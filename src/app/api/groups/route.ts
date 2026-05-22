import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { GroupFormSchema } from "@/schemas/forms";
import { errorResponse } from "@/lib/response";

// Step 1: serializeGroup 헬퍼 함수
const serializeGroup = (group: any) => {
  if (!group) throw new Error('Group object is null or undefined');
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    color: group.color,
    funnelId: group.funnelId,
    funnelName: group.funnel?.name ?? null,
    _count: { members: group._count?.members ?? 0 },
  };
};

// GET /api/groups — 그룹 목록
export async function GET() {
  try {
    const ctx = await getAuthContext();

    // GLOBAL_ADMIN은 organizationId가 null — 첫 번째 조직 사용
    let orgId: string;
    if (ctx.organizationId) {
      orgId = ctx.organizationId;
    } else if (ctx.role === 'GLOBAL_ADMIN') {
      const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
      if (!firstOrg) return NextResponse.json({ ok: true, groups: [] });
      orgId = firstOrg.id;
    } else {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN', message: '이 작업을 수행할 권한이 없습니다' }, { status: 403 });
    }

    // 내 그룹(ownerId === ctx.userId) + 조직 공유 그룹(ownerId === null) 만 반환
    // GLOBAL_ADMIN은 ownerId 필터 없이 조직 전체 조회
    const ownerFilter = ctx.role !== 'GLOBAL_ADMIN'
      ? { OR: [{ ownerId: ctx.userId }, { ownerId: null }] }
      : {};

    const groups = await prisma.contactGroup.findMany({
      where: { organizationId: orgId, ...ownerFilter },
      include: {
        _count: { select: { members: true } },
        funnel: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const result = groups.map(g => {
      if (!g) return null;
      try {
        return serializeGroup(g);
      } catch (err) {
        logger.error('[serializeGroup failed]', { err, groupId: g.id });
        return null;
      }
    }).filter((g): g is ReturnType<typeof serializeGroup> => g !== null);

    return NextResponse.json({ ok: true, groups: result });
  } catch (err) {
    logger.error("[GET /api/groups]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST /api/groups — 그룹 생성
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();

    // GLOBAL_ADMIN은 organizationId가 null — 첫 번째 조직 사용
    let orgId: string;
    if (ctx.organizationId) {
      orgId = ctx.organizationId;
    } else if (ctx.role === 'GLOBAL_ADMIN') {
      const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
      if (!firstOrg) return NextResponse.json({ ok: false, error: '조직이 없습니다.' }, { status: 500 });
      orgId = firstOrg.id;
    } else {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN', message: '조직 정보가 없습니다' }, { status: 403 });
    }

    const body = await req.json();
    const validation = GroupFormSchema.safeParse(body);

    if (!validation.success) {
      const fieldErrors = Object.fromEntries(
        validation.error.issues.map((issue) => [
          issue.path.join('.'),
          issue.message,
        ])
      );
      return errorResponse(
        "입력값 검증에 실패했습니다.",
        400,
        { errors: fieldErrors }
      );
    }

    const { name, description, color, funnelId } = validation.data;

    // ✅ funnelId 검증: 제공되었다면 해당 funnel이 존재하는지 확인
    if (funnelId) {
      const funnel = await prisma.funnel.findUnique({
        where: { id: funnelId },
        select: { id: true, organizationId: true },
      });

      if (!funnel) {
        return NextResponse.json(
          { ok: false, error: 'INVALID_FUNNEL', message: '존재하지 않는 퍼널입니다.' },
          { status: 400 }
        );
      }

      if (funnel.organizationId !== orgId) {
        return NextResponse.json(
          { ok: false, error: 'FORBIDDEN', message: '해당 조직의 퍼널이 아닙니다.' },
          { status: 403 }
        );
      }
    }

    const group = await prisma.contactGroup.create({
      data: {
        organizationId: orgId,
        name,
        description: description ?? null,
        color:       color       ?? "#6B7280",
        funnelId:    funnelId    ?? null,
        ownerId:     ctx.userId,  // 개인 그룹으로 생성
      },
      include: {
        _count: { select: { members: true } },
        funnel: { select: { name: true } },
      },
    });

    if (!group) {
      return NextResponse.json({ ok: false, error: 'Group creation failed' }, { status: 500 });
    }

    try {
      const serialized = serializeGroup(group);
      return NextResponse.json({
        ok: true,
        group: serialized,
      }, { status: 201 });
    } catch (serializeErr) {
      logger.error('[serializeGroup failed in POST]', { err: serializeErr, groupId: group.id });
      return NextResponse.json({ ok: false, error: 'Failed to serialize group' }, { status: 500 });
    }
  } catch (err) {
    logger.error("[POST /api/groups]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
