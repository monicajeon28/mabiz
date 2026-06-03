export const dynamic = 'force-dynamic';

/**
 * GET  /api/affiliate/contracts/complete?token=XXX  → 토큰으로 계약 조회 (공개)
 * POST /api/affiliate/contracts/complete             → 계약에 서류 정보 저장
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ── GET ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    if (!token || token.trim().length === 0) {
      return NextResponse.json({ ok: false, message: '토큰이 없습니다.' }, { status: 400 });
    }

    const contract = await prisma.gmAffiliateContract.findFirst({
      where: {
        status: 'APPROVED',
        metadata: {
          path: ['completionToken'],
          equals: token.trim(),
        },
      },
      select: { id: true, name: true, phone: true, status: true, metadata: true },
    });

    if (!contract) {
      return NextResponse.json(
        { ok: false, message: '유효하지 않은 링크입니다.' },
        { status: 404 },
      );
    }

    const meta = (contract.metadata as Record<string, unknown> | null) ?? {};

    // 이미 서류 제출된 경우
    if (meta.documentsSubmittedAt) {
      return NextResponse.json(
        { ok: false, message: '이미 서류가 제출된 링크입니다.' },
        { status: 409 },
      );
    }

    // completionToken 24시간 만료 검증
    const tokenIssuedAt = typeof meta.completionTokenIssuedAt === 'string'
      ? new Date(meta.completionTokenIssuedAt).getTime()
      : null;
    if (!tokenIssuedAt || Date.now() - tokenIssuedAt > 24 * 60 * 60 * 1000) {
      return NextResponse.json(
        { ok: false, message: '링크가 만료되었습니다. 새 링크를 요청하세요.' },
        { status: 410 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: { name: contract.name, contractId: contract.id },
    });
  } catch (err) {
    logger.error('[COMPLETE-CONTRACT] GET 실패', { error: err });
    return NextResponse.json({ ok: false, message: '오류가 발생했습니다.' }, { status: 500 });
  }
}

// ── POST ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, message: '잘못된 요청입니다.' }, { status: 400 });
    }

    const {
      token,
      bankName,
      bankAccount,
      bankAccountHolder,
      bankBookUrl,
      residentId,
      idPhotoUrl,
      signatureImageUrl,
      signName,
    } = body as Record<string, unknown>;

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return NextResponse.json({ ok: false, message: '토큰이 없습니다.' }, { status: 400 });
    }

    const contract = await prisma.gmAffiliateContract.findFirst({
      where: {
        status: 'APPROVED',
        metadata: {
          path: ['completionToken'],
          equals: token.trim(),
        },
      },
      select: { id: true, name: true, metadata: true },
    });

    if (!contract) {
      return NextResponse.json(
        { ok: false, message: '유효하지 않은 링크입니다.' },
        { status: 404 },
      );
    }

    const meta = (contract.metadata as Record<string, unknown> | null) ?? {};

    // 이미 서류 제출된 경우
    if (meta.documentsSubmittedAt) {
      return NextResponse.json(
        { ok: false, message: '이미 서류가 제출된 링크입니다.' },
        { status: 409 },
      );
    }

    // completionToken 24시간 만료 검증
    const tokenIssuedAt = typeof meta.completionTokenIssuedAt === 'string'
      ? new Date(meta.completionTokenIssuedAt).getTime()
      : null;
    if (!tokenIssuedAt || Date.now() - tokenIssuedAt > 24 * 60 * 60 * 1000) {
      return NextResponse.json(
        { ok: false, message: '링크가 만료되었습니다. 새 링크를 요청하세요.' },
        { status: 410 },
      );
    }

    await prisma.gmAffiliateContract.update({
      where: { id: contract.id },
      data: {
        residentId: typeof residentId === 'string' ? residentId.trim() : undefined,
        bankName: typeof bankName === 'string' ? bankName.trim() : undefined,
        bankAccount: typeof bankAccount === 'string' ? bankAccount.trim() : undefined,
        bankAccountHolder: typeof bankAccountHolder === 'string' ? bankAccountHolder.trim() : undefined,
        signatureImageUrl: typeof signatureImageUrl === 'string' ? signatureImageUrl : undefined,
        metadata: {
          ...meta,
          idPhotoUrl: typeof idPhotoUrl === 'string' ? idPhotoUrl : undefined,
          bankBookUrl: typeof bankBookUrl === 'string' ? bankBookUrl : undefined,
          signName: typeof signName === 'string' ? signName.trim() : undefined,
          documentsSubmittedAt: new Date().toISOString(),
        },
      },
    });

    logger.info('[COMPLETE-CONTRACT] 서류 제출 완료', {
      contractId: contract.id,
      name: contract.name,
    });

    return NextResponse.json({
      ok: true,
      message: '서류가 제출되었습니다.',
      data: { contractId: contract.id },
    });
  } catch (err) {
    logger.error('[COMPLETE-CONTRACT] POST 실패', { error: err });
    return NextResponse.json({ ok: false, message: '오류가 발생했습니다.' }, { status: 500 });
  }
}
