import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { cancelSubscription, requestPayment, requestSubscription } from '@/lib/payapp';
import { normalizePhone } from '@/lib/phone-normalize';

// ─── P1-6: 민감정보 마스킹 헬퍼 ───
function maskPhone(phone: string | null): string {
  if (!phone) return 'none';
  return `${phone.slice(0, 2)}***${phone.slice(-2)}`;
}

/**
 * POST /api/payapp/request
 * 페이앱 결제 요청 (일반결제 + 정기결제 통합)
 * - type: "onetime" (기본) | "subscription"
 */
export async function POST(req: Request) {
  let createdOrderId: string | null = null;
  let createdRebillNo: string | null = null;
  let createdSubscriptionId: string | null = null;

  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const body = await req.json();

    const {
      type = 'onetime',
      goodname,
      price,
      customerName,
      customerPhone,
      customerEmail,
      landingPageId,
      // 정기결제 전용
      cycleDay,
      expireDate,
    } = body as {
      type?: 'onetime' | 'subscription';
      goodname: string;
      price: number;
      customerName: string;
      customerPhone: string;
      customerEmail?: string;
      landingPageId?: string;
      cycleDay?: number;
      expireDate?: string;
    };

    if (!goodname || !price || price < 100 || !customerName || !customerPhone) {
      return NextResponse.json(
        { ok: false, message: '상품명, 금액, 이름, 전화번호는 필수입니다.' },
        { status: 400 }
      );
    }

    const landingPage = landingPageId
      ? await prisma.crmLandingPage.findFirst({
          where: { id: landingPageId, organizationId: orgId },
          select: { id: true, slug: true, organizationId: true },
        })
      : null;

    if (landingPageId && !landingPage) {
      return NextResponse.json(
        { ok: false, message: '랜딩페이지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const normalizedPhone = normalizePhone(customerPhone);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://mabizcruisedot.com';
    const feedbackurl = `${baseUrl}/api/webhooks/payapp`;

    if (type === 'subscription') {
      // ─── 정기결제 ───
      if (!cycleDay || !expireDate) {
        return NextResponse.json(
          { ok: false, message: '정기결제는 결제일(cycleDay)과 만료일(expireDate)이 필수입니다.' },
          { status: 400 }
        );
      }

      const subscription = await prisma.payAppSubscription.create({
        data: {
          organizationId: orgId,
          rebillNo: `pending_${Date.now()}`,
          goodname,
          goodprice: price,
          customerName,
          customerPhone: normalizedPhone,
          customerEmail: customerEmail ?? null,
          cycleDay,
          expireDate: new Date(expireDate),
          status: 'pending',
          payUrl: null,
          landingPageId: landingPageId ?? null,
        },
      });
      createdSubscriptionId = subscription.id;

      const result = await requestSubscription({
        goodname,
        goodprice: price,
        recvphone: normalizedPhone,
        cycleDay,
        expireDate,
        feedbackurl,
        var1: subscription.id,
        ...(landingPage?.slug ? { var2: landingPage.slug } : {}),
        recvemail: customerEmail,
      });

      if (!result.ok) {
        await prisma.payAppSubscription.updateMany({
          where: { id: subscription.id, organizationId: orgId },
          data: { status: 'failed' },
        });
        return NextResponse.json({ ok: false, message: result.error }, { status: 502 });
      }

      createdRebillNo = result.rebillNo ?? null;
      await prisma.payAppSubscription.updateMany({
        where: { id: subscription.id, organizationId: orgId },
        data: {
          rebillNo: result.rebillNo!,
          payUrl: result.payUrl ?? null,
        },
      });

      logger.log('[PayApp/Request] 정기결제 등록', {
        subscriptionId: subscription.id,
        rebillNo: result.rebillNo,
        phone: maskPhone(normalizedPhone), // P1-6: 마스킹 적용
      });

      return NextResponse.json({
        ok: true,
        type: 'subscription',
        subscriptionId: subscription.id,
        payUrl: result.payUrl,
      });
    }

    // ─── 일반결제 ───
    const nonce = randomBytes(4).toString('hex');
    const orderId = `pay_${orgId.slice(0, 8)}_${Date.now()}_${nonce}`;
    createdOrderId = orderId;

    // ─── P1-7: 취소 웹훅 금액 재검증 (결제 수신 시에도 원금 기록) ───
    // 취소 요청 시 환불액이 원금을 초과하지 않는지 확인하기 위해 원금 저장
    const originalAmount = price;

    // ─── pre-webhook: DB 레코드를 requestPayment 이전에 생성 ───
    // PayApp이 웹훅을 requestPayment 응답보다 먼저 보내는 race condition 방지
    await prisma.payAppPayment.create({
      data: {
        orderId,
        organizationId: orgId,
        amount: originalAmount, // P1-7: 원금 저장 (취소 검증용)
        customerName,
        customerPhone: normalizedPhone,
        customerEmail: customerEmail ?? null,
        productName: goodname,
        mulNo: null,
        status: 'pending',
        landingPageId: landingPageId ?? null,
      },
    });

    const result = await requestPayment({
      goodname,
      price,
      recvphone: normalizedPhone,
      feedbackurl,
      var1: orderId,
      var2: landingPage?.slug ?? '',
      recvemail: customerEmail,
      smsuse: 'n',
    });

    if (!result.ok) {
      const r = await prisma.payAppPayment.updateMany({ where: { orderId }, data: { status: 'failed' } });
      if (r.count === 0) logger.error('[PayApp/Request] failed 상태 저장 누락', { orderId });
      return NextResponse.json({ ok: false, message: result.error }, { status: 502 });
    }

    // mulNo 업데이트 (PayApp으로부터 수신한 주문번호 기록)
    if (result.mulNo) {
      const r = await prisma.payAppPayment.updateMany({ where: { orderId }, data: { mulNo: result.mulNo } });
      if (r.count === 0) logger.error('[PayApp/Request] mulNo 저장 누락', { orderId, mulNo: result.mulNo });
    }

    logger.log('[PayApp/Request] 일반결제 요청', {
      orderId,
      mulNo: result.mulNo,
      phone: maskPhone(normalizedPhone), // P1-6: 마스킹 적용
    });

    return NextResponse.json({
      ok: true,
      type: 'onetime',
      orderId,
      payUrl: result.payUrl,
    });
  } catch (err) {
    if (createdOrderId) {
      await prisma.payAppPayment.updateMany({ where: { orderId: createdOrderId }, data: { status: 'failed' } });
    }

    if (createdSubscriptionId) {
      await prisma.payAppSubscription.updateMany({
        where: { id: createdSubscriptionId },
        data: { status: 'failed' },
      });
    }

    if (createdRebillNo) {
      cancelSubscription(createdRebillNo).catch((cancelErr) => {
        logger.error('[PayApp/Request] 정기결제 외부 취소 실패', {
          rebillNo: createdRebillNo,
          err: cancelErr instanceof Error ? cancelErr.message : String(cancelErr),
        });
      });
    }

    logger.error('[PayApp/Request] 결제 요청 실패', { err });
    return NextResponse.json({ ok: false, message: '결제 요청 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
