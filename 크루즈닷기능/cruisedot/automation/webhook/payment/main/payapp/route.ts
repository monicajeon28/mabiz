export const dynamic = 'force-dynamic';

/**
 * PayApp 결제 Webhook 비동기 처리 (POST /api/payment/webhook/payapp)
 *
 * ⚠️ DEPRECATED: mabiz용 (더 이상 사용 안 함)
 * 크루즈닷몰은 WelcomePayments 게이트웨이 사용
 * 새로운 웹훅: /api/payment/webhook/welcomepayments
 *
 * 기능:
 * - 멱등성 검증 (mul_no로 중복 방지)
 * - Zod 입력 검증
 * - Webhook 검증 (PayApp 서명 확인)
 * - 비동기 큐 등록 (즉시 반환)
 * - 배치 처리 (Cron에서 호출)
 *
 * 아키텍처:
 * 1. Webhook 수신 → 즉시 201 반환 (최대 3초)
 * 2. ApisSyncQueue에 등록 (PENDING)
 * 3. Cron (/api/cron/process-webhooks): 10초마다 PENDING 배치 처리
 * 4. PayAppPayment + Payment 업데이트
 * 5. 최대 3회 재시도 (exponential backoff)
 *
 * P0 체크리스트:
 * ✓ 멱등성 검증 (mul_no)
 * ✓ Zod 입력 검증
 * ✓ Webhook 검증
 * ✓ 큐 등록 (즉시 반환)
 * ✓ 에러 마스킹
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { validatePayAppFeedback, getPaymentStatus, getPayTypeName } from '@/lib/payapp';
import { payAppWebhookSchema } from '@/lib/schemas/paymentSchema';

export async function POST(request: NextRequest) {
  try {
    // 1. Query 파라미터 추출
    const { searchParams } = new URL(request.url);

    const userid = searchParams.get('userid');
    const linkkey = searchParams.get('linkkey');
    const linkval = searchParams.get('linkval');
    const goodname = searchParams.get('goodname');
    const price = searchParams.get('price');
    const recvphone = searchParams.get('recvphone');
    const var1 = searchParams.get('var1'); // orderId
    const var2 = searchParams.get('var2'); // landingPageSlug
    const mul_no = searchParams.get('mul_no');
    const payurl = searchParams.get('payurl');
    const csturl = searchParams.get('csturl');
    const pay_date = searchParams.get('pay_date');
    const pay_state = searchParams.get('pay_state');
    const pay_type = searchParams.get('pay_type');
    const card_name = searchParams.get('card_name');
    const memo = searchParams.get('memo');
    const reqaddr = searchParams.get('reqaddr');

    // 2. 필수값 검증
    if (!userid || !linkkey || !linkval) {
      logger.warn('[PayApp Webhook] 필수 파라미터 부족 (userid/linkkey/linkval)', {
        userid,
        linkkey,
        linkval,
      });
      return NextResponse.json({ ok: false, error: '인증정보 부족' }, { status: 400 });
    }

    // 3. Webhook 검증 (PayApp 정보 확인)
    const isValid = validatePayAppFeedback({
      userid,
      linkkey,
      linkval,
      goodname: goodname || '',
      price: price || '',
      recvphone: recvphone || '',
      var1,
      var2,
      mul_no,
      payurl,
      csturl: csturl || '',
      card_name,
      pay_date,
      pay_state,
      pay_type,
      memo,
      reqaddr,
    });

    if (!isValid) {
      logger.warn('[PayApp Webhook] 검증 실패 (linkkey/linkval 불일치)', { var1 });
      return NextResponse.json({ ok: false, error: '검증 실패' }, { status: 401 });
    }

    // 4. mul_no 필수 검증 (멱등성 키)
    if (!mul_no) {
      logger.warn('[PayApp Webhook] mul_no(멱등성 키) 필수', { var1 });
      return NextResponse.json(
        { ok: false, error: 'mul_no 필수' },
        { status: 400 }
      );
    }

    // 5. 멱등성 검증: 이미 처리된 webhook인지 확인
    const existingQueue = await prisma.apisSyncQueue.findFirst({
      where: {
        targetType: 'PAYMENT_WEBHOOK',
        metadata: {
          path: ['mulNo'],
          equals: mul_no,
        },
      },
      select: { id: true, status: true },
    });

    if (existingQueue && existingQueue.status === 'SUCCESS') {
      logger.log('[PayApp Webhook] 중복 처리된 webhook (무시):', {
        mul_no,
        orderId: var1,
      });
      return NextResponse.json({ ok: true, message: '이미 처리됨' }, { status: 200 });
    }

    // 6. Zod 입력 검증
    let validatedData;
    try {
      validatedData = payAppWebhookSchema.parse({
        userid,
        linkkey,
        linkval,
        goodname,
        price,
        recvphone,
        var1,
        var2,
        mul_no,
        payurl,
        csturl,
        pay_date,
        pay_state,
        pay_type,
        card_name,
        memo,
        reqaddr,
      });
    } catch (error: any) {
      logger.warn('[PayApp Webhook] Zod 검증 실패:', {
        error: error.errors?.[0]?.message || '검증 실패',
        var1,
      });
      return NextResponse.json(
        { ok: false, error: '입력 검증 실패' },
        { status: 400 }
      );
    }

    // 7. 큐에 등록 (즉시 반환)
    const queueItem = await prisma.apisSyncQueue.create({
      data: {
        targetType: 'PAYMENT_WEBHOOK',
        targetId: 0, // 나중에 Cron에서 설정
        status: 'PENDING',
        metadata: {
          userid,
          linkkey,
          linkval,
          goodname,
          price,
          recvphone,
          var1,
          var2,
          mul_no,
          payurl,
          csturl,
          pay_date,
          pay_state,
          pay_type,
          card_name,
          memo,
          reqaddr,
          receivedAt: new Date().toISOString(),
        },
      },
    });

    logger.log('[PayApp Webhook] 큐에 등록됨 (비동기 처리 대기):', {
      queueId: queueItem.id,
      mul_no,
      orderId: var1,
    });

    // 8. 즉시 201 반환 (비동기 처리는 Cron에서 수행)
    return NextResponse.json(
      {
        ok: true,
        message: 'Webhook received',
        mul_no,
        queueId: queueItem.id,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('[PayApp Webhook] 큐 등록 중 오류:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
