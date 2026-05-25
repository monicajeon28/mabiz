import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { COMPETITOR_MENTION_KEYWORDS, COMPETITORS, L3_SMS_TEMPLATES } from '@/lib/l3-competitor-data';
import { logger } from '@/lib/logger';
import { sendScheduledSms } from '@/lib/sms-service';

/**
 * POST /api/comparisons/detect-mention
 * L3 렌즈: 고객 메모/콜로그에서 경쟁사 언급 감지 + SMS 자동 발송
 *
 * Request body:
 * {
 *   contactId: string,
 *   text: string,           // 고객이 언급한 텍스트 (메모, 콜로그, 문의 등)
 *   sourceType: 'memo'|'calllog'|'inquiry'
 * }
 *
 * 응답:
 * {
 *   ok: true,
 *   detected: boolean,
 *   competitor?: string,
 *   action?: 'sms_scheduled',
 *   riskFlags?: string[]
 * }
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    const body = await req.json() as {
      contactId?: string;
      text: string;
      sourceType?: 'memo' | 'calllog' | 'inquiry';
    };

    if (!body.contactId || !body.text) {
      return NextResponse.json(
        { ok: false, message: 'contactId, text 필수' },
        { status: 400 }
      );
    }

    const contact = await prisma.contact.findFirst({
      where: { id: body.contactId, organizationId: orgId },
      select: { id: true, phone: true, name: true, competitorMentioned: true },
    });

    if (!contact) {
      return NextResponse.json(
        { ok: false, message: '고객을 찾을 수 없음' },
        { status: 404 }
      );
    }

    // 경쟁사 언급 감지
    const detectedCompetitor = detectCompetitorMention(body.text);
    const riskFlags: string[] = [];

    if (detectedCompetitor) {
      // Contact 업데이트: 경쟁사 언급 기록
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          competitorMentioned: true,
          lastCompetitorMentionAt: new Date(),
          lastCompetitorName: detectedCompetitor,
          competitorNames: {
            push: detectedCompetitor,
          },
          tags: {
            push: `l3_competitor_${detectedCompetitor.toLowerCase()}`,
          },
        },
      });

      // Risk Flag 감지
      if (body.text.includes('이미') || body.text.includes('예약')) {
        riskFlags.push('competitor_booking_imminent');
      }

      if ((body.text.match(/뭐가 달라|뭐가 다른/g) || []).length >= 2) {
        riskFlags.push('hotel_frame_locked');
      }

      // Day 0 SMS 자동 발송 (화살표: 24시간 내)
      const smsTemplate = L3_SMS_TEMPLATES.day0_competitor_mention;
      const smsBody = smsTemplate.body
        .replace('{name}', contact.name || '님')
        .replace('{competitor}', detectedCompetitor);

      await sendScheduledSms({
        organizationId: orgId,
        contactId: contact.id,
        phoneNumber: contact.phone,
        body: smsBody,
        sendAt: new Date(Date.now() + 30 * 60 * 1000), // 30분 후
        campaignType: 'L3_DIFFERENTIATION',
        day: 0,
      });

      logger.log('[L3DetectMention] 경쟁사 감지 및 SMS 발송', {
        orgId,
        contactId: contact.id,
        competitor: detectedCompetitor,
        sourceType: body.sourceType || 'unknown',
        riskFlags,
      });

      return NextResponse.json({
        ok: true,
        detected: true,
        competitor: detectedCompetitor,
        action: 'sms_scheduled',
        riskFlags: riskFlags.length > 0 ? riskFlags : undefined,
      });
    }

    return NextResponse.json({
      ok: true,
      detected: false,
    });
  } catch (e) {
    logger.error('[L3DetectMention] 오류', {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ ok: false, message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * 텍스트에서 경쟁사 언급 감지
 */
function detectCompetitorMention(text: string): string | null {
  const lowerText = text.toLowerCase();

  for (const [competitor, keywords] of Object.entries(COMPETITOR_MENTION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        const competitorData = COMPETITORS[competitor as keyof typeof COMPETITORS];
        return competitorData.name;
      }
    }
  }

  return null;
}
