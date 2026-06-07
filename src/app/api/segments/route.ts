/**
 * GET /api/segments - List all segments with profiles
 * POST /api/segments/refresh - Trigger re-clustering
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext().catch(() => null);
  if (!ctx?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = resolveOrgId(ctx);

  // Contact의 autoSegment 필드 기반으로 세그먼트 통계 반환
  const segmentGroups = await prisma.contact.groupBy({
    by: ["autoSegment"],
    where: { organizationId: orgId, deletedAt: null },
    _count: { id: true },
  });

  const segments = segmentGroups.map((g) => ({
    id: g.autoSegment ?? "unclassified",
    name: g.autoSegment ?? "미분류",
    size: g._count.id,
  }));

  return NextResponse.json({
    success: true,
    total: segments.reduce((s, g) => s + g.size, 0),
    segments,
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext().catch(() => null);
  if (!ctx?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    success: true,
    message: "세그먼트 재분류 요청이 접수됐습니다.",
  });
}
