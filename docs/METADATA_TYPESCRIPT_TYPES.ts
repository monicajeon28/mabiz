/**
 * Next.js 메타데이터 TypeScript 타입 정의
 *
 * Next.js Metadata 타입의 구조를 자세히 이해하기 위한 레퍼런스
 * 이 파일은 문서용이며, 실제 프로젝트에서는 Next.js가 제공하는 타입을 사용합니다.
 *
 * 참고: import type { Metadata } from 'next';
 */

// ============================================================================
// 1. 기본 메타데이터 타입
// ============================================================================

type Metadata = {
  /**
   * 페이지 제목
   * - String: "마비즈 CRM"
   * - Template: { template: "%s | CRM", default: "CRM" }
   */
  title?:
    | string
    | {
        template: string; // "%s | 대시보드"
        default: string; // "대시보드"
        absolute?: string; // 상속 무시하고 절대값
      };

  /**
   * 페이지 설명 (Google 검색 결과에 표시)
   */
  description?: string;

  /**
   * 검색 키워드 (선택, Google은 무시하지만 다른 검색엔진에서 사용)
   */
  keywords?: string | string[];

  /**
   * 기본 URL (상대 경로를 절대 경로로 변환)
   */
  metadataBase?: URL | null;

  /**
   * 대체 URL (국가/언어별)
   */
  alternates?: {
    canonical?: string | { url: string; hrefLang?: string };
    languages?: Record<string, string>;
    media?: Record<string, string>;
    types?: Record<string, string | string[]>;
  };

  /**
   * Open Graph (Facebook, Discord, Slack 등에서 공유 시 표시)
   */
  openGraph?: {
    title?: string;
    description?: string;
    url?: string;
    siteName?: string;
    type?:
      | 'website'
      | 'article'
      | 'profile'
      | 'book'
      | 'profile'
      | 'music.song'
      | 'music.album';
    images?: OpenGraphImage[];
    videos?: OpenGraphVideo[];
    locale?: string;
    alternateLocale?: string[];
    publishedTime?: string; // ISO 8601
    modifiedTime?: string; // ISO 8601
    expirationTime?: string; // ISO 8601
    authors?: string[];
  };

  /**
   * Twitter 카드 (Twitter에서 공유 시 표시)
   */
  twitter?: {
    card?: 'summary' | 'summary_large_image' | 'app' | 'player';
    title?: string;
    description?: string;
    images?: string | string[];
    creator?: string;
    site?: string;
  };

  /**
   * 로봇 크롤링 설정 (robots.txt의 메타데이터 버전)
   */
  robots?: {
    index?: boolean; // Google 검색결과에 표시할지
    follow?: boolean; // 페이지의 링크를 따라갈지
    nocache?: boolean;
    googleBot?: {
      index?: boolean;
      follow?: boolean;
      'max-image-preview'?: 'large' | 'standard' | 'none';
      'max-snippet'?: number | -1;
      'max-video-preview'?: number | -1;
    };
  };

  /**
   * 아이콘 설정
   */
  icons?: {
    icon?: string | IconDescriptor[];
    shortcut?: string;
    apple?: string | AppleWebAppDescriptor[];
    other?: IconDescriptor[];
  };

  /**
   * 매니페스트 (PWA용)
   */
  manifest?: string;

  /**
   * Viewport 설정 (반응형 설정)
   */
  viewport?: ViewportDescriptor;

  /**
   * 앱 링크 (모바일 앱이 있을 경우)
   */
  appLinks?: AppLinkDescriptor[];

  /**
   * 검증 메타데이터 (Google Search Console 등)
   */
  verification?: {
    google?: string;
    yandex?: string;
    yahoo?: string;
  };

  /**
   * 분류 (콘텐츠 카테고리)
   */
  category?: string;

  /**
   * 문자 인코딩 (거의 항상 UTF-8)
   */
  charset?: 'utf-8';

  /**
   * 색상 (브라우저 주소창 배경색)
   */
  themeColor?: string | { media?: string; color: string }[];
};

// ============================================================================
// 2. OpenGraph 이미지/비디오 타입
// ============================================================================

type OpenGraphImage = {
  url: string; // 반드시 절대 URL
  width?: number;
  height?: number;
  alt?: string;
  type?: string; // 'image/jpeg', 'image/png', 'image/gif', 'image/webp'
};

type OpenGraphVideo = {
  url: string; // 반드시 절대 URL
  width?: number;
  height?: number;
  type?: string; // 'video/mp4', 'video/mpeg'
  secureUrl?: string;
};

// ============================================================================
// 3. 아이콘 디스크립터
// ============================================================================

type IconDescriptor = {
  url: string;
  href?: string;
  rel?: string;
  sizes?: string;
  type?: string;
};

