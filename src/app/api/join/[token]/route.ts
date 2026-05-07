import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { hashPassword } from "@/lib/password";

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

    // 비밀번호 검증 + bcrypt 해싱 (SHA-256 절대 사용 금지)
    let passwordHash: string;
    try {
      passwordHash = await hashPassword(body.password ?? '');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '비밀번호 오류';
      return NextResponse.json({ ok: false, message: msg }, { status: 400 });
    }

    // ── TOCTOU 방어: atomic updateMany로 토큰 클레임 ──────────────
    // findUnique → check → create 패턴은 경쟁조건 취약 → 사용 금지
    const claimed = await prisma.orgInviteToken.updateMany({
      where: {
        token,
        usedAt:    null,               // 아직 미사용
        expiresAt: { gt: new Date() }, // 만료 전
      },
      data: { usedAt: new Date() },
    });

    if (claimed.count === 0) {
      // 만료됐거나 이미 사용됨
      const check = await prisma.orgInviteToken.findUnique({
        where: { token },
        select: { usedAt: true, expiresAt: true },
      });
      if (!check) {
        return NextResponse.json({ ok: false, message: "유효하지 않은 초대입니다." }, { status: 404 });
      }
      const code = check.usedAt ? "TOKEN_USED" : "TOKEN_EXPIRED";
      const message = check.usedAt
        ? "이미 사용된 초대 링크입니다."
        : "만료된 초대 링크입니다. 새 링크를 요청하세요.";
      return NextResponse.json({ ok: false, message, code }, { status: 400 });
    }

    // 토큰 정보 조회 (클레임 완료 후)
    const invite = await prisma.orgInviteToken.findUnique({
      where: { token },
      select: { id: true, organizationId: true, role: true },
    });
    if (!invite) {
      return NextResponse.json({ ok: false, message: "초대 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    // 전화번호 중복 확인
    const existing = await prisma.organizationMember.findFirst({
      where: { organizationId: invite.organizationId, phone: phoneClean },
    });
    if (existing) {
      // 토큰 클레임 롤백
      await prisma.orgInviteToken.update({
        where: { id: invite.id },
        data:  { usedAt: null, usedByUserId: null },
      });
      return NextResponse.json({ ok: false, message: "이미 가입된 전화번호입니다." }, { status: 400 });
    }

    const memberId = `mbr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const role = invite.role === 'OWNER' ? 'OWNER'
               : invite.role === 'FREE_SALES' ? 'FREE_SALES'
               : 'AGENT';

    await prisma.$transaction([
      prisma.organizationMember.create({
        data: {
          id:             memberId,
          organizationId: invite.organizationId,
          userId:         memberId,
          phone:          phoneClean,
          email:          body.email?.trim() || null,
          passwordHash,
          role,
          displayName:    body.displayName?.trim() ?? null,
          isActive:       true,
        },
      }),
      prisma.orgInviteToken.update({
        where: { id: invite.id },
        data:  { usedByUserId: memberId, agreedToTerms: true },
      }),
    ]);

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

    // OWNER 이메일 알림 (비차단 — 실패해도 가입 성공)
    notifyOwnerOfNewMember(invite.organizationId, {
      name:      body.displayName?.trim() ?? '파트너',
      phone:     phoneClean.slice(0, 3) + '****' + phoneClean.slice(-4),
      role,
      memberId,
    }).catch((e) => logger.error("[join/token] OWNER 알림 실패", { e }));

    logger.warn("[POST /api/join/[token]] 판매원 가입 완료", {
      memberId, orgId: invite.organizationId, role,
    });

    return NextResponse.json({ ok: true, role });

  } catch (err) {
    logger.error("[POST /api/join/[token]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// ── OWNER 이메일 알림 (비동기, 비차단) ─────────────────────────────
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
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: 'long', day: 'numeric',
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
