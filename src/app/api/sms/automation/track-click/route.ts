import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimitAsync } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';

interface ClickEvent {
  messageId: string;
  timestamp?: string; // ISO 8601 format
  // contactId는 body에서 받지 않음 — message.contactId만 사용 (외부 주입 차단)
}

/**
 * SMS 링크 클릭 추적 API
 *
 * 사용법:
 * POST /api/sms/automation/track-click
 * {
 *   "messageId": "msg_123",
 *   "contactId": "contact_456",
 *   "timestamp": "2026-05-26T14:30:00Z"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // IP 기반 레이트 리밋: 분당 30회 제한
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rl = await checkRateLimitAsync(`sms_track_click:${ip}`, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
    }

    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    const event: ClickEvent = await request.json();
    const { messageId, timestamp } = event;

    if (!messageId) {
      return NextResponse.json(
        { error: 'Missing required field: messageId' },
        { status: 400 }
      );
    }

    const now = new Date();
    const clickTime = timestamp ? new Date(timestamp) : now;

    // timestamp 검증: 파싱 불가 또는 60초 초과 미래 날짜 거부
    if (timestamp && (isNaN(clickTime.getTime()) || clickTime > new Date(Date.now() + 60_000))) {
      return NextResponse.json({ error: 'Invalid timestamp' }, { status: 400 });
    }

    // 메시지 존재 여부 사전 확인 (IDOR 방지: update 전 조직 소속 검증)
    const existing = await prisma.crmMarketingMessage.findUnique({
      where: { id: messageId },
      select: { organizationId: true, contactId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // 조직 격리 검증: GLOBAL_ADMIN 제외, 타 조직 메시지 접근 차단
    if (ctx.role !== 'GLOBAL_ADMIN' && existing.organizationId !== orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 메시지 조회 및 업데이트
    const message = await prisma.crmMarketingMessage.update({
      where: { id: messageId },
      data: {
        status: 'clicked',
        clickCount: {
          increment: 1
        },
        lastClickTime: clickTime,
        metadata: {
          // 기존 metadata 유지
          trackedAt: clickTime.toISOString(),
          source: 'sms_link_click'
        }
      }
    });

    // 실제 클릭 시간 계산 (발송 후 경과 시간)
    const responseTimeMs = clickTime.getTime() - (message.sentTime?.getTime() || message.scheduledTime.getTime());
    const responseTimeMinutes = Math.round(responseTimeMs / 60000); // 분 단위

    // 응답 시간 기록 (필요시)
    if (responseTimeMinutes > 0) {
      await prisma.crmMarketingMessage.update({
        where: { id: messageId },
        data: {
          actualResponseTime: responseTimeMinutes
        }
      });
    }

    // 선택사항: 클릭한 고객의 리드 점수 증가 (message.contactId만 사용 — body 주입 차단)
    if (message.contactId) {
      await prisma.contact.update({
        where: { id: message.contactId },
        data: {
          leadScore: {
            increment: 10 // 클릭당 +10점
          }
        }
      });
    }

    return NextResponse.json({
      status: 'tracked',
      messageId,
      clickCount: message.clickCount,
      responseTimeMinutes,
      trackedAt: clickTime.toISOString()
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    logger.error('[POST /api/sms/automation/track-click]', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
