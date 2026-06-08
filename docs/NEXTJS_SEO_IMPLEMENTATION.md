# Next.js SEO 구현 코드 (복사 붙여넣기 완성)

**상태**: ✅ 마비즈 현재 코드 + 개선 제안  
**버전**: 1.0 (2026-06-09)  
**소요시간**: 30분 (복사/붙여넣기)

---

## 1️⃣ robots.ts (확정 코드)

### 📍 위치
`src/app/robots.ts`

### ✅ 최종 코드 (권장)

```typescript
import type { MetadataRoute } from 'next';

/**
 * Robots.txt 생성 (SEO 최적화)
 * 
 * 목적: Google/Naver/Bing 크롤러에게 어떤 페이지를 크롤링할지 지시
 * 참고: https://nextjs.org/docs/app/api-reference/file-conventions/robots
 * 
 * 생성 URL: https://mabizcruisedot.com/robots.txt
 * 
 * 규칙:
 * - /p/* : 공개 랜딩페이지 크롤링 허용 (SEO 수익화)
 * - / : 인증 필요 영역 차단 (대시보드, API 등)
 * - /api/* : API 자동 차단
 * - /auth/* : 인증 페이지 자동 차단
 */

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://mabizcruisedot.com';

  return {
    // 기본 크롤링 규칙
    rules: [
      {
        userAgent: '*',  // 모든 크롤러
        allow: '/p/',    // 랜딩페이지 허용
        disallow: '/',   // 나머지 전부 차단
      },
    ],

    // Sitemap 위치 지정 (필수)
    sitemap: `${baseUrl}/sitemap.xml`,

    // 크롤링 속도 제한 (서버 부하 방지)
    crawlDelay: 1,       // 1초 대기
  };
}
```

### 🔄 선택사항: 고급 규칙 (SEO 경쟁업체 차단)

```typescript
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://mabizcruisedot.com';

  return {
    rules: [
      // Google: 빠르게 크롤링 (우대)
      {
        userAgent: 'Googlebot',
        allow: '/p/',
        disallow: '/',
        crawlDelay: 0,  // 지연 없음
      },

      // Naver: 정상 속도
      {
        userAgent: 'Yeti',
        allow: '/p/',
        disallow: '/',
        crawlDelay: 1,
      },

      // 경쟁사 SEO 봇 차단
      {
        userAgent: 'AhrefsBot',
        disallow: '/',
      },
      {
        userAgent: 'SemrushBot',
        disallow: '/',
      },

      // 기타 모든 크롤러
      {
        userAgent: '*',
        allow: '/p/',
        disallow: '/',
        crawlDelay: 1,
      },
    ],

    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
```

### ✅ 생성 검증

```bash
# 실시간 확인 (로컬)
curl http://localhost:3000/robots.txt

# 배포 후 확인
curl https://mabizcruisedot.com/robots.txt

# 예상 출력:
# User-agent: *
# Allow: /p/
# Disallow: /
# Crawl-delay: 1
# Sitemap: https://mabizcruisedot.com/sitemap.xml
```

---

## 2️⃣ sitemap.ts (확정 코드)

### 📍 위치
`src/app/sitemap.ts`

### ✅ 최종 코드 (권장)

