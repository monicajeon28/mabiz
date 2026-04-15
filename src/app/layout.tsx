import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "mabiz CRM — 크루즈 영업 파트너",
  description: "크루즈 영업 파트너를 위한 올인원 CRM",
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
