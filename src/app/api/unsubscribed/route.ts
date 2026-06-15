import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';

/**
 * GET /api/unsubscribed
 * 수신거부 목록 조회 (RBAC: AGENT 이상)
 *
 * Query Params:
 * - page: number (기본값: 1)
 * - limit: number (기본값: 20)
 * - search: string (선택, 전화번호 검색)
 *
 * 응답:
 * {
 *   ok: true,
 *   items: [
 *     { id, phone, name, createdAt, createdBy },
 *     ...
 *   ],
 *   total: number,
 *   page: number,
 *   limit: number,
 *   pages: number,
 *   organizationName: string
 * }
 */
export async function GET(req: NextRequest) {
  try {
    // 1. 인증 확인
    const session = await getMabizSession();
    if (!session?.organizationId) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. 권한 확인 (AGENT 이상: AGENT, OWNER, GLOBAL_ADMIN)
    const allowedRoles = ['AGENT', 'OWNER', 'GLOBAL_ADMIN'];
    if (!allowedRoles.includes(session.role)) {
      // 감사 로깅: 권한 없음 시도
      logger.warn('[UnsubscribedList] 권한 없음', {
        userId: session.userId,
        userRole: session.role,
        organizationId: session.organizationId,
      });
      return NextResponse.json(
        { ok: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 3. 페이지네이션 파라미터
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') || '20')));
    const search = (req.nextUrl.searchParams.get('search') || '').trim();

    const skip = (page - 1) * limit;

    // 4. 조직 ID 결정
    let organizationId = session.organizationId || '';
    if (!organizationId && session.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, error: 'Organization not found' },
        { status: 400 }
      );
    }

    // GLOBAL_ADMIN인 경우 쿼리 파라미터의 organizationId를 사용할 수 있음 (선택사항)
    if (session.role === 'GLOBAL_ADMIN') {
      const paramOrgId = req.nextUrl.searchParams.get('organizationId');
      if (paramOrgId) {
        organizationId = paramOrgId;
      }
    }

    // 5. 검색 조건 (전화번호)
    const searchFilter = search
      ? {
          organizationId,
          phone: {
            contains: search.replace(/-/g, '').replace(/\s/g, ''),
          },
        }
      : { organizationId };

    // 6. 병렬 조회 (항목 + 총 개수)
    const [items, total] = await Promise.all([
      prisma.unsubscribed.findMany({
        where: searchFilter,
        select: {
          id: true,
          phone: true,
          name: true,
          createdAt: true,
          createdBy: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.unsubscribed.count({
        where: searchFilter,
      }),
    ]);

    // 7. 전화번호 마스킹 (보안)
    const maskedItems = items.map(item => ({
      ...item,
      phone: maskPhone(item.phone),
    }));

    // 8. 조직명 조회 (선택)
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });

    // 9. 감사 로깅
    logger.info('[UnsubscribedList] 목록 조회', {
      organizationId,
      userId: session.userId,
      role: session.role,
      resultCount: items.length,
      total,
      page,
      limit,
    });

    // 10. 응답
    return NextResponse.json({
      ok: true,
      items: maskedItems,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      organizationName: organization?.name || '알수없음',
    });
  } catch (error) {
    logger.error('[UnsubscribedList] 에러:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : '조회 실패',
      },
      { status: 500 }
    );
  }
}

/**
 * 전화번호 마스킹 (보안)
 * 010-1234-5678 → 010-****-5678
 * 01012345678 → 010****5678
 */
function maskPhone(phone: string): string {
  if (!phone || phone.length < 8) return phone;
  if (phone.includes('-')) {
    const parts = phone.split('-');
    if (parts.length === 3) {
      return `${parts[0]}-****-${parts[2]}`;
    }
  }
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}
