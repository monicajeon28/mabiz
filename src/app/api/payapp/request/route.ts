import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { requestPayment, requestSubscription } from '@/lib/payapp';
import { normalizePhone } from '@/lib/phone-normalize';

// ─── P0-5: returnUrl 도메인 화이트리스트 ───
const ALLOWED_COMPLETION_DOMAINS = [
  'mabizcruisedot.com',
  'cruisedot.co.kr',
  'localhost:3000', // 개발 환경
];

function isSafeCompletionUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    return ALLOWED_COMPLETION_DOMAINS.some(domain =>
      parsed.hostname.endsWith(domain) || parsed.hostname === domain
    );
  } catch {
    return false;
  }
}

// ─── P1-6: 민감정보 마스킹 헬퍼 ───
function maskPhone(phone: string | null): string {
  if (!phone) return 'none';
  return `${phone.slice(0, 2)}***${phone.slice(-2)}`;
}

function maskOrderId(orderId: string | null): string {
  if (!orderId) return 'none';
  return `${orderId.slice(0, 3)}***${orderId.slice(-3)}`;
}

/**
 * POST /api/payapp/request
 * 페이앱 결제 요청 (일반결제 + 정기결제 통합)
 * - type: "onetime" (기본) | "subscription"
 */
export async function POST(req: Request) {
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
    const orderId = `pay_${orgId.slice(0, 8)}_${Date.now()}`;

    const result = await requestPayment({
      goodname,
      price,
      recvphone: normalizedPhone,
      feedbackurl,
      var1: orderId,
      var2: landingPageId ?? '',
      recvemail: customerEmail,
      smsuse: 'n',
    });

    // ─── P1-7: 취소 웹훅 금액 재검증 (결제 수신 시에도 원금 기록) ───
    // 취소 요청 시 환불액이 원금을 초과하지 않는지 확인하기 위해 원금 저장
    const originalAmount = price;

    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.error }, { status: 502 });
    }

    await prisma.payAppPayment.create({
      data: {
        orderId,
        organizationId: orgId,
        amount: originalAmount, // P1-7: 원금 저장 (취소 검증용)
        customerName,
        customerPhone: normalizedPhone,
        customerEmail: customerEmail ?? null,
        productName: goodname,
        mulNo: result.mulNo ?? null,
        status: 'pending',
        landingPageId: landingPageId ?? null,
      },
    });

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
    logger.error('[PayApp/Request] 결제 요청 실패', { err });
    return NextResponse.json({ ok: false, message: '결제 요청 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
