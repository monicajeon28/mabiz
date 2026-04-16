import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { logger } from "@/lib/logger";

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

// POST /api/join/[token] — 초대 수락 (Clerk 로그인 후)
export async function POST(req: Request, { params }: Params) {
  try {
    const { token } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await req.json() as { displayName?: string; agreedToTerms?: boolean };

    if (!body.agreedToTerms) {
      return NextResponse.json({ ok: false, message: "수당 조건에 동의해야 합니다." }, { status: 400 });
    }

    const invite = await prisma.orgInviteToken.findUnique({
      where: { token },
      select: { id: true, organizationId: true, role: true, usedAt: true, expiresAt: true },
    });

    if (!invite)       return NextResponse.json({ ok: false, message: "유효하지 않은 초대입니다." }, { status: 404 });
    if (invite.usedAt) return NextResponse.json({ ok: false, message: "이미 사용된 초대입니다." }, { status: 400 });
    if (invite.expiresAt < new Date()) return NextResponse.json({ ok: false, message: "만료된 초대입니다." }, { status: 400 });

    // 이미 멤버인지 확인
    const existing = await prisma.organizationMember.findFirst({
      where: { organizationId: invite.organizationId, userId },
    });
    if (existing) {
      return NextResponse.json({ ok: false, message: "이미 조직 멤버입니다." }, { status: 400 });
    }

    // 트랜잭션: 멤버 추가 + 초대 토큰 사용 처리
    await prisma.$transaction([
      prisma.organizationMember.create({
        data: {
          organizationId: invite.organizationId,
          userId,
          role:           invite.role,
          displayName:    body.displayName?.trim() ?? null,
          isActive:       true,
        },
      }),
      prisma.orgInviteToken.update({
        where: { id: invite.id },
        data: {
          usedAt:       new Date(),
          usedByUserId: userId,
          agreedToTerms: true,
        },
      }),
    ]);

    logger.log("[POST /api/join/[token]] 판매원 가입 완료", {
      userId, orgId: invite.organizationId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[POST /api/join/[token]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
