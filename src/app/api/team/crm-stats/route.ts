import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { getCache, setCache } from '@/lib/redis';
import { enforceRBAC } from '@/app/api/_middleware/enforce-rbac';

export async function GET(req: NextRequest) {
  // ────────────────────────────────────────────────────────
  // RBAC: FREE_SALES 제외 (GLOBAL_ADMIN, OWNER, AGENT)
  // ────────────────────────────────────────────────────────
  const rbacCheck = enforceRBAC(req, {
    allowedRoles: ['GLOBAL_ADMIN', 'OWNER', 'AGENT'],
    errorMessage: '권한이 없습니다.',
  });
  if (rbacCheck !== true) return rbacCheck;

  try {
    const ctx = await getAuthContext();
    // FREE_SALES 이중 체크 제거 — enforceRBAC에서 이미 차단됨 (allowedRoles: GLOBAL_ADMIN/OWNER/AGENT)

    // ── query param 파싱 ──────────────────────────────────────
    const paramOrgId = req.nextUrl.searchParams.get('orgId') ?? undefined;

    // ── 조직 목록 조회 (GLOBAL_ADMIN만) ──────────────────────
    const orgs =
      ctx.role === 'GLOBAL_ADMIN'
        ? await prisma.organization.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
          })
        : null;

    // ── 집계에 사용할 실제 orgId 결정 ──────────────────────────
    // GLOBAL_ADMIN + orgId 없음 → undefined (전체 집계, where 필터 없음)
    // GLOBAL_ADMIN + orgId 있음 → 지정된 orgId
    // OWNER/AGENT          → 자기 조직 ID
    let effectiveOrgId: string | undefined;
    if (ctx.role === 'GLOBAL_ADMIN') {
      effectiveOrgId = paramOrgId; // 없으면 undefined → 전체 모드
    } else {
      effectiveOrgId = requireOrgId(ctx);
    }

    // ── 전체 모드(GLOBAL_ADMIN + orgId 없음) 여부 ────────────
    const isGlobalAll = ctx.role === 'GLOBAL_ADMIN' && !effectiveOrgId;

    // ── 캐시 키 (role 포함 — 역할별 데이터 격리) ──────────────
    // AGENT는 userId별 격리 — 같은 조직 내 다른 AGENT 간 캐시 공유 방지
    const cacheKey = ctx.role === 'AGENT'
      ? `crm-stats:AGENT:${ctx.userId}:v2`
      : `crm-stats:${ctx.role}:${effectiveOrgId ?? 'all'}:v2`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT' },
      });
    }

    // ── KST 기준 이번 달 범위 계산 ───────────────────────────
    const kstOffset = 9 * 60 * 60 * 1000;
    const now = new Date(Date.now() + kstOffset);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - kstOffset);

    // ── organizationId 필터 (전체 모드에서는 필터 없음) ───────
    // deletedAt: null 포함 — 소프트 삭제된 Contact가 통계에서 제외됨
    const orgFilter = effectiveOrgId
      ? { organizationId: effectiveOrgId, deletedAt: null as null }
      : { deletedAt: null as null };

    // ── AGENT 역할: 자신에게 할당된 Contact만 카운트 (다른 대리점장 고객 노출 방지) ──
    const agentFilter = ctx.role === 'AGENT' ? { assignedUserId: ctx.userId } : {};

    // ── 7-way Promise.all: members + 6개 count() 쿼리 병합 ──
    const [members, totalContacts, totalLeads, totalCustomers, monthLeads, monthCustomers, optOutCount] =
      await Promise.all([
        // 전체 모드 또는 AGENT 역할에서는 멤버 배열 반환 안 함
        // — 전체 모드: 멤버가 너무 많음 / AGENT: 동료 대리점장 정보 노출 방지
        (isGlobalAll || ctx.role === 'AGENT')
          ? Promise.resolve([])
          : (() => {
              if (!effectiveOrgId) {
                // isGlobalAll=true인 경우는 위에서 이미 Promise.resolve([]) 처리됨
                // 여기 도달하면 로직 오류 — 방어적으로 처리
                logger.error('[TeamCrmStats] effectiveOrgId undefined 비-GlobalAll 경로', { role: ctx.role });
                throw new Error('ORGANIZATION_REQUIRED');
              }
              return prisma.organizationMember.findMany({
                where: { organizationId: effectiveOrgId, isActive: true },
                select: { userId: true, displayName: true, role: true },
              });
            })(),
        prisma.contact.count({ where: { ...orgFilter, ...agentFilter } }),
        prisma.contact.count({ where: { ...orgFilter, ...agentFilter, type: { in: ['LEAD', '잠재고객', 'INQUIRY'] } } }),
        prisma.contact.count({ where: { ...orgFilter, ...agentFilter, type: { in: ['CUSTOMER', '구매완료', 'PURCHASED'] } } }),
        prisma.contact.count({
          where: { ...orgFilter, ...agentFilter, type: { in: ['LEAD', '잠재고객', 'INQUIRY'] }, createdAt: { gte: monthStart } },
        }),
        prisma.contact.count({
          where: { ...orgFilter, ...agentFilter, purchasedAt: { gte: monthStart } },
        }),
        prisma.contact.count({
          where: { ...orgFilter, ...agentFilter, optOutAt: { not: null } },
        }),
      ]);

    const conversionRate =
      totalLeads > 0 ? Math.round((totalCustomers / totalLeads) * 100 * 10) / 10 : 0;

    logger.log('[TeamCrmStats]', {
      role: ctx.role,
      effectiveOrgId: effectiveOrgId ?? 'ALL',
      totalContacts,
      optOutCount,
    });

    const responseData = {
      ok: true,
      // role 필드 제거 — 클라이언트는 세션에서 role을 가져와야 함
      // GLOBAL_ADMIN에게만 조직 목록 제공 (OWNER는 null)
      ...(orgs !== null && { orgs }),
      members,
      summary: {
        totalContacts,
        totalLeads,
        totalCustomers,
        monthLeads,
        monthCustomers,
        conversionRate,
        optOutCount,
      },
    };

    // 캐시 저장 (2분 TTL)
    await setCache(cacheKey, responseData, 120);

    return NextResponse.json(responseData);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error('[TeamCrmStats]', { error: msg });

    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, message: '인증이 필요합니다' }, { status: 401 });
    }
    if (msg === 'ORGANIZATION_REQUIRED') {
      return NextResponse.json({ ok: false, message: '조직 정보가 없습니다' }, { status: 403 });
    }

    return NextResponse.json({ ok: false, message: '조회 중 오류 발생' }, { status: 500 });
  }
}
