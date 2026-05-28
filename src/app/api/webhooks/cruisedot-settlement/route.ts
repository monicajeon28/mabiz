import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { Decimal } from '@prisma/client/runtime/library';

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

// Partner Tier 별 기본 CommissionRate (환경설정으로 대체 가능)
const PARTNER_TIER_RATES: Record<string, number> = {
  BRONZE: 10,
  SILVER: 15,
  GOLD: 20,
  PLATINUM: 25,
};

export async function POST(req: NextRequest) {
  const secret = process.env.CRUISEDOT_WEBHOOK_SECRET;

  if (!secret) {
    logger.error('[SettlementWebhook] CRUISEDOT_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // Bearer Token 검증
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');

  if (token !== secret) {
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

  if (signature !== expectedSignature) {
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

    let partner: any = null;
    let commissionLedgerEntry: any = null;
    let settlementEventEntry: any = null;

    // 트랜잭션 처리
    await prisma.$transaction(async (tx) => {
      // 1. Partner 찾기 또는 생성
      partner = await tx.partner.upsert({
        where: { id: partnerId },
        create: {
          id: partnerId,
          organizationId: 'org_cruisedot', // 기본값 (나중에 환경설정으로 변경)
          name: `Partner ${partnerId}`,
          email: undefined,
          phone: undefined,
          status: 'ACTIVE',
          commissionRate: commissionRate ? new Decimal(commissionRate) : null,
          totalRevenue: BigInt(0),
        },
        update: {
          // Partner가 이미 존재하면 수익만 업데이트 (아래 진행)
        },
        select: {
          id: true,
          organizationId: true,
          name: true,
          commissionRate: true,
          totalRevenue: true,
        },
      });

      // 2. CommissionLedger 기록
      // CommissionRate가 없으면 Partner Tier 기반 계산 (임시: 기본값 사용)
      const finalCommissionRate = commissionRate ?? PARTNER_TIER_RATES.SILVER; // SILVER를 기본값으로
      const calculatedNetAmount = netAmount ?? Math.floor(amount * (1 - finalCommissionRate / 100));
      const commissionAmount = Math.floor(amount - calculatedNetAmount);

      commissionLedgerEntry = await tx.commissionLedger.create({
        data: {
          saleId: parseInt(settlementId, 10),
          profileId: parseInt(partnerId, 10),
          entryType: 'SETTLEMENT_COMMISSION',
          amount: commissionAmount,
          currency: 'KRW',
          withholdingAmount: 0,
          settlementId: parseInt(settlementId, 10),
          isSettled: status === 'PAID',
          notes: `정산 ${period}: ${amount.toLocaleString()}원 → ${calculatedNetAmount.toLocaleString()}원`,
          metadata: {
            eventId,
            eventType,
            period,
            settlementStatus: status,
            paymentDate,
          },
        },
        select: {
          id: true,
          amount: true,
          isSettled: true,
        },
      });

      logger.log('[SettlementWebhook] CommissionLedger 기록', {
        ledgerId: commissionLedgerEntry.id,
        partnerId,
        amount: commissionAmount,
        settlementAmount: calculatedNetAmount,
      });

      // 3. Partner totalRevenue 누적
      if (status === 'PAID') {
        await tx.partner.update({
          where: { id: partnerId },
          data: {
            totalRevenue: {
              increment: BigInt(calculatedNetAmount),
            },
          },
        });

        logger.log('[SettlementWebhook] Partner 수익 누적', {
          partnerId,
          addedAmount: calculatedNetAmount,
        });
      }

      // 4. SettlementEvent 로깅
      settlementEventEntry = await tx.settlementEvent.create({
        data: {
          settlementId: parseInt(settlementId, 10),
          userId: undefined,
          eventType: `SETTLEMENT_${status}`,
          description: `정산 ${status}: ${period} ${amount.toLocaleString()}원`,
          metadata: {
            eventId,
            eventType,
            partnerId,
            amount,
            netAmount: calculatedNetAmount,
            commissionRate: finalCommissionRate,
            paymentDate,
          },
        },
        select: {
          id: true,
        },
      });

      logger.log('[SettlementWebhook] SettlementEvent 기록', {
        eventId: settlementEventEntry.id,
        settlementId,
        status,
      });

      // 5. ProcessedWebhookEvent 기록 (중복 방지)
      await tx.processedWebhookEvent.create({
        data: {
          eventId,
          webhookType: 'cruisedot-settlement',
          status: 'SUCCESS',
        },
      });
    });

    // 6. 알림 발송 (트랜잭션 후)
    if (status === 'PAID' && commissionLedgerEntry) {
      // TODO: Slack 알림 (Commission 지급 완료)
      // TODO: Email 알림 (Partner에게 정산 안내)
      // TODO: SMS 알림 (선택적)

      logger.log('[SettlementWebhook] 알림 발송 대기', {
        partnerId,
        settlementId,
        commissionAmount: commissionLedgerEntry.amount,
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

    logger.log('[SettlementWebhook] 처리 완료', {
      settlementId,
      partnerId,
      period,
      status,
      commissionAmount: commissionLedgerEntry?.amount,
    });

    return NextResponse.json({
      ok: true,
      success: true,
      settlementId,
      partnerId,
      commissionAmount: commissionLedgerEntry?.amount ?? 0,
      status: 'processed',
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('[SettlementWebhook] 처리 실패', {
      eventId,
      settlementId,
      error: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      { ok: false, message: '처리 중 오류 발생', error: error.message },
      { status: 500 }
    );
  }
}
