import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface ClickEvent {
  messageId: string;
  contactId?: string;
  timestamp?: string; // ISO 8601 format
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
    const event: ClickEvent = await request.json();
    const { messageId, contactId, timestamp } = event;

    if (!messageId) {
      return NextResponse.json(
        { error: 'Missing required field: messageId' },
        { status: 400 }
      );
    }

    const now = new Date();
    const clickTime = timestamp ? new Date(timestamp) : now;

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

    // 선택사항: 클릭한 고객의 리드 점수 증가
    if (contactId || message.contactId) {
      const cId = contactId || message.contactId;
      await prisma.contact.update({
        where: { id: cId },
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
    console.error('Error in track-click:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
