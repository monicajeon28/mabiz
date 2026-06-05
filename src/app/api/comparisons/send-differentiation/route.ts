import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import {
  HOTEL_EXPERIENCE_LEVELS,
  L3_CORE_MESSAGE,
  L3_SMS_TEMPLATES,
  HotelExperienceLevel,
} from '@/lib/l3-competitor-data';
import { logger } from '@/lib/logger';
import { sendScheduledSms } from '@/lib/sms-service';

/**
 * POST /api/comparisons/send-differentiation
 * L3 렌즈: 고객의 호텔 경험도에 맞춘 차별성 메시지 발송
 *
 * Request body:
 * {
 *   contactId: string,
 *   hotelExperienceLevel: 'none'|'basic'|'frequent'|'regular',
 *   manualMessage?: string,  // override 메시지
 *   scheduleDay?: 0|1|2|3    // 자동 발송 day (기본값: 0)
 * }
 *
 * 응답:
 * {
 *   ok: true,
 *   smsScheduled: boolean,
 *   documentCreated?: true,
 *   differentiationScore: number
 * }
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    const body = await req.json() as {
      contactId?: string;
      hotelExperienceLevel?: HotelExperienceLevel;
      manualMessage?: string;
      scheduleDay?: 0 | 1 | 2 | 3;
    };

    if (!body.contactId) {
      return NextResponse.json({ ok: false, message: 'contactId 필수' }, { status: 400 });
    }

    const contact = await prisma.contact.findFirst({
      where: { id: body.contactId, organizationId: orgId },
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        hotelExperienceLevel: true,
        competitorMentioned: true,
      },
    });

    if (!contact) {
      return NextResponse.json({ ok: false, message: '고객을 찾을 수 없음' }, { status: 404 });
    }

    // hotelExperienceLevel 결정 (명시적 입력 > 기존 데이터 > 기본값)
    const experienceLevel: HotelExperienceLevel =
      body.hotelExperienceLevel || (contact.hotelExperienceLevel as HotelExperienceLevel) || 'frequent';

    const levelConfig = HOTEL_EXPERIENCE_LEVELS[experienceLevel];
    const scheduleDay = body.scheduleDay ?? 0;
    const templates = L3_SMS_TEMPLATES as Record<string, any>;
    const templateKey = `day${scheduleDay}_${Object.keys(templates).find((k) => k.startsWith(`day${scheduleDay}`))?.split('_').slice(1).join('_')}`;

    // 차별성 메시지 결정
    const message = body.manualMessage || levelConfig.message;

    // Contact 업데이트
    const differentiationScore =
      body.hotelExperienceLevel === 'regular'
        ? 40 // 호텔 전문가 = 더 높은 설득력 필요 = 점수 낮음
        : body.hotelExperienceLevel === 'frequent'
          ? 50
          : body.hotelExperienceLevel === 'basic'
            ? 65
            : 80; // 경험 없음 = 쉬운 설득

    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        hotelExperienceLevel: experienceLevel,
        preparationFrameworkLevel: 'understanding',
        differentiationScore: differentiationScore,
        differentiationResponseSent: true,
        lastDifferentiationResponseAt: new Date(),
        differentiationSequenceStartedAt: contact.competitorMentioned ? undefined : new Date(),
        tags: {
          push: 'l3_differentiation_sent',
        },
      },
    });

    // SMS 발송
    await sendScheduledSms({
      organizationId: orgId,
      contactId: contact.id,
      phoneNumber: contact.phone,
      body: message,
      sendAt:
        scheduleDay === 0
          ? new Date(Date.now() + 30 * 60 * 1000) // 30분 후
          : new Date(Date.now() + scheduleDay * 24 * 60 * 60 * 1000), // scheduleDay일 후
      campaignType: 'L3_DIFFERENTIATION',
      day: scheduleDay,
    });

    // 추가 Day 1-3 자동 스케줄링 (Day 0 발송 시에만)
    if (scheduleDay === 0) {
      const day1Template = L3_SMS_TEMPLATES.day1_structure_comparison;
      const day1Body = day1Template.body
        .replace('{name}', contact.name || '님')
        .replace('{name}', contact.name || '님');

      await sendScheduledSms({
        organizationId: orgId,
        contactId: contact.id,
        phoneNumber: contact.phone,
        body: day1Body,
        sendAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1일 후
        campaignType: 'L3_DIFFERENTIATION',
        day: 1,
      });

      // Day 2-3도 동일하게 스케줄
      const day2Template = L3_SMS_TEMPLATES.day2_lifestyle_promise;
      const day2Body = day2Template.body
        .replace('{name}', contact.name || '님')
        .replace('{adults}', '2')
        .replace('{kids}', '0')
        .replace('{discount}', '20');

      await sendScheduledSms({
        organizationId: orgId,
        contactId: contact.id,
        phoneNumber: contact.phone,
        body: day2Body,
        sendAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2일 후
        campaignType: 'L3_DIFFERENTIATION',
        day: 2,
      });

      const day3Template = L3_SMS_TEMPLATES.day3_final_comparison;
      const day3Body = day3Template.body
        .replace('{name}', contact.name || '님');

      await sendScheduledSms({
        organizationId: orgId,
        contactId: contact.id,
        phoneNumber: contact.phone,
        body: day3Body,
        sendAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3일 후
        campaignType: 'L3_DIFFERENTIATION',
        day: 3,
      });
    }

    logger.log('[L3SendDifferentiation] 메시지 발송', {
      orgId,
      contactId: contact.id,
      experienceLevel,
      scheduleDay,
      differentiationScore,
    });

    return NextResponse.json({
      ok: true,
      smsScheduled: true,
      differentiationScore,
      experienceLevel,
      coreMessage: L3_CORE_MESSAGE,
    });
  } catch (e) {
    logger.error('[L3SendDifferentiation] 오류', {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ ok: false, message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