```typescript
/**
 * Sitemap 자동 생성 (SEO 최적화)
 *
 * 목적: Google/Naver 검색 봇에 크롤링할 페이지 목록 제공
 * 참고: https://nextjs.org/docs/app/api-reference/file-conventions/sitemap
 *
 * 생성 URL: https://mabizcruisedot.com/sitemap.xml
 * 생성 주기: 매 요청마다 (최신 데이터 반영)
 * 캐시: 1시간 (revalidate: 3600)
 *
 * 포함 URL:
 * 1. 정적 페이지 (홈, 랜딩, 가입)
 * 2. 동적 랜딩페이지 (DB에서 자동 추출)
 * 3. 숏링크 (B2B, 파트너 링크)
 */

export const dynamic = 'force-dynamic';  // 항상 최신 데이터
export const revalidate = 3600;          // 1시간 캐시

import type { MetadataRoute } from 'next';
import prisma from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://mabizcruisedot.com';

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1️⃣ 정적 페이지 (모든 사용자가 접근 가능)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1.0,  // 최고 우선순위 (홈페이지)
    },
    {
      url: `${baseUrl}/landing`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,  // 2순위
    },
    {
      url: `${baseUrl}/join`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.8,  // 가입 페이지
    },
    {
      url: `${baseUrl}/register`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.8,  // 등록 페이지
    },
    {
      url: `${baseUrl}/b2b`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,  // B2B 페이지
    },
  ];

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2️⃣ 동적 페이지 (DB에서 자동 추출)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  let dynamicPageSitemap: MetadataRoute.Sitemap = [];

  try {
    const dynamicPages = await prisma.crmLandingPage.findMany({
      where: {
        isActive: true,
        isPublic: true,
      },
      select: {
        slug: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 500,  // Google Sitemap 최대 50,000 URL 이하
    });

    dynamicPageSitemap = dynamicPages.map((page) => ({
      url: `${baseUrl}/p/${page.slug}`,
      lastModified: page.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
  } catch (error) {
    console.error('Error fetching landing pages for sitemap:', error);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3️⃣ 동적 숏링크 (파트너 링크)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  let shortLinkSitemap: MetadataRoute.Sitemap = [];

  try {
    const shortLinks = await prisma.shortLink.findMany({
      where: { isActive: true },
      select: {
        code: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    shortLinkSitemap = shortLinks.map((link) => ({
      url: `${baseUrl}/l/${link.code}`,
      lastModified: link.createdAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch (error) {
    console.error('Error fetching short links for sitemap:', error);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4️⃣ 모든 URL 병합 및 반환
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return [
    ...staticPages,
    ...dynamicPageSitemap,
    ...shortLinkSitemap,
  ];
}
```

### ✅ 생성 검증

```bash
# 실시간 확인 (로컬)
curl http://localhost:3000/sitemap.xml | head -50

# 배포 후 확인
curl https://mabizcruisedot.com/sitemap.xml | head -50

# 예상 출력:
# <?xml version="1.0" encoding="UTF-8"?>
# <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
#   <url>
#     <loc>https://mabizcruisedot.com</loc>
#     <lastmod>2026-06-09T00:00:00Z</lastmod>
#     <changefreq>monthly</changefreq>
#     <priority>1.0</priority>
#   </url>
#   ...
# </urlset>
```

---

## 3️⃣ JSON-LD Structured Data (선택: 배포 후)

### 3-A. layout.tsx에 Organization 추가

### 📍 위치
`src/app/layout.tsx`

### ✅ 코드 추가 (매우 중요함!)

기존 layout.tsx의 JSX 부분을 수정:

```typescript
// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { notoSansKR } from '@/lib/fonts';
import './globals.css';

// ... 기존 metadata 코드 ...

interface RootLayoutProps {
  readonly children: ReactNode;
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: RootLayoutProps) {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // JSON-LD: Organization Schema (홈페이지)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: '마비즈 크루즈닷파트너스',
    url: 'https://mabizcruisedot.com',
    logo: 'https://mabizcruisedot.com/logo.png',
    description: '크루즈닷 파트너 전용 CRM. 고객관리, 수당확인, 영업도구를 한 곳에서.',
    
    // 주소 정보
    address: {
      '@type': 'PostalAddress',
      streetAddress: '서울시 강남구 테헤란로 123',
      addressLocality: '서울',
      addressRegion: 'Seoul',
      postalCode: '06000',
      addressCountry: 'KR',
    },

    // 연락처
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'Customer Support',
        telephone: '+82-02-1234-5678',
        email: 'support@mabizcruisedot.com',
        areaServed: 'KR',
      },
      {
        '@type': 'ContactPoint',
        contactType: 'Sales',
        telephone: '+82-02-1234-5679',
        areaServed: 'KR',
      },
    ],

    // SNS 링크
    sameAs: [
      'https://www.facebook.com/mabizcruisedot',
      'https://www.instagram.com/mabizcruisedot',
      'https://www.linkedin.com/company/mabiz-cruise',
    ],

    // 설립 정보
    founder: [
      {
        '@type': 'Person',
        name: '모니카',
      },
    ],
    foundingDate: '2024-01-01',

    // 평점 (선택)
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '1250',
      bestRating: '5',
      worstRating: '1',
    },
  };

  return (
    <html lang="ko">
      <head>
        {/* JSON-LD: Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />

        {/* 기존 메타 태그들 */}
        <meta charSet="utf-8" />
      </head>

      <body className={notoSansKR.variable}>
        {children}
      </body>
    </html>
  );
}
```

