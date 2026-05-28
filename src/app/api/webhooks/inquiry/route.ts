export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { enqueueDLQ } from '@/lib/mabiz-dlq';
import { normalizePhone } from '@/lib/phone-normalize';
import { LensDetectionEngine } from '@/lib/services/lens-detection-engine';

/**
 * Loop 6 - Agent C: Customer Inquiry Webhook with Lens Detection
 *
 * POST /api/webhooks/inquiry
 * GMcruise(크루즈닷몰) 고객 문의/상담신청 시 호출
 * Authorization: Bearer MABIZ_INQUIRY_WEBHOOK_SECRET
 *
 * 추가 기능:
 * - 렌즈 감지 엔진 자동 분석
 * - 렌즈별 자동 대응 스크립트 제시
 * - Task 자동 생성 (24시간 이내 대응 필수)
 * - Webhook 응답에 suggestedResponse 포함
 */

interface InquiryRequest {
  phone: string;
  name: string;
  email?: string;
  inquiryType?: string;
  message?: string;
  productCode?: string;
  affiliateCode?: string;
  organizationId?: string;
  submittedAt?: string;
  eventId?: string;
}

interface LensDetectedSignals {
  detectedLens: string;
  confidence: number;
  keywords: string[];
  signals: string[];
}

interface SuggestedResponse {
  lensType: string;
  lensLabel: string;
  responseStrategy: string;
  suggestedScript: string;
  urgencyLevel: 'NORMAL' | 'HIGH' | 'CRITICAL';
  followUpTemplate: string;
}

/**
 * 문의 내용에서 렌즈 감지 키워드 분석
 */
function detectLensFromMessage(message: string | undefined): LensDetectedSignals {
  if (!message) {
    return {
      detectedLens: 'L0',
      confidence: 0,
      keywords: [],
      signals: [],
    };
  }

  const msgLower = message.toLowerCase();
  let detectedLens = 'L0';
  let confidence = 0;
  const keywords: string[] = [];
  const signals: string[] = [];

  // L1: 가격이의 ("비싸", "할인", "비용", "가격")
  const l1Keywords = ['비싸', '비용', '가격', 'cheap', 'expensive', 'cost', 'discount', '할인', '얼마', '원'];
  const l1Matches = l1Keywords.filter(kw => msgLower.includes(kw));
  if (l1Matches.length > 0) {
    detectedLens = 'L1';
    confidence = Math.min(100, 30 + l1Matches.length * 10);
    keywords.push(...l1Matches);
    signals.push('price_objection');
  }

  // L2: 준비복잡 ("언제", "몇일", "준비", "비자", "여권", "복잡")
  const l2Keywords = ['언제', '몇일', '며칠', '준비', '비자', '여권', '복잡', '어려', '헷갈', 'when', 'how long'];
  const l2Matches = l2Keywords.filter(kw => msgLower.includes(kw));
  if (l2Matches.length > 0 && confidence < 35) {
    detectedLens = 'L2';
    confidence = Math.min(100, 30 + l2Matches.length * 10);
    keywords.push(...l2Matches);
    signals.push('preparation_anxiety');
  }

  // L3: 차별성 ("다른곳", "경쟁사", "비교", "왜")
  const l3Keywords = ['다른', '경쟁사', '비교', '왜', '차이', 'competitor', 'vs', 'versus', '어디가'];
  const l3Matches = l3Keywords.filter(kw => msgLower.includes(kw));
  if (l3Matches.length > 0 && confidence < 35) {
    detectedLens = 'L3';
    confidence = Math.min(100, 30 + l3Matches.length * 10);
    keywords.push(...l3Matches);
    signals.push('competitor_mention');
  }

  // L6: 타이밍/손실회피 ("급하다", "내일", "빨리", "제한")
  const l6Keywords = ['급', '내일', '빨리', '빨', '제한', '남았', 'urgent', 'asap', 'today', 'tomorrow'];
  const l6Matches = l6Keywords.filter(kw => msgLower.includes(kw));
  if (l6Matches.length > 0 && confidence < 35) {
    detectedLens = 'L6';
    confidence = Math.min(100, 30 + l6Matches.length * 10);
    keywords.push(...l6Matches);
    signals.push('time_sensitive');
  }

  // L9: 건강신뢰 ("배멀미", "당뇨", "고혈압", "건강", "의료", "약")
  const l9Keywords = ['배멀미', '배멀', '당뇨', '고혈압', '건강', '의료', '약', '지병', 'health', 'medical'];
  const l9Matches = l9Keywords.filter(kw => msgLower.includes(kw));
  if (l9Matches.length > 0 && confidence < 35) {
    detectedLens = 'L9';
    confidence = Math.min(100, 30 + l9Matches.length * 10);
    keywords.push(...l9Matches);
    signals.push('health_concern');
  }

  return { detectedLens, confidence, keywords, signals };
}

