export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/campaigns/sending-history
 * 캠페인 발송 이력 조회
 *
 * @query status - 필터링 상태 (SENT|FAILED|PENDING|RETRY_SCHEDULED|ABANDONED|SKIPPED)
 * @query limit - 페이지당 레코드 수 (기본값: 20)
 * @query offset - 오프셋 (기본값: 0)
 * @returns { ok: boolean, histories: SendingHistory[], total: number }
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 1. 쿼리 파라미터 파싱
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const url = new URL(req.url);
    const status = url.searchParams.get('status')?.toUpperCase();
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);

    // 유효한 상태값 검증
    const validStatuses = ['SENT', 'FAILED', 'PENDING', 'RETRY_SCHEDULED', 'ABANDONED', 'SKIPPED'];
    const filterStatus = status && validStatuses.includes(status) ? status : null;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 2. 발송 이력 조회 (최신순, 관계 포함)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const where = {
      organizationId: orgId,
      ...(filterStatus && { status: filterStatus }),
    };

    const [histories, total] = await Promise.all([
      prisma.sendingHistory.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
          campaign: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.sendingHistory.count({ where }),
    ]);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 3. 응답 직렬화
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const serialized = histories.map((h) => ({
      id: h.id,
      contact: h.contact,
      campaign: h.campaign,
      channel: h.channel,
      status: h.status,
      sentAt: h.sentAt,
      failureReason: h.failureReason,
      failureUserMsg: h.failureUserMsg,
      retryCount: h.retryCount,
      maxRetries: h.maxRetries,
      createdAt: h.createdAt,
    }));

    logger.log('[GET /api/campaigns/sending-history]', {
      orgId,
      filter: filterStatus,
      limit,
      offset,
      total,
      returned: histories.length,
    });

    return NextResponse.json({
      ok: true,
      histories: serialized,
      total,
      limit,
      offset,
    });
  } catch (err) {
    logger.error('[GET /api/campaigns/sending-history]', { err });
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다.', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
