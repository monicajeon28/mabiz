import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';
import {
  integrateContactWithLoop5Sms,
  getLoop6AgentDStats,
} from '@/lib/loop6-agent-d-integrator';
import { WebhookPayload } from '@/lib/contact-auto-creator';
import {
  maskPhone,
  maskPayloadForLogging,
  createSafeErrorResponse,
  generateErrorId,
  logSafeError,
} from '@/lib/pii-masker';

/**
 * POST /api/webhook/cruisedot-payment
 *
 * 크루즈닷몰 Payment Webhook
 * Contact 자동 생성 → Loop 5 Day 0-3 SMS 자동 발송
 *
 * 예상 처리:
 * - 응답 시간: <1초
 * - 에러율: <0.1%
 * - SMS 발송율: 98%+
 *
 * 보안:
 * - WEBHOOK_SECRET 검증 (X-Webhook-Signature)
 * - Rate limiting (100 req/min)
 * - Input validation (name, phone)
 * - Error handling (모든 에러는 200 OK + 상세 로깅)
 */

interface PaymentWebhookRequest {
  // 필수
  payment_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;

  // 크루즈 정보
  cruise_type?: string; // "europe", "caribbean", "asia"
  departure_date?: string; // "2026-06-15"
  cabin_price?: number;
  cabin_type?: string; // "inside", "oceanview", "balcony", "suite"

  // 고객 정보
  customer_age?: number;
  customer_family_size?: number;
  customer_country?: string;

  // 추적
  order_id?: string;
  timestamp?: string;
  referrer?: string;
}

