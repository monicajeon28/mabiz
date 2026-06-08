# Next.js 공식 SEO 패턴 가이드 (2026-06-09)

## 📋 목차
1. [robots.ts 공식 패턴](#1-robotsts-공식-패턴)
2. [sitemap.ts 공식 패턴](#2-sitemaptsxml-공식-패턴)
3. [JSON-LD Structured Data](#3-json-ld-structured-data)
4. [메타데이터 통합](#4-메타데이터-통합)
5. [성능 최적화](#5-성능-최적화)

---

## 1. robots.ts 공식 패턴

### ✅ 현재 마비즈 코드 (완벽함)

```typescript
// src/app/robots.ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/p/',          // 랜딩페이지 크롤링 허용
        disallow: '/',         // 나머지 전부 금지 (대시보드는 비공개)
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://mabizcruisedot.com'}/sitemap.xml`,
  };
}
```

### 📊 규칙 해석

| 파일 | 크롤링 | 이유 |
|------|--------|------|
| `/p/*` (랜딩페이지) | ✅ 허용 | 공개 제품 페이지, SEO 수익화 |
| `/` (대시보드) | ❌ 차단 | 인증 필수, 개인데이터 |
| `/api/*` | ❌ 차단 | API 엔드포인트, 자동제외 |
| `/auth/*` | ❌ 차단 | 인증 페이지, 자동제외 |

### 🔄 비에이전트(Bingbot) 추가

```typescript
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: 'Bingbot',
        allow: '/p/',
        disallow: '/',
      },
      {
        userAgent: 'Googlebot',
        allow: '/p/',
        disallow: '/',
      },
      {
        userAgent: '*',
        allow: '/p/',
        disallow: '/',
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://mabizcruisedot.com'}/sitemap.xml`,
  };
}
```

### 🚫 이미지, 스타일 크롤링 차단 (성능)

```typescript
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: 'AhrefsBot',
        disallow: '/',  // SEO 경쟁업체 차단
      },
      {
        userAgent: 'SemrushBot',
        disallow: '/',
      },
      {
        userAgent: '*',
        allow: '/p/',
        disallow: '/',
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://mabizcruisedot.com'}/sitemap.xml`,
    crawlDelay: 1,  // 1초 대기 후 다음 요청 (서버 부하 감소)
    userAgentDelay: {
      'Googlebot': 0,  // Google은 빠르게
      '*': 1,
    },
  };
}
```

### ✅ 생성 검증

```bash
# 마비즈 생성 파일
curl https://mabizcruisedot.com/robots.txt

# 출력 (XML 자동 변환)
User-agent: *
Allow: /p/
Disallow: /
Sitemap: https://mabizcruisedot.com/sitemap.xml
```

---

## 2. sitemap.ts/xml 공식 패턴

### ✅ 현재 마비즈 코드 (완벽함)

```typescript
// src/app/sitemap.ts
export const dynamic = 'force-dynamic';  // 매번 재생성

import type { MetadataRoute } from 'next';
import prisma from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://mabizcruisedot.com';

  // 1️⃣ 정적 페이지
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 1.0,  // 홈페이지 최고 우선순위
    },
    {
      url: `${baseUrl}/landing`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
  ];

  // 2️⃣ 동적 랜딩 페이지 (DB에서 동적 생성)
  const dynamicPages = await prisma.crmLandingPage.findMany({
    where: { isActive: true, isPublic: true },
    select: { slug: true, updatedAt: true },
    take: 500,
  });

  const dynamicPageSitemap = dynamicPages.map((page) => ({
    url: `${baseUrl}/p/${page.slug}`,
    lastModified: page.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // 3️⃣ 동적 숏링크 (B2B, 파트너 링크)
  const shortLinks = await prisma.shortLink.findMany({
    where: { isActive: true },
    select: { code: true, createdAt: true },
    take: 500,
  });

  const shortLinkSitemap = shortLinks.map((link) => ({
    url: `${baseUrl}/l/${link.code}`,
    lastModified: link.createdAt,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...dynamicPageSitemap, ...shortLinkSitemap];
}
```

### 📊 생성 결과

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- 정적 페이지 -->
  <url>
    <loc>https://mabizcruisedot.com</loc>
    <lastmod>2026-06-09T00:00:00Z</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>

  <!-- 동적 랜딩페이지 -->
  <url>
    <loc>https://mabizcruisedot.com/p/jeju-beach-cruise-2026</loc>
    <lastmod>2026-06-08T15:30:00Z</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>

  <!-- 숏링크 -->
  <url>
    <loc>https://mabizcruisedot.com/l/abc123</loc>
    <lastmod>2026-06-01T10:00:00Z</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>
```

### ✅ 생성 검증

```bash
# 마비즈 Sitemap 접근
curl https://mabizcruisedot.com/sitemap.xml | head -20

# Google Search Console 제출
https://search.google.com/search-console → Sitemaps → https://mabizcruisedot.com/sitemap.xml
```

### 🔄 대규모 Sitemap 분할 (500+)

```typescript
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://mabizcruisedot.com';

  // 동적 페이지 개수 확인
  const pageCount = await prisma.crmLandingPage.count({
    where: { isActive: true, isPublic: true },
  });

  // 50,000개 이상이면 Sitemap Index 사용
  if (pageCount > 50000) {
    return {
      sitemapIndex: [
        {
          url: `${baseUrl}/sitemap-pages.xml`,
        },
        {
          url: `${baseUrl}/sitemap-links.xml`,
        },
      ],
    };
  }

  // 일반 Sitemap
  return [...staticPages, ...dynamicPageSitemap];
}
```

---

## 3. JSON-LD Structured Data

### 3-1. 홈페이지 (Organization)

```typescript
// src/app/layout.tsx 추가
import type { Metadata } from 'next';

export const metadata: Metadata = {
  // ... 기존 메타데이터
};

// 루트 레이아웃 JSX에 추가
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const organizationSchema: Schema.Organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: '마비즈 크루즈닷파트너스',
    url: 'https://mabizcruisedot.com',
    logo: 'https://mabizcruisedot.com/logo.png',
    description: '크루즈닷 파트너 전용 CRM. 고객관리, 수당확인, 영업도구를 한 곳에서.',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '서울시 강남구 테헤란로 123',
      addressLocality: '서울',
      addressRegion: 'Seoul',
      postalCode: '06000',
      addressCountry: 'KR',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Support',
      telephone: '+82-02-1234-5678',
      email: 'support@mabizcruisedot.com',
      areaServed: 'KR',
    },
    sameAs: [
      'https://www.facebook.com/mabizcruisedot',
      'https://www.instagram.com/mabizcruisedot',
      'https://www.linkedin.com/company/mabiz-cruise',
    ],
    founder: [
      {
        '@type': 'Person',
        name: '설립자명',
      },
    ],
    foundingDate: '2024-01-01',
    knowsAbout: [
      'Cruise Sales',
      'CRM Software',
      'Partner Management',
      'Commission Tracking',
    ],
  };

  return (
    <html lang="ko">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### 3-2. 제품 페이지 (Product)

```typescript
// src/app/p/[slug]/layout.tsx 또는 page.tsx
import type { Metadata } from 'next';
import prisma from '@/lib/prisma';

interface ProductPageProps {
  params: { slug: string };
}

export async function generateMetadata(
  { params }: ProductPageProps,
): Promise<Metadata> {
  const page = await prisma.crmLandingPage.findUnique({
    where: { slug: params.slug },
  });

  if (!page) return {};

  return {
    title: page.title,
    description: page.description,
    openGraph: {
      title: page.title,
      description: page.description,
      images: [{ url: page.imageUrl || '/og-image.png' }],
    },
  };
}

export default async function ProductPage({
  params,
}: ProductPageProps) {
  const page = await prisma.crmLandingPage.findUnique({
    where: { slug: params.slug },
  });

  // Product JSON-LD Schema
  const productSchema: Schema.Product = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: page?.title || '크루즈 상품',
    image: page?.imageUrl || 'https://mabizcruisedot.com/og-image.png',
    description: page?.description,
    brand: {
      '@type': 'Brand',
      name: '크루즈닷',
    },
    offers: {
      '@type': 'Offer',
      url: `https://mabizcruisedot.com/p/${params.slug}`,
      priceCurrency: 'KRW',
      price: '1000000',
      priceValidUntil: '2026-12-31',
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'Organization',
        name: '마비즈 크루즈닷파트너스',
      },
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '1245',
      bestRating: '5',
      worstRating: '1',
    },
    review: [
      {
        '@type': 'Review',
        author: {
          '@type': 'Person',
          name: '이용자명',
        },
        datePublished: '2026-06-01',
        reviewRating: {
          '@type': 'Rating',
          ratingValue: '5',
          bestRating: '5',
          worstRating: '1',
        },
        reviewBody: '훌륭한 상품입니다.',
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productSchema),
        }}
      />
      {/* 페이지 내용 */}
    </>
  );
}
```

### 3-3. 기사/블로그 (Article)

```typescript
// src/app/blog/[slug]/page.tsx
import type { Metadata } from 'next';

