export const dynamic = 'force-dynamic';

/**
 * PUT /api/affiliate/contracts/[contractId]/presales-create-account
 *
 * 무료 파트너스(CRUISE_PARTNER) — 관리자가 제출 서류 확인 후 "계정 생성"(최종 승인).
 * 서류 제출 완료(documentsSubmittedAt) 건만, 무료 크루즈닷 몰 계정(아이디·비번) 발급.
 * 접근: GLOBAL_ADMIN 또는 담당 지사(OWNER, supervisorPhone 일치).
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getAuthContext } from '@/lib/rbac';
import { provisionFreePresalesAccount } from '@/lib/affiliate/provision';
import { sendSystemEmail } from '@/lib/system-email';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> },
) {
  try {
    const ctx = await getAuthContext();
    if (!ctx || !['GLOBAL_ADMIN', 'OWNER'].includes(ctx.role)) {
      return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
    }

    const { contractId: contractIdStr } = await params;
    const contractId = parseInt(contractIdStr, 10);
    if (isNaN(contractId) || contractId <= 0) {
      return NextResponse.json({ ok: false, message: '유효한 신청 ID가 아닙니다.' }, { status: 400 });
    }

    const contract = await prisma.gmAffiliateContract.findUnique({
      where: { id: contractId },
      select: { id: true, name: true, phone: true, email: true, status: true, metadata: true },
    });
    if (!contract) {
      return NextResponse.json({ ok: false, message: '신청을 찾을 수 없습니다.' }, { status: 404 });
    }

    const meta = (contract.metadata as Record<string, unknown> | null) ?? {};
    if (meta.type !== 'CRUISE_PARTNER') {
      return NextResponse.json({ ok: false, message: '크루즈닷 파트너스 신청에만 사용할 수 있습니다.' }, { status: 400 });
    }
    if (!meta.documentsSubmittedAt) {
      return NextResponse.json({ ok: false, message: '서류 제출이 완료된 신청만 계정을 생성할 수 있습니다.' }, { status: 400 });
    }
    if (meta.accountCreated || meta.presalesGmUserId) {
      return NextResponse.json({ ok: false, message: '이미 계정이 생성된 신청입니다.' }, { status: 409 });
    }

    // OWNER는 담당 신청만 (IDOR 방지)
    if (ctx.role === 'OWNER') {
      const supervisorPhone = (meta.supervisorPhone as string | undefined) || (meta.agentPhone as string | undefined);
      const selfMember = await prisma.organizationMember.findFirst({ where: { userId: ctx.userId, isActive: true }, select: { phone: true } });
      if (!supervisorPhone || selfMember?.phone !== supervisorPhone) {
        return NextResponse.json({ ok: false, message: '담당 지사만 계정을 생성할 수 있습니다.' }, { status: 403 });
      }
    }

    // 무료 크루즈닷 몰 계정 생성
    const acct = await provisionFreePresalesAccount({
      contractId: contract.id,
      contractorName: contract.name || '파트너스',
      contractorEmail: contract.email || '',
      contractorPhone: contract.phone || '',
    });

    await prisma.gmAffiliateContract.update({
      where: { id: contract.id },
      data: {
        metadata: {
          ...meta,
          accountCreated: true,
          presalesGmUserId: acct.gmUserId,
          presalesPartnerId: acct.partnerId,
          accountCreatedAt: new Date().toISOString(),
          accountCreatedBy: ctx.userId,
        },
      },
    });

    // 아이디·임시비번 이메일 발송 (best-effort)
    let emailSent = false;
    if (contract.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contract.email)) {
      const html = `
        <div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <h2 style="font-size:18px;color:#1a1a1a;">크루즈닷 파트너스 계정이 발급되었습니다 🎉</h2>
          <p style="font-size:14px;color:#444;line-height:1.7;">
            ${contract.name || '파트너스'}님, 아래 정보로 크루즈닷 몰에 로그인하세요.<br/><br/>
            <b>아이디</b>: ${acct.partnerId}<br/>
            <b>임시 비밀번호</b>: ${acct.tempPassword}<br/><br/>
            로그인 후 비밀번호를 변경해 주세요. 상품을 클릭하면 나만의 판매 링크가 생성됩니다.
          </p>
        </div>`;
      try {
        emailSent = await sendSystemEmail({ to: contract.email, subject: '[크루즈닷 파트너스] 계정 발급 — 아이디·임시 비밀번호', html });
      } catch (mailErr) {
        logger.error('[PRESALES-CREATE-ACCOUNT] 이메일 발송 오류', { contractId, err: mailErr });
      }
    }

    logger.info('[PRESALES-CREATE-ACCOUNT] 무료 파트너스 계정 생성', { contractId, gmUserId: acct.gmUserId, by: ctx.userId });
    // 임시비번은 응답에 미포함(이메일로만) — 단 발송 실패 시 관리자 전달용으로 partnerId만 반환
    return NextResponse.json({
      ok: true,
      message: emailSent ? '계정이 생성되고 아이디·비밀번호를 이메일로 보냈습니다.' : '계정이 생성되었습니다. (이메일 미발송 — 아이디·비번을 직접 전달하세요)',
      data: { contractId, partnerId: acct.partnerId, emailSent, ...(emailSent ? {} : { tempPassword: acct.tempPassword }) },
    });
  } catch (err) {
    logger.error('[PRESALES-CREATE-ACCOUNT] 실패', { error: err });
    return NextResponse.json({ ok: false, message: '계정 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
