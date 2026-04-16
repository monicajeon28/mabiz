import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/org/invite — 초대 토큰 목록
export async function GET(_req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);

    if (ctx.role !== "OWNER" && ctx.role !== "GLOBAL_ADMIN") {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const tokens = await prisma.orgInviteToken.findMany({
      where:   { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take:    20,
      select: {
        id: true, token: true, role: true, note: true,
        expiresAt: true, usedAt: true, usedByUserId: true,
        agreedToTerms: true, createdAt: true,
      },
    });

    const now = new Date();
    const mapped = tokens.map((t) => ({
      ...t,
      url:        `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/join/${t.token}`,
      isExpired:  t.expiresAt < now,
      isUsed:     !!t.usedAt,
    }));

    return NextResponse.json({ ok: true, tokens: mapped });
  } catch (err) {
    logger.error("[GET /api/org/invite]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST /api/org/invite — 초대 토큰 생성
export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);

    if (ctx.role !== "OWNER" && ctx.role !== "GLOBAL_ADMIN") {
      return NextResponse.json({ ok: false, message: "대리점장 또는 관리자만 초대 링크를 생성할 수 있습니다." }, { status: 403 });
    }

    const { role = 'AGENT', note } = await req.json() as { role?: string; note?: string };

    // 허용 역할 검증
    const ALLOWED_ROLES = ['OWNER', 'AGENT', 'FREE_SALES'];
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ ok: false, message: '허용되지 않은 역할입니다' }, { status: 400 });
    }

    // 7일 만료
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await prisma.orgInviteToken.create({
      data: {
        organizationId: orgId,
        role,
        note:           note?.trim() ?? null,
        expiresAt,
        createdByUserId: ctx.userId,
      },
      select: { id: true, token: true, expiresAt: true, note: true },
    });

    logger.log("[POST /api/org/invite]", { orgId, inviteId: invite.id });

    return NextResponse.json({
      ok: true,
      invite: {
        ...invite,
        url: `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/join/${invite.token}`,
      },
    });
  } catch (err) {
    logger.error("[POST /api/org/invite]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// DELETE /api/org/invite?id=xxx — 초대 취소
export async function DELETE(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);

    if (ctx.role !== "OWNER" && ctx.role !== "GLOBAL_ADMIN") {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false }, { status: 400 });

    await prisma.orgInviteToken.deleteMany({
      where: { id, organizationId: orgId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[DELETE /api/org/invite]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
