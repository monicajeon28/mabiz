import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ token: string }> };

// 64자 hex 토큰 형식 검증 (XSS/인젝션 방지)
function isValidToken(t: string): boolean {
  return /^[a-f0-9]{64}$/.test(t);
}

/**
 * GET /api/public/affiliate-sign/[token]
 * 서명 링크로 접근한 대상(지사/대리점장/마케터)에게 계약 정보를 반환(공개 — 토큰이 인증).
 * 민감정보 미반환. 만료·사용완료·미존재 토큰은 거부.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const { token } = await params;
    if (!isValidToken(token)) {
      return NextResponse.json({ ok: false, message: '유효하지 않은 링크입니다.' }, { status: 400 });
    }

    const contract = await prisma.gmAffiliateContract.findFirst({
      where: { signatureToken: token },
      select: {
        id: true, name: true, phone: true, email: true, status: true,
        signatureTokenExpiresAt: true, metadata: true,
      },
    });
    if (!contract) {
      return NextResponse.json({ ok: false, message: '계약을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (contract.signatureTokenExpiresAt && contract.signatureTokenExpiresAt < new Date()) {
      return NextResponse.json({ ok: false, message: '링크가 만료되었습니다. 담당자에게 재발급을 요청하세요.' }, { status: 410 });
    }
    if (contract.status !== 'link_sent') {
      // 이미 서명/제출됨
      return NextResponse.json({ ok: false, message: '이미 작성이 완료된 계약입니다.', alreadyDone: true }, { status: 409 });
    }

    const meta = (contract.metadata as Record<string, unknown> | null) ?? {};
    return NextResponse.json({
      ok: true,
      contract: {
        name: contract.name,
        phone: contract.phone,
        email: contract.email,
        tierKey: meta.tierKey ?? null,
        tierLabel: meta.tierLabel ?? null,
        expiresAt: contract.signatureTokenExpiresAt,
      },
    });
  } catch (e) {
    logger.error('[AFFILIATE-SIGN GET] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false, message: '오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * POST /api/public/affiliate-sign/[token]
 * 대상이 정보등록 + 서명 후 제출. 토큰 검증 → 계약 업데이트(status=submitted) → 보관.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { token } = await params;
    if (!isValidToken(token)) {
      return NextResponse.json({ ok: false, message: '유효하지 않은 링크입니다.' }, { status: 400 });
    }

    const body = await req.json() as {
      name?: string; phone?: string; email?: string; address?: string;
      residentId?: string; bankName?: string; bankAccount?: string; bankAccountHolder?: string;
      consentPrivacy?: boolean; consentNonCompete?: boolean; consentDbUse?: boolean;
      consentPenalty?: boolean; consentRefund?: boolean;
      signatureImageUrl?: string; // base64 dataURL
    };

    if (!body.signatureImageUrl || !body.signatureImageUrl.startsWith('data:image/')) {
      return NextResponse.json({ ok: false, message: '서명을 완료해주세요.' }, { status: 400 });
    }
    // 서명 base64 크기 상한 (대용량 페이로드/DoS 방지) — 약 1MB
    if (body.signatureImageUrl.length > 1_000_000) {
      return NextResponse.json({ ok: false, message: '서명 이미지가 너무 큽니다.' }, { status: 413 });
    }
    // 필수 동의 검증
    if (!body.consentPrivacy || !body.consentNonCompete || !body.consentDbUse || !body.consentPenalty || !body.consentRefund) {
      return NextResponse.json({ ok: false, message: '필수 동의 항목에 모두 동의해주세요.' }, { status: 400 });
    }

    // 토큰 원자적 검증·잠금: status link_sent + 미만료인 것만 PROCESSING으로
    const now = new Date();
    const contract = await prisma.gmAffiliateContract.findFirst({
      where: { signatureToken: token },
      select: { id: true, status: true, signatureTokenExpiresAt: true, name: true, phone: true },
    });
    if (!contract) {
      return NextResponse.json({ ok: false, message: '계약을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (contract.signatureTokenExpiresAt && contract.signatureTokenExpiresAt < now) {
      return NextResponse.json({ ok: false, message: '링크가 만료되었습니다.' }, { status: 410 });
    }
    if (contract.status !== 'link_sent') {
      return NextResponse.json({ ok: false, message: '이미 작성이 완료된 계약입니다.' }, { status: 409 });
    }

    // 원자적 제출 — status='link_sent'인 경우에만 전체 갱신+submitted.
    // (잠금→업데이트 2단계 비트랜잭션은 중간 실패 시 PROCESSING 고착 → 단일 updateMany로 원자화)
    const updated = await prisma.gmAffiliateContract.updateMany({
      where: { id: contract.id, status: 'link_sent' },
      data: {
        name: body.name?.trim() || contract.name,
        phone: body.phone?.trim() || contract.phone,
        email: body.email?.trim() || null,
        address: body.address?.trim() || null,
        residentId: body.residentId?.trim() || null,
        bankName: body.bankName?.trim() || null,
        bankAccount: body.bankAccount?.trim() || null,
        bankAccountHolder: body.bankAccountHolder?.trim() || null,
        consentPrivacy: true, consentNonCompete: true, consentDbUse: true,
        consentPenalty: true, consentRefund: true,
        signatureImageUrl: body.signatureImageUrl,
        status: 'submitted',
        submittedAt: now,
        contractSignedAt: now,
      },
    });
    if (updated.count === 0) {
      return NextResponse.json({ ok: false, message: '이미 처리되었거나 만료된 계약입니다.' }, { status: 409 });
    }

    // 토큰 사용 처리(추적 레코드) — best-effort
    await prisma.gmAffiliateSignatureToken.updateMany({
      where: { token },
      data: { signedAt: now, signedBy: (body.name?.trim() || contract.name)?.slice(0, 200) },
    }).catch(() => {});

    logger.info('[AFFILIATE-SIGN POST] 서명·제출 완료', { contractId: contract.id });
    return NextResponse.json({ ok: true, message: '계약서가 제출되었습니다. 검토 후 안내드리겠습니다.' });
  } catch (e) {
    logger.error('[AFFILIATE-SIGN POST] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false, message: '제출 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
