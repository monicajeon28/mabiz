/**
 * JSON-LD 구조화 데이터 생성
 *
 * 목적: Google/Naver 검색 결과에 리치 스니펫 표시
 * - Organization: 회사 정보
 * - WebPage: 페이지별 메타
 * - Article: 블로그 포스트 (미래)
 *
 * 참고: https://schema.org
 */

export interface OrganizationSchema {
  '@context': 'https://schema.org';
  '@type': 'Organization';
  name: string;
  url: string;
  logo?: string;
  description?: string;
  sameAs?: string[];
  contactPoint?: {
    '@type': 'ContactPoint';
    contactType: string;
    email?: string;
    telephone?: string;
  };
}

export interface WebPageSchema {
  '@context': 'https://schema.org';
  '@type': 'WebPage';
  name: string;
  description: string;
  url: string;
  isPartOf?: {
    '@type': 'WebSite';
    name: string;
    url: string;
  };
  datePublished?: string;
  dateModified?: string;
  mainEntity?: {
    '@type': string;
    [key: string]: unknown;
  };
}

/**
 * Organization 스키마 생성 (홈페이지)
 */
export function generateOrganizationSchema(
  baseUrl: string = 'https://mabizcruisedot.com'
): OrganizationSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: '마비즈',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    description:
      '크루즈닷 파트너 전용 CRM. 고객관리, 수당확인, 영업도구를 한 곳에서.',
    sameAs: [
      'https://www.instagram.com/mabizcruisedot',
      'https://www.facebook.com/mabizcruisedot',
      'https://www.linkedin.com/company/mabiz-cruisedot',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Support',
      email: 'support@mabizcruisedot.com',
      telephone: '+82-2-XXXX-XXXX',
    },
  };
}

/**
 * WebPage 스키마 생성 (페이지별)
 */
export function generateWebPageSchema(
  name: string,
  description: string,
  url: string,
  baseUrl: string = 'https://mabizcruisedot.com'
): WebPageSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name,
    description,
    url,
    isPartOf: {
      '@type': 'WebSite',
      name: '마비즈 크루즈닷파트너스',
      url: baseUrl,
    },
    datePublished: new Date().toISOString(),
    dateModified: new Date().toISOString(),
  };
}

/**
 * JSON-LD을 HTML 스크립트 태그로 렌더링
 */
export function renderJsonLd(schema: unknown): string {
  return JSON.stringify(schema);
}

/**
 * React 컴포넌트에서 사용할 JSON-LD 스크립트 생성
 */
export function createJsonLdScript(schema: unknown) {
  return {
    __html: `<script type="application/ld+json">${renderJsonLd(schema)}</script>`,
  };
}