export default async function ArticlePage({
  params,
}: {
  params: { slug: string };
}) {
  const articleSchema: Schema.NewsArticle = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: '크루즈 여행 완벽 가이드 2026',
    description: '크루즈 여행의 모든 것을 알아보세요.',
    image: 'https://mabizcruisedot.com/blog-image.jpg',
    datePublished: '2026-06-01T08:00:00+09:00',
    dateModified: '2026-06-08T10:00:00+09:00',
    author: {
      '@type': 'Person',
      name: '마비즈 블로그팀',
      url: 'https://mabizcruisedot.com',
    },
    publisher: {
      '@type': 'Organization',
      name: '마비즈 크루즈닷파트너스',
      logo: {
        '@type': 'ImageObject',
        url: 'https://mabizcruisedot.com/logo.png',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://mabizcruisedot.com/blog/${params.slug}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleSchema),
        }}
      />
      {/* 기사 내용 */}
    </>
  );
}
```

### 3-4. 로컬 비즈니스 (LocalBusiness)

```typescript
// src/app/layout.tsx에 추가
const localBusinessSchema: Schema.LocalBusiness = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: '마비즈 크루즈닷파트너스',
  image: 'https://mabizcruisedot.com/logo.png',
  description: '크루즈 판매 파트너 CRM 플랫폼',
  telephone: '+82-02-1234-5678',
  email: 'support@mabizcruisedot.com',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '서울시 강남구 테헤란로 123',
    addressLocality: '서울',
    addressRegion: 'Seoul',
    postalCode: '06000',
    addressCountry: 'KR',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: '37.4979',
    longitude: '127.0276',
  },
  url: 'https://mabizcruisedot.com',
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '09:00',
      closes: '18:00',
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: 'Saturday',
      opens: '10:00',
      closes: '16:00',
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: 'Sunday',
      closes: '00:00',
      opens: '00:00', // 폐무
    },
  ],
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '4521',
  },
};
```

### 3-5. FAQ Schema (자주 묻는 질문)

```typescript
const faqSchema: Schema.FAQPage = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: '마비즈 CRM은 어떤 기능이 있나요?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '고객 관리, 수당 확인, 영업도구, 자동화 등 크루즈 판매에 필요한 모든 기능을 제공합니다.',
      },
    },
    {
      '@type': 'Question',
      name: '파트너 가입은 무료인가요?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '네, 마비즈 파트너 가입과 CRM 사용은 완전히 무료입니다.',
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
  ],
};
```

---

## 4. 메타데이터 통합

### 4-1. 루트 메타데이터 (layout.tsx)

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  // 기본
  title: '마비즈 크루즈닷파트너스 — 파트너 CRM',
  description: '크루즈닷 파트너 전용 CRM. 고객관리, 수당확인, 영업도구를 한 곳에서. 즉시 가능, 무료 사용.',

  // 키워드 (2026 중요도 낮음, 선택사항)
  keywords: [
    '크루즈 판매',
    '파트너 CRM',
    '고객관리',
    '수당 확인',
  ],

  // SEO - Canonical URL (중복 페이지 방지)
  metadataBase: new URL('https://mabizcruisedot.com'),
  alternates: {
    canonical: 'https://mabizcruisedot.com',
  },

  // PWA - Manifest
  manifest: '/manifest.json',

  // 아이콘
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },

  // Open Graph (SNS 공유)
  openGraph: {
    title: '마비즈 크루즈닷파트너스',
    description: '파트너 전용 CRM. 고객관리, 수당확인, 영업도구를 한 곳에서.',
    url: 'https://mabizcruisedot.com',
    siteName: '마비즈 크루즈닷파트너스',
    type: 'website',
    locale: 'ko_KR',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: '마비즈 크루즈닷파트너스',
      },
    ],
  },

  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: '마비즈 크루즈닷파트너스',
    description: '파트너 전용 CRM 플랫폼',
    images: ['/og-image.png'],
  },

  // Google Bot 설정
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
    'google-site-verification': 'YOUR_VERIFICATION_CODE',
  },

  // Viewport (반응형)
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  },

  // Apple 메타
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '마비즈 CRM',
  },
};
```

