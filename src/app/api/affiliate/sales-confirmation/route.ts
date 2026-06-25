export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getSession } from '@/lib/auth';
import { checkRateLimitAsync } from '@/lib/rate-limit';

function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  if (phone.length <= 4) return phone;
  const mid = Math.floor(phone.length / 2);
  return phone.slice(0, mid - 2) + '****' + phone.slice(mid + 2);
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }
    if (!session.organizationId && session.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, error: '조직 정보가 없습니다.' },
        { status: 401 }
      );
    }

    // OWNER·GLOBAL_ADMIN만 판매 승인 대기 목록 조회 허용
    if (session.role !== 'OWNER' && session.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // T-005: GET rate limiting — 30초당 30회 제한
    const rlGet = await checkRateLimitAsync(
      `sales-confirm:get:${session.userId}`,
      30,
      30_000
    );
    if (!rlGet.allowed) {
      return NextResponse.json(
        { ok: false, error: '요청이 너무 많습니다.' },
        { status: 429 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const rawSearch = searchParams.get('search') ?? '';
    const search = rawSearch.slice(0, 200) || null;

    // T-005: status 파라미터 enum 검증 — Prisma WHERE에 임의 문자열 직접 전달 방지
    const ALLOWED_SALE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'EARNED', 'PAID'] as const;
    type AllowedSaleStatus = typeof ALLOWED_SALE_STATUSES[number];
    const rawStatus = searchParams.get('status');
    const status = rawStatus && rawStatus !== 'ALL' && (ALLOWED_SALE_STATUSES as readonly string[]).includes(rawStatus)
      ? rawStatus as AllowedSaleStatus
      : undefined;

    const offset = (page - 1) * limit;

    const orgFilter = session.role === 'GLOBAL_ADMIN'
      ? {}
      : { organizationId: session.organizationId! };
    const where: Prisma.AffiliateSaleWhereInput = {
      ...orgFilter,
      ...(status ? { status } : {}),
      ...(search ? {
        OR: [
          { productName: { contains: search, mode: 'insensitive' } },
          { customerPhone: { contains: search, mode: 'insensitive' } },
          { affiliateCode: { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.affiliateSale.findMany({
        where,
        select: {
          id: true,
          organizationId: true,
          affiliateCode: true,
          affiliateUserId: true,
          productName: true,
          saleAmount: true,
          commissionAmount: true,
          status: true,
          customerPhone: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.affiliateSale.count({ where }),
    ]);

    // affiliateUserId(OrganizationMember.userId)로 표시명 일괄 조회 (UUID 노출 방지)
    const userIds = [...new Set(data.map((d) => d.affiliateUserId).filter(Boolean))] as string[];
    // GLOBAL_ADMIN 전체 조회 시 동일 userId가 다른 조직에 존재할 수 있으므로
    // 현재 데이터셋의 organizationId 목록으로 범위를 제한하여 표시명 충돌 방지.
    // Map 키: `userId:organizationId` 복합키 사용.
    const orgIds = [...new Set(data.map((d) => d.organizationId).filter(Boolean))] as string[];
    const members = userIds.length > 0
      ? await prisma.organizationMember.findMany({
          where: {
            userId: { in: userIds },
            ...(orgIds.length > 0 ? { organizationId: { in: orgIds } } : {}),
          },
          select: { userId: true, organizationId: true, displayName: true },
        })
      : [];
    // 복합키 Map으로 조직별 표시명 충돌 방지
    const userOrgMap = new Map(members.map((m) => [`${m.userId}:${m.organizationId}`, m.displayName]));
    // 단순 userId → displayName fallback (GLOBAL_ADMIN 단일조직 환경 호환)
    const userMap = new Map(members.map((m) => [m.userId, m.displayName]));

    const shouldMask = session.role !== 'GLOBAL_ADMIN';

    return NextResponse.json({
      ok: true,
      data: data.map((d) => {
        // T-022: affiliateUserId 응답에서 제외 — OWNER가 다른 조직 대리점장 UUID를 추론하는 데 악용 방지
         
        const { affiliateUserId, ...rest } = d;
        return {
          ...rest,
          // T-016: OWNER 대상 고객 전화번호 마스킹
          customerPhone: shouldMask ? maskPhone(d.customerPhone) : d.customerPhone,
          // 복합키(userId:orgId)로 먼저 조회, fallback은 단순 userId — agentDisplayName만 노출
          agentDisplayName: affiliateUserId
            ? (userOrgMap.get(`${affiliateUserId}:${d.organizationId}`) ?? userMap.get(affiliateUserId) ?? null)
            : null,
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    logger.error('[sales-confirmation GET] 오류', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
