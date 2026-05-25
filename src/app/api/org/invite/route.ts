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

const VALID_ROLES = ['OWNER', 'AGENT', 'FREE_SALES'];

// GET /api/org/invite — 초대 토큰 목록 (페이지네이션 지원)
export async function GET(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);

    if (ctx.role !== "OWNER" && ctx.role !== "GLOBAL_ADMIN") {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    // 페이지네이션 파라미터
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const skip = (page - 1) * limit;

    const [tokens, total] = await Promise.all([
      prisma.orgInviteToken.findMany({
        where:   { organizationId: orgId },
        orderBy: { createdAt: "desc" },
        skip,
        take:    limit,
        select: {
          id: true, token: true, role: true, note: true,
          expiresAt: true, usedAt: true, usedByUserId: true,
          agreedToTerms: true, createdAt: true, createdByUserId: true,
        },
      }),
      prisma.orgInviteToken.count({ where: { organizationId: orgId } }),
    ]);

    const now = new Date();
    const mapped = tokens.map((t) => ({
      ...t,
      url:       `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/join/${t.token}`,
      isExpired: t.expiresAt < now,
      isUsed:    !!t.usedAt,
    }));

    return NextResponse.json({
      ok: true,
      tokens: mapped,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      }
    });
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

    // JSON 파싱
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, message: "Invalid JSON" },
        { status: 400 }
      );
    }

    // 입력 검증
    const role = (body.role ?? 'AGENT').toUpperCase().trim();
    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { ok: false, message: `유효하지 않은 역할: ${role}` },
        { status: 400 }
      );
    }

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
      orgId = body.organizationId || '';
      if (!orgId) {
        return NextResponse.json(
          { ok: false, message: "GLOBAL_ADMIN은 organizationId를 명시해야 합니다." },
          { status: 400 }
        );
      }
    } else {
      orgId = requireOrgId(ctx);
    }

    // 조직 존재 여부 확인
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    });
    if (!org) {
      return NextResponse.json(
        { ok: false, message: "조직을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 만료: 기본 14일, 최대 30일
    const daysRaw = Math.min(Math.max(1, body.expiresInDays ?? 14), 30);
    const expiresAt = new Date(Date.now() + daysRaw * 24 * 60 * 60 * 1000);

    // 보안 토큰 — randomBytes(32).toString('base64url')
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
      select: {
        id: true,
        token: true,
        role: true,
        note: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    const url = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/join/${invite.token}`;

    logger.warn("[POST /api/org/invite] 초대 토큰 생성", {
      orgId, role, inviteId: invite.id, createdBy: ctx.userId, expiresAt,
    });

    return NextResponse.json(
      { ok: true, invite: { ...invite, url } },
      { status: 201 }
    );
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
      return NextResponse.json(
        { ok: false, message: "권한이 없습니다." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { ok: false, message: "id 파라미터 필수" },
        { status: 400 }
      );
    }

    // id 형식 검증 (cuid 패턴: ^[a-z0-9]+$)
    if (!/^[a-z0-9]+$/.test(id)) {
      return NextResponse.json(
        { ok: false, message: "유효하지 않은 id 형식" },
        { status: 400 }
      );
    }

    // 이미 사용된 토큰은 삭제 불가 (감사 추적 보존)
    const token = await prisma.orgInviteToken.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true, usedAt: true, role: true, createdAt: true },
    });
    if (!token) {
      return NextResponse.json(
        { ok: false, message: "토큰을 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    if (token.usedAt) {
      return NextResponse.json(
        { ok: false, message: "이미 사용된 초대 링크는 삭제할 수 없습니다." },
        { status: 409 }
      );
    }

    const deleted = await prisma.orgInviteToken.delete({
      where: { id },
      select: { id: true, role: true, createdAt: true },
    });

    logger.warn("[DELETE /api/org/invite] 초대 취소", {
      orgId, inviteId: id, role: deleted.role, deletedBy: ctx.userId,
    });

    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    logger.error("[DELETE /api/org/invite]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
