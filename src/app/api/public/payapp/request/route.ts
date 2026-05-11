import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { requestPayment, requestSubscription } from '@/lib/payapp';
import { normalizePhone } from '@/lib/phone-normalize';

/**
 * POST /api/public/payapp/request
 * 공개 랜딩페이지용 결제 요청 (인증 불필요)
 * - 랜딩페이지 slug/id로 조직을 특정
 * - 비회원 방문자가 결제 가능
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      type = 'onetime',
      goodname,
      price,
      customerName,
      customerPhone,
      customerEmail,
      landingPageId,
      cycleDay,
      expireDate,
    } = body as {
      type?: 'onetime' | 'subscription';
      goodname: string;
      price: number;
      customerName: string;
      customerPhone: string;
      customerEmail?: string;
      landingPageId: string;
      cycleDay?: number;
      expireDate?: string;
    };

    if (!goodname || !price || !customerName || !customerPhone || !landingPageId) {
      return NextResponse.json(
        { ok: false, message: '상품명, 금액, 이름, 전화번호, 랜딩페이지ID는 필수입니다.' },
        { status: 400 }
      );
    }

    // 랜딩페이지로 조직 특정 (인증 대신)
    const landingPage = await prisma.crmLandingPage.findFirst({
      where: { id: landingPageId, isActive: true },
      select: { organizationId: true, slug: true },
    });

    if (!landingPage) {
      return NextResponse.json({ ok: false, message: '랜딩페이지를 찾을 수 없습니다.' }, { status: 404 });
    }

    const orgId = landingPage.organizationId;
    const normalizedPhone = normalizePhone(customerPhone);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://crm.cruisedot.co.kr';
    const feedbackurl = `${baseUrl}/api/webhooks/payapp`;

    if (type === 'subscription') {
      if (!cycleDay || !expireDate) {
        return NextResponse.json(
          { ok: false, message: '정기결제는 결제일과 만료일이 필수입니다.' },
          { status: 400 }
        );
      }

      const result = await requestSubscription({
        goodname,
        goodprice: price,
        recvphone: normalizedPhone,
        cycleDay,
        expireDate,
        feedbackurl,
        var1: `sub_${Date.now()}`,
        recvemail: customerEmail,
      });

      if (!result.ok) {
        return NextResponse.json({ ok: false, message: result.error }, { status: 502 });
      }

      const subscription = await prisma.payAppSubscription.create({
        data: {
          organizationId: orgId,
          rebillNo: result.rebillNo!,
          goodname,
          goodprice: price,
          customerName,
          customerPhone: normalizedPhone,
          customerEmail: customerEmail ?? null,
          cycleDay,
          expireDate: new Date(expireDate),
          status: 'pending',
          payUrl: result.payUrl ?? null,
          landingPageId: landingPageId ?? null,
        },
      });

      logger.log('[Public/PayApp] 정기결제 등록', {
        subscriptionId: subscription.id,
        phone: normalizedPhone.slice(0, 4) + '***',
      });

      return NextResponse.json({ ok: true, type: 'subscription', payUrl: result.payUrl });
    }

    // 일반결제
    const orderId = `pay_${orgId.slice(0, 8)}_${Date.now()}`;

    const result = await requestPayment({
      goodname,
      price,
      recvphone: normalizedPhone,
      feedbackurl,
      var1: orderId,
      var2: landingPage.slug ?? '',
      recvemail: customerEmail,
      smsuse: 'n',
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.error }, { status: 502 });
    }

    await prisma.payAppPayment.create({
      data: {
        orderId,
        organizationId: orgId,
        amount: price,
        customerName,
        customerPhone: normalizedPhone,
        customerEmail: customerEmail ?? null,
        productName: goodname,
        mulNo: result.mulNo ?? null,
        status: 'pending',
        landingPageId: landingPageId ?? null,
      },
    });

    logger.log('[Public/PayApp] 일반결제 요청', {
      orderId,
      phone: normalizedPhone.slice(0, 4) + '***',
    });

    return NextResponse.json({ ok: true, type: 'onetime', orderId, payUrl: result.payUrl });
  } catch (err) {
    logger.error('[Public/PayApp] 결제 요청 실패', { err });
    return NextResponse.json({ ok: false, message: '결제 요청 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
