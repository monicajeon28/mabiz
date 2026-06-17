export const dynamic = 'force-dynamic';

/**
 * PUT /api/affiliate/contracts/[contractId]/simple-approve
 *
 * 크루즈닷 파트너스(CRUISE_PARTNER) 신청 승인 — 계정 생성 없이 상태만 변경
 * 접근 권한: GLOBAL_ADMIN 또는 담당 대리점장 (OWNER/AGENT)
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getAuthContext } from '@/lib/rbac';
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

    const body = await req.json().catch(() => ({}));
    const note: string = typeof body.note === 'string' ? body.note.trim() : '';

    const contract = await prisma.gmAffiliateContract.findUnique({
      where: { id: contractId },
      select: { id: true, status: true, metadata: true, name: true, phone: true, email: true },
    });
    if (!contract) {
      return NextResponse.json({ ok: false, message: '신청을 찾을 수 없습니다.' }, { status: 404 });
    }

    const meta = (contract.metadata as Record<string, unknown> | null) ?? {};
    const contractType = meta.type as string | undefined;

    // 이 엔드포인트는 CRUISE_PARTNER 전용
    if (contractType !== 'CRUISE_PARTNER') {
      return NextResponse.json(
        { ok: false, message: '이 엔드포인트는 크루즈닷 파트너스 신청에만 사용할 수 있습니다.' },
        { status: 400 },
      );
    }
    if (contract.status === 'APPROVED') {
      return NextResponse.json({ ok: false, message: '이미 승인된 신청입니다.' }, { status: 409 });
    }
    if (contract.status === 'rejected') {
      return NextResponse.json({ ok: false, message: '반려된 신청은 승인할 수 없습니다.' }, { status: 409 });
    }

    // supervisorPhone → 담당 대리점 산하 배정을 위한 OWNER 조회
    const supervisorPhone = (meta.supervisorPhone as string | undefined)
      || (meta.agentPhone as string | undefined);
    let supervisorMember: { id: string; organizationId: string } | null = null;
    if (supervisorPhone) {
      supervisorMember = await prisma.organizationMember.findFirst({
        where: { phone: supervisorPhone, role: 'OWNER', isActive: true },
        select: { id: true, organizationId: true },
      });
      if (!supervisorMember) {
        logger.warn('[simple-approve] supervisorPhone 매칭 실패, 본사로 폴백', {
          supervisorPhone: supervisorPhone.slice(0, 6) + '****',
        });
      }
    }

    const completionToken = randomUUID();
    const completionLink = `${process.env.NEXT_PUBLIC_APP_URL}/affiliate/pre-sales/complete?token=${completionToken}`;

    await prisma.gmAffiliateContract.update({
      where: { id: contractId },
      data: {
        status: 'APPROVED',
        metadata: {
          ...meta,
          approvedAt: new Date().toISOString(),
          approvedBy: ctx.userId,
          approveNote: note || null,
          completionToken,
          completionTokenIssuedAt: new Date().toISOString(),
          completionLink,
          // 매칭된 대리점 정보 저장 (pre-sales/complete 단계에서 계정 생성 시 활용)
          assignedOrganizationId: supervisorMember?.organizationId ?? null,
          assignedManagerId: supervisorMember?.id ?? null,
        },
      },
    });

    logger.info('[CRUISE-PARTNER] 신청 승인', {
      contractId,
      approvedBy: ctx.userId,
      name: contract.name,
    });

    // 승인 직후 신청자에게 신분증/통장 제출 링크 이메일 자동 발송 (best-effort, 실패해도 승인은 유지)
    let emailSent = false;
    if (contract.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contract.email)) {
      const html = `
        <div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <h2 style="font-size:18px;color:#1a1a1a;">크루즈닷 파트너스 가입이 승인되었습니다 🎉</h2>
          <p style="font-size:14px;color:#444;line-height:1.6;">
            ${contract.name || '신청자'}님, 가입 신청이 승인되었습니다.<br/>
            마지막으로 <b>신분증</b>과 <b>통장 사본</b>을 제출해 주세요. 아래 버튼을 눌러 업로드하시면 됩니다.
          </p>
          <p style="margin:24px 0;">
            <a href="${completionLink}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:15px;">서류 제출하러 가기</a>
          </p>
          <p style="font-size:12px;color:#888;">※ 이 링크는 발급 후 24시간 동안만 유효합니다.</p>
        </div>`;
      try {
        emailSent = await sendSystemEmail({
          to: contract.email,
          subject: '[크루즈닷 파트너스] 가입 승인 — 신분증·통장 제출 안내',
          html,
        });
      } catch (mailErr) {
        logger.error('[CRUISE-PARTNER] 승인 이메일 발송 오류', { contractId, err: mailErr });
      }
      if (!emailSent) logger.warn('[CRUISE-PARTNER] 승인 이메일 미발송(설정/주소 확인)', { contractId });
    }

    return NextResponse.json({
      ok: true,
      message: emailSent ? '승인 완료 — 신청자에게 서류 제출 링크를 이메일로 보냈습니다.' : '신청이 승인되었습니다.',
      data: { contractId, name: contract.name, completionLink, emailSent },
    });
  } catch (err) {
    logger.error('[CRUISE-PARTNER] 승인 실패', { error: err });
    return NextResponse.json({ ok: false, message: '오류가 발생했습니다.' }, { status: 500 });
  }
}
