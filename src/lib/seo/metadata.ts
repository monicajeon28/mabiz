/**
 * SEO 메타데이터 생성 유틸
 *
 * 용도: 페이지별 메타 태그 생성 (title, description, keywords, OG)
 * 관리자가 쉽게 메타 설정을 변경할 수 있도록 중앙화
 */

import type { Metadata } from 'next';

export interface SEOConfig {
  title: string;
  description: string;
  keywords?: string[];
  image?: {
    url: string;
    width?: number;
    height?: number;
    alt?: string;
  };
  url?: string;
  locale?: string;
  type?: 'website' | 'article' | 'profile';
}

/**
 * 페이지별 메타데이터 생성기
 * @param config SEO 설정
 * @param baseUrl 기본 도메인 (기본값: https://mabizcruisedot.com)
 * @returns Next.js Metadata 객체
 */
export function generateMetadata(
  config: SEOConfig,
  baseUrl: string = 'https://mabizcruisedot.com'
): Metadata {
  const url = config.url ? `${baseUrl}${config.url}` : baseUrl;
  const imageUrl = config.image?.url || `${baseUrl}/og-image.png`;

  return {
    title: config.title,
    description: config.description,
    keywords: config.keywords?.join(', ') || '',
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: config.title,
      description: config.description,
      url,
      siteName: '마비즈 크루즈닷파트너스',
      images: [
        {
          url: imageUrl,
          width: config.image?.width || 1200,
          height: config.image?.height || 630,
          alt: config.image?.alt || config.title,
          type: 'image/png',
        },
      ],
      locale: config.locale || 'ko_KR',
      type: config.type || 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: config.title,
      description: config.description,
      images: [imageUrl],
    },
  };
}

/**
 * 공통 메타데이터 설정
 */
export const commonSEOConfig = {
  siteTitle: '마비즈 크루즈닷파트너스',
  siteDomain: 'mabizcruisedot.com',
  baseUrl: 'https://mabizcruisedot.com',
};

/**
 * 페이지별 SEO 설정 (관리자 수정 지점)
 */
export const pageMetaConfig: Record<string, SEOConfig> = {
  landing: {
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
    ],
    url: '/landing',
    image: {
      url: '/og-image.png',
      width: 1200,
      height: 630,
      alt: '마비즈 크루즈닷파트너스 — 파트너 CRM 솔루션',
    },
  },
  join: {
    title: '파트너 가입 — 마비즈 크루즈닷파트너스',
    description:
      '마비즈 크루즈닷파트너스에 가입하세요. 무료 회원가입, 5분 내 시작 가능.',
    keywords: [
      '파트너 가입',
      '무료 가입',
      '크루즈 판매 파트너',
      '수당 설정',
    ],
    url: '/join',
  },
  register: {
    title: '회원가입 — 마비즈 크루즈닷파트너스',
    description: '마비즈 크루즈닷파트너스 회원가입. 이메일, 전화번호로 즉시 가입.',
    keywords: ['회원가입', '무료 가입', '계정 생성'],
    url: '/register',
  },
};