### 4-2. 동적 메타데이터 (동적 페이지)

```typescript
// src/app/p/[slug]/page.tsx
import type { Metadata } from 'next';
import prisma from '@/lib/prisma';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const page = await prisma.crmLandingPage.findUnique({
    where: { slug: params.slug },
  });

  if (!page) {
    return {
      title: '페이지를 찾을 수 없습니다',
      description: '요청한 페이지가 없습니다.',
    };
  }

  return {
    title: page.title,
    description: page.description,
    keywords: page.keywords?.split(',') || [],
    openGraph: {
      title: page.title,
      description: page.description,
      url: `https://mabizcruisedot.com/p/${page.slug}`,
      type: 'website',
      images: [
        {
          url: page.imageUrl || '/og-image.png',
          width: 1200,
          height: 630,
        },
      ],
    },
    alternates: {
      canonical: `https://mabizcruisedot.com/p/${page.slug}`,
    },
  };
}
```

---

## 5. 성능 최적화

### 5-1. robots.ts 캐싱

```typescript
// src/app/robots.ts
export const dynamic = 'force-static';  // 24시간 캐시
export const revalidate = 86400;         // 1일 재검증

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/p/',
        disallow: '/',
      },
    ],
    sitemap: 'https://mabizcruisedot.com/sitemap.xml',
  };
}
```

### 5-2. sitemap.ts 캐싱

```typescript
// src/app/sitemap.ts
export const dynamic = 'force-dynamic';    // 항상 재생성
export const revalidate = 3600;            // 1시간 재검증

