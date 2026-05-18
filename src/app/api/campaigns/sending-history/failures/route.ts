export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface FailureRecord {
  id: string;
  contact: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  channel: string;
  status: string;
  failureReason?: string;
  failureUserMsg?: string;
  sentAt?: string;
  nextRetryAt?: string;
  retryCount: number;
  maxRetries: number;
}

interface FailuresResponse {
  ok: boolean;
  failures?: FailureRecord[];
  total?: number;
  limit?: number;
  offset?: number;
  error?: string;
}

/**
 * GET /api/campaigns/sending-history/failures
 * 실패 목록 조회 API
 *
 * @query campaignId - 캠페인 ID (필수)
 * @query status - 상태 (FAILED|ABANDONED, 기본값: FAILED)
 * @query limit - 페이지당 레코드 수 (기본값: 50)
 * @query offset - 오프셋 (기본값: 0)
 * @returns { ok: boolean, failures: [...], total: number }
 */
export async function GET(req: Request): Promise<NextResponse<FailuresResponse>> {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 1. 쿼리 파라미터 파싱
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const url = new URL(req.url);
    const campaignId = url.searchParams.get('campaignId');
    const statusFilter = url.searchParams.get('status') || 'FAILED';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);

    if (!campaignId) {
      return NextResponse.json(
        { ok: false, error: 'campaignId is required' },
        { status: 400 }
      );
    }

    // 유효한 상태값 검증
    const validStatuses = ['FAILED', 'ABANDONED'];
    if (!validStatuses.includes(statusFilter)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid status. Use FAILED or ABANDONED' },
        { status: 400 }
      );
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 2. 실패 목록 조회
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const where = {
      organizationId: orgId,
      campaignId,
      status: statusFilter,
    };

    const [failures, total] = await Promise.all([
      prisma.sendingHistory.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: { sentAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.sendingHistory.count({ where }),
    ]);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 3. 응답 직렬화
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const serialized = failures.map((f) => ({
      id: f.id,
      contact: {
        id: f.contact.id,
        name: f.contact.name,
        email: f.contact.email,
        phone: f.contact.phone,
      },
      channel: f.channel,
      status: f.status,
      failureReason: f.failureReason,
      failureUserMsg: f.failureUserMsg,
      sentAt: f.sentAt?.toISOString(),
      nextRetryAt: f.nextRetryAt?.toISOString(),
      retryCount: f.retryCount,
      maxRetries: f.maxRetries,
    }));

    logger.log('[GET /api/campaigns/sending-history/failures]', {
      orgId,
      campaignId,
      status: statusFilter,
      limit,
      offset,
      total,
      returned: failures.length,
    });

    return NextResponse.json({
      ok: true,
      failures: serialized,
      total,
      limit,
      offset,
    });
  } catch (err) {
    logger.error('[GET /api/campaigns/sending-history/failures]', { err });
    return NextResponse.json(
      {
        ok: false,
        error: '서버 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
