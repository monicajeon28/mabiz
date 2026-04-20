import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { createHash } from "crypto";

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
      return NextResponse.json({ ok: false, message: "이미 사용된 초대 링크입니다." }, { status: 400 });
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ ok: false, message: "만료된 초대 링크입니다. 새 링크를 요청하세요." }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      orgName:  invite.organization.name,
      note:     invite.note,
      role:     invite.role,
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
      displayName?: string;
      agreedToTerms?: boolean;
      phone?: string;
      password?: string;
      signature?: string;
    };

    if (!body.agreedToTerms) {
      return NextResponse.json({ ok: false, message: "수당 조건에 동의해야 합니다." }, { status: 400 });
    }

    const phoneClean = body.phone?.trim().replace(/[^0-9]/g, '') || '';
    if (!phoneClean) {
      return NextResponse.json({ ok: false, message: "전화번호를 입력해주세요." }, { status: 400 });
    }

    const invite = await prisma.orgInviteToken.findUnique({
      where: { token },
      select: { id: true, organizationId: true, role: true, usedAt: true, expiresAt: true },
    });

    if (!invite)       return NextResponse.json({ ok: false, message: "유효하지 않은 초대입니다." }, { status: 404 });
    if (invite.usedAt) return NextResponse.json({ ok: false, message: "이미 사용된 초대입니다." }, { status: 400 });
    if (invite.expiresAt < new Date()) return NextResponse.json({ ok: false, message: "만료된 초대입니다." }, { status: 400 });

    // 전화번호로 중복 가입 확인
    const existing = await prisma.organizationMember.findFirst({
      where: { organizationId: invite.organizationId, phone: phoneClean },
    });
    if (existing) {
      return NextResponse.json({ ok: false, message: "이미 가입된 전화번호입니다." }, { status: 400 });
    }

    const passwordHash = createHash('sha256').update(body.password || 'qwe1').digest('hex');
    const memberId = `mbr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await prisma.$transaction([
      prisma.organizationMember.create({
        data: {
          id: memberId,
          organizationId: invite.organizationId,
          userId: memberId,
          phone: phoneClean,
          passwordHash,
          role: invite.role,
          displayName: body.displayName?.trim() ?? null,
          isActive: true,
        },
      }),
      prisma.orgInviteToken.update({
        where: { id: invite.id },
        data: {
          usedAt:       new Date(),
          usedByUserId: memberId,
          agreedToTerms: true,
        },
      }),
    ]);

    // 자동 로그인 세션 생성
    const { cookies } = await import('next/headers');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const session = await prisma.mabizSession.create({
      data: {
        memberId,
        role: invite.role === 'OWNER' ? 'OWNER' : invite.role === 'FREE_SALES' ? 'FREE_SALES' : 'AGENT',
        organizationId: invite.organizationId,
        expiresAt,
      },
    });

    const cookieStore = await cookies();
    cookieStore.set('mabiz.sid', session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });

    logger.log("[POST /api/join/[token]] 판매원 가입 완료", {
      memberId, orgId: invite.organizationId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[POST /api/join/[token]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
