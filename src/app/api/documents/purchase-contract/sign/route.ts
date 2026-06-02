import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendFunnelEmail } from '@/lib/email';
import { checkRateLimitAsync } from '@/lib/rate-limit';

type Companion = {
  name: string;      // 이름 (필수)
  birthDate: string; // 생년월일 YYYY-MM-DD (필수)
  relation: string;  // 관계: 배우자|자녀|부모|형제자매|친구|기타
  phone: string;     // 연락처 (필수)
};

// P0-2: timingSafeEqual 기반 토큰 비교
function safeTokenCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// P2-2: HTML 이스케이프
function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// P2-1: 동행자 관계 허용 목록
const ALLOWED_RELATIONS = ['배우자', '자녀', '부모', '형제자매', '친구', '기타'];
const birthDateRegex = /^\d{4}-\d{2}-\d{2}$/;

// ─── GET /api/documents/purchase-contract/sign?docId=X&token=Y ───────────────
// 공개 API — 토큰 기반, 인증 불필요
export async function GET(req: Request) {
  try {
    // P1-1: Rate Limiting (GET)
    const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
    const rl = await checkRateLimitAsync(`sign_get:${ip}`, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 429 },
      );
    }

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

    // P1-3: IDOR 방지 — 문서 없을 때 동일 메시지
    if (!doc) {
      return NextResponse.json(
        { ok: false, message: '유효하지 않은 링크입니다' },
        { status: 401 },
      );
    }

    const data = doc.generatedData as Record<string, unknown>;

    // P0-2: timingSafeEqual 토큰 비교
    const storedToken = typeof data.signToken === 'string' ? data.signToken : '';
    if (!storedToken || !safeTokenCompare(storedToken, token)) {
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
    logger.error('[PurchaseContractSign GET] 오류', {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// ─── POST /api/documents/purchase-contract/sign ──────────────────────────────
// 공개 API — 토큰 기반, 인증 불필요
export async function POST(req: Request) {
  try {
    // P1-1: Rate Limiting (POST)
    const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
    const rl = await checkRateLimitAsync(`sign_post:${ip}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 429 },
      );
    }

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

    // P1-2: signatureImage base64 형식 검증
    const base64Regex = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
    if (!base64Regex.test(signatureImage)) {
      return NextResponse.json(
        { ok: false, message: '유효하지 않은 서명 이미지입니다' },
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

    // P2-1: Companion 필드 유효성 검증
    for (const [i, c] of companions.entries()) {
      if (!c.name?.trim() || !c.birthDate || !c.phone?.trim() || !c.relation) {
        return NextResponse.json(
          { ok: false, message: `동행자 ${i + 1}번 필수 정보 누락` },
          { status: 400 },
        );
      }
      if (!birthDateRegex.test(c.birthDate)) {
        return NextResponse.json(
          { ok: false, message: `동행자 ${i + 1}번 생년월일 형식 오류 (YYYY-MM-DD)` },
          { status: 400 },
        );
      }
      if (!ALLOWED_RELATIONS.includes(c.relation)) {
        return NextResponse.json(
          { ok: false, message: `동행자 ${i + 1}번 관계 값 오류` },
          { status: 400 },
        );
      }
    }

    // P0-1: Race condition 방지 — $transaction으로 select-then-update 원자적 처리
    const result = await prisma.$transaction(async (tx) => {
      // 현재 문서 조회 (APPROVED가 아닌 것만)
      const current = await tx.salesDocument.findFirst({
        where: { id: docId, status: { not: 'APPROVED' } },
        select: { id: true, generatedData: true, organizationId: true },
      });
      if (!current) return null; // 이미 서명됨

      const existingData = current.generatedData as Record<string, unknown>;

      // P0-2: timingSafeEqual 토큰 비교
      const storedToken = typeof existingData.signToken === 'string' ? existingData.signToken : '';
      if (!storedToken || !safeTokenCompare(storedToken, token)) {
        return 'INVALID_TOKEN' as const;
      }

      // 만료 검증
      if (
        existingData.signTokenExpiresAt &&
        new Date(existingData.signTokenExpiresAt as string) < new Date()
      ) {
        return 'EXPIRED' as const;
      }

      const signedAt = new Date().toISOString();

      // P1-5: 서명 후 signToken 무효화
      await tx.salesDocument.update({
        where: { id: docId },
        data: {
          status:     'APPROVED',
          approvedAt: new Date(),
          generatedData: {
            ...existingData,
            companions,
            signatureImage,
            signedAt,
            signedByName: signerName,
            signStatus:   'SIGNED',
            signToken:    null,
            signTokenExpiresAt: null,
          },
        },
      });

      return { signedAt, organizationId: current.organizationId };
    });

    if (result === null) {
      return NextResponse.json(
        { ok: false, message: '이미 서명된 계약서입니다' },
        { status: 409 },
      );
    }
    if (result === 'INVALID_TOKEN') {
      return NextResponse.json(
        { ok: false, message: '유효하지 않은 링크입니다' },
        { status: 401 },
      );
    }
    if (result === 'EXPIRED') {
      return NextResponse.json(
        { ok: false, message: '링크가 만료되었습니다 (7일 경과)' },
        { status: 410 },
      );
    }

    // 에이전트 이메일 알림 (fire-and-forget)
    const { signedAt, organizationId } = result;
    const productNameRaw = '크루즈 상품'; // 이메일에 사용할 상품명은 DB에서 읽어올 수 없으므로 기본값

    void (async () => {
      try {
        // DB에서 상품명 조회
        const freshDoc = await prisma.salesDocument.findUnique({
          where: { id: docId },
          select: { generatedData: true },
        });
        const productName = typeof (freshDoc?.generatedData as Record<string, unknown> | null)?.productName === 'string'
          ? ((freshDoc!.generatedData as Record<string, unknown>).productName as string)
          : productNameRaw;

        // P1-4: isActive 필터 추가
        const admin = await prisma.organizationMember.findFirst({
          where: {
            organizationId,
            role: { in: ['OWNER', 'GLOBAL_ADMIN'] },
            email: { not: null },
            isActive: true,
          },
          select: { email: true },
        });

        const adminEmail = admin?.email ?? null;
        if (!adminEmail) return;

        await sendFunnelEmail({
          organizationId,
          to:      adminEmail,
          subject: `[서명완료] ${escHtml(productName)} 계약서 서명이 완료되었습니다`,
          // P2-2: signerName, productName HTML 이스케이프
          html: `<div style="font-family:sans-serif;line-height:1.8;max-width:600px;margin:0 auto;padding:32px 24px">
<h2 style="color:#1a1a2e;margin:0 0 16px">구매계약서 서명 완료 알림</h2>
<p>고객이 구매계약서에 서명을 완료했습니다.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0">
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666;width:40%">서명자</td><td style="padding:10px 14px;font-weight:600">${escHtml(signerName)}</td></tr>
  <tr><td style="padding:10px 14px;color:#666">상품명</td><td style="padding:10px 14px">${escHtml(productName)}</td></tr>
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666">서명일시</td><td style="padding:10px 14px">${escHtml(signedAt)}</td></tr>
  <tr><td style="padding:10px 14px;color:#666">동행자 수</td><td style="padding:10px 14px">${companions.length}명</td></tr>
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666">문서번호</td><td style="padding:10px 14px;font-size:12px;color:#888">${escHtml(docId)}</td></tr>
</table>
<p style="color:#666;font-size:14px">CRM에서 계약서를 확인하세요.</p>
</div>`,
          channel: 'MANUAL',
        });
      } catch (emailErr) {
        logger.error('[PurchaseContractSign] 에이전트 이메일 발송 실패', {
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

    // POST 응답에 signedAt 포함
    return NextResponse.json({ ok: true, message: '서명이 완료되었습니다', signedAt });
  } catch (e) {
    logger.error('[PurchaseContractSign POST] 오류', {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
