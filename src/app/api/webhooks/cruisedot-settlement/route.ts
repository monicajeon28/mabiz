import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { SettlementSaga, SettlementSagaContext } from '@/lib/webhooks/settlement-saga';
import { retryStrategy } from '@/lib/webhooks/retry-strategy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CruisedotSettlementPayload {
  eventId: string;
  eventType: 'settlement.created' | 'settlement.approved' | 'settlement.locked' | 'settlement.paid';
  timestamp: string;
  settlementId: string;
  partnerId: string;
  period: string; // YYYY-MM
  status: 'DRAFT' | 'APPROVED' | 'LOCKED' | 'PAID';
  amount: number; // 정산액 (수수료 차감 전)
  netAmount?: number; // 순정산액 (수수료 차감 후)
  commissionRate?: number; // 커미션 비율 (%)
  paymentDate?: string; // ISO 8601 날짜
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRUISEDOT_WEBHOOK_SECRET;

  if (!secret) {
    logger.error('[SettlementWebhook] CRUISEDOT_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // Bearer Token 검증
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');

  if (token.length !== secret.length || !timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
    logger.warn('[SettlementWebhook] 인증 실패');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // 요청 본문 읽기
  const body = await req.text();

  // HMAC-SHA256 서명 검증
  const signature = req.headers.get('x-signature') ?? '';
  const expectedSignature = createHmac('sha256', secret)
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

  const { eventId, eventType, timestamp, settlementId, partnerId, period, status, amount, netAmount, commissionRate, paymentDate } = payload;

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
      where: { eventId },
    });

    if (alreadyProcessed) {
      logger.log('[SettlementWebhook] 중복 이벤트 무시', { eventId });
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const profileIdInt = parseInt(partnerId, 10);
    const settlementIdInt = parseInt(settlementId, 10);

    // Validate that partnerId is a valid number
    if (isNaN(profileIdInt)) {
      logger.warn('[SettlementWebhook] 유효하지 않은 partnerId', { partnerId });
      return NextResponse.json({ ok: false, message: '유효하지 않은 partnerId' }, { status: 400 });
    }

    // Find or infer organizationId
    let organizationId = process.env.CRUISEDOT_WEBHOOK_ORG_ID;

    if (!organizationId) {
      const org = await prisma.organization.findFirst({
        where: {
          partners: {
            some: {}
          }
        }
      });
      organizationId = org?.id;
    }

    if (!organizationId) {
      logger.error('[SettlementWebhook] organizationId를 결정할 수 없음', { partnerId, settlementId });
      return NextResponse.json({ ok: false, message: 'organizationId를 결정할 수 없음' }, { status: 400 });
    }

    // Calculate final commission rate
    const finalCommissionRate = commissionRate ?? 18; // 기본값: SILVER 18%
    const calculatedNetAmount = netAmount ?? Math.floor(amount * (1 - finalCommissionRate / 100));

    // Create Saga context
    const sagaContext: SettlementSagaContext = {
      eventId,
      organizationId,
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

      // TODO: Slack 알림 (Commission 지급 완료)
      // TODO: Email 알림 (Partner에게 정산 안내)
      // TODO: SMS 알림 (선택적)

      logger.log('[SettlementWebhook] 알림 발송 대기', {
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
        error: error.message,
        retryable: classification.retryable,
        dlq: classification.dlq,
      },
      { status: statusCode }
    );
  }
}
