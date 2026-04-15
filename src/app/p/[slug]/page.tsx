import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
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

  // 조회수 증가 (비동기, 오류 무시)
  prisma.crmLandingPage
    .update({ where: { id: page.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});

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
