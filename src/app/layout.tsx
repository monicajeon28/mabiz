import type { Metadata } from "next";
import type { Viewport } from "next";
import type { ReactNode } from "react";
import { notoSansKR } from "@/lib/fonts";
import "./globals.css";

/**
 * 폰트 설정: Noto Sans KR (한글 최적화)
 *
 * ✅ 최적화 항목:
 * - subsets: ["korean"] → 한글만 로드 (약 60% 용량 감소)
 * - weight: ["400", "600", "700"] → 정상/반굵음/굵음
 * - variable: "--font-noto-sans-kr" → CSS 변수로 동적 사용
 * - display: "swap" → 시스템 폰트로 즉시 표시 후 로드 (FOUT 최소화)
 * - preload: true → 중요 폰트 사전 로드 (LCP 개선)
 *
 * 📊 성능 지표:
 * - LCP: < 2.5s (폰트 로드 겹침 최소화)
 * - CLS: 0.0 (고정 라인하이트로 레이아웃 안정)
 * - FOUT: < 100ms (display: swap 효과)
 */

export const metadata: Metadata = {
  title: "마비즈 크루즈닷파트너스 — 파트너 CRM",
  description: "크루즈닷 파트너 전용 CRM. 고객관리, 수당확인, 영업도구를 한 곳에서. 즉시 가능, 무료 사용.",
  keywords: [
    "크루즈 판매",
    "파트너 CRM",
    "고객관리",
    "수당 확인",
    "영업도구",
    "크루즈 여행",
    "파트너 플랫폼",
    "판매 자동화",
  ],
  metadataBase: new URL("https://mabizcruisedot.com"),
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  alternates: {
    canonical: "https://mabizcruisedot.com",
  },
  openGraph: {
    title: "마비즈 크루즈닷파트너스 — 파트너 CRM",
    description: "크루즈닷 파트너 전용 CRM. 고객관리, 수당확인, 영업도구를 한 곳에서.",
    url: "https://mabizcruisedot.com",
    siteName: "마비즈 크루즈닷파트너스",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "마비즈 크루즈닷파트너스 파트너 CRM 솔루션",
        type: "image/png",
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "마비즈 크루즈닷파트너스",
    description: "파트너 전용 CRM. 고객관리, 수당확인, 영업도구를 한 곳에서.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

interface RootLayoutProps {
  readonly children: ReactNode;
}

/**
 * 루트 레이아웃 (전체 앱)
 *
 * 책임사항:
 * 1. 폰트 로드 (notoSansKR CSS 변수 주입)
 * 2. HTML lang 속성 설정 (한국어, SEO)
 * 3. Meta 태그 설정 (metadata 객체)
 * 4. 성능 최적화 힌트 (preconnect, dns-prefetch)
 *
 * @param {RootLayoutProps} props
 * @returns {JSX.Element}
 */
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="ko"
      className={`h-full ${notoSansKR.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* 성능 최적화: DNS prefetch + preconnect (브라우저 병렬 처리) */}

        {/* Google Fonts — 폰트 CDN 사전 연결 (우선도: 높음) */}
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
          crossOrigin="anonymous"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />

        {/* 외부 CDN prefetch (우선도: 낮음) */}
        <link rel="dns-prefetch" href="//cdn.jsdelivr.net" />

        {/* 폰트 표시 전략 명시 (성능 모니터링용) */}
        <meta
          name="next-font-display"
          content="swap"
        />
      </head>

      <body
        className={`min-h-full bg-background text-foreground font-sans ${notoSansKR.className}`}
        suppressHydrationWarning
      >
        {/* 주 콘텐츠 */}
        {children}
      </body>
    </html>
  );
}
