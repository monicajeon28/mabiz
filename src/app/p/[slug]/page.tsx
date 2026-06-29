import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { cache } from "react";
import Script from "next/script";
import { LandingClient } from "./LandingClient";
import BotLandingClient from "./BotLandingClient";
import { LandingDocumentFrame } from "./LandingDocumentFrame";
import { sanitizeHtml } from "@/lib/html-sanitizer";
import { isFullHtmlDocument } from "@/lib/html-doc-detect";
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
      deletedAt: null, // 삭제된 페이지는 고객에게 노출 안 함
    },
    select: {
      id: true, title: true, htmlContent: true, commentEnabled: true,
      pageType: true, botConfig: true, editorMode: true,
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
      kakaoChannelUrl?: string;
      hookText?: string;
      liveUrl?: string;
      liveLabel?: string;
      liveEndsAt?: string;
    };
    const homepageUrl =
      typeof cfg.homepageUrl === "string" && /^https?:\/\//i.test(cfg.homepageUrl)
        ? cfg.homepageUrl
        : undefined;
    // 카톡 채널 링크 — 봇별 커스텀 우선, 없으면 회사 공용 채널로 폴백(LandingClient 패턴 동일).
    const kakaoChannelUrl =
      typeof cfg.kakaoChannelUrl === "string" && /^https?:\/\//i.test(cfg.kakaoChannelUrl)
        ? cfg.kakaoChannelUrl
        : `https://pf.kakao.com/${process.env.NEXT_PUBLIC_KAKAO_CHANNEL_ID || "_cruisedot"}`;
    const hookText =
      typeof cfg.hookText === "string" && cfg.hookText.trim() ? cfg.hookText.trim() : undefined;
    const botType = cfg.botType === "recruit" ? "recruit" : "cruise";

    // 후킹용 대표 상품(실데이터) — 크루즈닷 공유 CruiseProduct에서 실제 가격·출발일을 끌어온다.
    //   지어내지 않고 실데이터만 인용(컴플라이언스). 대표>인기>긴급, 가까운 출발 우선. 없으면 미표시.
    let featured:
      | {
          title: string;
          priceFrom: number;
          departOn: string | null;
          nights: number;
          days: number;
          availableSeats: number | null;
        }
      | undefined;
    if (botType === "cruise") {
      try {
        const now = new Date();
        const fp = await prisma.cruiseProduct.findFirst({
          where: {
            isVisible: true,
            isActive: true,
            deletedAt: null,
            basePrice: { not: null },
            saleStatus: "판매중",
            OR: [{ startDate: { gte: now } }, { startDate: null }],
          },
          orderBy: [
            { isMainProduct: "desc" },
            { isPopular: "desc" },
            { isUrgent: "desc" },
            { startDate: "asc" },
          ],
          select: {
            packageName: true,
            basePrice: true,
            startDate: true,
            nights: true,
            days: true,
            availableCount: true,
          },
        });
        if (fp?.basePrice) {
          featured = {
            title: fp.packageName,
            priceFrom: fp.basePrice,
            departOn: fp.startDate ? fp.startDate.toISOString() : null,
            nights: fp.nights,
            days: fp.days,
            availableSeats: fp.availableCount ?? null,
          };
        }
      } catch {
        featured = undefined; // 상품 조회 실패해도 가이드는 그대로 동작(부가 후킹일 뿐)
      }
    }

    // 라이브방송 후킹 카드 — 접수(리드 확정) '직후'에만 노출(링크만 들고 이탈 방지).
    //   링크·문구는 botConfig로 봇별 덮어쓰기, 없으면 회사 공용 기본값. '30%' 등 할인 표현은 운영자 단일 책임(문구 한 곳).
    //   liveEndsAt(선택)이 설정돼 있고 지났으면 자동 미노출(광고법 안전), 없으면 상시 노출.
    let live: { url: string; label: string } | undefined;
    if (botType === "cruise") {
      const liveUrl =
        typeof cfg.liveUrl === "string" && /^https?:\/\//i.test(cfg.liveUrl)
          ? cfg.liveUrl
          : "https://open.kakao.com/o/plREDDUh";
      const liveLabel =
        typeof cfg.liveLabel === "string" && cfg.liveLabel.trim()
          ? cfg.liveLabel.trim()
          : "이번 주 라이브방송 30% 특가";
      let liveActive = true;
      if (typeof cfg.liveEndsAt === "string" && cfg.liveEndsAt) {
        const end = new Date(cfg.liveEndsAt);
        if (!Number.isNaN(end.getTime()) && Date.now() > end.getTime()) liveActive = false;
      }
      if (liveActive) live = { url: liveUrl, label: liveLabel };
    }

    return (
      <BotLandingClient
        pageId={page.id}
        refCode={refCode}
        brandTitle={page.title}
        greeting={cfg.greeting}
        chips={Array.isArray(cfg.chips) ? cfg.chips : undefined}
        botType={botType}
        homepageUrl={homepageUrl}
        kakaoChannelUrl={kakaoChannelUrl}
        hookText={hookText}
        featured={featured}
        live={live}
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

  // #15 — HTML형으로 "전체 HTML 문서"(<!doctype html>/<html>)를 붙여넣은 경우:
  //   sanitize(태그 화이트리스트)로는 style/script/head가 제거돼 디자인이 죽고 <title>이 본문에 새어나옴.
  //   → 원본 그대로 iframe(샌드박스)로 격리 렌더해 "하얀 백지에 코드 그대로" 보장.
  //   감지는 내용 기준(빌더 조각/이미지형은 <div>로 시작 → 항상 sanitize 경로 유지 = 회귀 0).
  // 내용이 "전체 HTML 문서"로 시작하면 iframe 격리 렌더(#15). 앵커(^\s*<!doctype/<html)라 빌더 조각·이미지형
  //   (항상 <div로 시작)은 절대 오탐 안 됨 → editorMode 게이트 불필요(초안이 'image'로 남아 막히던 문제 해결, #15b).
  const rawHtml = page.htmlContent ?? "";
  if (isFullHtmlDocument(rawHtml)) {
    return (
      <>
        {safeHeaderScript && (
          <Script id="landing-header-script" strategy="afterInteractive"
            dangerouslySetInnerHTML={{ __html: safeHeaderScript }} />
        )}
        <LandingDocumentFrame pageId={page.id} htmlContent={rawHtml} />
      </>
    );
  }

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
        payment={page.paymentEnabled && (page.productPrice ?? 0) >= 100 && (page.productName ?? "").trim() ? {
          type: (page.paymentType as "onetime" | "subscription") ?? "onetime",
          productName: page.productName as string,
          productPrice: page.productPrice as number,
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
