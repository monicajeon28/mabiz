import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { sendFunnelEmail } from '@/lib/email';
import { COMPANY_INFO, CANCELLATION_POLICY_LINES, BANK_TRANSFER_LABEL, CRUISE_CANCELLATION_POLICY } from '@/lib/company-info';

// P0-4: HTML 이스케이프 함수
function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// POST: 구매계약서 발급
export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    // P0-1: resolveOrgId로 교체 — GLOBAL_ADMIN도 BONSA_ORG_ID로 처리
    const orgId = resolveOrgId(ctx);

    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '권한 없음' }, { status: 403 });
    }

    const body = await req.json() as {
      orderId: string;
      specialTerms?: string;
      signedAt?: string;
      // 수동 입력 override 필드 (자동 도출값 덮어쓰기)
      overrideProductName?: string;
      overrideDepartureDate?: string;
      overrideNights?: number;
      overrideHeadcount?: number;
      overrideCabinType?: string;
      overrideIncludedItems?: string[];
      overrideExcludedItems?: string[];
      overrideHasGuide?: 'Y' | 'N';
      overrideRefundPolicy?: { label: string; value: string }[];
      companions?: Array<{ name: string; birthDate: string; relation: string; phone: string; pnr?: string }>;
    };

    if (!body.orderId) {
      return NextResponse.json({ ok: false, message: 'orderId 필수' }, { status: 400 });
    }

    // 결제 정보 조회
    const payment = await prisma.payment.findUnique({
      where: { orderId: body.orderId },
      select: {
        orderId: true, buyerName: true, buyerTel: true, buyerEmail: true,
        amount: true, status: true, pgProvider: true, paidAt: true,
        productName: true, affiliateCode: true, metadata: true,
      },
    });

    if (!payment) {
      return NextResponse.json({ ok: false, message: '결제 정보 없음' }, { status: 404 });
    }

    if (payment.status !== 'completed') {
      return NextResponse.json({ ok: false, message: '결제 완료 건만 계약서 발급 가능합니다' }, { status: 400 });
    }

    // 조직 소유권 검증
    const sale = await prisma.affiliateSale.findFirst({
      where: { orderId: body.orderId, organizationId: orgId },
      select: { id: true, saleAmount: true, affiliateCode: true },
    });
    if (!sale) {
      return NextResponse.json({ ok: false, message: '이 조직의 판매건이 아닙니다' }, { status: 403 });
    }

    // 출발일 + 상품 포함/불포함/인솔자 자동 도출
    let departureDate: string | null = null;
    let nights: number | null = null;
    let includedItems: string[] = [
      '선박/항공기 운임', '숙박/식사료', '항만세·관광기금',
      '제세금', '여행알선수수료', '유류할증료', '관광지 입장료', '여행보험료',
    ];
    let excludedItems: string[] = ['선상팁', '쇼핑비', '선택관광'];
    let hasGuide: 'Y' | 'N' = 'Y';
    let productRefundPolicy: { label: string; value: string }[] = CRUISE_CANCELLATION_POLICY.slice();

    try {
      const productCode = (payment.metadata as { productCode?: string })?.productCode ?? '';
      if (productCode) {
        const trip = await prisma.$queryRaw<{ departureDate: Date; nights: number | null }[]>`
          SELECT "departureDate", "nights" FROM "Trip"
          WHERE "productCode" = ${productCode} LIMIT 1`;
        if (trip[0]?.departureDate) {
          departureDate = trip[0].departureDate.toISOString().split('T')[0] ?? null;
          nights = trip[0].nights ?? null;
        }

        // 크루즈 상품 정보로 포함/불포함 자동 도출
        const cp = await prisma.cruiseProduct.findUnique({
          where: { productCode },
          select: { isJapan: true, isDomestic: true, tourType: true, airlineName: true, refundPolicy: true },
        }).catch(() => null);

        if (cp) {
          hasGuide = cp.tourType !== 'FREE' ? 'Y' : 'N';
          if (hasGuide === 'Y') includedItems.push('안내자경비');
          if (cp.airlineName) includedItems.push('항공기 추가 운임');
          if (cp.isJapan) excludedItems.push('일본 관광 입국세');
          if (!cp.isDomestic) excludedItems.push('여권·비자 개인 부담');
          // 상품별 환불정책이 있으면 사용 (없으면 크루즈 기본 취소료 유지)
          if (Array.isArray(cp.refundPolicy)) {
            productRefundPolicy = cp.refundPolicy as { label: string; value: string }[];
          }
        }
      }
    } catch (productErr) { logger.warn('[PurchaseContract] 상품 정보 조회 실패 — 기본값 사용', { error: productErr instanceof Error ? productErr.message : String(productErr) }); }

    const paymentMethod = payment.pgProvider
      ? `${payment.pgProvider} (온라인 결제)`
      : BANK_TRANSFER_LABEL;

    const signedAt = body.signedAt ?? new Date().toISOString().split('T')[0];

    // AGENT → PENDING_APPROVAL, OWNER/ADMIN → APPROVED
    const status = (ctx.role === 'GLOBAL_ADMIN' || ctx.role === 'OWNER') ? 'APPROVED' : 'PENDING_APPROVAL';

    // 서명 토큰 생성
    const signToken = randomUUID();
    const signTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7일

    // P1-4: SalesDocument + Approval 트랜잭션 (중복 체크 포함)
    const txResult = await prisma.$transaction(async (tx) => {
      // Race condition 방지: 트랜잭션 내부에서 중복 재확인
      const alreadyExists = await tx.salesDocument.findFirst({
        where: { orderId: body.orderId, documentType: 'PURCHASE_CONTRACT' },
        select: { id: true },
      });
      if (alreadyExists) {
        return { conflict: true as const, documentId: alreadyExists.id };
      }

      const newDoc = await tx.salesDocument.create({
        data: {
          organizationId: orgId,
          documentType:   'PURCHASE_CONTRACT',
          status,
          orderId:        body.orderId,
          affiliateSaleId: sale.id,
          createdBy:      ctx.userId,
          generatedData: {
            // 계약 당사자
            buyerName:      payment.buyerName,
            buyerTel:       payment.buyerTel,
            buyerEmail:     payment.buyerEmail ?? null,
            // 상품 정보 (수동 override 우선 적용)
            productName:    body.overrideProductName ?? payment.productName ?? '크루즈 상품',
            departureDate:  body.overrideDepartureDate !== undefined ? body.overrideDepartureDate : departureDate,
            nights:         body.overrideNights !== undefined ? body.overrideNights : nights,
            // 계약 금액
            amount:         payment.amount,
            paymentMethod,
            paidAt:         payment.paidAt?.toISOString() ?? null,
            // 계약 정보
            affiliateCode:  sale.affiliateCode ?? null,
            signedAt,
            specialTerms:   body.specialTerms ?? null,
            // 상품 포함/불포함/인솔자 (수동 override 우선 적용)
            includedItems:  body.overrideIncludedItems ?? includedItems,
            excludedItems:  body.overrideExcludedItems ?? excludedItems,
            hasGuide:       body.overrideHasGuide ?? hasGuide,
            // 환불 규정: 수동 override > 상품별 정책 > 크루즈 기본 취소료
            refundPolicy:   body.overrideRefundPolicy ?? productRefundPolicy,
            // 취소/환불 규정 (법정 기준 요약) — 단일 출처(company-info) 사용으로 미리보기와 일치
            cancellationPolicy: CANCELLATION_POLICY_LINES,
            companyName:   COMPANY_INFO.name,
            companyReg:    `대표: ${COMPANY_INFO.ceo}`,
            issuedAt:      new Date().toISOString(),
            // 서명 관련 필드
            signToken,
            signTokenExpiresAt: signTokenExpiresAt.toISOString(),
            signStatus:    'PENDING', // PENDING | SIGNED
            companions:    body.companions ?? [],
            signatureImage: null,
            customerSignedAt: null,
            signedByName:  null,
          },
        },
        select: { id: true, status: true },
      });

      if (status === 'APPROVED') {
        await tx.salesDocumentApproval.create({
          data: {
            documentId: newDoc.id, organizationId: orgId,
            requestedBy: ctx.userId, approvedBy: ctx.userId,
            status: 'APPROVED', processedAt: new Date(),
          },
        });
      }

      return { conflict: false as const, doc: newDoc };
    });

    // 트랜잭션 내부에서 중복 감지된 경우
    if (txResult.conflict) {
      return NextResponse.json(
        { ok: false, message: '이미 발급된 계약서가 있습니다', documentId: txResult.documentId },
        { status: 409 },
      );
    }

    const doc = txResult.doc;

    // 서명 링크 이메일 발송 (fire-and-forget)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mabizcruisedot.com';
    const signUrl = `${appUrl}/contract/sign/${doc.id}?token=${signToken}`;

    // P1-2: APPROVED 시 서명 링크 이메일 중복 발송 방지
    if (!payment.buyerEmail) {
      logger.warn('[PurchaseContract] buyerEmail 없음 — 서명 링크 이메일 미발송. signUrl 응답에 포함됨', { docId: doc.id, signUrl });
    }
    if (payment.buyerEmail && status !== 'APPROVED') {
      sendFunnelEmail({
        organizationId: orgId,
        to:      payment.buyerEmail,
        subject: `[구매계약서] ${escHtml(payment.productName ?? '크루즈 상품')} 계약서 서명 요청`,
        html: `<div style="font-family:sans-serif;line-height:1.8;max-width:600px;margin:0 auto;padding:32px 24px">
<h2 style="color:#1a1a2e;margin:0 0 16px">구매 계약서 서명 요청</h2>
<p>${escHtml(payment.buyerName ?? '')}님, 안녕하세요.<br>아래 상품의 구매 계약서 서명을 요청드립니다.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0">
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666;width:40%">상품명</td><td style="padding:10px 14px;font-weight:600">${escHtml(payment.productName ?? '크루즈 상품')}</td></tr>
  ${departureDate ? `<tr><td style="padding:10px 14px;color:#666">출발일</td><td style="padding:10px 14px">${escHtml(departureDate)}</td></tr>` : ''}
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666">계약금액</td><td style="padding:10px 14px;font-weight:700;color:#2b6cb0">${payment.amount.toLocaleString()}원</td></tr>
  <tr><td style="padding:10px 14px;color:#666">결제방법</td><td style="padding:10px 14px">${escHtml(paymentMethod)}</td></tr>
</table>
<div style="text-align:center;margin:32px 0">
  <a href="${signUrl}" style="display:inline-block;background:#2b6cb0;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:700">계약서 서명하기</a>
</div>
<p style="color:#888;font-size:13px;text-align:center">위 링크는 <strong>7일</strong>간 유효합니다. 기간 내 서명을 완료해 주세요.</p>
<p style="color:#666;font-size:13px">버튼이 작동하지 않으면 아래 주소를 복사해 브라우저에 붙여넣기 해주세요:<br>
<span style="word-break:break-all;color:#4a90e2">${signUrl}</span></p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="color:#aaa;font-size:12px">문의사항은 담당 에이전트에게 연락해 주세요.</p>
</div>`,
        channel: 'MANUAL',
      }).catch(() => {});
    }

    // APPROVED면 발급 안내 이메일
    if (status === 'APPROVED') {
      if (payment.buyerEmail) {
        sendFunnelEmail({
          organizationId: orgId,
          to:      payment.buyerEmail,
          subject: `[구매계약서] ${escHtml(payment.productName ?? '크루즈 상품')} 구매 계약서가 발급되었습니다`,
          html: `<div style="font-family:sans-serif;line-height:1.8;max-width:600px;margin:0 auto;padding:32px 24px">
<h2 style="color:#1a1a2e;margin:0 0 16px">구매 계약서 발급 안내</h2>
<p>${escHtml(payment.buyerName ?? '')}님, 아래 내용으로 구매 계약서가 발급되었습니다.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0">
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666;width:40%">상품명</td><td style="padding:10px 14px;font-weight:600">${escHtml(payment.productName ?? '크루즈 상품')}</td></tr>
  ${departureDate ? `<tr><td style="padding:10px 14px;color:#666">출발일</td><td style="padding:10px 14px">${escHtml(departureDate)}</td></tr>` : ''}
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666">계약금액</td><td style="padding:10px 14px;font-weight:700;color:#2b6cb0">${payment.amount.toLocaleString()}원</td></tr>
  <tr><td style="padding:10px 14px;color:#666">결제방법</td><td style="padding:10px 14px">${escHtml(paymentMethod)}</td></tr>
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666">계약일</td><td style="padding:10px 14px">${escHtml(signedAt)}</td></tr>
  <tr><td style="padding:10px 14px;color:#666">문서번호</td><td style="padding:10px 14px;font-size:12px;color:#888">${escHtml(doc.id)}</td></tr>
</table>
${body.specialTerms ? `<p style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;margin:16px 0;border-radius:0 8px 8px 0"><strong>특약사항:</strong> ${escHtml(body.specialTerms)}</p>` : ''}
<p style="color:#666;font-size:14px">문의사항은 담당 에이전트에게 연락해 주세요.</p>
</div>`,
          channel: 'MANUAL',
        }).catch(() => {});
      }
    }

    logger.log('[PurchaseContract] 발급', { orgId, orderId: body.orderId, status, docId: doc.id });
    return NextResponse.json({ ok: true, documentId: doc.id, status });
  } catch (e) {
    // P2-3: logger.error 사용
    logger.error('[PurchaseContract] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const ctx   = await getAuthContext();
    // P0-1: resolveOrgId로 교체
    const orgId = resolveOrgId(ctx);
    if (ctx.role === 'FREE_SALES') return NextResponse.json({ ok: false }, { status: 403 });

    const docs = await prisma.salesDocument.findMany({
      where: { organizationId: orgId, documentType: 'PURCHASE_CONTRACT' },
      orderBy: { createdAt: 'desc' }, take: 50,
      select: {
        id: true, status: true, orderId: true, createdAt: true, approvedAt: true,
        contactId: true, generatedData: true,
        contact: { select: { name: true, phone: true } },
      },
    });
    return NextResponse.json({ ok: true, documents: docs });
  } catch (e) {
    // P2-3: logger.error 사용
    logger.error('[PurchaseContract GET] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
