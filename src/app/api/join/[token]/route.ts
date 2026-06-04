import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { hashPassword } from "@/lib/password";
import { generateContractPdf } from "@/lib/contract-pdf";
import { sendSystemEmail, COMPANY_EMAIL } from "@/lib/system-email";

type Params = { params: Promise<{ token: string }> };

// GET /api/join/[token] — 초대 토큰 정보 조회 (공개)
export async function GET(_req: Request, { params }: Params) {
  try {
    const { token } = await params;

    const invite = await prisma.orgInviteToken.findUnique({
      where: { token },
      select: {
        id: true, role: true, note: true, expiresAt: true, usedAt: true,
        organization: { select: { name: true, slug: true } },
      },
    });

    if (!invite) {
      return NextResponse.json({ ok: false, message: "유효하지 않은 초대 링크입니다." }, { status: 404 });
    }
    if (invite.usedAt) {
      return NextResponse.json({ ok: false, message: "이미 사용된 초대 링크입니다.", code: "TOKEN_USED" }, { status: 400 });
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ ok: false, message: "만료된 초대 링크입니다. 새 링크를 요청하세요.", code: "TOKEN_EXPIRED" }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      orgName:   invite.organization.name,
      note:      invite.note,
      role:      invite.role,
      expiresAt: invite.expiresAt,
    });
  } catch (err) {
    logger.error("[GET /api/join/[token]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST /api/join/[token] — 초대 수락 (전화번호/비밀번호 기반 가입)
export async function POST(req: Request, { params }: Params) {
  try {
    const { token } = await params;
    const body = await req.json() as {
      displayName?:   string;
      email?:         string;
      agreedToTerms?: boolean;
      phone?:         string;
      password?:      string;
      signature?:     string;
    };

    if (!body.agreedToTerms) {
      return NextResponse.json({ ok: false, message: "수당 조건에 동의해야 합니다." }, { status: 400 });
    }

    const phoneClean = body.phone?.trim().replace(/[^0-9]/g, '') ?? '';
    if (phoneClean.length < 10) {
      return NextResponse.json({ ok: false, message: "올바른 전화번호를 입력해주세요." }, { status: 400 });
    }

    // 비밀번호 해싱 (bcrypt)
    let passwordHash: string;
    try {
      passwordHash = await hashPassword(body.password ?? '');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '비밀번호 오류';
      return NextResponse.json({ ok: false, message: msg }, { status: 400 });
    }

    // TOCTOU 방어: atomic updateMany로 토큰 클레임
    const claimed = await prisma.orgInviteToken.updateMany({
      where: { token, usedAt: null, expiresAt: { gt: new Date() } },
      data:  { usedAt: new Date() },
    });

    if (claimed.count === 0) {
      const check = await prisma.orgInviteToken.findUnique({
        where: { token }, select: { usedAt: true, expiresAt: true },
      });
      if (!check) return NextResponse.json({ ok: false, message: "유효하지 않은 초대입니다." }, { status: 404 });
      const code    = check.usedAt ? "TOKEN_USED" : "TOKEN_EXPIRED";
      const message = check.usedAt ? "이미 사용된 초대 링크입니다." : "만료된 초대 링크입니다. 새 링크를 요청하세요.";
      return NextResponse.json({ ok: false, message, code }, { status: 400 });
    }

    const invite = await prisma.orgInviteToken.findUnique({
      where: { token }, select: { id: true, organizationId: true, role: true },
    });
    if (!invite) return NextResponse.json({ ok: false, message: "초대 정보를 찾을 수 없습니다." }, { status: 404 });

    // 전화번호 중복 확인
    const existing = await prisma.organizationMember.findFirst({
      where: { organizationId: invite.organizationId, phone: phoneClean },
    });
    if (existing) {
      try {
        await prisma.orgInviteToken.update({ where: { id: invite.id }, data: { usedAt: null, usedByUserId: null } });
      } catch (rollbackErr) {
        logger.error('[join/token] 토큰 롤백 실패 — 수동 복구 필요', { token, rollbackErr });
      }
      return NextResponse.json({ ok: false, message: "이미 가입된 전화번호입니다." }, { status: 400 });
    }

    const memberId   = `mbr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const role       = invite.role === 'OWNER' ? 'OWNER' : invite.role === 'FREE_SALES' ? 'FREE_SALES' : 'AGENT';
    const memberEmail = body.email?.trim() || null;
    const signedAt   = new Date();

    await prisma.$transaction([
      prisma.organizationMember.create({
        data: {
          id:                memberId,
          organizationId:    invite.organizationId,
          userId:            memberId,
          phone:             phoneClean,
          email:             memberEmail,
          passwordHash,
          role,
          displayName:       body.displayName?.trim() ?? null,
          isActive:          true,
          contractSignature: body.signature?.trim() ?? null,
          contractSignedAt:  signedAt,
        },
      }),
      prisma.orgInviteToken.update({
        where: { id: invite.id },
        data:  {
          usedByUserId: memberId,
          agreedToTerms: true,
          signature:   body.signature?.trim() ?? null,
          signedAt,
          memberEmail,
        },
      }),
    ]);

    // 계약서 PDF 생성 + 이메일 발송 (비차단 — 실패해도 가입 성공)
    sendContractPdf({
      orgId:       invite.organizationId,
      memberName:  body.displayName?.trim()  ?? '파트너',
      memberPhone: phoneClean,
      memberEmail: memberEmail ?? '',
      role,
      signature:   body.signature?.trim() ?? body.displayName?.trim() ?? '',
      signedAt,
    }).catch((e) => logger.error('[join/token] 계약서 발송 실패', { e }));

    // 자동 로그인 세션 생성
    const { cookies } = await import('next/headers');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const session = await prisma.mabizSession.create({
      data: { memberId, role, organizationId: invite.organizationId, expiresAt },
    });

    const cookieStore = await cookies();
    cookieStore.set('mabiz.sid', session.id, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path:     '/',
      expires:  expiresAt,
    });

    // OWNER 이메일 알림 (비차단)
    notifyOwnerOfNewMember(invite.organizationId, {
      name:  body.displayName?.trim() ?? '파트너',
      phone: phoneClean.slice(0, 3) + '****' + phoneClean.slice(-4),
      role,
      memberId,
    }).catch((e) => logger.error("[join/token] OWNER 알림 실패", { e }));

    logger.warn("[POST /api/join/[token]] 판매원 가입 완료", { memberId, orgId: invite.organizationId, role });
    return NextResponse.json({ ok: true, role });

  } catch (err) {
    logger.error("[POST /api/join/[token]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// ── HTML 이스케이프 헬퍼 ─────────────────────────────────────────────
function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── 계약서 PDF 생성 + 회사/가입자 이메일 발송 ────────────────────────

async function sendContractPdf(p: {
  orgId:       string;
  memberName:  string;
  memberPhone: string;
  memberEmail: string;
  role:        string;
  signature:   string;
  signedAt:    Date;
}) {
  const org = await prisma.organization.findUnique({
    where: { id: p.orgId }, select: { name: true },
  });
  const orgName     = org?.name ?? '크루즈닷';
  const signedAtStr = p.signedAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const filename    = `계약서_${p.memberName}_${p.signedAt.toISOString().slice(0, 10)}.pdf`;
  const subject     = `[크루즈닷] ${p.memberName} 판매원 계약서 (${p.signedAt.toISOString().slice(0, 10)})`;

  const pdfBuffer = await generateContractPdf({
    memberName:  p.memberName,
    memberPhone: p.memberPhone,
    memberEmail: p.memberEmail,
    role:        p.role,
    orgName,
    signature:   p.signature,
    signedAt:    signedAtStr,
  });

  const baseHtml = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a">
      <h2 style="color:#1a3a6b;margin-bottom:16px">📋 어필리에이트 판매원 계약서</h2>
      <p>안녕하세요.</p>
      <p><strong>${escHtml(p.memberName)}</strong>님이 크루즈닷 어필리에이트 판매원으로 계약을 체결하였습니다.<br>
      서명된 계약서 PDF가 첨부되어 있습니다.</p>
      <table style="border-collapse:collapse;width:100%;margin:20px 0;font-size:14px">
        <tr style="background:#f5f7fa"><td style="padding:10px;border:1px solid #e5e7eb;width:120px;font-weight:600">성명</td><td style="padding:10px;border:1px solid #e5e7eb">${escHtml(p.memberName)}</td></tr>
        <tr><td style="padding:10px;border:1px solid #e5e7eb;font-weight:600">전화번호</td><td style="padding:10px;border:1px solid #e5e7eb">${p.memberPhone.slice(0, 3)}****${p.memberPhone.slice(-4)}</td></tr>
        <tr style="background:#f5f7fa"><td style="padding:10px;border:1px solid #e5e7eb;font-weight:600">역할</td><td style="padding:10px;border:1px solid #e5e7eb">${escHtml(p.role === 'OWNER' ? '대리점장' : p.role === 'FREE_SALES' ? '자유판매원' : '소속판매원')}</td></tr>
        <tr><td style="padding:10px;border:1px solid #e5e7eb;font-weight:600">소속</td><td style="padding:10px;border:1px solid #e5e7eb">${escHtml(orgName)}</td></tr>
        <tr style="background:#f5f7fa"><td style="padding:10px;border:1px solid #e5e7eb;font-weight:600">서명 일시</td><td style="padding:10px;border:1px solid #e5e7eb">${escHtml(signedAtStr)}</td></tr>
      </table>
      <p style="font-size:12px;color:#888;border-top:1px solid #eee;padding-top:12px">
        본 계약서는 전자서명법에 따라 법적 효력을 가집니다. 크루즈닷 × ${escHtml(orgName)}
      </p>
    </div>`;

  const attachment = [{ filename, content: pdfBuffer, contentType: 'application/pdf' }];

  // 발송 1: 회사 보관 (마비즈스쿨 원격평생교육원)
  await sendSystemEmail({
    to:          COMPANY_EMAIL,
    subject:     `[회사보관] ${subject}`,
    html:        baseHtml,
    attachments: attachment,
  });

  // 발송 2: 가입자 본인 (이메일 입력한 경우만)
  if (p.memberEmail && p.memberEmail.includes('@')) {
    await sendSystemEmail({
      to:          p.memberEmail,
      subject:     `[본인보관] ${subject}`,
      html:        baseHtml.replace('서명된 계약서 PDF가 첨부되어 있습니다.', '본인 보관용 계약서 PDF가 첨부되어 있습니다. 안전한 곳에 보관해 주세요.'),
      attachments: attachment,
    });
  }
}

// ── OWNER 이메일 알림 ───────────────────────────────────────────────

async function notifyOwnerOfNewMember(
  orgId: string,
  member: { name: string; phone: string; role: string; memberId: string }
) {
  const [owner, emailConfig] = await Promise.all([
    prisma.organizationMember.findFirst({
      where:  { organizationId: orgId, role: 'OWNER', isActive: true },
      select: { email: true, displayName: true },
    }),
    prisma.orgEmailConfig.findUnique({ where: { organizationId: orgId } }),
  ]);

  if (!owner?.email || !emailConfig?.isActive) return;

  const { sendEmail } = await import('@/lib/email');
  const { renderPartnerJoinedEmail } = await import('@/lib/email-templates');

  const joinedAt = new Date().toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const { subject, html } = renderPartnerJoinedEmail({
    ownerName:    owner.displayName ?? '대리점장',
    partnerName:  member.name,
    partnerPhone: member.phone,
    partnerRole:  member.role,
    joinedAt,
    crmUrl:       process.env.NEXT_PUBLIC_APP_URL ?? '',
  });

  await sendEmail({
    smtpHost:          emailConfig.smtpHost,
    smtpPort:          emailConfig.smtpPort,
    smtpUser:          emailConfig.smtpUser,
    smtpPassEncrypted: emailConfig.smtpPassEncrypted,
    senderName:        '크루즈닷 CRM',
    senderEmail:       emailConfig.senderEmail,
    to:                owner.email,
    subject,
    html,
  });
}
