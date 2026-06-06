import "server-only";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { hashAffiliatePassword } from "@/lib/affiliate-issuance";

export const dynamic = "force-dynamic";

/**
 * POST /api/affiliate-issuance/[id]/reset-password
 * GLOBAL_ADMIN 전용 — 어필리에이트 비밀번호 초기화
 *
 * Request body: { newPassword?: string }  // 기본값 "1101"
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) {
      return NextResponse.json({ ok: false, error: "인증이 필요합니다." }, { status: 401 });
    }
    if (ctx.role !== "GLOBAL_ADMIN") {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const profileId = parseInt(params.id, 10);
    if (isNaN(profileId)) {
      return NextResponse.json({ ok: false, error: "유효하지 않은 ID입니다." }, { status: 400 });
    }

    // 요청 바디 파싱
    let newPassword = "1101";
    try {
      const body = await req.json();
      if (body?.newPassword && typeof body.newPassword === "string") {
        newPassword = body.newPassword;
      }
    } catch {
      // 바디 없거나 파싱 실패 시 기본값 사용
    }

    // 1. AffiliateProfile → userId 조회
    const profile = await prisma.gmAffiliateProfile.findUnique({
      where: { id: profileId },
      select: { userId: true },
    });
    if (!profile) {
      return NextResponse.json({ ok: false, error: "어필리에이트를 찾을 수 없습니다." }, { status: 404 });
    }

    // 2. 비밀번호 해시
    const hash = await hashAffiliatePassword(newPassword);

    // 3. GmUser 비밀번호 업데이트 + PasswordEvent 기록 (트랜잭션)
    await prisma.$transaction([
      prisma.gmUser.update({
        where: { id: profile.userId },
        data: { password: hash, isPasswordSet: true },
      }),
      prisma.passwordEvent.create({
        data: {
          userId: profile.userId,
          from: "",
          to: hash,
          reason: "affiliate_password_reset",
        },
      }),
    ]);

    logger.info(`affiliate-issuance: 비밀번호 초기화 완료 profileId=${profileId} userId=${profile.userId}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("affiliate-issuance reset-password POST 오류", err);
    return NextResponse.json({ ok: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