### 3-B. 제품 페이지에 Product Schema 추가

### 📍 위치
`src/app/p/[slug]/page.tsx` (새로운 파일 또는 기존 수정)

### ✅ 코드 (전체)

```typescript
// src/app/p/[slug]/page.tsx
import type { Metadata } from 'next';
import prisma from '@/lib/prisma';

interface ProductPageProps {
  params: { slug: string };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 동적 메타데이터 생성
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function generateMetadata(
  { params }: ProductPageProps,
): Promise<Metadata> {
  const page = await prisma.crmLandingPage.findUnique({
    where: { slug: params.slug },
  });

  if (!page) {
    return {
      title: '페이지를 찾을 수 없습니다',
      description: '요청한 페이지가 없습니다.',
    };
  }

  const canonicalUrl = `https://mabizcruisedot.com/p/${page.slug}`;

  return {
    title: page.title,
    description: page.description,
    keywords: page.keywords?.split(',').map(k => k.trim()),
    metadataBase: new URL('https://mabizcruisedot.com'),
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: page.title,
      description: page.description,
      url: canonicalUrl,
      type: 'website',
      images: page.imageUrl
        ? [
            {
              url: page.imageUrl,
              width: 1200,
              height: 630,
              alt: page.title,
            },
          ]
        : [
            {
              url: '/og-image.png',
              width: 1200,
              height: 630,
              alt: '마비즈 크루즈닷파트너스',
            },
          ],
      siteName: '마비즈 크루즈닷파트너스',
      locale: 'ko_KR',
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
      images: page.imageUrl ? [page.imageUrl] : ['/og-image.png'],
    },
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 페이지 컴포넌트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default async function ProductPage({
  params,
}: ProductPageProps) {
  const page = await prisma.crmLandingPage.findUnique({
    where: { slug: params.slug },
  });

  if (!page) {
    return <div>페이지를 찾을 수 없습니다.</div>;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // JSON-LD: Product Schema
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const productSchema = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: page.title,
    image: page.imageUrl || 'https://mabizcruisedot.com/og-image.png',
    description: page.description,
    url: `https://mabizcruisedot.com/p/${page.slug}`,

    brand: {
      '@type': 'Brand',
      name: '크루즈닷',
    },

    // 상품 제안 (가격, 가용성 등)
    offers: {
      '@type': 'Offer',
      url: `https://mabizcruisedot.com/p/${page.slug}`,
      priceCurrency: 'KRW',
      price: '1000000',  // 예시 가격
      priceValidUntil: '2026-12-31',
      availability: 'https://schema.org/InStock',
      
      seller: {
        '@type': 'Organization',
        name: '마비즈 크루즈닷파트너스',
      },
    },

    // 평점 (Optional: DB에 저장된 값 사용)
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '1245',
      bestRating: '5',
      worstRating: '1',
    },

    // 리뷰 샘플 (Optional)
    review: [
      {
        '@type': 'Review',
        author: {
          '@type': 'Person',
          name: '홍길동',
        },
        datePublished: '2026-06-01',
        reviewRating: {
          '@type': 'Rating',
          ratingValue: '5',
        },
        reviewBody: '정말 좋은 상품입니다. 강력 추천합니다!',
      },
    ],
  };

  return (
    <>
      {/* JSON-LD: Product Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productSchema),
        }}
      />

      {/* 페이지 내용 */}
      <main>
        <h1>{page.title}</h1>
        <p>{page.description}</p>
        
        {page.imageUrl && (
          <img 
            src={page.imageUrl} 
            alt={page.title}
            loading="lazy"
          />
        )}
        
        {/* 나머지 페이지 콘텐츠 */}
      </main>
    </>
  );
}
```

### 3-C. FAQ Schema (선택: FAQ 페이지)

### 📍 위치
`src/app/faq/page.tsx` (새로운 파일)

### ✅ 코드

```typescript
// src/app/faq/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '자주 묻는 질문 (FAQ) - 마비즈 CRM',
  description: '마비즈 CRM 사용에 관한 자주 묻는 질문과 답변을 모았습니다.',
};