type AppleWebAppDescriptor = {
  url: string;
  sizes?: string;
};

// ============================================================================
// 4. Viewport 설정
// ============================================================================

type ViewportDescriptor = {
  width?: string | number; // "device-width", 320 등
  height?: string | number;
  initialScale?: number; // 1.0
  minimumScale?: number;
  maximumScale?: number;
  userScalable?: boolean;
  viewportFit?: 'auto' | 'cover' | 'contain'; // iPhone 노치 대응
  interactiveWidget?: 'resizes-visual' | 'resizes-content' | 'overlays-content';
};

// ============================================================================
// 5. App Link (모바일 앱)
// ============================================================================

type AppLinkDescriptor = {
  app_name: string;
  app_id?: string;
  app_url?: string;
  should_fallback?: boolean;
  platform: 'iphone' | 'ipad' | 'android' | 'windows_phone';
  url?: string;
};

// ============================================================================
// 6. generateMetadata 함수 타입
// ============================================================================

/**
 * 동적 메타데이터 생성 함수
 *
 * 사용 예:
 * export async function generateMetadata(
 *   props: Props,
 *   parent: ResolvingMetadata
 * ): Promise<Metadata> {
 *   return { title: "..." };
 * }
 */
type GenerateMetadataFunction<
  Params = Record<string, string | string[]>,
  SearchParams = Record<string, string | string[] | undefined>,
> = (
  props: {
    params: Params;
    searchParams: SearchParams;
  },
  parent: Promise<Metadata>,
) => Promise<Metadata>;

// ============================================================================
// 7. 실제 사용 예시: Contact Page 메타데이터
// ============================================================================

/**
 * 고객 상세 페이지 메타데이터
 *
 * URL: /contacts/[id]
 * 예: /contacts/user-123 → 제목: "김철수 | 고객관리 | ..."
 */
const ContactPageMetadata: Metadata = {
  // 기본 정보
  title: '김철수', // 부모 layout의 template: '%s | 고객관리'와 조합
  description: '010-1234-5678 • test@example.com • 구매고객',
  keywords: ['김철수', '고객', '크루즈'],

  // 검색 엔진
  robots: {
    index: true, // 이 페이지를 Google 검색결과에 표시
    follow: true, // 페이지 내 링크 크롤링 허용
  },

  // 중복 제거
  alternates: {
    canonical: 'https://mabizcruisedot.com/contacts/user-123',
  },

  // SNS 공유 (Facebook, Discord, Slack 등)
  openGraph: {
    title: '김철수',
    description: '마비즈 CRM 고객 정보',
    type: 'profile',
    url: 'https://mabizcruisedot.com/contacts/user-123',
    images: [
      {
        url: 'https://mabizcruisedot.com/avatars/user-123.jpg',
        width: 400,
        height: 400,
        alt: '김철수 프로필 사진',
        type: 'image/jpeg',
      },
    ],
  },

  // Twitter 공유
  twitter: {
    card: 'summary', // 작은 카드
    title: '김철수 | 마비즈 CRM',
    description: '010-1234-5678',
    images: ['https://mabizcruisedot.com/avatars/user-123.jpg'],
  },
};

// ============================================================================
// 8. 실제 사용 예시: 검색 페이지 메타데이터
// ============================================================================

/**
 * 검색 결과 페이지 메타데이터
 *
 * URL: /contacts?q=김철수
 * 특징: 검색 결과는 Google 색인하지 않음 (중복 방지)
 */
const SearchPageMetadata: Metadata = {
  title: '검색: 김철수',
  description: '마비즈 CRM에서 "김철수"에 대한 고객 검색 결과',

  // 🔴 중요: 검색 결과는 Google 색인 금지
  // (같은 데이터가 URL 변수에 따라 무한히 생성되므로)
  robots: {
    index: false, // 색인하지 않음
    follow: false, // 링크도 따라가지 않음
  },
};

// ============================================================================
// 9. 실제 사용 예시: JSON-LD 구조화 데이터
// ============================================================================

/**
 * Schema.org JSON-LD
 * Google, Naver 등의 검색 엔진이 콘텐츠를 더 잘 이해하도록 함
 */

interface PersonSchema {
  '@context': 'https://schema.org';
  '@type': 'Person';
  name: string;
  telephone?: string;
  email?: string;
  image?: string;
  jobTitle?: string;
  url?: string;
}

const ContactPersonSchema: PersonSchema = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: '김철수',
  telephone: '010-1234-5678',
  email: 'test@example.com',
  image: 'https://mabizcruisedot.com/avatars/user-123.jpg',
  jobTitle: '구매고객',
  url: 'https://mabizcruisedot.com/contacts/user-123',
};

