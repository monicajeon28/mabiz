import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/tools/news-links
// 인증된 사용자에게 발행된 뉴스 목록을 최신순으로 반환 (최대 50개)
export async function GET() {
  try {
    await getAuthContext(); // 인증 확인만 (News는 조직 필터 없음)

    const news = await prisma.news.findMany({
      where: { status: "published" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        slug: true,
        title: true,
        publishedAt: true,
        createdAt: true,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cruisedot.co.kr";

    const links = news.map((n) => ({
      id: String(n.id),
      shortCode: n.slug,
      title: n.title,
      url: `${baseUrl}/news/${n.slug}`,
      createdAt: (n.publishedAt ?? n.createdAt).toISOString(),
    }));

    return NextResponse.json({ ok: true, links });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false }, { status: 401 });
    logger.error("[GET /api/tools/news-links]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
