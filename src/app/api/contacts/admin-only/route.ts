import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { handleApiError } from "@/lib/response";
import prisma from "@/lib/prisma";
import { getAuthContext, canViewTrash } from "@/lib/rbac";

/**
 * GET /api/contacts/admin-only
 * 관리자 전용 고객 목록 (visibility === ADMIN_ONLY만 반환)
 *
 * 권한:
 * - GLOBAL_ADMIN: 모든 ADMIN_ONLY 고객
 * - OWNER: 자신의 조직 ADMIN_ONLY 고객만
 * - AGENT/FREE_SALES: 접근 불가 (403 Forbidden)
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();

    // OWNER 이상만 접근 가능 (canViewTrash와 동일한 권한)
    if (!canViewTrash(ctx)) {
      return NextResponse.json(
        { error: "접근 권한 없음 (OWNER 이상 필요)" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);

    const q = searchParams.get("q");
    const tagParam = searchParams.get("tags");
    const tags = tagParam ? tagParam.split(",").map((t) => t.trim()).filter(Boolean) : [];
    const limit = Math.min(Number(searchParams.get("limit")) || 30, 200);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

    // 기본 WHERE 조건
    const baseWhere: Prisma.ContactWhereInput = {
      visibility: "ADMIN_ONLY",
      deletedAt: null,
      ...(ctx.role === "GLOBAL_ADMIN"
        ? {} // GLOBAL_ADMIN은 제한 없음
        : { organizationId: ctx.organizationId! }), // OWNER는 자신의 조직만
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q } },
            ],
          }
        : {}),
      ...(tags.length > 0 ? { tags: { hasEvery: tags } } : {}),
    };

    const skip = (page - 1) * limit;

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where: baseWhere,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          type: true,
          createdAt: true,
          createdBy: true,
          managerId: true,
          visibility: true,
          adminMemo: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.contact.count({ where: baseWhere }),
    ]);

    return NextResponse.json({
      tabName: "admin-only",
      description: "관리자만 볼 수 있는 고객 목록",
      items: contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error, "관리자 전용 고객 목록 조회 실패");
  }
}
