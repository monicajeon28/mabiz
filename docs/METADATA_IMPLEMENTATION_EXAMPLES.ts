/**
 * Next.js 메타데이터 구현 예시 (마비즈 CRM)
 * 복사해서 바로 사용 가능한 10가지 코드 패턴
 * @updated 2026-06-09
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

// ============================================================================
// 1️⃣ 루트 레이아웃 메타데이터
// ============================================================================

export const example1RootMetadata: Metadata = {
  title: '마비즈 크루즈닷파트너스 — 파트너 CRM',
  description: '크루즈닷 파트너 전용 CRM. 고객관리, 수당확인, 영업도구를 한 곳에서.',
  keywords: ['크루즈', 'CRM', '파트너', '고객관리'],
  metadataBase: new URL('https://mabizcruisedot.com'),
  alternates: {
    canonical: 'https://mabizcruisedot.com',
  },
  openGraph: {
    title: '마비즈 크루즈닷파트너스',
    description: '파트너 CRM',
    url: 'https://mabizcruisedot.com',
    type: 'website',
    images: [{
      url: 'https://mabizcruisedot.com/og-image.png',
      width: 1200,
      height: 630,
      alt: '마비즈 로고',
    }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },
};

// ============================================================================
// 2️⃣ 대시보드 레이아웃 메타데이터
// ============================================================================

export const example2DashboardMetadata: Metadata = {
  title: '대시보드 — 마비즈 CRM',
  description: '파트너 대시보드',
  robots: {
    index: false,
    follow: false,
    noindex: true,
  },
};

// ============================================================================
// 3️⃣ 공개 랜딩 페이지 (동적)
// ============================================================================

interface LandingPageProps {
  params: Promise<{ slug: string }>;
}

export async function example3LandingMetadata({
  params,
}: LandingPageProps): Promise<Metadata> {
  const { slug } = await params;

  // DB에서 페이지 정보 조회 (실제 구현에서는 prisma 사용)
  const page = {
    title: `크루즈 랜딩: ${slug}`,
    description: '크루즈 여행 정보',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return {
    title: page.title,
    description: page.description,
    keywords: [slug, '크루즈', '여행'],
    openGraph: {
      title: page.title,
      description: page.description,
      url: `https://mabizcruisedot.com/p/${slug}`,
      type: 'article',
      publishedTime: page.createdAt.toISOString(),
      modifiedTime: page.updatedAt.toISOString(),
      images: [{
        url: `https://mabizcruisedot.com/og/${slug}.png`,
        width: 1200,
        height: 630,
        alt: page.title,
      }],
    },
    alternates: {
      canonical: `https://mabizcruisedot.com/p/${slug}`,
    },
  };
}

// ============================================================================
// 4️⃣ 숏링크 페이지 (동적)
// ============================================================================

interface ShortLinkProps {
  params: Promise<{ code: string }>;
}

export async function example4ShortLinkMetadata({
  params,
}: ShortLinkProps): Promise<Metadata> {
  const { code } = await params;

  return {
    title: `크루즈닷 링크`,
    description: '크루즈닷에서 공유한 링크',
    openGraph: {
      title: '크루즈닷 링크',
      description: '크루즈 여행 정보',
      url: `https://mabizcruisedot.com/l/${code}`,
      type: 'website',
      images: [{
        url: 'https://mabizcruisedot.com/og-image.png',
        width: 1200,
        height: 630,
      }],
    },
  };
}

// ============================================================================
// 5️⃣ 고객 검색 페이지 (searchParams)
// ============================================================================

interface ContactSearchProps {
  searchParams: Promise<{ q?: string; type?: string }>;
}

export async function example5SearchMetadata({
  searchParams,
}: ContactSearchProps): Promise<Metadata> {
  const { q, type } = await searchParams;

  let title = '고객 관리';
  if (q) title = `검색: "${q}"`;
  if (type === 'inquiry') title = '교육 문의 고객';

  return {
    title: `${title} | 마비즈 CRM`,
    description: q ? `"${q}" 검색 결과` : '고객 정보 조회',
    robots: {
      index: false,
      noindex: true,
    },
  };
}

// ============================================================================
// 6️⃣ 고객 상세 페이지 (인증 필요)
// ============================================================================

interface ContactDetailProps {
  params: Promise<{ id: string }>;
}

export async function example6ContactDetailMetadata({
  params,
}: ContactDetailProps): Promise<Metadata> {
  const { id } = await params;

  return {
    title: `고객 정보 | 마비즈 CRM`,
    description: '고객 프로필 및 거래 이력',
    robots: {
      index: false,
      follow: false,
    },
  };
}

// ============================================================================
// 7️⃣ 계약서 상세 페이지 (공개 가능)
// ============================================================================

interface ContractDetailProps {
  params: Promise<{ id: string }>;
}

export async function example7ContractMetadata({
  params,
}: ContractDetailProps): Promise<Metadata> {
  const { id } = await params;

  return {
    title: `계약서 상세`,
    description: '전자서명 계약서',
    robots: {
      index: true,
      follow: true,
    },
  };
}

// ============================================================================
// 8️⃣ 제휴 파트너 프로필 (동적)
// ============================================================================

interface PartnerProfileProps {
  params: Promise<{ id: string }>;
}

export async function example8PartnerMetadata({
  params,
}: PartnerProfileProps): Promise<Metadata> {
  const { id } = await params;

  return {
    title: `파트너 프로필`,
    description: '제휴 파트너 정보',
    openGraph: {
      title: '파트너 프로필',
      description: '제휴 파트너 정보',
      url: `https://mabizcruisedot.com/partner/${id}`,
      type: 'profile',
    },
  };
}

// ============================================================================
// 9️⃣ JSON-LD Organization (클라이언트 컴포넌트)
// ============================================================================

export function example9JSONLDOrganization() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: '마비즈 크루즈닷파트너스',
    url: 'https://mabizcruisedot.com',
    logo: 'https://mabizcruisedot.com/logo.png',
    description: '크루즈닷 파트너 전용 CRM',
    sameAs: [
      'https://www.facebook.com/cruisedot',
      'https://www.instagram.com/cruisedot',
    ],
  };
}

// ============================================================================
// 🔟 JSON-LD Article (클라이언트 컴포넌트)
// ============================================================================

export function example10JSONLDArticle(title: string, description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: description,
    image: 'https://mabizcruisedot.com/og-image.png',
    datePublished: new Date().toISOString(),
    author: {
      '@type': 'Organization',
      name: '마비즈',
    },
  };
}
