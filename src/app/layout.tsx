import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

// 폰트 최적화: Noto Sans KR을 preload
// 주요 개선:
// 1. subsets: ["korean"] - 불필요한 latin 서브셋 제거 (용량 감소)
// 2. weight: ["400", "700"] - 필수 두 가지만 사용 (4가지 → 2가지)
// 3. variable: CSS 변수로 동적 사용
const notoSansKR = Noto_Sans_KR({
  weight: ["400", "700"],
  variable: "--font-noto-sans-kr",
  display: "swap",
  fallback: ["system-ui", "-apple-system"],
});

export const metadata: Metadata = {
  title: "크루즈닷파트너스 — 파트너 CRM",
  description: "크루즈닷 파트너 전용 CRM. 고객관리, 수당확인, 영업도구를 한 곳에서.",
  metadataBase: new URL("https://mabizcruisedot.com"),
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "크루즈닷파트너스 — 파트너 CRM",
    description: "크루즈닷 파트너 전용 CRM. 고객관리, 수당확인, 영업도구를 한 곳에서.",
    url: "https://mabizcruisedot.com",
    siteName: "크루즈닷파트너스",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "크루즈닷파트너스 파트너 CRM",
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`h-full ${notoSansKR.variable}`} suppressHydrationWarning>
      <head>
        {/* 성능 최적화: DNS prefetch, preconnect (우선순위 높음) */}
        {/* Google Fonts preconnect - 폰트 로딩 병렬화 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* CDN prefetch (비필수 리소스는 낮은 우선순위) */}
        <link rel="dns-prefetch" href="//cdn.jsdelivr.net" />
      </head>
      <body className={`min-h-full font-sans ${notoSansKR.className}`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
