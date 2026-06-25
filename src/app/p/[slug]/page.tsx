import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { cache } from "react";
import Script from "next/script";
import { LandingClient } from "./LandingClient";
import BotLandingClient from "./BotLandingClient";
import { sanitizeHtml } from "@/lib/html-sanitizer";
import { sanitizeHeaderScript } from "@/lib/sanitize-header-script";

// [T17] React cache()로 같은 요청 내 중복 DB 쿼리 제거
const getLandingPageBySlugOrShortlink = cache(async (identifier: string) => {
  return prisma.crmLandingPage.findFirst({
    where:  {
      OR: [
        { shortlink: identifier }, // 먼저 shortlink로 검색
        { slug: identifier }        // 그 다음 slug로 검색
      ],
      isActive: true,
      isPublic: true,
    },
    select: {
      id: true, title: true, htmlContent: true, commentEnabled: true,
      pageType: true, botConfig: true,
      paymentEnabled: true, paymentType: true, productName: true, productPrice: true,
      cycleDay: true, expireDate: true,
      buttonTitle: true, completionPageUrl: true, headerScript: true,
      exposureTitle: true, exposureImage: true,
      formConfig: true, description: true,
      // L6 설정 필드 추가
      l6Enabled: true,
      l6PriceAnchors: true,
      l6StockCurrent: true,
      l6StockTotal: true,
      l6WeeklyBurnRate: true,
      l6CountdownEnd: true,
    },
  });
});

// 공개 랜딩페이지 — 인증 불필요 (shortlink 또는 slug로 접근 가능)
export default async function PublicLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;

  const page = await getLandingPageBySlugOrShortlink(slug);

  if (!page) notFound();

  // 크루즈닷봇 랜딩 — 봇 네이티브 렌더(htmlContent 경로와 분리, sanitize 우회)
  if (page.pageType === "bot") {
    const sp = await searchParams;
    const refRaw = sp.ref ?? slug; // ?ref= 없으면 진입 slug(=shortlink)로 귀속
    const refCode = Array.isArray(refRaw) ? refRaw[0] : refRaw;
    const cfg = (page.botConfig ?? {}) as {
      persona?: string;
      greeting?: string;
      chips?: string[];
      botType?: string;
      homepageUrl?: string;
    };
    const homepageUrl =
      typeof cfg.homepageUrl === "string" && /^https?:\/\//i.test(cfg.homepageUrl)
        ? cfg.homepageUrl
        : undefined;
    return (
      <BotLandingClient
        pageId={page.id}
        refCode={refCode}
        brandTitle={page.title}
        greeting={cfg.greeting}
        chips={Array.isArray(cfg.chips) ? cfg.chips : undefined}
        botType={cfg.botType === "recruit" ? "recruit" : "cruise"}
        homepageUrl={homepageUrl}
      />
    );
  }

  // [P0-7] viewCount 업데이트는 서버 컴포넌트에서 제거.
  // Vercel Serverless는 응답 반환 후 비동기 작업 완료를 보장하지 않으므로
  // fire-and-forget (.catch(() => {})) 패턴 대신 LandingClient에서
  // POST /api/landing-pages/[id]/view 호출로 이전함.
  // 해당 API는 IP 해시 dedup + 트랜잭션 처리를 포함합니다.

  // P0-6: sanitize headerScript 적용
  const safeHeaderScript = sanitizeHeaderScript(page.headerScript);

  return (
    <>
      {safeHeaderScript && (
        <Script id="landing-header-script" strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: safeHeaderScript }} />
      )}
      <LandingClient
        pageId={page.id}
        slug={slug}
        htmlContent={sanitizeHtml(page.htmlContent ?? "")}
        commentEnabled={page.commentEnabled}
        buttonTitle={page.buttonTitle ?? undefined}
        completionPageUrl={page.completionPageUrl ?? undefined}
        footer={(page.formConfig as Record<string, unknown> | null)?.footer as string | undefined}
        payment={page.paymentEnabled ? {
          type: (page.paymentType as "onetime" | "subscription") ?? "onetime",
          productName: page.productName ?? "",
          productPrice: page.productPrice ?? 0,
          cycleDay: page.cycleDay ?? 1,
          expireDate: page.expireDate?.toISOString().split("T")[0] ?? "",
        } : undefined}
        l6Config={page.l6Enabled ? {
          enabled: true,
          priceAnchors: page.l6PriceAnchors
            ? Array.isArray(page.l6PriceAnchors)
              ? page.l6PriceAnchors as Array<{day: number; price: number; label: string}>
              : JSON.parse(String(page.l6PriceAnchors)) as Array<{day: number; price: number; label: string}>
            : undefined,
          stockConfig: (() => {
            const burnRate = Math.max(1, page.l6WeeklyBurnRate ?? 5);
            return {
              currentStock: page.l6StockCurrent,
              totalStock: page.l6StockTotal,
              weeklyBurnRate: burnRate,
              weeksToZero: page.l6StockTotal > 0
                ? Math.ceil(page.l6StockCurrent / burnRate)
                : 0,
              countdownTarget: page.l6CountdownEnd?.toISOString() ?? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            };
          })(),
          hoursUntilIncrease: page.l6CountdownEnd
            ? Math.max(1, Math.floor((page.l6CountdownEnd.getTime() - Date.now()) / (60 * 60 * 1000)))
            : 48,
        } : undefined}
      />
    </>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://mabizcruisedot.com';
  // [T17] getLandingPageBySlugOrShortlink 재사용 — 같은 요청에서 캐시 히트 (DB 쿼리 1회)
  const page = await getLandingPageBySlugOrShortlink(slug);
  const title = page?.exposureTitle || page?.title || "크루즈닷 랜딩페이지";
  const description = page?.description || `${title} - 크루즈 전문 여행사 크루즈닷 상담 신청`;
  const url = `${baseUrl}/p/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type: 'website' as const,
      url,
      siteName: '크루즈닷',
      ...(page?.exposureImage ? { images: [{ url: page.exposureImage, width: 1200, height: 630, alt: title }] } : {}),
    },
    twitter: {
      card: 'summary' as const,
      title,
      description,
    },
  };
}
