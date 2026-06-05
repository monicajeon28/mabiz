import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import {
  SMS_DAY0_3_SCHEDULE,
  assignAbTestVariant,
  getTemplateId,
  calculateScheduledTime
} from '@/lib/automation/sms-day0-3';
import {
  getTemplateBySegmentAndDay,
  interpolateTemplate
} from '@/lib/automation/sms-templates-loader';

interface CallCompletedEvent {
  contactId: string;
  organizationId: string;
  segment: 'newlywed' | 'family' | 'couple';
  callTime: string; // ISO 8601 format
  firstName?: string; // 선택사항: 메시지 변수 치환용
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    const event: CallCompletedEvent = await request.json();
    const { contactId, organizationId, segment, callTime, firstName } = event;

    // 조직 소속 검증
    if (event.organizationId !== orgId) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    // 입력값 검증
    if (!contactId || !organizationId || !segment || !callTime) {
      return NextResponse.json(
        { error: 'Missing required fields: contactId, organizationId, segment, callTime' },
        { status: 400 }
      );
    }

    const callTimeDate = new Date(callTime);
    if (isNaN(callTimeDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid callTime format. Use ISO 8601 format.' },
        { status: 400 }
      );
    }

    // 고객 확인
    const contact = await prisma.contact.findUnique({
      where: { id: contactId }
    });

    if (!contact) {
      return NextResponse.json(
        { error: `Contact not found: ${contactId}` },
        { status: 404 }
      );
    }

    // A/B 테스트 그룹 배정 (50%/50%)
    const variant = assignAbTestVariant();

    // Day 0, 1, 3 메시지 생성 (Day 7은 선택적)
    const messagesToCreate = [];
    const schedules = SMS_DAY0_3_SCHEDULE.filter(s => s.day <= 3); // Day 0, 1, 3만 생성

    for (const schedule of schedules) {
      try {
        // 템플릿 로드
        const template = getTemplateBySegmentAndDay(segment, schedule.day, variant);

        if (!template) {
          console.warn(
            `Template not found for segment=${segment}, day=${schedule.day}, variant=${variant}`
          );
          continue;
        }

        // 스케줄 시간 계산 (null이면 해당 day가 스케줄에 없음 — skip)
        const scheduledTime = calculateScheduledTime(callTimeDate, schedule.day);
        if (!scheduledTime) continue;

        // 메시지 콘텐츠 변수 치환
        const firstName_display = firstName || contact.name.split(' ')[0] || 'Guest';
        const interpolatedContent = interpolateTemplate(template.content, {
          firstName: firstName_display,
          ctaUrl: template.cta.url
        });

        // DB에 메시지 레코드 생성
        const message = await prisma.crmMarketingMessage.create({
          data: {
            contactId,
            organizationId,
            templateId: template.id,
            segment,
            variant,
            day: schedule.day,
            scheduledTime,
            status: 'pending',
            content: interpolatedContent,
            psychologyLenses: template.psychology,
            ctaUrl: template.cta.url,
            ctaButtonText: template.cta.text,
            abTestGroup: variant,
            expectedResponseRate: template.expectedConversionRate,
            metadata: {
              phase: template.phase,
              ebbinghaus: template.metadata.ebbinghaus,
              emotionalTrigger: template.metadata.emotionalTrigger,
              scarcity: template.metadata.scarcity,
              expectedClickRate: template.expectedClickRate
            }
          }
        });

        messagesToCreate.push(message);
      } catch (err) {
        console.error(
          `Failed to create message for day ${schedule.day}:`,
          err
        );
      }
    }

    // Contact 메타데이터 업데이트: SMS 발송 날짜 기록
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        smsDay0Sent: false, // 아직 발송 전
        smsDay0SentAt: null,
        smsDay1Sent: false,
        smsDay1SentAt: null,
        smsDay3Sent: false,
        smsDay3SentAt: null
      }
    });

    return NextResponse.json({
      status: 'success',
      message: `${messagesToCreate.length} messages scheduled successfully`,
      contactId,
      organizationId,
      segment,
      variant,
      callTime: callTimeDate.toISOString(),
      messagesScheduled: messagesToCreate.length,
      messages: messagesToCreate.map(msg => ({
        id: msg.id,
        day: msg.day,
        templateId: msg.templateId,
        scheduledTime: msg.scheduledTime.toISOString(),
        status: msg.status
      }))
    });
  } catch (error) {
    console.error('Error in schedule-day0-3:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
