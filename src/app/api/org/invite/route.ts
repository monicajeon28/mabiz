import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// ── 역할별 생성 가능 초대 역할 ──────────────────────────────────────────
// OWNER → AGENT, FREE_SALES (자신의 조직 내 하위 역할만)
// GLOBAL_ADMIN → OWNER, AGENT, FREE_SALES (모든 역할, 모든 조직)
const ALLOWED_BY_ROLE: Record<string, string[]> = {
  OWNER:        ['AGENT', 'FREE_SALES'],
  GLOBAL_ADMIN: ['OWNER', 'AGENT', 'FREE_SALES'],
};

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
      take:    50,
      select: {
        id: true, token: true, role: true, note: true,
        expiresAt: true, usedAt: true, usedByUserId: true,
        agreedToTerms: true, createdAt: true,
      },
    });

    const now = new Date();
    const mapped = tokens.map((t) => ({
      ...t,
      url:       `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/join/${t.token}`,
      isExpired: t.expiresAt < now,
      isUsed:    !!t.usedAt,
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
    const ctx = await getAuthContext();

    if (ctx.role !== "OWNER" && ctx.role !== "GLOBAL_ADMIN") {
      return NextResponse.json(
        { ok: false, message: "대리점장 또는 관리자만 초대 링크를 생성할 수 있습니다." },
        { status: 403 }
      );
    }

    const body = await req.json() as {
      role?:           string;
      note?:           string;
      organizationId?: string;  // GLOBAL_ADMIN이 타 조직에 초대 발급 시
      expiresInDays?:  number;
    };

    const role = (body.role ?? 'AGENT').toUpperCase();

    // 역할 권한 검증
    const allowed = ALLOWED_BY_ROLE[ctx.role] ?? [];
    if (!allowed.includes(role)) {
      return NextResponse.json(
        { ok: false, message: `${ctx.role}는 ${role} 역할 초대를 생성할 수 없습니다.` },
        { status: 403 }
      );
    }

    // 조직 ID 결정 — GLOBAL_ADMIN은 body.organizationId 허용
    let orgId: string;
    if (ctx.role === 'GLOBAL_ADMIN') {
      orgId = body.organizationId ?? ctx.organizationId ?? '';
      if (!orgId) {
        return NextResponse.json(
          { ok: false, message: "GLOBAL_ADMIN은 organizationId를 명시해야 합니다." },
          { status: 400 }
        );
      }
    } else {
      orgId = requireOrgId(ctx);
    }

    // 만료: 기본 14일, 최대 30일
    const daysRaw = Math.min(body.expiresInDays ?? 14, 30);
    const expiresAt = new Date(Date.now() + daysRaw * 24 * 60 * 60 * 1000);

    // 보안 토큰 — cuid() 사용 금지
    const token = randomBytes(32).toString('base64url');

    const invite = await prisma.orgInviteToken.create({
      data: {
        organizationId:  orgId,
        token,
        role,
        note:            body.note?.trim() ?? null,
        expiresAt,
        createdByUserId: ctx.userId,
      },
      select: { id: true, token: true, role: true, note: true, expiresAt: true },
    });

    const url = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/join/${invite.token}`;

    logger.warn("[POST /api/org/invite] 초대 토큰 생성", {
      orgId, role, inviteId: invite.id, createdBy: ctx.userId,
    });

    return NextResponse.json({ ok: true, invite: { ...invite, url } });
  } catch (err) {
    logger.error("[POST /api/org/invite]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// DELETE /api/org/invite?id=xxx — 초대 취소 (미사용 토큰만)
export async function DELETE(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);

    if (ctx.role !== "OWNER" && ctx.role !== "GLOBAL_ADMIN") {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, message: "id 필수" }, { status: 400 });

    // 이미 사용된 토큰은 삭제 불가 (감사 추적 보존)
    const token = await prisma.orgInviteToken.findFirst({
      where: { id, organizationId: orgId },
      select: { usedAt: true },
    });
    if (!token) {
      return NextResponse.json({ ok: false, message: "토큰을 찾을 수 없습니다." }, { status: 404 });
    }
    if (token.usedAt) {
      return NextResponse.json({ ok: false, message: "이미 사용된 초대 링크는 삭제할 수 없습니다." }, { status: 400 });
    }

    await prisma.orgInviteToken.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[DELETE /api/org/invite]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
