import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendFunnelEmail } from '@/lib/email';

type Companion = {
  name: string;      // 이름 (필수)
  birthDate: string; // 생년월일 YYYY-MM-DD (필수)
  relation: string;  // 관계: 배우자|자녀|부모|형제자매|친구|기타
  phone: string;     // 연락처 (필수)
};

// ─── GET /api/documents/purchase-contract/sign?docId=X&token=Y ───────────────
// 공개 API — 토큰 기반, 인증 불필요
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const docId = searchParams.get('docId');
    const token = searchParams.get('token');

    if (!docId || !token) {
      return NextResponse.json(
        { ok: false, message: 'docId와 token이 필요합니다' },
        { status: 400 },
      );
    }

    const doc = await prisma.salesDocument.findUnique({
      where: { id: docId },
      select: { id: true, generatedData: true, status: true },
    });

    if (!doc) {
      return NextResponse.json(
        { ok: false, message: '문서를 찾을 수 없습니다' },
        { status: 404 },
      );
    }

    const data = doc.generatedData as Record<string, unknown>;

    // 토큰 검증
    if (data.signToken !== token) {
      return NextResponse.json(
        { ok: false, message: '유효하지 않은 링크입니다' },
        { status: 401 },
      );
    }

    // 만료 검증
    if (
      data.signTokenExpiresAt &&
      new Date(data.signTokenExpiresAt as string) < new Date()
    ) {
      return NextResponse.json(
        { ok: false, message: '링크가 만료되었습니다 (7일 경과)' },
        { status: 410 },
      );
    }

    // 이미 서명된 경우
    if (data.signStatus === 'SIGNED') {
      return NextResponse.json({
        ok: true,
        alreadySigned: true,
        signedAt: data.signedAt ?? null,
      });
    }

    return NextResponse.json({
      ok: true,
      doc: {
        id: doc.id,
        productName:        data.productName        ?? null,
        buyerName:          data.buyerName          ?? null,
        amount:             data.amount             ?? null,
        departureDate:      data.departureDate      ?? null,
        nights:             data.nights             ?? null,
        paymentMethod:      data.paymentMethod      ?? null,
        paidAt:             data.paidAt             ?? null,
        signedAt:           data.signedAt           ?? null,
        cancellationPolicy: data.cancellationPolicy ?? null,
        specialTerms:       data.specialTerms       ?? null,
        companyName:        data.companyName        ?? null,
      },
      alreadySigned: false,
    });
  } catch (e) {
    logger.log('[PurchaseContractSign GET] 오류', {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// ─── POST /api/documents/purchase-contract/sign ──────────────────────────────
// 공개 API — 토큰 기반, 인증 불필요
export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      docId: string;
      token: string;
      companions: Companion[];
      signatureImage: string;
      signerName: string;
    };

    const { docId, token, companions = [], signatureImage, signerName } = body;

    // 필수값 검증
    if (!docId || !token || !signatureImage || !signerName) {
      return NextResponse.json(
        { ok: false, message: 'docId, token, signatureImage, signerName은 필수입니다' },
        { status: 400 },
      );
    }

    // 동행자 최대 20명 제한
    if (companions.length > 20) {
      return NextResponse.json(
        { ok: false, message: '동행자는 최대 20명까지 등록 가능합니다' },
        { status: 400 },
      );
    }

    // 서명 이미지 크기 검증 (base64 ~375KB max)
    if (signatureImage.length > 500_000) {
      return NextResponse.json(
        { ok: false, message: '서명 이미지 크기가 너무 큽니다 (최대 375KB)' },
        { status: 400 },
      );
    }

    const doc = await prisma.salesDocument.findUnique({
      where: { id: docId },
      select: { id: true, generatedData: true, status: true, organizationId: true },
    });

    if (!doc) {
      return NextResponse.json(
        { ok: false, message: '문서를 찾을 수 없습니다' },
        { status: 404 },
      );
    }

    const data = doc.generatedData as Record<string, unknown>;

    // 토큰 검증
    if (data.signToken !== token) {
      return NextResponse.json(
        { ok: false, message: '유효하지 않은 링크입니다' },
        { status: 401 },
      );
    }

    // 만료 검증
    if (
      data.signTokenExpiresAt &&
      new Date(data.signTokenExpiresAt as string) < new Date()
    ) {
      return NextResponse.json(
        { ok: false, message: '링크가 만료되었습니다 (7일 경과)' },
        { status: 410 },
      );
    }

    // 이미 서명된 경우
    if (data.signStatus === 'SIGNED') {
      return NextResponse.json(
        { ok: false, message: '이미 서명된 계약서입니다' },
        { status: 409 },
      );
    }

    const signedAt = new Date().toISOString();

    // generatedData 업데이트 (기존 데이터 spread 보존)
    await prisma.salesDocument.update({
      where: { id: docId },
      data: {
        generatedData: {
          ...data,
          companions,
          signatureImage,
          signedAt,
          signedByName: signerName,
          signStatus:   'SIGNED',
        },
        status:     'APPROVED',
        approvedAt: new Date(),
      },
    });

    // 에이전트 이메일 알림 (fire-and-forget)
    const organizationId = doc.organizationId;
    const productName    = (data.productName as string | null) ?? '크루즈 상품';

    void (async () => {
      try {
        const admin = await prisma.organizationMember.findFirst({
          where: {
            organizationId,
            role: { in: ['OWNER', 'GLOBAL_ADMIN'] },
            email: { not: null },
          },
          select: { email: true },
        });

        const adminEmail = admin?.email ?? null;
        if (!adminEmail) return;

        await sendFunnelEmail({
          organizationId,
          to:      adminEmail,
          subject: `[서명완료] ${productName} 계약서 서명이 완료되었습니다`,
          html: `<div style="font-family:sans-serif;line-height:1.8;max-width:600px;margin:0 auto;padding:32px 24px">
<h2 style="color:#1a1a2e;margin:0 0 16px">구매계약서 서명 완료 알림</h2>
<p>고객이 구매계약서에 서명을 완료했습니다.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0">
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666;width:40%">서명자</td><td style="padding:10px 14px;font-weight:600">${signerName}</td></tr>
  <tr><td style="padding:10px 14px;color:#666">상품명</td><td style="padding:10px 14px">${productName}</td></tr>
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666">서명일시</td><td style="padding:10px 14px">${signedAt}</td></tr>
  <tr><td style="padding:10px 14px;color:#666">동행자 수</td><td style="padding:10px 14px">${companions.length}명</td></tr>
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666">문서번호</td><td style="padding:10px 14px;font-size:12px;color:#888">${docId}</td></tr>
</table>
<p style="color:#666;font-size:14px">CRM에서 계약서를 확인하세요.</p>
</div>`,
          channel: 'MANUAL',
        });
      } catch (emailErr) {
        logger.log('[PurchaseContractSign] 에이전트 이메일 발송 실패', {
          error: emailErr instanceof Error ? emailErr.message : String(emailErr),
        });
      }
    })();

    logger.log('[PurchaseContractSign] 서명 완료', {
      docId,
      signerName,
      companions: companions.length,
      organizationId,
    });

    return NextResponse.json({ ok: true, message: '서명이 완료되었습니다' });
  } catch (e) {
    logger.log('[PurchaseContractSign POST] 오류', {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
