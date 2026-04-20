import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "크루즈닷파트너스 — 파트너 CRM",
  description: "크루즈닷 파트너 전용 CRM. 고객관리, 수당확인, 영업도구를 한 곳에서.",
  metadataBase: new URL("https://www.mabizcruisedot.com"),
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "크루즈닷파트너스 — 파트너 CRM",
    description: "크루즈닷 파트너 전용 CRM. 고객관리, 수당확인, 영업도구를 한 곳에서.",
    url: "https://www.mabizcruisedot.com",
    siteName: "크루즈닷파트너스",
    images: [
      {
        url: "/og-image.jpg",
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
    <ClerkProvider>
      <html lang="ko" className="h-full">
        <body className="min-h-full">{children}</body>
      </html>
    </ClerkProvider>
  );
}
