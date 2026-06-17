export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { enqueueDLQ } from '@/lib/mabiz-dlq';
import { normalizePhone } from '@/lib/phone-normalize';
import { sanitizeHtml } from '@/lib/html-sanitizer';
import { maskPhone } from '@/lib/pii-masker';
import { buildInquiryTracking, extractInquiryIp } from '@/lib/inquiry-tracking';

/**
 * Loop 6 - Agent C: Customer Inquiry Webhook with Lens Detection
 *
 * POST /api/webhooks/inquiry
 * GMcruise(크루즈닷몰) 고객 문의/상담신청 시 호출
 * Authorization: Bearer MABIZ_LEAD_WEBHOOK_SECRET
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
  productName?: string;
  pageUrl?: string;
  userAgent?: string;
  deviceType?: string;
  source?: string;
  isGold?: boolean;
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
function generateSuggestedResponse(lensType: string, _inquiryType: string | undefined): SuggestedResponse {
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
  const secret = process.env.MABIZ_INQUIRY_WEBHOOK_SECRET ?? process.env.MABIZ_LEAD_WEBHOOK_SECRET;

  // [P0-SEC-101] MABIZ_INQUIRY_WEBHOOK_SECRET 필수
  if (!secret) {
    logger.error('[InquiryWebhook] CRITICAL: MABIZ_INQUIRY_WEBHOOK_SECRET 미설정. 웹훅 수신 불가능합니다. DevOps에 연락하세요.');
    return NextResponse.json({ ok: false, error: 'Webhook secret not configured' }, { status: 500 });
  }

  // [P0-SEC-102] Bearer Token 검증 (필수)
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    logger.warn('[InquiryWebhook] Bearer token 미제공 — 요청 차단');
    return NextResponse.json({ ok: false, error: 'Missing Bearer token' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  if (token.length === 0) {
    logger.warn('[InquiryWebhook] Bearer token 값 비어있음 — 요청 차단');
    return NextResponse.json({ ok: false, error: 'Empty Bearer token' }, { status: 401 });
  }

  if (
    token.length !== secret.length ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  ) {
    logger.warn('[InquiryWebhook] Bearer token 불일치 — 인증 실패');
    return NextResponse.json({ ok: false, error: 'Authentication failed' }, { status: 401 });
  }

  // raw body를 먼저 읽은 뒤 HMAC-SHA256 서명 검증
  const rawBody = await req.text();
  const signature = req.headers.get('x-signature') ?? '';
  if (!signature) {
    logger.warn('[InquiryWebhook] x-signature 헤더 누락 — 요청 차단');
    return NextResponse.json({ ok: false, error: 'Missing x-signature' }, { status: 401 });
  }
  const expectedSignature = createHmac('sha256', secret).update(rawBody).digest('hex');
  if (
    signature.length !== expectedSignature.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    logger.warn('[InquiryWebhook] HMAC 서명 검증 실패 — 요청 차단');
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 403 });
  }

  let body: InquiryRequest;
  try {
    body = JSON.parse(rawBody) as InquiryRequest;
  } catch {
    return NextResponse.json({ ok: false, message: 'JSON 파싱 실패' }, { status: 400 });
  }
  const { phone, name, email, inquiryType, message, affiliateCode, organizationId: bodyOrgId, eventId } = body;
  const requestIp = extractInquiryIp(req.headers);
  const tracking = buildInquiryTracking({
    source: body.source,
    productName: body.productName,
    productCode: body.productCode,
    pageUrl: body.pageUrl,
    userAgent: body.userAgent ?? req.headers.get('user-agent'),
    deviceType: body.deviceType,
    ip: requestIp,
    isGold: body.isGold,
    submittedAt: body.submittedAt,
  });
  const sourceType = body.isGold ? 'gold_member' : 'inquiry';

  if (!phone || !name) {
    return NextResponse.json({ ok: false, message: 'phone, name 필수' }, { status: 400 });
  }

  logger.log('[InquiryWebhook] 수신', { phone: maskPhone(phone), inquiryType, lensDetectionEnabled: true });

  // [P0-SEC-103] organizationId 결정 — affiliateCode 자동 매핑 우선
  let organizationId = bodyOrgId;

  // affiliateCode가 있으면 → GmAffiliateProfile → OrganizationMember → organizationId 자동 매핑
  if (!organizationId && affiliateCode) {
    const profile = await prisma.gmAffiliateProfile.findFirst({
      where: { affiliateCode },
      select: { userId: true },
    });
    if (profile?.userId) {
      const member = await prisma.organizationMember.findFirst({
        where: { userId: `gm-${profile.userId}`, isActive: true, role: 'OWNER' },
        select: { organizationId: true },
      });
      if (member?.organizationId) {
        organizationId = member.organizationId;
        logger.log('[InquiryWebhook] affiliateCode → organizationId 자동 매핑', {
          affiliateCode,
          organizationId,
        });
      }
    }
  }

  if (!organizationId) {
    organizationId = process.env.DEFAULT_ORGANIZATION_ID;
    if (!organizationId) {
      logger.error('[InquiryWebhook] organizationId 미제공 + DEFAULT_ORGANIZATION_ID 미설정');
      return NextResponse.json({ ok: false, message: 'organizationId 필수' }, { status: 400 });
    }
  }

  // [P0-SEC-104] organizationId가 유효한지 확인 (cross-tenant 접근 방지)
  const isValidOrg = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });

  if (!isValidOrg) {
    logger.warn('[InquiryWebhook] 조직 미존재 — 접근 차단', { organizationId });
    return NextResponse.json({ ok: false, error: 'Organization not found' }, { status: 403 });
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
          where: {
            eventId_webhookType: {
              eventId,
              webhookType: 'inquiry',
            },
          },
          select: { eventId: true },
        });
        if (alreadyProcessed) {
          logger.log('[InquiryWebhook] 중복 이벤트 무시', { eventId });
          return { duplicate: true, contactId: '', created: false, lensType: lensDetection.detectedLens };
        }
      }

      const existing = await tx.contact.findUnique({
        where: { phone_organizationId: { phone: normalizedPhone, organizationId } },
        select: { id: true, type: true, leadScore: true, surveyData: true },
      });
      const existingSurveyData =
        existing?.surveyData &&
        typeof existing.surveyData === 'object' &&
        !Array.isArray(existing.surveyData)
          ? existing.surveyData
          : {};

      let contactId: string;
      let created = false;

      if (existing) {
        await tx.contact.update({
          where: { id: existing.id },
          data: {
            name,
            ...(email ? { email } : {}),
            ...(affiliateCode ? { affiliateCode } : {}),
            sourceType,
            ...(body.productName ? { productName: body.productName } : {}),
            ...(body.productCode ? { inquiryProductCode: body.productCode } : {}),
            surveyData: {
              ...existingSurveyData,
              inquiryTracking: tracking,
            },
            type: existing.type === 'PURCHASED' ? 'PURCHASED' : 'LEAD',
            leadScore: (existing.leadScore ?? 0) + 15,
            ...(gmUser ? { userId: gmUser.id } : {}),
            lastContactedAt: new Date(),
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
            sourceType,
            ...(body.productName ? { productName: body.productName } : {}),
            ...(body.productCode ? { inquiryProductCode: body.productCode } : {}),
            surveyData: { inquiryTracking: tracking },
            type: 'LEAD',
            leadScore: 15,
            userId: gmUser?.id ?? null,
            lastContactedAt: new Date(),
          },
          select: { id: true },
        });
        contactId = c.id;
        created = true;
      }

      // ContactMemo: 문의 내용 + 렌즈 정보
      // [P1-5] 사용자 입력 message를 sanitizeHtml로 정제 — XSS 방지
      const sanitizedMessage = sanitizeHtml(message || '');
      const memoContent = `[문의] ${inquiryType ?? '상담신청'} [렌즈: ${lensDetection.detectedLens} (신뢰도: ${lensDetection.confidence}%)]\n메시지: ${sanitizedMessage || '내용 없음'}`;
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

      // NextBestAction 자동 생성 (24시간 이내 대응 필수)
      const suggestedResponse = generateSuggestedResponse(lensDetection.detectedLens, inquiryType);

      await tx.nextBestAction.create({
        data: {
          contactId,
          organizationId,
          recommendedAction: 'CALL', // 문의는 콜로 대응
          actionType: 'NURTURE',
          priority: suggestedResponse.urgencyLevel === 'CRITICAL' ? 100 : 50,
          message: {
            type: 'LEAD_RESPONSE',
            title: `[${lensDetection.detectedLens}] ${name}님 문의 대응: ${inquiryType ?? '상담신청'}`,
            script: suggestedResponse.suggestedScript,
            followUpTemplate: suggestedResponse.followUpTemplate,
          },
          reasoning: [
            `렌즈: ${lensDetection.detectedLens} (${suggestedResponse.lensLabel})`,
            `신뢰도: ${lensDetection.confidence}%`,
          ],
          status: 'PENDING',
        },
      }).catch(() => {
        // NextBestAction 생성 실패는 무시
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
      lensLabel: result.suggestedResponse?.lensLabel,
    });

    return NextResponse.json({
      ok: true,
      contactId: result.contactId,
      created: result.created,
      inquiryId: eventId || result.contactId,
      lens: {
        type: result.lensType,
        label: result.suggestedResponse?.lensLabel || '알 수 없음',
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
