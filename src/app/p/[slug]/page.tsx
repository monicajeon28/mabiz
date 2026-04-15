import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createHash } from "crypto";
import { LandingClient } from "./LandingClient";

// 공개 랜딩페이지 — 인증 불필요
export default async function PublicLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const page = await prisma.crmLandingPage.findFirst({
    where:  { slug, isActive: true, isPublic: true },
    select: { id: true, title: true, htmlContent: true },
  });

  if (!page) notFound();

  // IP 해시 dedup — 24시간 내 동일 IP 재방문은 viewCount 증가 스킵
  const hdrs = await headers();
  const rawIP =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    "unknown";
  const salt = process.env.LANDING_VIEW_SALT ?? "default-salt";
  const ipHash = createHash("sha256").update(rawIP + salt).digest("hex");

  // 24시간 이상 된 뷰 비동기 정리 (오류 무시)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  prisma.crmLandingView
    .deleteMany({ where: { viewedAt: { lt: since } } })
    .catch(() => {});

  try {
    await prisma.crmLandingView.create({
      data: { landingPageId: page.id, ipHash },
    });
    // 신규 방문 → viewCount 증가 (비동기, 오류 무시)
    prisma.crmLandingPage
      .update({ where: { id: page.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});
  } catch {
    // unique 위반(P2002) = 24시간 내 재방문 → viewCount 증가 스킵
  }

  return (
    <LandingClient
      pageId={page.id}
      htmlContent={page.htmlContent ?? ""}
    />
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await prisma.crmLandingPage.findFirst({
    where:  { slug },
    select: { title: true },
  });
  return {
    title:       page?.title ?? "크루즈닷 랜딩페이지",
    description: "크루즈 전문 여행사 크루즈닷의 상담 신청 페이지입니다.",
  };
}