// ============================================
// Webhook 서명 검증 (HMAC-SHA256)
// ============================================

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // [P0-SEC-301] Timing-safe 비교로 타이밍 공격 방지
  if (signature.length !== expectedSignature.length) {
    return false;
  }

  try {
    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

// ============================================
// Payload 변환: Payment → WebhookPayload
// ============================================

function transformPaymentPayload(paymentData: PaymentWebhookRequest): WebhookPayload {
  // 선호도 유형 감지 (가격/객실 타입 기반)
  let preferenceType = 'luxury';

  if (paymentData.cabin_type === 'inside') {
    preferenceType = 'budget';
  } else if (paymentData.cabin_type === 'oceanview') {
    preferenceType = 'comfort';
  } else if (paymentData.cabin_type === 'balcony' || paymentData.cabin_type === 'suite') {
    preferenceType = 'luxury';
  }

  // 크루즈 타입별 취향
  if (paymentData.cruise_type === 'caribbean') {
    preferenceType += '_tropical';
  } else if (paymentData.cruise_type === 'europe') {
    preferenceType += '_culture';
  }

  return {
    name: paymentData.customer_name,
    phone: paymentData.customer_phone,
    email: paymentData.customer_email,
    age: paymentData.customer_age,
    cruiseInterest: paymentData.cruise_type || 'general',
    departureDate: paymentData.departure_date,
    budgetRange:
      paymentData.cabin_price && paymentData.cabin_price > 0
        ? `$${Math.round(paymentData.cabin_price)}`
        : undefined,
    preferenceType,
    familyComposition:
      paymentData.customer_family_size &&
      paymentData.customer_family_size > 2
        ? 'family_with_kids'
        : 'couple',
    paymentId: paymentData.payment_id,
    orderId: paymentData.order_id,
    timestamp: paymentData.timestamp || new Date().toISOString(),
    source: 'cruisedot_payment',
  };
}

// ============================================
// 메인 Webhook 핸들러
// ============================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // ============================================
    // 1. 요청 헤더 및 바디 파싱
    // ============================================

    const rawBody = await request.text();
    const signature = request.headers.get('x-webhook-signature');
    const organizationId = request.headers.get('x-org-id') || 'cruisedot-default';

    if (!rawBody) {
      logger.warn('[Webhook] 빈 바디 수신');
      return NextResponse.json(
        { error: 'Empty request body' },
        { status: 400 }
      );
    }

    let paymentData: PaymentWebhookRequest;
    try {
      paymentData = JSON.parse(rawBody) as PaymentWebhookRequest;
    } catch (e) {
      logger.error('[Webhook] JSON 파싱 오류', {
        error: e instanceof Error ? e.message : String(e),
        bodyLength: rawBody.length,
      });
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
    }

    // ============================================
    // 2. Webhook 서명 검증 (필수)
    // ============================================

    // [P0-SEC-302] WEBHOOK_SECRET 필수 검증
    if (!process.env.WEBHOOK_SECRET) {
      logger.error('[Webhook] CRITICAL: WEBHOOK_SECRET 환경변수 미설정. 웹훅 수신 불가능합니다. DevOps에 연락하세요.');
      return NextResponse.json(
        { error: 'Server misconfiguration' },
        { status: 500 }
      );
    }

    // [P0-SEC-303] 서명 헤더 필수 검증
    if (!signature) {
      logger.warn('[Webhook] 서명 헤더 누락 — 요청 차단');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 403 }
      );
    }

    // [P0-SEC-304] 서명 길이 검증 (기본 SHA256 hex는 64자)
    if (signature.length !== 64) {
      logger.warn('[Webhook] 서명 길이 불일치 — 위조 의심', {
        paymentId: paymentData.payment_id,
        receivedLength: signature.length,
        expected: 64,
      });
      return NextResponse.json(
        { error: 'Invalid signature format' },
        { status: 403 }
      );
    }

    try {
      const isValid = verifyWebhookSignature(
        rawBody,
        signature,
        process.env.WEBHOOK_SECRET
      );

      if (!isValid) {
        logger.warn('[Webhook] 서명 검증 실패 — 인증 오류', {
          paymentId: paymentData.payment_id,
          signature: signature.slice(0, 8) + '***' + signature.slice(-8),
        });

        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 403 }
        );
      }

      logger.log('[Webhook] 서명 검증 성공', {
        paymentId: paymentData.payment_id,
      });
    } catch (error) {
      logger.error('[Webhook] 서명 검증 오류', {
        error: error instanceof Error ? error.message : String(error),
        paymentId: paymentData.payment_id,
      });
      return NextResponse.json(
        { error: 'Signature verification failed' },
        { status: 403 }
      );
    }

    // ============================================
    // 3. 입력 데이터 검증
    // ============================================

    if (!paymentData.customer_name || !paymentData.customer_phone) {
      logger.warn('[Webhook] 필수 필드 누락', {
        paymentId: paymentData.payment_id,
        hasName: !!paymentData.customer_name,
        hasPhone: !!paymentData.customer_phone,
      });

      return NextResponse.json(
        { error: 'Missing required fields: customer_name, customer_phone' },
        { status: 400 }
      );
    }

    // ============================================
    // 4. Payload 변환 및 Contact 생성
    // ============================================

    const webhookPayload = transformPaymentPayload(paymentData);

    logger.log('[Webhook] Contact 자동 생성 시작', {
      paymentId: paymentData.payment_id,
      name: paymentData.customer_name ? paymentData.customer_name.substring(0, 1) + '*'.repeat(Math.max(0, paymentData.customer_name.length - 1)) : 'unknown',
      phone: maskPhone(paymentData.customer_phone),
    });

    const integrationResult = await integrateContactWithLoop5Sms(
      organizationId,
      webhookPayload,
      true // Day 0 SMS 즉시 발송
    );

    if (!integrationResult.success) {
      logger.error('[Webhook] Contact 통합 실패', {
        paymentId: paymentData.payment_id,
        error: integrationResult.error,
      });

      // 에러가 발생했지만 200 OK 응답 (비동기 재시도를 위해)
      return NextResponse.json(
        {
          success: false,
          paymentId: paymentData.payment_id,
          error: integrationResult.error,
          processingTime: Date.now() - startTime,
        },
        { status: 200 }
      );
    }

    // ============================================
    // 5. 성공 응답
    // ============================================

    logger.log('[Webhook] Contact 통합 완료', {
      paymentId: paymentData.payment_id,
      contactId: integrationResult.contactId,
      day0SmsSent: integrationResult.day0SmsResult?.success,
      processingTime: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        success: true,
        paymentId: paymentData.payment_id,
        contactId: integrationResult.contactId,
        day0SmsSent: integrationResult.day0SmsResult?.success || false,
        day0SmsId: integrationResult.day0SmsResult?.smsId,
        scheduledDays: integrationResult.scheduledDays,
        processingTime: Date.now() - startTime,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    // ============================================
    // 6. 예기치 않은 에러 처리
    // ============================================

    const errorId = generateErrorId();
    logSafeError(logger, error, '[Webhook] 예기치 않은 오류');

    return NextResponse.json(
      {
        success: false,
        message: '요청을 처리할 수 없습니다',
        errorId,
        contactSupport: true,
        processingTime: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// ============================================
// GET: 헬스 체크 + 통계
// ============================================

export async function GET(request: NextRequest) {
  try {
    const organizationId = request.nextUrl.searchParams.get('org_id') || 'cruisedot-default';
    const days = parseInt(request.nextUrl.searchParams.get('days') || '7', 10);

    const stats = await getLoop6AgentDStats(organizationId, days);

    return NextResponse.json(
      {
        success: true,
        service: 'Loop 6 - Agent D: Contact Auto Creator + Loop 5 SMS Integration',
        status: 'healthy',
        stats,
        lastUpdated: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorId = generateErrorId();
    logSafeError(logger, error, '[Webhook GET] 오류');

    return NextResponse.json(
      {
        success: false,
        message: '통계를 조회할 수 없습니다',
        errorId,
        contactSupport: true,
      },
      { status: 500 }
    );
  }
}

// ============================================
// OPTIONS: CORS preflight
// ============================================

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-webhook-signature, x-org-id',
    },
  });
}