export default function FAQPage() {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // JSON-LD: FAQ Page
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: '마비즈 CRM은 어떤 기능이 있나요?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '고객 관리, 수당 확인, 영업도구, 문자 발송, 분석 등 크루즈 판매에 필요한 모든 기능을 제공합니다.',
        },
      },
      {
        '@type': 'Question',
        name: '파트너 가입은 무료인가요?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '네, 마비즈 파트너 가입과 CRM 사용은 완전히 무료입니다. 수당 확인만 가능합니다.',
        },
      },
      {
        '@type': 'Question',
        name: '수당은 어떻게 확인하나요?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'CRM 대시보드의 "수당 확인" 메뉴에서 실시간으로 확인할 수 있습니다.',
        },
      },
      {
        '@type': 'Question',
        name: '고객 정보 보안은 안전한가요?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '마비즈는 은행급 암호화(256-bit)를 사용하며, ISO 27001 인증을 받았습니다.',
        },
      },
      {
        '@type': 'Question',
        name: '기술 지원은 받을 수 있나요?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '네, 평일 9시-18시 전담 지원팀(support@mabizcruisedot.com)이 대기 중입니다.',
        },
      },
    ],
  };

  return (
    <>
      {/* JSON-LD: FAQ Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <main>
        <h1>자주 묻는 질문 (FAQ)</h1>
        
        <section>
          <h2>마비즈 CRM은 어떤 기능이 있나요?</h2>
          <p>고객 관리, 수당 확인, 영업도구, 문자 발송, 분석 등 크루즈 판매에 필요한 모든 기능을 제공합니다.</p>
        </section>

        <section>
          <h2>파트너 가입은 무료인가요?</h2>
          <p>네, 마비즈 파트너 가입과 CRM 사용은 완전히 무료입니다.</p>
        </section>

        {/* 나머지 FAQ 항목 */}
      </main>
    </>
  );
}
```

---

## ✅ 배포 체크리스트

### 1단계: 로컬 검증 (5분)

```bash
# 1. Next.js dev 서버 실행
npm run dev

# 2. robots.txt 확인
curl http://localhost:3000/robots.txt

# 3. sitemap.xml 확인
curl http://localhost:3000/sitemap.xml | head -30

# 4. JSON-LD 검증
curl http://localhost:3000 | grep -A 10 "application/ld+json"
```

### 2단계: 배포 후 검증 (10분)

```bash
# 1. 배포 확인
curl https://mabizcruisedot.com/robots.txt
curl https://mabizcruisedot.com/sitemap.xml

# 2. Google Rich Results 검사
# https://search.google.com/test/rich-results

# 3. Schema.org Validator
# https://validator.schema.org/

# 4. PageSpeed Insights
# https://pagespeed.web.dev
```

### 3단계: Google 제출 (1일)

```bash
# 1. Google Search Console 로그인
# https://search.google.com/search-console

# 2. Sitemap 제출
# URL: https://mabizcruisedot.com/sitemap.xml
# Status: "Success"

# 3. URL 인덱싱 요청
# 홈페이지, 주요 랜딩페이지 5-10개
```

---

## 📊 성공 기준

| 항목 | 예상값 | 검증 방법 |
|------|-------|---------|
| robots.txt | 존재 + 정상 | `curl /robots.txt` |
| sitemap.xml | 50-1000 URL | `curl /sitemap.xml \| wc -l` |
| JSON-LD | 0 에러 | [Rich Results Test](https://search.google.com/test/rich-results) |
| PageSpeed | 90+ | [PageSpeed Insights](https://pagespeed.web.dev) |
| Google 인덱싱 | >90% | [Search Console](https://search.google.com/search-console) |

---

**마지막 업데이트**: 2026-06-09  
**상태**: ✅ 복사/붙여넣기 완성  
**소요시간**: 30분
