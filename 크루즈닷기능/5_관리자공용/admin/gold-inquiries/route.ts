export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';
import { getAffiliateRoleFilter } from '@/lib/affiliate-filters';

const GOLD_PRODUCT_CODE = 'GOLD_MEMBERSHIP';
const VALID_STATUSES = ['pending', 'contacted', 'converted'];

function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(parseInt(searchParams.get('page') ?? '1', 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 1), 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/**
 * GET /api/admin/gold-inquiries
 * productCode='GOLD_MEMBERSHIP'인 ProductInquiry 목록 조회
 * - admin/superadmin: 전체
 * - BRANCH_MANAGER: managerId 일치만
 * - SALES_AGENT: agentId 일치만
 */
export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const roleFilter = await getAffiliateRoleFilter(sessionUser.id);
    if (!roleFilter) {
      return NextResponse.json({ ok: false, message: '접근 권한이 없습니다.' }, { status: 403 });
    }
    const { managerFilter, agentFilter, subAgentIds } = roleFilter;

    const { searchParams } = new URL(req.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const statusParam = searchParams.get('status') || null;

    // status 파라미터 유효성 검사
    if (statusParam && !VALID_STATUSES.includes(statusParam)) {
      return NextResponse.json(
        { ok: false, message: `status는 ${VALID_STATUSES.join(', ')} 중 하나여야 합니다.` },
        { status: 400 }
      );
    }

    // WHERE 조건
    const whereConditions: Prisma.ProductInquiryWhereInput[] = [
      { productCode: GOLD_PRODUCT_CODE },
    ];

    if (statusParam) whereConditions.push({ status: statusParam });
    if (managerFilter !== undefined) {
      // BRANCH_MANAGER: 본인 managerId OR 소속 에이전트 agentId (gold-members와 동일)
      if (subAgentIds.length > 0) {
        whereConditions.push({ OR: [{ managerId: managerFilter }, { agentId: { in: subAgentIds } }] });
      } else {
        whereConditions.push({ managerId: managerFilter });
      }
    }
    if (agentFilter !== undefined) whereConditions.push({ agentId: agentFilter });

    const where: Prisma.ProductInquiryWhereInput = { AND: whereConditions };

    const [inquiries, total] = await Promise.all([
      prisma.productInquiry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          productCode: true,
          userId: true,
          name: true,
          phone: true,
          // passportNumber은 PII — 응답에 포함하지 않음 (boolean만)
          passportNumber: true,
          message: true,
          status: true,
          managerId: true,
          agentId: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              InquiryCallLog: true,
            },
          },
        },
      }),
      prisma.productInquiry.count({ where }),
    ]);

    // passportNumber를 boolean으로 변환하고 원본 제거
    const formattedInquiries = inquiries.map(({ passportNumber, ...rest }) => ({
      ...rest,
      hasPassportNumber: !!passportNumber,
      callLogCount: rest._count.InquiryCallLog,
    }));

    return NextResponse.json({
      ok: true,
      inquiries: formattedInquiries,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    logger.error('[admin/gold-inquiries][GET] 조회 실패', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ ok: false, message: '골드 문의 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}
