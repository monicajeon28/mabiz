import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { COMPANY_INFO, CANCELLATION_POLICY_LINES, BANK_TRANSFER_LABEL, CRUISE_CANCELLATION_POLICY } from '@/lib/company-info';
import { refundPolicyToLines, normalizeRefundPolicy } from '@/lib/refund-calculator';

// POST: 구매계약서 발급 (#17c: 발급 시 자동 이메일/문자 미발송 — 운영자가 signUrl 수동 전달)
export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    // P0-1: resolveOrgId로 교체 — GLOBAL_ADMIN도 BONSA_ORG_ID로 처리
    const orgId = resolveOrgId(ctx);

    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '권한 없음' }, { status: 403 });
    }

    const body = await req.json() as {
      orderId?: string;
      // 발급 모드: 'sale'=구매자 검색(Payment 강결합) / 'manual'=직접입력(검색 없이 발급)
      mode?: 'sale' | 'manual';
      // 수동(manual) 모드 필드 — Payment/판매건 없이 직접 입력으로 발급
      buyerName?: string;
      buyerTel?: string;
      buyerEmail?: string;
      productName?: string;
      amount?: number;
      productCode?: string;
      departureDate?: string;
      nights?: number;
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
      // ③-2 계약 추가 정보 (미리보기에만 보이던 서술형 필드 — generatedData에 저장)
      contractDetails?: {
        contractType?: '기획여행' | '희망여행';
        travelGuarantee?: ('공제' | '예치금' | '영업보증보험')[];
        hasInsurance?: boolean;
        insuranceCompany?: string;
        minPax?: number;
        maxPax?: number;
        pricePerPerson?: number;
        transportTypes?: ('항공기' | '선박' | '기차')[];
        shipName?: string;
        accommodationTypes?: ('일정표표시' | '관광호텔' | '기타')[];
        hotelGrade?: string;
        mealDisplay?: '일정표표시' | '개별';
        breakfast?: number;
        lunch?: number;
        dinner?: number;
        localGuide?: '있음' | '없음';
        localTransport?: ('버스' | '승용차' | '기타' | '없음')[];
        localAgency?: '있음' | '없음';
      };
    };

    const isManual = body.mode === 'manual';

    // ── sale / manual 공통 변수 (양쪽 분기에서 반드시 채움) ──
    let buyerName: string | null;
    let buyerTel: string | null;
    let buyerEmail: string | null;
    let docAmount: number;
    let docProductName: string;
    let paidAtIso: string | null;
    let paymentMethod: string;
    let effectiveOrderId: string | null;
    let effectiveSaleId: string | null;
    let docAffiliateCode: string | null;
    let lookupProductCode: string;

    if (isManual) {
      // 수동(직접입력) 모드 — orderId/Payment/결제완료/판매건 소유권 검증 전부 건너뜀.
      // 대신 필수 입력값(이름·연락처·상품명·금액)만 직접 검증한다.
      const mName    = (body.buyerName ?? '').trim();
      const mTel     = (body.buyerTel ?? '').trim();
      const mProduct = (body.productName ?? '').trim();
      const mAmount  = Number(body.amount);
      if (!mName)    return NextResponse.json({ ok: false, message: '구매자 이름을 입력해주세요' }, { status: 400 });
      if (!mTel)     return NextResponse.json({ ok: false, message: '구매자 연락처를 입력해주세요' }, { status: 400 });
      if (!mProduct) return NextResponse.json({ ok: false, message: '상품명을 입력해주세요' }, { status: 400 });
      if (!Number.isFinite(mAmount) || mAmount <= 0) {
        return NextResponse.json({ ok: false, message: '계약 금액을 0원보다 큰 숫자로 입력해주세요' }, { status: 400 });
      }
      buyerName        = mName;
      buyerTel         = mTel;
      buyerEmail       = (body.buyerEmail ?? '').trim() || null;
      docAmount        = mAmount;
      docProductName   = mProduct;
      paidAtIso        = null;
      paymentMethod    = BANK_TRANSFER_LABEL;
      effectiveOrderId = null;
      effectiveSaleId  = null;
      docAffiliateCode = null;
      lookupProductCode = (body.productCode ?? '').trim();
    } else {
      // 기존 sale 모드 — orderId 필수 + 결제 조회 + 완료 + 판매건 소유권 검증 (동작 보존)
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

      buyerName        = payment.buyerName;
      buyerTel         = payment.buyerTel;
      buyerEmail       = payment.buyerEmail ?? null;
      docAmount        = payment.amount;
      docProductName   = payment.productName ?? '크루즈 상품';
      paidAtIso        = payment.paidAt?.toISOString() ?? null;
      paymentMethod    = payment.pgProvider ? `${payment.pgProvider} (온라인 결제)` : BANK_TRANSFER_LABEL;
      effectiveOrderId = body.orderId;
      effectiveSaleId  = sale.id;
      docAffiliateCode = sale.affiliateCode ?? null;
      lookupProductCode = (payment.metadata as { productCode?: string })?.productCode ?? '';
    }

    // 출발일 + 상품 포함/불포함/인솔자 자동 도출
    // manual이 departureDate/nights를 직접 주면 그 값을 우선(아래 Trip 조회는 비어있을 때만 채움).
    let departureDate: string | null = (isManual && body.departureDate) ? body.departureDate : null;
    let nights: number | null = (isManual && typeof body.nights === 'number') ? body.nights : null;
    let includedItems: string[] = [
      '선박/항공기 운임', '숙박/식사료', '항만세·관광기금',
      '제세금', '여행알선수수료', '유류할증료', '관광지 입장료', '여행보험료',
    ];
    let excludedItems: string[] = ['선상팁', '쇼핑비', '선택관광'];
    let hasGuide: 'Y' | 'N' = 'Y';
    let productRefundPolicy: { label: string; value: string }[] = CRUISE_CANCELLATION_POLICY.slice();

    try {
      const productCode = lookupProductCode;
      if (productCode) {
        const trip = await prisma.$queryRaw<{ departureDate: Date; nights: number | null }[]>`
          SELECT "departureDate", "nights" FROM "Trip"
          WHERE "productCode" = ${productCode} LIMIT 1`;
        if (trip[0]?.departureDate) {
          // manual 직접 입력값이 이미 있으면 보존, 없을 때만 Trip 값으로 채움
          if (departureDate === null) departureDate = trip[0].departureDate.toISOString().split('T')[0] ?? null;
          if (nights === null) nights = trip[0].nights ?? null;
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
          // 상품별 환불정책 — CruiseProduct.refundPolicy 는 RefundPolicyJson({slots}) 객체.
          // 공통 어댑터로 {label,value}[] 변환 (이전 Array.isArray 가드는 객체라 항상 false였음 = 버그).
          const lines = refundPolicyToLines(normalizeRefundPolicy(cp.refundPolicy));
          if (lines.length > 0) {
            productRefundPolicy = lines;
          }
        }
      }
    } catch (productErr) { logger.warn('[PurchaseContract] 상품 정보 조회 실패 — 기본값 사용', { error: productErr instanceof Error ? productErr.message : String(productErr) }); }

    const signedAt = body.signedAt ?? new Date().toISOString().split('T')[0];

    // AGENT → PENDING_APPROVAL, OWNER/ADMIN → APPROVED
    const status = (ctx.role === 'GLOBAL_ADMIN' || ctx.role === 'OWNER') ? 'APPROVED' : 'PENDING_APPROVAL';

    // 서명 토큰 생성
    const signToken = randomUUID();
    const signTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7일

    // P1-4: SalesDocument + Approval 트랜잭션 (중복 체크 포함)
    const txResult = await prisma.$transaction(async (tx) => {
      // Race condition 방지: 트랜잭션 내부에서 중복 재확인
      // ⚠️ manual 발급은 orderId=null 이므로 null끼리 오매칭되지 않도록 effectiveOrderId 있을 때만 검사
      const alreadyExists = effectiveOrderId
        ? await tx.salesDocument.findFirst({
            where: { orderId: effectiveOrderId, documentType: 'PURCHASE_CONTRACT' },
            select: { id: true },
          })
        : null;
      if (alreadyExists) {
        return { conflict: true as const, documentId: alreadyExists.id };
      }

      const newDoc = await tx.salesDocument.create({
        data: {
          organizationId: orgId,
          documentType:   'PURCHASE_CONTRACT',
          status,
          orderId:        effectiveOrderId,
          affiliateSaleId: effectiveSaleId,
          createdBy:      ctx.userId,
          generatedData: {
            // 계약 당사자
            buyerName:      buyerName,
            buyerTel:       buyerTel,
            buyerEmail:     buyerEmail,
            // 상품 정보 (수동 override 우선 적용)
            productName:    body.overrideProductName ?? docProductName,
            departureDate:  body.overrideDepartureDate !== undefined ? body.overrideDepartureDate : departureDate,
            nights:         body.overrideNights !== undefined ? body.overrideNights : nights,
            // 계약 금액
            amount:         docAmount,
            paymentMethod,
            paidAt:         paidAtIso,
            // 계약 정보
            affiliateCode:  docAffiliateCode,
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
            // ③-2 계약 추가 정보 — 미리보기/재조회 시 그대로 복원되도록 top-level 저장
            ...(body.contractDetails ?? {}),
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

    // #17c: 발급 시 자동 이메일/문자 발송하지 않음 — 운영자가 서명 링크(signUrl)를 직접 복사/문자로
    //   전달해 서명받는다. (자동발송은 "이메일칸도 없는데 발송됨" 혼란 + 미동의 발송 위험. 수동=운영자 통제.)
    //   signUrl·signToken을 응답에 실어 발급 직후 바로 복사/전달 가능하게 함.

    logger.log('[PurchaseContract] 발급(자동발송 없음)', { orgId, orderId: effectiveOrderId, mode: isManual ? 'manual' : 'sale', status, docId: doc.id });
    return NextResponse.json({ ok: true, documentId: doc.id, status, signUrl, signToken });
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
