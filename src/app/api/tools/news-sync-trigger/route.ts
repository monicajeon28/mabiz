import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// POST /api/tools/news-sync-trigger
// draft 상태의 뉴스를 published로 전환 (publishedAt 기준 누락분 처리)
// 외부 RSS/API 연동이 없는 경우 미발행 뉴스를 일괄 발행 처리
export async function POST() {
  try {
    await getAuthContext(); // 인증 확인

    const now = new Date();

    // publishedAt이 설정됐으나 status가 여전히 draft인 뉴스 일괄 발행
    const { count } = await prisma.news.updateMany({
      where: {
        status: "draft",
        publishedAt: { lte: now },
      },
      data: { status: "published" },
    });

    logger.info("[POST /api/tools/news-sync-trigger]", { published: count });

    return NextResponse.json({
      ok: true,
      message: count > 0
        ? `${count}개의 뉴스가 발행 처리되었습니다.`
        : "동기화 요청이 접수되었습니다.",
      published: count,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false }, { status: 401 });
    logger.error("[POST /api/tools/news-sync-trigger]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
