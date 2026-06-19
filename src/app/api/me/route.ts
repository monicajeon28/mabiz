import { NextResponse } from "next/server";
import { getMabizSession } from "@/lib/auth";

// GET /api/me - 현재 사용자 정보 조회
export async function GET() {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });

    return NextResponse.json({
      ok: true,
      userId: ctx.userId,
      role: ctx.role,
      organizationId: ctx.organizationId,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, message: "오류가 발생했습니다." }, { status: 500 });
  }
}
