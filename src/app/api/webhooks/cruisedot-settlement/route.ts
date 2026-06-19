import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { SettlementSaga, SettlementSagaContext } from '@/lib/webhooks/settlement-saga';
import { retryStrategy } from '@/lib/webhooks/retry-strategy';
import { sendSmsViaAligo } from '@/lib/sms-service';
import { recordProcessedWebhookEvent } from '@/lib/webhook-execution';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CruisedotSettlementPayload {
  eventId: string;
  eventType: 'settlement.created' | 'settlement.approved' | 'settlement.locked' | 'settlement.paid' | 'settlement.calculated';
  timestamp: string;
  settlementId: string;
  partnerId: string;
  period: string; // YYYY-MM
  status: 'DRAFT' | 'APPROVED' | 'LOCKED' | 'PAID';
  amount: number; // 정산액 (수수료 차감 전)
  netAmount?: number; // 순정산액 (수수료 차감 후)
  commissionRate?: number; // 커미션 비율 (%)
  paymentDate?: string; // ISO 8601 날짜
  // settlement.calculated 전용 필드
  totalNetPayment?: number;
  profiles?: Array<{ partnerId: string; netPayment: number; period: string }>;
}

export async function POST(req: NextRequest) {
  // settlement.calculated는 MABIZ_SETTLEMENT_WEBHOOK_SECRET, 나머지는 CRUISEDOT_WEBHOOK_SECRET
  const secret = process.env.MABIZ_SETTLEMENT_WEBHOOK_SECRET ?? process.env.CRUISEDOT_WEBHOOK_SECRET;

  if (!secret) {
    logger.error('[SettlementWebhook] MABIZ_SETTLEMENT_WEBHOOK_SECRET 미설정');
    return NextResponse.json(
      { ok: false, message: 'Service temporarily unavailable' },
      { status: 503 } // Service Unavailable - client should retry
    );
  }
  const secretStr: string = secret;

  // Bearer Token 검증
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    logger.warn('[SettlementWebhook] 인증 실패');
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const token = authHeader.slice(7);

  if (token.length !== secretStr.length || !timingSafeEqual(Buffer.from(token), Buffer.from(secretStr))) {
    logger.warn('[SettlementWebhook] 인증 실패');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // 요청 본문 읽기
  const body = await req.text();

  // HMAC-SHA256 서명 검증
  const signature = req.headers.get('x-signature') ?? '';
  const expectedSignature = createHmac('sha256', secretStr)
    .update(body)
    .digest('hex');

  if (signature.length !== expectedSignature.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    logger.warn('[SettlementWebhook] 서명 검증 실패');
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  // JSON 파싱
  let payload: CruisedotSettlementPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false, message: 'JSON 파싱 실패' }, { status: 400 });
  }

  const { eventId, eventType, timestamp: _timestamp, settlementId, partnerId, period, status, amount, netAmount, commissionRate, paymentDate } = payload;

  // 필수 필드 검증
  if (!eventId || !eventType || !settlementId || !partnerId || !period || !status || amount === undefined) {
    logger.warn('[SettlementWebhook] 필수 필드 누락', {
      eventId,
      settlementId,
      partnerId,
      period,
      status,
    });
    return NextResponse.json({ ok: false, message: '필수 필드 누락' }, { status: 400 });
  }

  // period 형식 검증 (YYYY-MM format)
  if (typeof period !== 'string' || !period.match(/^\d{4}-\d{2}$/)) {
    logger.warn('[SettlementWebhook] 유효하지 않은 period 형식', { period });
    return NextResponse.json(
      { ok: false, message: 'Period must be YYYY-MM format' },
      { status: 400 }
    );
  }

  logger.log('[SettlementWebhook] 수신', {
    eventId,
    eventType,
    settlementId,
    partnerId,
    period,
    status,
    amount,
  });

  try {
    // eventId 멱등성 체크
    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
      where: {
        eventId_webhookType: {
          eventId,
          webhookType: 'cruisedot-settlement',
        },
      },
    });

    if (alreadyProcessed) {
      logger.log('[SettlementWebhook] 중복 이벤트 무시', { eventId });
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // settlement.calculated: 크루즈닷몰 LOCKED 완료 → CRM AffiliatePayslip upsert
    // SSoT = 크루즈닷몰. CRM은 받은 값 저장만, 계산 없음.
    if (eventType === 'settlement.calculated') {
      const { totalNetPayment, profiles, paymentDate: pd } = payload;

      if (!profiles || profiles.length === 0) {
        await recordProcessedWebhookEvent(prisma, {
          eventId,
          webhookType: 'cruisedot-settlement',
          context: '[SettlementWebhook] SUCCESS 기록 실패',
        });
        return NextResponse.json({ ok: true, received: true, upserted: 0 });
      }

      // 1. bulk GmUser 검증 — 외부 ID 그대로 쓰기 금지
      const partnerIds = profiles
        .map((p) => parseInt(String(p.partnerId), 10))
        .filter((id) => !isNaN(id));

      const gmUsers = await prisma.gmUser.findMany({
        where: { id: { in: partnerIds } },
        select: { id: true, name: true },
      });
      const gmUserMap = new Map<number, string | null>(gmUsers.map((u) => [u.id, u.name]));

      // 2. AffiliatePayslip upsert (status=APPROVED — 크루즈닷 계산 완료)
      let upserted = 0;
      let skipped = 0;
      for (const profile of profiles) {
        const agentId = parseInt(String(profile.partnerId), 10);
        if (isNaN(agentId) || !gmUserMap.has(agentId)) {
          skipped++;
          logger.warn('[SettlementWebhook] 유효하지 않은 partnerId skip', { partnerId: profile.partnerId });
          continue;
        }
        const netPayment = typeof profile.netPayment === 'number' ? profile.netPayment : 0;
        const yearMonth = (profile.period as string | undefined) || period;
        const netBigInt = BigInt(Math.round(netPayment));

        await prisma.affiliatePayslip.upsert({
          where: { agentId_yearMonth: { agentId, yearMonth } },
          create: {
            agentId,
            yearMonth,
            baseCommission: netBigInt,
            netAmount:      netBigInt,
            status:         'APPROVED',
            agentDisplayName: gmUserMap.get(agentId) ?? null,
            note: pd ? `예정지급일: ${pd}` : null,
          },
          update: {
            baseCommission:   netBigInt,
            netAmount:        netBigInt,
            status:           'APPROVED',
            agentDisplayName: gmUserMap.get(agentId) ?? null,
            note: pd ? `예정지급일: ${pd}` : null,
          },
        });
        upserted++;
      }

      await recordProcessedWebhookEvent(prisma, {
        eventId,
        webhookType: 'cruisedot-settlement',
        context: '[SettlementWebhook] SUCCESS 기록 실패',
      });

      logger.info('[SettlementWebhook] settlement.calculated 처리 완료', {
        settlementId, period, totalNetPayment, upserted, skipped,
      });
      return NextResponse.json({ ok: true, received: true, upserted, skipped });
    }

    const profileIdInt = parseInt(partnerId, 10);
    const settlementIdInt = parseInt(settlementId, 10);

    // Validate that partnerId is a valid number
    if (isNaN(profileIdInt)) {
      logger.warn('[SettlementWebhook] 유효하지 않은 partnerId', { partnerId });
      return NextResponse.json({ ok: false, message: '유효하지 않은 partnerId' }, { status: 400 });
    }

    // Validate that settlementId is a valid number
    if (isNaN(settlementIdInt)) {
      logger.warn('[SettlementWebhook] 유효하지 않은 settlementId', { settlementId });
      return NextResponse.json({ ok: false, message: '유효하지 않은 settlementId' }, { status: 400 });
    }

    // ✅ P0-13: organizationId 환경변수 필수화 (테넌트 격리)
    const organizationId = process.env.CRUISEDOT_WEBHOOK_ORG_ID;

    if (!organizationId) {
      logger.error('[SettlementWebhook] CRUISEDOT_WEBHOOK_ORG_ID 미설정 - Cross-tenant 데이터 오염 위험', {
        partnerId,
        settlementId
      });
      return NextResponse.json(
        { ok: false, message: 'Service temporarily unavailable - organizationId not configured' },
        { status: 503 } // Service Unavailable - client should retry after fix
      );
    }
    const orgId: string = organizationId;

    // 수당 계산 SSoT = 크루즈닷몰. CRM은 받은 값 그대로 저장만.
    const finalCommissionRate = commissionRate ?? 0;
    const calculatedNetAmount = netAmount ?? amount;

    // Create Saga context
    const sagaContext: SettlementSagaContext = {
      eventId,
      organizationId: orgId,
      settlementId: settlementIdInt,
      partnerId: profileIdInt,
      period,
      status: status as 'DRAFT' | 'APPROVED' | 'LOCKED' | 'PAID',
      amount,
      netAmount: calculatedNetAmount,
      commissionRate: finalCommissionRate,
      paymentDate,
      executedSteps: new Map(),
    };

    // Execute saga with SERIALIZABLE isolation
    const saga = new SettlementSaga(sagaContext);
    const sagaResult = await saga.execute();

    if (!sagaResult.success) {
      logger.error('[SettlementWebhook] Saga execution failed', {
        failedStep: sagaResult.failedStep,
        error: sagaResult.error,
        eventId,
      });

      return NextResponse.json(
        {
          ok: false,
          message: 'Saga execution failed',
          error: sagaResult.error,
          failedStep: sagaResult.failedStep,
        },
        { status: 500 }
      );
    }

    // 6. 알림 발송 (트랜잭션 후)
    if (status === 'PAID') {
      const commissionAmount = Math.floor(amount - calculatedNetAmount);

      // SMS 알림: netAmount 없으면 0원 발송 방지
      if (netAmount === undefined || netAmount === null) {
        logger.warn('[SettlementWebhook] netAmount 누락 — 정산 SMS 발송 건너뜀', { profileIdInt, period });
      } else {
      // SMS 알림: 파트너에게 정산 완료 안내
      try {
        const gmUser = await prisma.gmUser.findUnique({
          where: { id: profileIdInt },
          select: { phone: true, name: true },
        });
        if (gmUser?.phone) {
          const msg = `[마비즈] ${gmUser.name ?? '파트너'}님, ${period} 정산이 완료되었습니다. 입금액: ${commissionAmount.toLocaleString()}원`;
          await sendSmsViaAligo(gmUser.phone, msg);
          logger.info('[SettlementWebhook] 정산 SMS 발송 완료', { partnerId: profileIdInt });
        }
      } catch (smsErr) {
        logger.warn('[SettlementWebhook] 정산 SMS 발송 실패', { partnerId: profileIdInt, error: String(smsErr) });
      }
      } // end netAmount guard

      logger.log('[SettlementWebhook] 알림 발송 완료', {
        partnerId: profileIdInt,
        settlementId: settlementIdInt,
        commissionAmount,
      });
    }

    // 7. 월말 자동 정산 예약 (status가 LOCKED일 때)
    if (status === 'LOCKED' && paymentDate) {
      // TODO: Cron Job 또는 Queue에 추가
      // TODO: 정산 자동화 로직 (PayApp 등과 연동)

      logger.log('[SettlementWebhook] 자동 정산 예약', {
        settlementId,
        paymentDate,
      });
    }

    const commissionAmount = Math.floor(amount - calculatedNetAmount);

    logger.log('[SettlementWebhook] 처리 완료 (Saga)', {
      settlementId: settlementIdInt,
      partnerId: profileIdInt,
      period,
      status,
      commissionAmount,
      sagaSteps: sagaResult.completedSteps,
    });

    return NextResponse.json({
      ok: true,
      success: true,
      settlementId: settlementIdInt,
      partnerId: profileIdInt,
      commissionAmount,
      status: 'processed',
      sagaSteps: sagaResult.completedSteps,
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const classification = retryStrategy.classifyError(error);

    logger.error('[SettlementWebhook] 처리 실패', {
      eventId,
      settlementId,
      error: error.message,
      stack: error.stack,
      classification,
    });

    // Determine HTTP status code based on error classification
    const statusCode = classification.dlq ? 400 : 500;

    return NextResponse.json(
      {
        ok: false,
        message: '처리 중 오류 발생',
        error: '처리 중 오류가 발생했습니다.',
        retryable: classification.retryable,
        dlq: classification.dlq,
      },
      { status: statusCode }
    );
  }
}
