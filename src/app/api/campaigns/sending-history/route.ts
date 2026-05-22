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
    // 2. 발송 이력 조회 (최신순)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const where: any = {
      organizationId: orgId,
      ...(filterStatus && { status: filterStatus }),
    };

    const [histories, total] = await Promise.all([
      prisma.sendingHistory.findMany({
        where,
        select: {
          id: true,
          contactId: true,
          campaignId: true,
          channel: true,
          status: true,
          sentAt: true,
          failureReason: true,
          failureUserMsg: true,
          retryCount: true,
          maxRetries: true,
          createdAt: true,
          phone: true,
          email: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.sendingHistory.count({ where }),
    ]);

    // Contact와 Campaign 정보 조회 (필요한 경우)
    const contactIds = Array.from(new Set(histories.map((h) => h.contactId).filter((id): id is string => !!id)));
    const campaignIds = Array.from(new Set(histories.map((h) => h.campaignId).filter((id): id is string => !!id)));

    const [contacts, campaigns] = await Promise.all([
      contactIds.length > 0
        ? prisma.contact.findMany({
            where: { id: { in: contactIds } },
            select: { id: true, name: true, phone: true, email: true },
          })
        : Promise.resolve([]),
      campaignIds.length > 0
        ? prisma.crmMarketingCampaign.findMany({
            where: { id: { in: campaignIds } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
    ]);

    const contactMap = new Map(contacts.map((c) => [c.id, c]));
    const campaignMap = new Map(campaigns.map((c) => [c.id, c]));

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 3. 응답 직렬화
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const serialized = histories.map((h) => ({
      id: h.id,
      contactId: h.contactId,
      contact: h.contactId ? contactMap.get(h.contactId) : null,
      campaignId: h.campaignId,
      campaign: h.campaignId ? campaignMap.get(h.campaignId) : null,
      channel: h.channel,
      status: h.status,
      sentAt: h.sentAt?.toISOString(),
      failureReason: h.failureReason,
      failureUserMsg: h.failureUserMsg,
      retryCount: h.retryCount,
      maxRetries: h.maxRetries,
      createdAt: h.createdAt?.toISOString(),
      phone: h.phone,
      email: h.email,
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
