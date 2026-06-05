import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { errorResponse, handleApiError } from "@/lib/response";
import { z } from "zod";

// ─────────────────────────────────────────────
// Validation schema (확장)
// ─────────────────────────────────────────────
const GroupCreateSchema = z.object({
  // 기존 필드
  name: z.string().min(1, "그룹 이름은 필수입니다.").max(100, "100자 이하여야 합니다."),
  description: z.string().max(500, "500자 이하여야 합니다.").optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "#RRGGBB 형식이어야 합니다.")
    .optional()
    .nullable(),
  // 하위 호환성 유지
  funnelId: z.string().optional().nullable(),
  funnelSmsId: z.string().optional().nullable(),
  // 신규 필드
  parentGroupId: z.string().optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  reEntryPolicy: z
    .enum(["KEEP_TIME_KEEP_DATA", "RESET_TIME_KEEP_DATA", "RESET_ALL_RESTART"])
    .optional()
    .default("KEEP_TIME_KEEP_DATA"),
  autoMoveEnabled: z.boolean().optional().default(false),
  autoMoveDays: z.number().int().positive().optional().nullable(),
  autoMoveTargetGroupId: z.string().optional().nullable(),
  funnelIds: z.array(z.string()).optional().default([]),
  funnelSmsIds: z.array(z.string()).optional().default([]),
  funnelEmailIds: z.array(z.string()).optional().default([]),
});