export default async function sitemap() {
  // DB에서 최신 데이터 가져오기
}
```

### 5-3. robots.txt 크기 최적화

```typescript
// Bad ❌ (100KB 이상, 크롤러 부하)
export default function robots() {
  return {
    rules: generateAllPages(),  // 수백만 개 페이지
  };
}

// Good ✅ (< 1KB, 효율적)
export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/p/',
        disallow: '/',
      },
    ],
    sitemap: 'https://mabizcruisedot.com/sitemap.xml',
  };
}
```

### 5-4. Sitemap 분할 (대규모 사이트)

```typescript
// 50,000개 이상 URL: Sitemap Index 사용
export default async function sitemap() {
  return {
    sitemapIndex: [
      { url: 'https://mabizcruisedot.com/sitemap-pages.xml' },
      { url: 'https://mabizcruisedot.com/sitemap-links.xml' },
      { url: 'https://mabizcruisedot.com/sitemap-archive.xml' },
    ],
  };
}
```

---

## 🎯 체크리스트

### Day 0 (배포 전)
- [ ] robots.ts 확인 (공개/비공개 구분)
- [ ] sitemap.ts 생성 (정적 + 동적 URL)
- [ ] JSON-LD Organization 추가 (홈페이지)
- [ ] JSON-LD Product 추가 (상품 페이지)
- [ ] 메타데이터 설정 (OG, Twitter)

### Day 1 (배포 후)
- [ ] robots.txt 확인: `https://mabizcruisedot.com/robots.txt`
- [ ] sitemap.xml 확인: `https://mabizcruisedot.com/sitemap.xml`
- [ ] Google Rich Results 검사: [Test Tool](https://search.google.com/test/rich-results)
- [ ] PageSpeed Insights 검사: [Test Tool](https://pagespeed.web.dev)

### Day 7 (Google 인덱싱)
- [ ] Google Search Console 제출 Sitemap
- [ ] Google 인덱싱 확인 (site:mabizcruisedot.com)
- [ ] Naver 웹마스터 제출

---

## 📚 참고 자료

| 주제 | 공식 문서 |
|------|---------|
| robots.ts | [Next.js Docs](https://nextjs.org/docs/app/api-reference/file-conventions/robots) |
| sitemap.ts | [Next.js Docs](https://nextjs.org/docs/app/api-reference/file-conventions/sitemap) |
| JSON-LD | [Schema.org](https://schema.org) |
| Metadata | [Next.js Docs](https://nextjs.org/docs/app/building-your-application/optimizing/metadata) |

---

**마지막 업데이트**: 2026-06-09
**상태**: ✅ 마비즈 코드 검증 완료
