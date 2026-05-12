export const dynamic = 'force-dynamic';

/**
 * WelcomePayments 결제 Webhook 비동기 처리 (POST /api/payment/webhook/welcomepayments)
 *
 * 기능:
 * - 크루즈닷몰 결제 시스템 (WelcomePayments 게이트웨이)
 * - HMAC-SHA256 서명 검증 (쿼리 파라미터 또는 헤더 기반)
 * - 멱등성 검증 (orderId로 중복 방지)
 * - Zod 입력 검증
 * - 비동기 큐 등록 (즉시 반환, Cron에서 배치 처리)
 * - 결제 상태 업데이트
 *
 * 아키텍처:
 * 1. Webhook 수신 → 서명 검증 → 즉시 201 반환 (최대 3초)
 * 2. ApisSyncQueue에 등록 (PENDING)
 * 3. Cron (/api/cron/process-payment-webhooks): 10초마다 PENDING 배치 처리
 * 4. Payment 테이블 업데이트
 * 5. 최대 3회 재시도 (exponential backoff)
 *
 * P0 체크리스트:
 * ✓ HMAC-SHA256 서명 검증 (constant-time 비교, 쿼리 파라미터/헤더 지원)
 * ✓ 멱등성 검증 (orderId)
 * ✓ Zod 입력 검증
 * ✓ 큐 등록 (즉시 반환)
 * ✓ 에러 마스킹
 * ✓ 구조화된 로깅
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { validateWelcomePaymentsSignature, parseWelcomePaymentsStatus } from '@/lib/payment/welcomepayments-service';
import { welcomePaymentsWebhookSchema } from '@/lib/schemas/paymentSchema';

/**
 * 헤더 기반 HMAC-SHA256 서명 검증
 * Content-Type: application/x-www-form-urlencoded 형식의 body 검증
 *
 * @param body 서명할 바디 콘텐츠
 * @param headerSignature 헤더의 서명 값 (x-welcomepayments-signature)
 * @returns 검증 성공 여부
 */