/**
 * 렌즈 기반 자동 대응 스크립트 생성
 */
function generateSuggestedResponse(lensType: string, inquiryType: string | undefined): SuggestedResponse {
  const responses: Record<string, SuggestedResponse> = {
    L0: {
      lensType: 'L0',
      lensLabel: '부재중 재활성화',
      responseStrategy: '감정 재연결 + 손실회피',
      suggestedScript: `안녕하세요! 그동안 오래 뵙지 못해 안녕하신지 궁금했습니다.
새로운 크루즈 경로가 많이 추가되었어요. 다시 한번 함께하는 경험은 어떨까요?`,
      urgencyLevel: 'NORMAL',
      followUpTemplate: 'REACTIVATION_DAY0_PASONA',
    },
    L1: {
      lensType: 'L1',
      lensLabel: '가격이의',
      responseStrategy: '가치 재정의 + 분할결제 강조',
      suggestedScript: `가격 말씀하신 거군요! 실제로는 월 33K 멤버비 외에는 차이가 크게 없어요.
올인클루시브라서 먹고, 자고, 즐기는 모든 게 포함됩니다. 그래서 오히려 더 저렴해요.`,
      urgencyLevel: 'HIGH',
      followUpTemplate: 'L1_PRICE_OBJECTION_FLOW',
    },
    L2: {
      lensType: 'L2',
      lensLabel: '준비복잡',
      responseStrategy: '걱정 해소 + 체크리스트 제시',
      suggestedScript: `준비가 복잡할 것 같으신 거죠? 저희가 가장 많이 받는 문의예요.
실제로는 짐만 싸면 끝입니다! 여권, 비자, 예방접종은 저희가 안내해드려요.`,
      urgencyLevel: 'HIGH',
      followUpTemplate: 'L2_PREPARATION_FAQ_CHECKLIST',
    },
    L3: {
      lensType: 'L3',
      lensLabel: '경쟁사 차별성',
      responseStrategy: '차별화 강조 + USP 비교',
      suggestedScript: `우리만의 차이를 알려드릴게요!
배 = 움직이는 리조트입니다. 호텔은 한 곳에만 있지만, 배는 매일 새로운 나라를 가져요.
이미 예약된 분들도 이 점을 가장 좋아하세요.`,
      urgencyLevel: 'HIGH',
      followUpTemplate: 'L3_DIFFERENTIATION_USP_COMPARISON',
    },
    L6: {
      lensType: 'L6',
      lensLabel: '타이밍/손실회피',
      responseStrategy: '긴박감 강조 + 제한 명시',
      suggestedScript: `빨리 결정하셔야 할 것 같으신데, 정확히 맞는 직관입니다!
오늘 예약하면 최저가가 확정되고, 내일부터는 가격이 올라갑니다.
자리도 5개만 남았으니까요.`,
      urgencyLevel: 'CRITICAL',
      followUpTemplate: 'L6_TIMING_URGENCY_COUNTDOWN',
    },
    L9: {
      lensType: 'L9',
      lensLabel: '건강신뢰',
      responseStrategy: '의료신뢰 강화 + 안심 보증',
      suggestedScript: `건강이 걱정되신다면, 배 위가 가장 안전한 곳입니다!
24시간 의료진 상주, 배멀미약 무료 제공, 응급 헬리콥터도 대기 중입니다.
당뇨병이나 고혈압도 전혀 문제없어요. 이미 수백 명이 안전하게 다녀왔거든요.`,
      urgencyLevel: 'HIGH',
      followUpTemplate: 'L9_HEALTH_MEDICAL_TRUST_ASSURANCE',
    },
  };

  return responses[lensType] || responses['L0'];
}

