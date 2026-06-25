import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMabizSession } from "@/lib/auth";

// GET /api/branch-managers - GLOBAL_ADMIN용 지사장 목록 조회
export async function GET() {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });

    // GLOBAL_ADMIN만 접근 가능
    if (ctx.role !== "GLOBAL_ADMIN") {
      return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
    }

    // OWNER 또는 BRANCH_MANAGER 역할을 가진 조직멤버 조회
    const branchManagers = await prisma.organizationMember.findMany({
      where: {
        role: { in: ["OWNER", "BRANCH_MANAGER"] },
        isActive: true,
      },
      select: {
        id: true,
        displayName: true,
      },
      orderBy: { displayName: "asc" },
    });

    return NextResponse.json(branchManagers);
  } catch {
    return NextResponse.json({ ok: false, message: "오류가 발생했습니다." }, { status: 500 });
  }
}