// ─────────────────────────────────────────────
// 헬퍼: seq 생성 (16자 hex, 최대 5회 재시도)
// ─────────────────────────────────────────────
async function generateUniqueSeq(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = crypto.randomBytes(8).toString("hex"); // 16자
    const existing = await prisma.contactGroup.findFirst({
      where: { seq: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw new Error("seq 생성 실패: 5회 재시도 초과");
}

// ─────────────────────────────────────────────
// 헬퍼: 조직 ID 해석 (GLOBAL_ADMIN 지원)
// ─────────────────────────────────────────────
async function resolveOrgId(ctx: Awaited<ReturnType<typeof getAuthContext>>): Promise<string | null> {
  if (ctx.organizationId) return ctx.organizationId;
  if (ctx.role === "GLOBAL_ADMIN") {
    const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
    return firstOrg?.id ?? null;
  }
  return null;
}

// ─────────────────────────────────────────────
// 헬퍼: 그룹 직렬화
// ─────────────────────────────────────────────
type RawGroup = {
  id: string;
  seq?: string | null;
  name: string;
  description?: string | null;
  color?: string | null;
  category?: string | null;
  parentGroupId?: string | null;
  reEntryPolicy?: string;
  autoMoveEnabled?: boolean;
  autoMoveDays?: number | null;
  autoMoveTargetGroupId?: string | null;
  funnelId?: string | null;
  funnelSmsId?: string | null;
  funnelIds?: string[];
  funnelSmsIds?: string[];
  funnelEmailIds?: string[];
  memberCount?: number;
  createdAt: Date | string;
  _count?: { members?: number };
  children?: RawGroup[];
};

type FunnelSmsChip = { id: string; title: string };

type SerializedGroup = {
  id: string;
  seq: string | null;
  name: string;
  description: string | null;
  color: string;
  category: string | null;
  parentGroupId: string | null;
  reEntryPolicy: string;
  autoMoveEnabled: boolean;
  autoMoveDays: number | null;
  autoMoveTargetGroupId: string | null;
  funnelId: string | null;
  funnelSmsId: string | null;
  funnelIds: string[];
  funnelSmsIds: string[];
  funnelEmailIds: string[];
  // 연결된 퍼널문자 제목 칩 (id+title) — 배치 조회로 매핑
  funnelSmsChips: FunnelSmsChip[];
  memberCount: number;
  createdAt: Date | string;
  _count: { members: number };
  children: SerializedGroup[] | undefined;
};

function serializeGroup(
  g: RawGroup,
  funnelSmsTitleMap?: Map<string, string>
): SerializedGroup {
  const smsIds = g.funnelSmsIds ?? [];
  const funnelSmsChips: FunnelSmsChip[] = funnelSmsTitleMap
    ? smsIds
        .map((id) => {
          const title = funnelSmsTitleMap.get(id);
          return title ? { id, title } : null;
        })
        .filter((c): c is FunnelSmsChip => c !== null)
    : [];

  return {
    id: g.id,
    seq: g.seq ?? null,
    name: g.name,
    description: g.description ?? null,
    color: g.color ?? "#6B7280",
    category: g.category ?? null,
    parentGroupId: g.parentGroupId ?? null,
    reEntryPolicy: g.reEntryPolicy ?? "KEEP_TIME_KEEP_DATA",
    autoMoveEnabled: g.autoMoveEnabled ?? false,
    autoMoveDays: g.autoMoveDays ?? null,
    autoMoveTargetGroupId: g.autoMoveTargetGroupId ?? null,
    funnelId: g.funnelId ?? null,
    funnelSmsId: g.funnelSmsId ?? null,
    funnelIds: g.funnelIds ?? [],
    funnelSmsIds: smsIds,
    funnelEmailIds: g.funnelEmailIds ?? [],
    funnelSmsChips,
    memberCount: g.memberCount ?? 0,
    createdAt: g.createdAt,
    _count: { members: g._count?.members ?? 0 },
    // 자식 그룹 (GET에서 include 시 포함)
    children: Array.isArray(g.children)
      ? g.children.map((c) => serializeGroup(c, funnelSmsTitleMap))
      : undefined,
  };
}

// ─────────────────────────────────────────────
// GET /api/groups — 그룹 목록 (계층 포함, 페이지네이션)
// ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const orgId = await resolveOrgId(ctx);

    if (!orgId) {
      if (ctx.role === "GLOBAL_ADMIN") {
        return NextResponse.json({ ok: true, groups: [], totalCount: 0 });
      }
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN", message: "이 작업을 수행할 권한이 없습니다" },
        { status: 403 }
      );
    }

    // URL 파라미터 파싱
    const { searchParams } = new URL(req.url);
    const rawLimit = parseInt(searchParams.get("limit") ?? "10", 10);
    const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
    const rawPageSize = searchParams.get("pageSize");
    const parentIdParam = searchParams.get("parentId"); // "null" 문자열 또는 실제 ID 또는 미지정

    // pageSize가 명시되면 limit 대신 사용
    const limit = rawPageSize
      ? [10, 50, 100].includes(parseInt(rawPageSize, 10))
        ? parseInt(rawPageSize, 10)
        : 10
      : isNaN(rawLimit) || rawLimit < 1
      ? 10
      : Math.min(rawLimit, 100);

    const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

    // 오너 필터 (GLOBAL_ADMIN은 전체 조회)
    const ownerFilter =
      ctx.role !== "GLOBAL_ADMIN"
        ? { OR: [{ ownerId: ctx.userId }, { ownerId: null as string | null }] }
        : {};

    // parentId 필터 결정
    // - parentId=null (명시적 "null" 문자열) → 대그룹만 (parentGroupId IS NULL)
    // - parentId=<id> → 해당 그룹의 자식만
    // - 미지정 → 대그룹 + 자식 포함 (기본: 대그룹 기준 계층 쿼리)
    const isRootQuery = parentIdParam === null || parentIdParam === "null";
    const isChildQuery = parentIdParam && parentIdParam !== "null";

    const parentFilter = isChildQuery
      ? { parentGroupId: parentIdParam }
      : isRootQuery
      ? { parentGroupId: null as string | null }
      : { parentGroupId: null as string | null }; // 기본값: 대그룹

    // totalCount
    const totalCount = await prisma.contactGroup.count({
      where: { organizationId: orgId, ...ownerFilter, ...parentFilter },
    });

    // 대그룹 쿼리 시 children 포함
    const includeChildren = !isChildQuery; // 대그룹 조회 시 children include

    const groups = await prisma.contactGroup.findMany({
      where: { organizationId: orgId, ...ownerFilter, ...parentFilter },
      select: {
        id: true,
        seq: true,
        name: true,
        description: true,
        color: true,
        category: true,
        parentGroupId: true,
        reEntryPolicy: true,
        autoMoveEnabled: true,
        autoMoveDays: true,
        autoMoveTargetGroupId: true,
        funnelId: true,
        funnelSmsId: true,
        funnelIds: true,
        funnelSmsIds: true,
        funnelEmailIds: true,
        memberCount: true,
        createdAt: true,
        _count: { select: { members: true } },
        // 자식 그룹 (대그룹 쿼리 시만 포함)
        ...(includeChildren
          ? {
              children: {
                select: {
                  id: true,
                  seq: true,
                  name: true,
                  description: true,
                  color: true,
                  category: true,
                  parentGroupId: true,
                  reEntryPolicy: true,
                  autoMoveEnabled: true,
                  autoMoveDays: true,
                  autoMoveTargetGroupId: true,
                  funnelId: true,
                  funnelSmsId: true,
                  funnelIds: true,
                  funnelSmsIds: true,
                  funnelEmailIds: true,
                  memberCount: true,
                  createdAt: true,
                  _count: { select: { members: true } },
                },
                orderBy: { createdAt: "asc" },
              },
            }
          : {}),
      },
      orderBy: { createdAt: "asc" },
      skip: offset,
      take: limit,
    });

    // ── 연결된 퍼널문자 title 배치 조회 (N+1 방지: in-절 1회) ──
    // 대그룹 + 자식 그룹의 funnelSmsIds 를 모두 수집 후 1회 쿼리로 매핑.
    const allFunnelSmsIds = new Set<string>();
    for (const g of groups) {
      for (const id of g.funnelSmsIds ?? []) allFunnelSmsIds.add(id);
      for (const child of g.children ?? []) {
        for (const id of child.funnelSmsIds ?? []) allFunnelSmsIds.add(id);
      }
    }

    const funnelSmsTitleMap = new Map<string, string>();
    if (allFunnelSmsIds.size > 0) {
      const smsRows = await prisma.funnelSms.findMany({
        where: { id: { in: [...allFunnelSmsIds] }, organizationId: orgId },
        select: { id: true, title: true },
      });
      for (const row of smsRows) funnelSmsTitleMap.set(row.id, row.title);
    }

    const result = groups
      .map((g) => {
        try {
          return serializeGroup(g, funnelSmsTitleMap);
        } catch (err) {
          logger.error("[serializeGroup failed]", { err, groupId: g.id });
          return null;
        }
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);

    const categoryRows = await prisma.contactGroup.findMany({
      where: { organizationId: orgId, ...ownerFilter, category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });
    const categories = categoryRows
      .map((r) => r.category)
      .filter((c): c is string => c !== null);

    return NextResponse.json({ ok: true, groups: result, totalCount, categories });
  } catch (err) {
    logger.error("[GET /api/groups]", { err });
    return handleApiError(err);
  }
}

// ─────────────────────────────────────────────
// POST /api/groups — 그룹 생성
// ─────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = await resolveOrgId(ctx);

    if (!orgId) {
      if (ctx.role === "GLOBAL_ADMIN") {
        return NextResponse.json({ ok: false, error: "조직이 없습니다." }, { status: 500 });
      }
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN", message: "조직 정보가 없습니다" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validation = GroupCreateSchema.safeParse(body);

    if (!validation.success) {
      const fieldErrors = Object.fromEntries(
        validation.error.issues.map((issue) => [issue.path.join("."), issue.message])
      );
      return errorResponse("입력값 검증에 실패했습니다.", 400, { errors: fieldErrors });
    }

    const data = validation.data;

    // ── parentGroupId 검증 ──────────────────────
    if (data.parentGroupId) {
      const parentGroup = await prisma.contactGroup.findUnique({
        where: { id: data.parentGroupId },
        select: { id: true, organizationId: true },
      });
      if (!parentGroup) {
        return NextResponse.json(
          { ok: false, error: "INVALID_PARENT_GROUP", message: "존재하지 않는 부모 그룹입니다." },
          { status: 400 }
        );
      }
      if (parentGroup.organizationId !== orgId) {
        return NextResponse.json(
          { ok: false, error: "FORBIDDEN", message: "해당 조직의 그룹이 아닙니다." },
          { status: 403 }
        );
      }

      // ── 순환참조 방지: 조상 체인에 자기자신(parentGroupId) 포함 여부 재귀 검사 ──
      // POST(신규 생성) 시점에는 아직 id가 없으므로, parentGroupId 자체가
      // 자기 자신을 가리키거나 그 조상 체인 안에 parentGroupId가 반복되는
      // 경우(= 이미 닫힌 고리)를 차단한다.
      async function hasCircularAncestor(checkId: string, visited = new Set<string>()): Promise<boolean> {
        if (visited.has(checkId)) return true; // 이미 방문 → 순환 발생
        visited.add(checkId);
        const node = await prisma.contactGroup.findUnique({
          where: { id: checkId },
          select: { parentGroupId: true },
        });
        if (!node?.parentGroupId) return false;
        return hasCircularAncestor(node.parentGroupId, visited);
      }

      if (await hasCircularAncestor(data.parentGroupId)) {
        return NextResponse.json(
          { ok: false, error: "CIRCULAR_PARENT_GROUP", message: "순환 참조가 발생하는 부모 그룹은 지정할 수 없습니다." },
          { status: 400 }
        );
      }
    }

    // ── 기존 funnelId 검증 (하위 호환) ─────────
    if (data.funnelId) {
      const funnel = await prisma.funnel.findUnique({
        where: { id: data.funnelId },
        select: { id: true, organizationId: true },
      });
      if (!funnel) {
        return NextResponse.json(
          { ok: false, error: "INVALID_FUNNEL", message: "존재하지 않는 퍼널입니다." },
          { status: 400 }
        );
      }
      if (funnel.organizationId !== orgId) {
        return NextResponse.json(
          { ok: false, error: "FORBIDDEN", message: "해당 조직의 퍼널이 아닙니다." },
          { status: 403 }
        );
      }
    }

    // ── autoMoveTargetGroupId 검증 (IDOR 방지) ──
    if (data.autoMoveTargetGroupId) {
      const targetGroup = await prisma.contactGroup.findUnique({
        where: { id: data.autoMoveTargetGroupId },
        select: { id: true, organizationId: true },
      });
      if (!targetGroup || targetGroup.organizationId !== orgId) {
        return NextResponse.json(
          { ok: false, error: "FORBIDDEN", message: "자동 이동 대상 그룹이 이 조직에 속하지 않습니다." },
          { status: 403 }
        );
      }
    }

    // ── seq 생성 (16자 hex, 최대 5회 재시도) ───
    const seq = await generateUniqueSeq();

    // ── 그룹 생성 ───────────────────────────────
    const group = await prisma.contactGroup.create({
      data: {
        organizationId: orgId,
        name: data.name,
        description: data.description ?? null,
        color: data.color ?? "#6B7280",
        seq,
        // 하위 호환성 유지
        funnelId: data.funnelId ?? null,
        funnelSmsId: data.funnelSmsId ?? null,
        // 신규 필드
        parentGroupId: data.parentGroupId ?? null,
        category: data.category ?? null,
        reEntryPolicy: data.reEntryPolicy,
        autoMoveEnabled: data.autoMoveEnabled,
        autoMoveDays: data.autoMoveDays ?? null,
        autoMoveTargetGroupId: data.autoMoveTargetGroupId ?? null,
        funnelIds: data.funnelIds,
        funnelSmsIds: data.funnelSmsIds,
        funnelEmailIds: data.funnelEmailIds,
        ownerId: ctx.userId,
      },
      select: {
        id: true,
        seq: true,
        name: true,
        description: true,
        color: true,
        category: true,
        parentGroupId: true,
        reEntryPolicy: true,
        autoMoveEnabled: true,
        autoMoveDays: true,
        autoMoveTargetGroupId: true,
        funnelId: true,
        funnelSmsId: true,
        funnelIds: true,
        funnelSmsIds: true,
        funnelEmailIds: true,
        memberCount: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
    });

    try {
      const serialized = serializeGroup(group);
      return NextResponse.json({ ok: true, group: serialized }, { status: 201 });
    } catch (serializeErr) {
      logger.error("[serializeGroup failed in POST]", { err: serializeErr, groupId: group.id });
      return NextResponse.json({ ok: false, error: "Failed to serialize group" }, { status: 500 });
    }
  } catch (err) {
    logger.error("[POST /api/groups]", { err });
    return NextResponse.json(
      { ok: false, error: "INTERNAL_SERVER_ERROR", message: "그룹 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
