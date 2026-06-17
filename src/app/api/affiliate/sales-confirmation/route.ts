export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getSession } from '@/lib/auth';

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

    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const offset = (page - 1) * limit;

    const orgFilter = session.role === 'GLOBAL_ADMIN'
      ? {}
      : { organizationId: session.organizationId! };
    const where: Prisma.AffiliateSaleWhereInput = {
      ...orgFilter,
      ...(status && status !== 'ALL' ? { status } : {}),
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

    return NextResponse.json({
      ok: true,
      data: data.map((d) => ({
        ...d,
        // 복합키(userId:orgId)로 먼저 조회, fallback은 단순 userId
        agentDisplayName: d.affiliateUserId
          ? (userOrgMap.get(`${d.affiliateUserId}:${d.organizationId}`) ?? userMap.get(d.affiliateUserId) ?? null)
          : null,
      })),
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
