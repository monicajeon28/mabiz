import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

// 폰트 최적화: Noto Sans KR을 preload
const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
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
        {/* 성능 최적화: DNS prefetch, preconnect */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Lighthouse 최적화: Preload critical resources */}
        <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" />
      </head>
      <body className={`min-h-full font-sans ${notoSansKR.className}`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
