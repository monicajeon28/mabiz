export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { enforceRBAC } from '@/app/api/_middleware/enforce-rbac';

// FREE_SALES 멤버 + affiliateCode 조회 결과 타입
type FreeSalesMemberRow = {
  id: string;
  displayName: string | null;
  phone: string | null;
  organizationId: string;
  affiliateCode: string | null;
};

export async function GET(req: NextRequest) {
  // ────────────────────────────────────────────────────────
  // RBAC: GLOBAL_ADMIN / OWNER 전용 엔드포인트
  // ────────────────────────────────────────────────────────
  const rbacCheck = enforceRBAC(req, {
    allowedRoles: ['GLOBAL_ADMIN', 'OWNER'],
    errorMessage: '권한이 없습니다.',
  });
  if (rbacCheck !== true) return rbacCheck;

  try {
    const ctx = await getAuthContext();

    if (ctx.role !== 'GLOBAL_ADMIN' && ctx.role !== 'OWNER') {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    // ── 날짜 파라미터 파싱 (없으면 이번달 기본값) ──────────────
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(yyyy, now.getMonth() + 1, 0).getDate();

    const fromStr = searchParams.get('from') ?? `${yyyy}-${mm}-01`;
    const toStr   = searchParams.get('to')   ?? `${yyyy}-${mm}-${lastDay}`;

    // ISO 날짜 → Date 객체 (to는 해당 날짜 끝 시각)
    const fromDate = new Date(`${fromStr}T00:00:00.000Z`);
    const toDate   = new Date(`${toStr}T23:59:59.999Z`);

    // 조직 ID 결정
    // GLOBAL_ADMIN은 ?orgId=xxx 쿼리 파라미터로 특정 조직 필터링 가능
    const paramOrgId = searchParams.get('orgId');
    const effectiveOrgId = ctx.role === 'GLOBAL_ADMIN'
      ? (paramOrgId ?? undefined)   // undefined = 전체 (필터 없음)
      : ctx.organizationId ?? undefined;

    // ── AGENT 역할 멤버 조회 ────────────────────────────────────
    const agentWhere = effectiveOrgId
      ? { organizationId: effectiveOrgId, isActive: true, role: 'AGENT' }
      : { isActive: true, role: 'AGENT' };

    const agents = await prisma.organizationMember.findMany({
      where: agentWhere,
      select: {
        id: true,
        userId: true,
        displayName: true,
        role: true,
        organizationId: true,
        organization: {
          select: {
            externalAffiliateProfileId: true,
          },
        },
      },
      orderBy: { displayName: 'asc' },
      take: 200,
    });

    // ── AGENT 리드 수 집계 (날짜 필터 적용) ─────────────────────
    // Contact.assignedUserId = OrganizationMember.id (cuid) 기준으로 저장됨
    const agentLeadCountMap = new Map<string, number>();
    if (agents.length > 0) {
      const memberIds = agents.map((a) => a.id);
      const leadCounts = await prisma.contact.groupBy({
        by: ['assignedUserId'],
        where: {
          assignedUserId: { in: memberIds },
          ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
          createdAt: { gte: fromDate, lte: toDate },
        },
        _count: { _all: true },
      });
      leadCounts.forEach((row) => {
        if (row.assignedUserId) {
          agentLeadCountMap.set(row.assignedUserId, row._count._all);
        }
      });
    }

    // ── AGENT 판매 집계 (완료된 판매만) ────────────────────────
    // AffiliateSale.affiliateUserId = OrganizationMember.userId 기준
    const salesMap = new Map<string, { count: number; salesCommission: number }>();
    if (agents.length > 0) {
      const userIds = agents.map((a) => a.userId);
      const salesGroups = await prisma.affiliateSale.groupBy({
        by: ['affiliateUserId'],
        where: {
          affiliateUserId: { in: userIds },
          status: { in: ['EARNED', 'PAID'] },
          ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
        },
        _count: { _all: true },
        _sum: { commissionAmount: true },
      });
      salesGroups.forEach((row) => {
        if (row.affiliateUserId) {
          salesMap.set(row.affiliateUserId, {
            count: row._count._all,
            salesCommission: row._sum.commissionAmount ?? 0,
          });
        }
      });
    }

    // ── AGENT 메트릭 조합 + 판매 수 기준 내림차순 정렬 ──────────
    const metrics = agents
      .map((agent) => {
        // 리드: OrganizationMember.id 기준, 판매: OrganizationMember.userId 기준
        const leadTotal = agentLeadCountMap.get(agent.id) ?? 0;
        const saleData  = salesMap.get(agent.userId);
        return {
          agent: {
            id: agent.id,
            affiliateCode: agent.userId,
            displayName: agent.displayName,
            status: agent.role,
          },
          leads: { total: leadTotal },
          sales: {
            count: saleData?.count ?? 0,
            salesCommission: saleData?.salesCommission ?? 0,
          },
        };
      })
      .sort((a, b) => b.sales.count - a.sales.count || b.leads.total - a.leads.total);

    // ── FREE_SALES 멤버 조회 ────────────────────────────────────
    // OrganizationMember.phone → User.affiliateCode 조회 (Raw SQL)
    // OWNER: 자기 org의 FREE_SALES만, GLOBAL_ADMIN: effectiveOrgId 지정시 필터, 미지정시 전체
    const fsOrgFilter = effectiveOrgId
      ? Prisma.sql`AND m."organizationId" = ${effectiveOrgId}`
      : Prisma.sql``;

    const freeSalesRows = await prisma.$queryRaw<FreeSalesMemberRow[]>(Prisma.sql`
      SELECT
        m.id,
        m."displayName",
        m.phone,
        m."organizationId",
        u."affiliateCode"
      FROM "OrganizationMember" m
      LEFT JOIN "User" u ON u.phone = m.phone AND u."isLocked" = false
      WHERE m."isActive" = true
        AND m.role = 'FREE_SALES'
        ${fsOrgFilter}
      ORDER BY m."displayName" ASC
      LIMIT 500
    `);

    // ── FREE_SALES affiliateCode 기준 리드·전환 집계 ───────────
    // affiliateCode가 null인 멤버는 0으로 처리
    const validAffiliateCodes = freeSalesRows
      .map((r) => r.affiliateCode)
      .filter((c): c is string => c != null && c.length > 0);

    // Contact.affiliateCode 기준 집계 (날짜 필터 적용)
    const fsContactGroups: Array<{ affiliateCode: string | null; type: string; _count: { _all: number } }> = [];
    if (validAffiliateCodes.length > 0) {
      const rawGroups = await prisma.contact.groupBy({
        by: ['affiliateCode', 'type'],
        where: {
          affiliateCode: { in: validAffiliateCodes },
          ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
          createdAt: { gte: fromDate, lte: toDate },
        },
        _count: { _all: true },
      });
      fsContactGroups.push(...rawGroups);
    }

    // affiliateCode → { leads, converted } 맵
    type FsStats = { leads: number; converted: number };
    const fsStatsMap = new Map<string, FsStats>();
    for (const row of fsContactGroups) {
      const code = row.affiliateCode;
      if (!code) continue;
      if (!fsStatsMap.has(code)) {
        fsStatsMap.set(code, { leads: 0, converted: 0 });
      }
      const entry = fsStatsMap.get(code)!;
      if (row.type === 'LEAD' || row.type === '잠재고객' || row.type === 'INQUIRY') {
        entry.leads += row._count._all;
      } else if (row.type === 'CUSTOMER' || row.type === '구매완료' || row.type === 'PURCHASED') {
        entry.converted += row._count._all;
      }
    }

    // ── FREE_SALES 결과 조합 ────────────────────────────────────
    const freeSales = freeSalesRows.map((member) => {
      const code  = member.affiliateCode ?? null;
      const stats = code ? (fsStatsMap.get(code) ?? { leads: 0, converted: 0 }) : { leads: 0, converted: 0 };
      const total      = stats.leads + stats.converted;
      const converted  = stats.converted;
      const convRate   = total > 0 ? Math.round((converted / total) * 1000) / 10 : 0;

      return {
        member: {
          id: member.id,
          displayName: member.displayName,
          affiliateCode: code,
        },
        leads: {
          total: stats.leads,
          converted,
        },
        conversionRate: convRate,
      };
    });

    logger.log('[team/agents] 판매원 리더보드 조회', {
      role: ctx.role,
      orgId: effectiveOrgId ?? 'global',
      agentCount: agents.length,
      freeSalesCount: freeSales.length,
      period: { from: fromStr, to: toStr },
    });

    return NextResponse.json({
      ok: true,
      metrics,
      freeSales,
      period: { from: fromStr, to: toStr },
    });
  } catch (e: unknown) {
    logger.error('[team/agents] 조회 실패', {
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
