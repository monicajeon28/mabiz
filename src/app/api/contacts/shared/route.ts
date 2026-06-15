import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { handleApiError } from "@/lib/response";
import prisma from "@/lib/prisma";
import { getAuthContext, buildContactWhere, maskContactInfo } from "@/lib/rbac";

/**
 * GET /api/contacts/shared
 * 공유된 고객 목록 (visibility !== ADMIN_ONLY만 반환)
 *
 * 권한:
 * - GLOBAL_ADMIN: 모든 고객 (삭제됨 제외)
 * - OWNER: 자신의 조직 고객 (ADMIN_ONLY 제외)
 * - AGENT: 할당된 고객 + 자신이 작성한 고객 (ADMIN_ONLY 제외)
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const { searchParams } = new URL(req.url);

    const q = searchParams.get("q");
    const tagParam = searchParams.get("tags");
    const tags = tagParam ? tagParam.split(",").map((t) => t.trim()).filter(Boolean) : [];
    const assignedTo = searchParams.get("assignedTo");
    const limit = Math.min(Number(searchParams.get("limit")) || 30, 200);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

    // buildContactWhere()가 이미 visibility !== ADMIN_ONLY를 자동으로 필터링함
    const baseWhere = buildContactWhere(ctx, {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q } },
            ],
          }
        : {}),
      ...(tags.length > 0 ? { tags: { hasEvery: tags } } : {}),
      ...(assignedTo === "unassigned"
        ? { assignedUserId: null }
        : assignedTo
          ? { assignedUserId: assignedTo }
          : {}),
    });

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
          assignedUserId: true,
          createdBy: true,
          managerId: true,
          visibility: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.contact.count({ where: baseWhere }),
    ]);

    // P0-1 Security Fix: Apply PII masking to all contacts
    const maskedContacts = contacts.map(c => maskContactInfo(c, ctx));

    return NextResponse.json({
      tabName: "shared",
      description: "모두 볼 수 있는 고객 목록",
      items: maskedContacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error, "공유 고객 목록 조회 실패");
  }
}