export async function POST(req: NextRequest) {
  const secret = process.env.MABIZ_INQUIRY_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('[InquiryWebhook] MABIZ_INQUIRY_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  if (
    token.length !== secret.length ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  ) {
    logger.error('[InquiryWebhook] 인증 실패');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json() as InquiryRequest;
  const { phone, name, email, inquiryType, message, affiliateCode, organizationId: bodyOrgId, eventId } = body;

  if (!phone || !name) {
    return NextResponse.json({ ok: false, message: 'phone, name 필수' }, { status: 400 });
  }

  logger.log('[InquiryWebhook] 수신', { phone: phone.slice(0, 4) + '***', inquiryType, lensDetectionEnabled: true });

  // 1. organizationId 결정
  let organizationId = bodyOrgId;
  if (!organizationId) {
    organizationId = process.env.DEFAULT_ORGANIZATION_ID;
    if (!organizationId) {
      logger.error('[InquiryWebhook] organizationId 미제공 + DEFAULT_ORGANIZATION_ID 미설정');
      return NextResponse.json({ ok: false, message: 'organizationId 필수' }, { status: 400 });
    }
  }

  const normalizedPhone = normalizePhone(phone);
  const gmUser = await prisma.gmUser.findFirst({
    where: { phone: normalizedPhone },
    select: { id: true },
  });

  // 메시지에서 렌즈 감지
  const lensDetection = detectLensFromMessage(message);
  logger.log('[InquiryWebhook] 렌즈 감지', {
    lens: lensDetection.detectedLens,
    confidence: lensDetection.confidence,
    keywords: lensDetection.keywords,
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
      // eventId 멱등성 체크
      if (eventId) {
        const alreadyProcessed = await tx.processedWebhookEvent.findUnique({
          where: { eventId },
          select: { eventId: true },
        });
        if (alreadyProcessed) {
          logger.log('[InquiryWebhook] 중복 이벤트 무시', { eventId });
          return { duplicate: true, contactId: '', created: false, lensType: lensDetection.detectedLens };
        }
      }

      const existing = await tx.contact.findUnique({
        where: { phone_organizationId: { phone: normalizedPhone, organizationId } },
        select: { id: true, type: true, leadScore: true },
      });

      let contactId: string;
      let created = false;

      if (existing) {
        await tx.contact.update({
          where: { id: existing.id },
          data: {
            name,
            ...(email ? { email } : {}),
            ...(affiliateCode ? { affiliateCode } : {}),
            type: existing.type === 'PURCHASED' ? 'PURCHASED' : 'LEAD',
            leadScore: (existing.leadScore ?? 0) + 15,
            ...(gmUser ? { userId: gmUser.id } : {}),
          },
        });
        contactId = existing.id;
      } else {
        const c = await tx.contact.create({
          data: {
            phone: normalizedPhone,
            name,
            organizationId,
            ...(email ? { email } : {}),
            ...(affiliateCode ? { affiliateCode } : {}),
            type: 'LEAD',
            leadScore: 15,
            userId: gmUser?.id ?? null
          },
          select: { id: true },
        });
        contactId = c.id;
        created = true;
      }

      // ContactMemo: 문의 내용 + 렌즈 정보
      const memoContent = `[문의] ${inquiryType ?? '상담신청'} [렌즈: ${lensDetection.detectedLens} (신뢰도: ${lensDetection.confidence}%)]\n메시지: ${message ?? '내용 없음'}`;
      await tx.contactMemo.create({
        data: { contactId, userId: 'webhook-inquiry', content: memoContent },
      });

      // 상담 그룹 자동 배정
      const group = await tx.contactGroup.findFirst({
        where: { organizationId, name: { contains: '상담' } },
        select: { id: true },
      });
      if (group) {
        await tx.contactGroupMember.upsert({
          where: { groupId_contactId: { groupId: group.id, contactId } },
          create: { groupId: group.id, contactId },
          update: {},
        });
      }

      // 담당자 자동할당 (Weighted Round-Robin)
      const availableAgents = await tx.organizationMember.findMany({
        where: {
          organizationId,
          role: { in: ['AGENT', 'OWNER'] },
        },
        select: {
          userId: true,
          displayName: true,
        },
      });

      if (availableAgents.length > 0) {
        const agentWorkload = await tx.$queryRaw`
          SELECT
            m."userId",
            COALESCE(COUNT(c.id), 0)::int as contact_count
          FROM "OrganizationMember" m
          LEFT JOIN "Contact" c ON c."assignedUserId" = m."userId" AND c."organizationId" = ${organizationId}
          WHERE m."organizationId" = ${organizationId}
            AND m.role IN ('AGENT', 'OWNER')
          GROUP BY m."userId"
          ORDER BY contact_count ASC, RANDOM()
          LIMIT 1
        ` as Array<{ userId: string; contact_count: number }>;

        if (agentWorkload && agentWorkload.length > 0) {
          const assignedUserId = agentWorkload[0].userId;
          await tx.contact.update({
            where: { id: contactId },
            data: { assignedUserId },
          });
          logger.log('[InquiryWebhook] 담당자 자동할당', {
            contactId,
            assignedUserId,
            workload: agentWorkload[0].contact_count,
          });
        }
      }

      // Task 자동 생성 (24시간 이내 대응 필수)
      const suggestedResponse = generateSuggestedResponse(lensDetection.detectedLens, inquiryType);
      const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24시간 후

      await tx.task.create({
        data: {
          contactId,
          organizationId,
          type: 'INQUIRY_RESPONSE',
          title: `[${lensDetection.detectedLens}] ${name}님 문의 대응: ${inquiryType ?? '상담신청'}`,
          description: `렌즈: ${lensDetection.detectedLens} (${suggestedResponse.lensLabel})\n신뢰도: ${lensDetection.confidence}%\n\n제안 대응:\n${suggestedResponse.suggestedScript}\n\nFollow-up: ${suggestedResponse.followUpTemplate}`,
          priority: suggestedResponse.urgencyLevel === 'CRITICAL' ? 'HIGH' : 'NORMAL',
          status: 'OPEN',
          dueAt,
        },
      });

      // processedWebhookEvent 기록
      if (eventId) {
        await tx.processedWebhookEvent.create({
          data: { eventId, webhookType: 'inquiry' },
        });
      }

      return {
        contactId,
        created,
        lensType: lensDetection.detectedLens,
        suggestedResponse,
      };
    }, {
      isolationLevel: 'Serializable',
      timeout: 30000,
    });

    if (result.duplicate) {
      logger.log('[InquiryWebhook] 중복 처리됨');
      return NextResponse.json({
        ok: true,
        duplicate: true,
        suggestedResponse: generateSuggestedResponse(result.lensType, inquiryType),
      });
    }

    logger.log('[InquiryWebhook] 완료', {
      contactId: result.contactId,
      created: result.created,
      lens: result.lensType,
      lensLabel: result.suggestedResponse.lensLabel,
    });

    return NextResponse.json({
      ok: true,
      contactId: result.contactId,
      created: result.created,
      inquiryId: eventId || result.contactId,
      lens: {
        type: result.lensType,
        label: result.suggestedResponse.lensLabel,
        confidence: lensDetection.confidence,
      },
      suggestedResponse: result.suggestedResponse,
    });
  } catch (err) {
    logger.error('[InquiryWebhook] 처리 실패', { err });
    await enqueueDLQ('inquiry', body, err instanceof Error ? err.message : String(err)).catch(() => {});
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
