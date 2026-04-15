import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";

// 공개 랜딩페이지 — 인증 불필요
export default async function PublicLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const page = await prisma.crmLandingPage.findFirst({
    where: { slug, isActive: true, isPublic: true },
    select: { id: true, title: true, htmlContent: true },
  });

  if (!page) notFound();

  // 조회수 증가 (비동기, 오류 무시)
  prisma.crmLandingPage
    .update({ where: { id: page.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});

  return (
    <div className="min-h-screen">
      {/* HTML 콘텐츠를 iframe 대신 dangerouslySetInnerHTML로 렌더 */}
      {/* 보안: htmlContent는 관리자가 직접 작성한 신뢰된 콘텐츠 */}
      <div
        dangerouslySetInnerHTML={{ __html: page.htmlContent ?? "" }}
      />
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await prisma.crmLandingPage.findFirst({
    where: { slug },
    select: { title: true },
  });
  return { title: page?.title ?? "크루즈닷 랜딩페이지" };
}
