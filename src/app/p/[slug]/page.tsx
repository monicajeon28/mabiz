import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createHash } from "crypto";
import { cache } from "react";
import Script from "next/script";
import { LandingClient } from "./LandingClient";
import { sanitizeHtml } from "@/lib/html-sanitizer";

// P0-6: headerScript 허용 목록 방식 sanitize
function sanitizeHeaderScript(script: string | null): string | null {
  if (!script) return null;
  const ALLOWED_DOMAINS = [
    'www.googletagmanager.com',
    'www.google-analytics.com',
    'connect.facebook.net',
    'cdn.jsdelivr.net',
    'developers.kakao.com',
    'wcs.naver.net',
    'cdn.channel.io',
    't1.kakaocdn.net',
  ];
  // 인라인 스크립트 차단 (src= 없는 script 태그)
  const inlineScriptPattern = /<script(?![^>]*src=)[^>]*>/gi;
  if (inlineScriptPattern.test(script)) {
    console.warn('[Security] headerScript: 인라인 스크립트 차단됨');
    return null;
  }
  // src URL 도메인 검증
  const srcPattern = /src=["']([^"']+)["']/gi;
  let match;
  while ((match = srcPattern.exec(script)) !== null) {
    try {
      const url = new URL(match[1]);
      if (!ALLOWED_DOMAINS.some(d => url.hostname === d || url.hostname.endsWith('.' + d))) {
        console.warn('[Security] headerScript: 허용되지 않은 도메인 차단', url.hostname);
        return null;
      }
    } catch {
      return null; // 잘못된 URL
    }
  }
  return script;
}

// [T17] React cache()로 같은 요청 내 중복 DB 쿼리 제거
const getLandingPageBySlug = cache(async (slug: string) => {
  return prisma.crmLandingPage.findFirst({
    where:  { slug, isActive: true, isPublic: true },
    select: {
      id: true, title: true, htmlContent: true, commentEnabled: true,
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

// 공개 랜딩페이지 — 인증 불필요
export default async function PublicLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const page = await getLandingPageBySlug(slug);

  if (!page) notFound();

  // IP 해시 dedup — 24시간 내 동일 IP 재방문은 viewCount 증가 스킵
  const hdrs = await headers();
  const rawIP =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    "unknown";
  const salt = process.env.LANDING_VIEW_SALT ?? "default-salt";
  const ipHash = createHash("sha256").update(rawIP + salt).digest("hex");

  // Cron으로 이전됨: /api/cron/cleanup-landing-views

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
  // [T17] getLandingPageBySlug 재사용 — 같은 요청에서 캐시 히트 (DB 쿼리 1회)
  const page = await getLandingPageBySlug(slug);
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