interface SoftwareApplicationSchema {
  '@context': 'https://schema.org';
  '@type': 'SoftwareApplication';
  name: string;
  description: string;
  applicationCategory: string;
  offers: {
    '@type': 'Offer';
    price: string;
    priceCurrency: string;
  };
  aggregateRating?: {
    '@type': 'AggregateRating';
    ratingValue: string;
    ratingCount: string;
  };
}

const CRMApplicationSchema: SoftwareApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: '마비즈 크루즈닷파트너스',
  description: '크루즈 파트너 전용 CRM',
  applicationCategory: 'BusinessApplication',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'KRW',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '127',
  },
};

// ============================================================================
// 10. 고급: Revalidation 전략
// ============================================================================

/**
 * Next.js ISR (Incremental Static Regeneration)
 * 정적 생성 + 주기적 재검증
 */

// 1시간마다 재검증
export const revalidate = 3600;

// 또는: 온디맨드 재검증
export const dynamic = 'force-dynamic'; // 매 요청마다 생성
// export const dynamic = 'force-static'; // 정적 생성 (빌드 타임)

// ============================================================================
// 11. 마비즈 CRM 메타데이터 적용 체크리스트
// ============================================================================

/**
 * ✅ 구현 완료
 * - src/app/layout.tsx (Root metadata)
 * - src/app/sitemap.ts (Dynamic sitemap)
 * - public/robots.txt (기본 robots 규칙)
 *
 * ⚠️ 즉시 구현 필요 (P0)
 * - src/app/(dashboard)/layout.tsx: generateMetadata() + robots:noindex
 * - src/app/(dashboard)/contacts/layout.tsx: title template
 *
 * ⚠️ 우선순위 높음 (P1)
 * - src/app/(dashboard)/contacts/[id]/page.tsx: generateMetadata()
 * - src/app/contract/[id]/page.tsx: generateMetadata()
 * - src/app/partner/[agentId]/page.tsx: generateMetadata()
 *
 * ⚠️ 우선순위 중간 (P2)
 * - JSON-LD 구조화 데이터
 * - Dynamic OG 이미지 생성 (api/og/route.ts)
 */

// ============================================================================
// 12. 유용한 헬퍼 타입 정의
// ============================================================================

/**
 * 동적 메타데이터 Props 타입
 * 모든 동적 페이지에서 사용할 수 있음
 */
type DynamicPageProps<T = Record<string, any>> = {
  params: T;
  searchParams: Record<string, string | string[] | undefined>;
};

/**
 * 특정 리소스 메타데이터 제너레이터
 */
type MetadataGenerator<T, P extends DynamicPageProps> = (
  props: P,
) => Promise<Metadata>;

/**
 * 예시: Contact 메타데이터 제너레이터
 */
type ContactMetadataGenerator = MetadataGenerator<
  { id: string },
  { params: { id: string } }
>;

// ============================================================================
// 13. 실전 패턴: 에러 처리
// ============================================================================

/**
 * 안전한 메타데이터 생성 함수
 *
 * try-catch로 에러를 처리하고 폴백값을 반환
 */
async function safeGenerateMetadata(
  fetcher: () => Promise<Metadata | null>,
  fallback: Metadata,
): Promise<Metadata> {
  try {
    const metadata = await fetcher();
    return metadata || fallback;
  } catch (error) {
    console.error('Metadata generation error:', error);
    return fallback;
  }
}

// 사용 예:
// export async function generateMetadata({
//   params,
// }: Props): Promise<Metadata> {
//   return safeGenerateMetadata(
//     async () => {
//       const contact = await getContact(params.id);
//       if (!contact) return null;
//       return { title: contact.name };
//     },
//     { title: '고객을 찾을 수 없습니다' }
//   );
// }

// ============================================================================
// 14. 성능 최적화 팁
// ============================================================================

/**
 * ❌ 느린 메타데이터 쿼리
 */
const slowMetadata = `
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // 모든 필드 조회 → 불필요한 데이터 로드
  const contact = await prisma.contact.findUnique({
    where: { id: params.id },
  });

  return { title: contact.name };
}
`;

/**
 * ✅ 빠른 메타데이터 쿼리
 */
const fastMetadata = `
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // 필요한 필드만 선택 → 빠른 쿼리
  const contact = await prisma.contact.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, phone: true, photo: true },
  });

  return { title: contact.name };
}
`;

// ============================================================================
// Export types for use in other files
// ============================================================================

export type {
  Metadata,
  OpenGraphImage,
  OpenGraphVideo,
  IconDescriptor,
  AppleWebAppDescriptor,
  ViewportDescriptor,
  AppLinkDescriptor,
  GenerateMetadataFunction,
  DynamicPageProps,
  MetadataGenerator,
  ContactMetadataGenerator,
  PersonSchema,
  SoftwareApplicationSchema,
};

export { safeGenerateMetadata };