function validateSignatureFromHeader(body: string, headerSignature: string): boolean {
  try {
    const secret = process.env.WELCOMEPAYMENTS_WEBHOOK_SECRET;

    if (!secret) {
      logger.warn('[WelcomePayments] 웹훅 시크릿 미설정 (WELCOMEPAYMENTS_WEBHOOK_SECRET)');
      return false;
    }

    // HMAC-SHA256 계산
    const expectedSignature = createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    // Constant-time 비교 (타이밍 공격 방지)
    try {
      return timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(headerSignature)
      );
    } catch {
      // Buffer 길이가 다르면 timingSafeEqual 실패
      return false;
    }
  } catch (error) {
    logger.error('[WelcomePayments] 헤더 서명 검증 중 오류:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. 헤더 기반 서명 검증 (기본 지원)
    const headerSignature = request.headers.get('x-welcomepayments-signature');

    if (headerSignature) {
      // [경로 A] 헤더 기반 서명 검증
      const body = await request.text();

      if (!validateSignatureFromHeader(body, headerSignature)) {
        logger.warn('[WelcomePayments Webhook] 헤더 서명 검증 실패');
        return NextResponse.json(
          { ok: false, error: '서명 검증 실패' },
          { status: 401 }
        );
      }

      // body를 다시 JSON으로 파싱
      let params: Record<string, any>;
      try {
        params = JSON.parse(body);
      } catch {
        // application/x-www-form-urlencoded 형식이면 URL decode
        params = Object.fromEntries(new URLSearchParams(body));
      }

      return processWebhookPayload(params, headerSignature);
    }

    // [경로 B] 쿼리 파라미터 기반 서명 검증 (레거시 지원)
    const { searchParams } = new URL(request.url);

    const tid = searchParams.get('tid');
    const orderId = searchParams.get('orderId');
    const amount = searchParams.get('amount');
    const status = searchParams.get('status');
    const payMethod = searchParams.get('payMethod');
    const approvalNumber = searchParams.get('approvalNumber');
    const signature = searchParams.get('signature');
    const paidAt = searchParams.get('paidAt');
    const merchantKey = searchParams.get('merchantKey');

    // 2. 필수값 검증
    if (!tid || !orderId || !amount || !signature) {
      logger.warn('[WelcomePayments Webhook] 필수 파라미터 부족', {
        hasTid: !!tid,
        hasOrderId: !!orderId,
        hasAmount: !!amount,
        hasSignature: !!signature,
      });
      return NextResponse.json(
        { ok: false, error: '필수 파라미터 부족' },
        { status: 400 }
      );
    }

    // 3. HMAC-SHA256 서명 검증 (쿼리 파라미터 방식)
    const isValidSignature = validateWelcomePaymentsSignature(
      {
        tid,
        orderId,
        amount,
        status: status || 'pending',
      },
      signature
    );

    if (!isValidSignature) {
      logger.warn('[WelcomePayments Webhook] 서명 검증 실패', {
        orderId,
        tid,
      });
      return NextResponse.json(
        { ok: false, error: '서명 검증 실패' },
        { status: 401 }
      );
    }

    return processWebhookPayload(
      {
        tid,
        orderId,
        amount,
        status,
        payMethod,
        approvalNumber,
        signature,
        paidAt,
        merchantKey,
      },
      signature
    );
  } catch (error) {
    logger.error('[WelcomePayments Webhook] 큐 등록 중 오류:', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 웹훅 페이로드 처리 (공통 로직)
 *
 * @param params 웹훅 파라미터 객체
 * @param signature 검증된 서명 값
 */
async function processWebhookPayload(
  params: Record<string, any>,
  signature: string
) {
  try {
    const { tid, orderId, amount, status, payMethod, approvalNumber, paidAt, merchantKey } = params;

    // 필수 필드 재검증
    if (!tid || !orderId || !amount) {
      logger.warn('[WelcomePayments Webhook] 필수 필드 누락', {
        hasTid: !!tid,
        hasOrderId: !!orderId,
        hasAmount: !!amount,
      });
      return NextResponse.json(
        { ok: false, error: '필수 필드 누락' },
        { status: 400 }
      );
    }

    // 멱등성 검증: 이미 처리된 webhook인지 확인
    const existingQueue = await prisma.apisSyncQueue.findFirst({
      where: {
        targetType: 'WELCOMEPAYMENTS_WEBHOOK',
        metadata: {
          path: ['orderId'],
          equals: orderId,
        },
      },
      select: { id: true, status: true },
    });

    if (existingQueue && existingQueue.status === 'SUCCESS') {
      logger.log('[WelcomePayments Webhook] 중복 처리된 webhook (무시):', {
        orderId,
        tid,
      });
      return NextResponse.json(
        { ok: true, message: '이미 처리됨' },
        { status: 200 }
      );
    }

    // Zod 입력 검증
    let validatedData;
    try {
      validatedData = welcomePaymentsWebhookSchema.parse({
        tid,
        orderId,
        amount,
        status,
        payMethod,
        approvalNumber,
        signature,
        paidAt,
        merchantKey,
      });
    } catch (error: any) {
      logger.warn('[WelcomePayments Webhook] Zod 검증 실패:', {
        error: error.errors?.[0]?.message || '검증 실패',
        orderId,
      });
      return NextResponse.json(
        { ok: false, error: '입력 검증 실패' },
        { status: 400 }
      );
    }

    // 큐에 등록 (즉시 반환, Cron에서 배치 처리)
    const queueItem = await prisma.apisSyncQueue.create({
      data: {
        targetType: 'WELCOMEPAYMENTS_WEBHOOK',
        targetId: 0, // 나중에 Cron에서 설정
        status: 'PENDING',
        metadata: {
          tid,
          orderId,
          amount,
          status: status || 'pending',
          payMethod,
          approvalNumber,
          signature,
          paidAt,
          merchantKey,
          receivedAt: new Date().toISOString(),
        },
      },
    });

    logger.log('[WelcomePayments Webhook] 큐에 등록됨 (비동기 처리 대기):', {
      queueId: queueItem.id,
      orderId,
      tid,
      status: status || 'pending',
    });

    // 즉시 201 반환 (비동기 처리는 Cron에서 수행)
    return NextResponse.json(
      {
        ok: true,
        message: 'Webhook received',
        orderId,
        queueId: queueItem.id,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('[WelcomePayments Webhook] 페이로드 처리 중 오류:', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
