/**
 * Landing 페이지 레이아웃
 *
 * 책임사항:
 * 1. Landing 페이지 특화 메타 태그
 * 2. JSON-LD Organization 스키마 주입
 * 3. SEO 최적화 (title, description, keywords)
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { generateOrganizationSchema, generateWebPageSchema } from '@/lib/seo/schema';

export const metadata: Metadata = {
  title: '마비즈 크루즈닷파트너스 — 파트너 CRM',
  description:
    '크루즈닷 파트너 전용 CRM. 고객관리, 수당확인, 영업도구를 한 곳에서. 즉시 가능, 무료 사용.',
  keywords: [
    '크루즈 판매',
    '파트너 CRM',
    '고객관리',
    '수당 확인',
    '영업도구',
    '크루즈 여행',
    '파트너 플랫폼',
    '판매 자동화',
    '마비즈',
  ],
  alternates: {
    canonical: 'https://mabizcruisedot.com/landing',
  },
  openGraph: {
    title: '마비즈 크루즈닷파트너스 — 파트너 CRM',
    description:
      '크루즈닷 파트너 전용 CRM. 고객관리, 수당확인, 영업도구를 한 곳에서.',
    url: 'https://mabizcruisedot.com/landing',
    siteName: '마비즈 크루즈닷파트너스',
    images: [
      {
        url: 'https://mabizcruisedot.com/og-image.png',
        width: 1200,
        height: 630,
        alt: '마비즈 크루즈닷파트너스 파트너 CRM 솔루션',
        type: 'image/png',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '마비즈 크루즈닷파트너스',
    description: '파트너 전용 CRM. 고객관리, 수당확인, 영업도구를 한 곳에서.',
    images: ['https://mabizcruisedot.com/og-image.png'],
  },
};

interface LandingLayoutProps {
  readonly children: ReactNode;
}

export default function LandingLayout({ children }: LandingLayoutProps) {
  const organizationSchema = generateOrganizationSchema();
  const webPageSchema = generateWebPageSchema(
    '마비즈 크루즈닷파트너스 — 파트너 CRM',
    '크루즈닷 파트너 전용 CRM. 고객관리, 수당확인, 영업도구를 한 곳에서.',
    'https://mabizcruisedot.com/landing'
  );

  return (
    <>
      {/* JSON-LD 스키마 (Google 검색 결과 최적화) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      {/* 페이지 콘텐츠 */}
      {children}
    </>
  );
}
