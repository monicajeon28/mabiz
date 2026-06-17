import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { cancelSubscription, requestPayment, requestSubscription } from '@/lib/payapp';
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

const RequestSchema = z.object({
  type:          z.enum(["onetime", "subscription"]).default("onetime"),
  goodname:      z.string().min(1).max(200),
  price:         z.number().int().min(100).max(100_000_000),
  customerName:  z.string().min(1).max(50),
  customerPhone: z.string().min(10).max(15),
  customerEmail: z.string().email().optional(),
  landingPageId: z.string().min(1),
  cycleDay:      z.number().int().min(1).max(90).optional(),
  expireDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '만료일은 YYYY-MM-DD 형식이어야 합니다.')
    .refine((d) => !d || new Date(d) > new Date(), { message: '만료일은 미래 날짜여야 합니다.' })
    .optional(),
});

/**
 * POST /api/public/payapp/request
 * 공개 랜딩페이지용 결제 요청 (인증 불필요)
 * - 랜딩페이지 slug/id로 조직을 특정
 * - 비회원 방문자가 결제 가능
 */
export async function POST(req: Request) {
  let createdSubscriptionId: string | null = null;
  let createdRebillNo: string | null = null;

  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: '입력값을 확인해주세요.', errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { type, goodname, price, customerName, customerPhone, customerEmail, landingPageId, cycleDay, expireDate } = parsed.data;

    // 랜딩페이지로 조직 특정 (인증 대신) — CRM 랜딩 먼저, B2B 랜딩 폴백
    let orgId: string;
    let landingSlug: string | null = null;
    let b2bMeta: { b2bLandingPageId: string; b2bLandingTitle: string; b2bCreatedBy: string | null } | null = null;

    const crmPage = await prisma.crmLandingPage.findFirst({
      where: { id: landingPageId, isActive: true },
      select: { organizationId: true, slug: true },
    });

    if (crmPage) {
      orgId = crmPage.organizationId;
      landingSlug = crmPage.slug;
    } else {
      // B2B 랜딩 페이지 폴백
      const b2bPage = await prisma.b2BLandingPage.findFirst({
        where: { id: landingPageId, isActive: true },
        select: { organizationId: true, title: true },
      });

      if (!b2bPage) {
        return NextResponse.json({ ok: false, message: '랜딩페이지를 찾을 수 없습니다.' }, { status: 404 });
      }

      orgId = b2bPage.organizationId;

      // ShortLink에서 페이지 생성자(어필리에이트) 조회
      // 'b2b-landing' category는 경로 삭제 후 신규 생성 없음 → dead branch 제거
      // 기존 DB에 해당 레코드가 있다면 scripts/migrate-shortlinks.mjs로 category 일괄 업데이트 권장
      const shortLink = await prisma.shortLink.findFirst({
        where: {
          category: 'landing-pages',
          targetUrl: { contains: landingPageId },
        },
        select: { createdBy: true },
      });

      b2bMeta = {
        b2bLandingPageId: landingPageId,
        b2bLandingTitle: b2bPage.title,
        b2bCreatedBy: shortLink?.createdBy ?? null,
      };
    }
    const normalizedPhone = normalizePhone(customerPhone);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://mabizcruisedot.com';
    const feedbackurl = `${baseUrl}/api/webhooks/payapp`;

    if (type === 'subscription') {
      if (!cycleDay || !expireDate) {
        return NextResponse.json(
          { ok: false, message: '정기결제는 결제일과 만료일이 필수입니다.' },
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

      logger.log('[Public/PayApp] 정기결제 등록', {
        subscriptionId: subscription.id,
        phone: normalizedPhone.slice(0, 4) + '***',
      });

      return NextResponse.json({ ok: true, type: 'subscription', payUrl: result.payUrl });
    }

    // 일반결제
    const orderId = `pay_${orgId.slice(0, 8)}_${Date.now()}`;

    // 완료 URL 구성 및 검증 (CRM 랜딩: /p/{slug}/..., B2B 랜딩: 기본 완료 페이지)
    const completionUrl = landingSlug
      ? `${baseUrl}/p/${landingSlug}/payment/complete?orderId=${orderId}`
      : `${baseUrl}/payment/complete?orderId=${orderId}`;
    if (!isSafeCompletionUrl(completionUrl)) {
      logger.warn('[Public/PayApp] 완료 URL이 유효하지 않음', { completionUrl });
      return NextResponse.json(
        { ok: false, message: '완료 페이지 URL이 유효하지 않습니다.' },
        { status: 400 }
      );
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
        mulNo: null,
        status: 'pending',
        landingPageId: landingPageId ?? null,
        ...(b2bMeta ? { metadata: b2bMeta } : {}),
      },
    });

    const result = await requestPayment({
      goodname,
      price,
      recvphone: normalizedPhone,
      feedbackurl,
      var1: orderId,
      var2: landingSlug ?? '',
      recvemail: customerEmail,
      smsuse: 'n',
      returnurl: completionUrl,
    });

    if (!result.ok) {
      await prisma.payAppPayment.updateMany({ where: { orderId }, data: { status: 'failed' } });
      return NextResponse.json({ ok: false, message: result.error }, { status: 502 });
    }

    if (result.mulNo) {
      await prisma.payAppPayment.updateMany({ where: { orderId }, data: { mulNo: result.mulNo } });
    }

    logger.log('[Public/PayApp] 일반결제 요청', {
      orderId,
      phone: normalizedPhone.slice(0, 4) + '***',
    });

    return NextResponse.json({ ok: true, type: 'onetime', orderId, payUrl: result.payUrl });
    } catch (err) {
      if (createdSubscriptionId) {
        await prisma.payAppSubscription.updateMany({
          where: { id: createdSubscriptionId },
          data: { status: 'failed' },
        });
      }

      if (createdRebillNo) {
        cancelSubscription(createdRebillNo).catch((cancelErr) => {
          logger.error('[Public/PayApp] 정기결제 외부 취소 실패', {
            rebillNo: createdRebillNo,
            err: cancelErr instanceof Error ? cancelErr.message : String(cancelErr),
          });
        });
      }

      logger.error('[Public/PayApp] 결제 요청 실패', { err });
      return NextResponse.json({ ok: false, message: '결제 요청 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
