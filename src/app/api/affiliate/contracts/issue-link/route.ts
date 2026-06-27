import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { CONTRACT_PRICE_TIERS, type PriceTierKey } from '@/lib/affiliate/priceTiers';

/**
 * POST /api/affiliate/contracts/issue-link
 * 관리자(또는 지사)가 계약서 서명 링크를 발급한다.
 *  - 지사 계약서: 관리자가 지사 후보에게 링크 발송 → 지사가 정보등록·서명 → 보관 → affiliate-issuance 발급
 *  - 대리점장/마케터: 지사·관리자가 모집 대상에게 링크 발송
 * 빈 GmAffiliateContract(status=link_sent) + 서명토큰을 생성하고 서명 링크 URL을 반환한다.
 * (공개 자가신청 /affiliate-join/apply 와 달리, 관리자가 주도해 링크를 보낸다.)
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    // 관리자(GLOBAL_ADMIN) 전용 — 계약서 링크 발급 (발급 페이지·사이드바도 GLOBAL_ADMIN)
    if (!ctx || ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await req.json() as {
      name?: string;
      phone?: string;
      email?: string;
      tierKey?: PriceTierKey;
    };

    const name = (body.name ?? '').trim();
    const phone = (body.phone ?? '').trim();
    if (!name || !phone) {
      return NextResponse.json({ ok: false, message: '이름과 연락처는 필수입니다.' }, { status: 400 });
    }
    // 등급(선택) — 지정 시 검증
    if (body.tierKey && !CONTRACT_PRICE_TIERS[body.tierKey]) {
      return NextResponse.json({ ok: false, message: '유효하지 않은 등급입니다.' }, { status: 400 });
    }
    const tierKey = body.tierKey ?? null;
    const tierLabel = tierKey ? CONTRACT_PRICE_TIERS[tierKey].label : null;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mabizcruisedot.com';
    const token = randomBytes(32).toString('hex'); // 64자 (VarChar64)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7일

    const contract = await prisma.gmAffiliateContract.create({
      data: {
        name,
        phone,
        email: body.email?.trim() || null,
        status: 'link_sent', // 서명 대기 (지사/대상이 링크에서 정보등록·서명하면 submitted)
        signatureToken: token,
        signatureTokenExpiresAt: expiresAt,
        signatureLink: `${baseUrl}/affiliate-sign/${token}`,
        signatureLinkExpiresAt: expiresAt,
        metadata: {
          contractKind: 'link', // 관리자 발급 링크 계약
          ...(tierKey ? { tierKey, tierLabel } : {}),
          issuedByMemberId: ctx.userId,
          issuedByRole: ctx.role,
          issuedAt: new Date().toISOString(),
        },
      },
      select: { id: true },
    });

    // 추적용 토큰 레코드(있으면 활용) — best-effort
    try {
      await prisma.gmAffiliateSignatureToken.create({
        data: { token, contractId: contract.id, expiresAt },
      });
    } catch (tokErr) {
      logger.warn('[ISSUE-LINK] 서명토큰 레코드 생성 실패(무시)', { contractId: contract.id, err: tokErr instanceof Error ? tokErr.message : String(tokErr) });
    }

    const signUrl = `${baseUrl}/affiliate-sign/${token}`;
    logger.info('[ISSUE-LINK] 계약 서명 링크 발급', { contractId: contract.id, tierKey, by: ctx.userId });

    return NextResponse.json({
      ok: true,
      contractId: contract.id,
      signUrl,
      token,
      expiresAt: expiresAt.toISOString(),
      tier: tierKey ? { key: tierKey, label: tierLabel } : null,
    });
  } catch (e) {
    logger.error('[ISSUE-LINK] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false, message: '서명 링크 발급 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
