# Next.js 메타데이터 API 완전 가이드 (마비즈 CRM)

**마지막 업데이트**: 2026-06-09  
**대상**: Next.js 15 App Router + TypeScript  
**Current Status**: ✅ 완료

---

## 📊 현황 분석

### ✅ 구현 완료
| 항목 | 파일 | 상태 | 설명 |
|------|------|------|------|
| **Root Metadata** | `src/app/layout.tsx` | ✅ | title, description, og, twitter, robots 완벽 |
| **robots.txt** | `src/app/robots.ts` | ✅ | Allow `/p/`, Disallow `/` |
| **sitemap.xml** | `src/app/sitemap.ts` | ✅ | 1000+ 동적 페이지 포함 |
| **폰트 최적화** | `src/app/layout.tsx` | ✅ | Noto Sans KR, display: swap |

### ⚠️ 미구현 (우선순위)

| Priority | 항목 | 파일 | 영향도 | 예상 시간 |
|----------|------|------|--------|---------|
| **P0** | 대시보드 레이아웃 메타데이터 | `src/app/(dashboard)/layout.tsx` | 🔴 높음 | 1시간 |
| **P1** | 동적 페이지 메타데이터 | `src/app/(dashboard)/[domain]/[id]/page.tsx` | 🟡 중간 | 2-3시간 |
| **P2** | JSON-LD 구조화 데이터 | `src/app/api/jsonld.ts` | 🟡 중간 | 1-2시간 |
| **P3** | 동적 OG 이미지 | `src/app/og.tsx` | 🟢 낮음 | 2시간 |

---

## 🎯 3가지 메타데이터 패턴

### 1️⃣ Static Metadata (고정 값)
```typescript
// src/app/(dashboard)/contacts/page.tsx
export const metadata: Metadata = {
  title: '고객 관리 - 마비즈 CRM',
  description: '고객 정보 조회, 검색, 태그 관리',
  robots: {
    index: false, // 대시보드는 Google 색인 불가
  },
};
```

**특징**:
- 빌드 타임에 결정
- 모든 사용자 동일
- 캐싱 최적화 가능

---

### 2️⃣ Dynamic Metadata with `params` (URL 경로)
```typescript
// src/app/p/[slug]/page.tsx
import { notFound } from 'next/navigation';
import type { Metadata, MetadataRoute } from 'next';
import prisma from '@/lib/prisma';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  
  const page = await prisma.crmLandingPage.findUnique({
    where: { slug },
    select: { title: true, description: true, createdAt: true, updatedAt: true },
  });

  if (!page) return notFound();

  return {
    title: page.title,
    description: page.description,
    openGraph: {
      title: page.title,
      description: page.description,
      url: `https://mabizcruisedot.com/p/${slug}`,
      type: 'article',
      publishedTime: page.createdAt?.toISOString(),
      modifiedTime: page.updatedAt?.toISOString(),
    },
    alternates: {
      canonical: `https://mabizcruisedot.com/p/${slug}`,
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const page = await prisma.crmLandingPage.findUnique({ where: { slug } });
  
  if (!page) return notFound();
  
  return <article>{page.content}</article>;
}
```

**특징**:
- 런타임에 동적 생성
- DB 쿼리 필요 (캐싱 권장)
- SEO 최적화 ⭐⭐⭐

---

### 3️⃣ Dynamic Metadata with `searchParams` (URL 쿼리)
```typescript
// src/app/(dashboard)/contacts/page.tsx
import type { Metadata } from 'next';

interface PageProps {
  searchParams: Promise<{ q?: string; type?: string; sort?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q, type } = await searchParams;

  // 검색 쿼리 기반 제목 생성
  let title = '고객 관리';
  if (q) title = `고객 검색: "${q}"`;
  if (type === 'inquiry') title = '교육 문의 - 고객 관리';

  return {
    title: `${title} - 마비즈 CRM`,
    description: q ? `"${q}" 검색 결과` : '고객 정보 조회 및 관리',
    robots: {
      index: false, // 동적 쿼리 페이지는 색인 제외
    },
  };
}

export default async function ContactsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  // ...
}
```

**특징**:
- URL 쿼리 기반
- 대시보드 페이지 적합
- 검색 봇 색인 제외 권장

---

## 🔧 P0: 대시보드 레이아웃 메타데이터 (1시간)

### 파일: `src/app/(dashboard)/layout.tsx`

```typescript
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useSession } from '@/hooks/useSession';

export const metadata: Metadata = {
  title: '대시보드 - 마비즈 CRM',
  description: '파트너 전용 CRM 대시보드. 고객 관리, 수당 확인, 영업 도구.',
  robots: {
    index: false,        // 대시보드는 Google 색인 불가
    follow: false,       // 대시보드 링크 크롤링 불가
    noindex: true,       // 명시적으로 색인 제외
  },
};

interface DashboardLayoutProps {
  readonly children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Header />
        <main className="flex-1 overflow-auto bg-background p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

**설정 설명**:
- `robots.index: false` → 대시보드는 SEO 색인 불필요
- `robots.follow: false` → 내부 링크 크롤링 불필요
- `noindex: true` → X-Robots-Tag 이중 확인

---

## 🔧 P1: 동적 페이지 메타데이터 (2-3시간)

### 1️⃣ 공개 랜딩 페이지 (SEO 필수)

**파일**: `src/app/p/[slug]/page.tsx`

```typescript
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// SEO 크롤러가 파라미터를 알 수 있도록 선언
export async function generateStaticParams() {
  const pages = await prisma.crmLandingPage.findMany({
    where: { isActive: true, isPublic: true },
    select: { slug: true },
    take: 100, // Vercel 프리 플랜 한계: 최대 100개
  });
  
  return pages.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const page = await prisma.crmLandingPage.findUnique({
      where: { slug },
      select: {
        title: true,
        description: true,
        heroImage: true,
        createdAt: true,
        updatedAt: true,
        author: { select: { name: true } },
      },
    });

    if (!page) return notFound();

    const ogImageUrl = page.heroImage 
      ? `https://mabizcruisedot.com${page.heroImage}`
      : 'https://mabizcruisedot.com/og-image.png';

    return {
      title: page.title,
      description: page.description,
      keywords: ['크루즈', '랜딩페이지', page.title].filter(Boolean),
      authors: page.author?.name ? [{ name: page.author.name }] : [],
      openGraph: {
        title: page.title,
        description: page.description,
        url: `https://mabizcruisedot.com/p/${slug}`,
        type: 'article',
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: page.title,
            type: 'image/png',
          },
        ],
        publishedTime: page.createdAt?.toISOString(),
        modifiedTime: page.updatedAt?.toISOString(),
        authors: page.author?.name ? [page.author.name] : [],
      },
      twitter: {
        card: 'summary_large_image',
        title: page.title,
        description: page.description,
        images: [ogImageUrl],
      },
      alternates: {
        canonical: `https://mabizcruisedot.com/p/${slug}`,
      },
    };
  } catch (error) {
    console.error(`[Metadata] Error for slug=${slug}:`, error);
    return notFound();
  }
}

export default async function LandingPage({ params }: PageProps) {
  const { slug } = await params;

  const page = await prisma.crmLandingPage.findUnique({
    where: { slug },
    include: { sections: true },
  });

  if (!page) return notFound();

  return (
    <article className="prose max-w-4xl mx-auto p-4">
      <h1>{page.title}</h1>
      <p>{page.description}</p>
      {/* 페이지 콘텐츠 */}
    </article>
  );
}
```

**최적화 포인트**:
- ✅ `generateStaticParams()` → 100개 페이지 정적 생성
- ✅ `openGraph.publishedTime` → Google News 등록
- ✅ `canonical` → 중복 URL 방지
- ✅ 이미지 1200x630 (OG 최적화)

---

### 2️⃣ 숏링크 페이지

**파일**: `src/app/l/[code]/page.tsx`

```typescript
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import prisma from '@/lib/prisma';

interface PageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;

  const link = await prisma.shortLink.findUnique({
    where: { code },
    select: {
      title: true,
      description: true,
      targetUrl: true,
      imageUrl: true,
      createdAt: true,
    },
  });

  if (!link) return notFound();

  return {
    title: link.title || '크루즈닷 링크',
    description: link.description || '크루즈닷에서 공유한 링크',
    openGraph: {
      title: link.title || '크루즈닷 링크',
      description: link.description || '',
      url: `https://mabizcruisedot.com/l/${code}`,
      type: 'website',
      images: [
        {
          url: link.imageUrl || 'https://mabizcruisedot.com/og-image.png',
          width: 1200,
          height: 630,
          alt: link.title || '크루즈닷 링크',
        },
      ],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function ShortLinkPage({ params }: PageProps) {
  const { code } = await params;

  const link = await prisma.shortLink.findUnique({
    where: { code },
  });

  if (!link) return notFound();

  // 리다이렉트 (메타데이터 생성 후)
  return redirect(link.targetUrl);
}
```

---

### 3️⃣ 고객 프로필 페이지 (인증된 사용자만)

**파일**: `src/app/(dashboard)/contacts/[id]/page.tsx`

```typescript
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await getSession();

  // 인증되지 않은 사용자는 메타데이터 표시 안 함
  if (!session) {
    return {
      robots: { index: false },
    };
  }

  const contact = await prisma.contact.findUnique({
    where: { id },
    select: { name: true, type: true },
  });

  if (!contact) return notFound();

  return {
    title: `${contact.name} - 고객 정보`,
    description: `${contact.type === 'user' ? '구매' : '문의'}고객 프로필`,
    robots: {
      index: false, // 대시보드 페이지는 색인 불가
    },
  };
}

export default async function ContactDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession();

  if (!session) {
    return <div>로그인이 필요합니다.</div>;
  }

  const contact = await prisma.contact.findUnique({
    where: { id },
  });

  if (!contact) return notFound();

  return (
    <div className="space-y-6">
      <h1>{contact.name}</h1>
      {/* 프로필 내용 */}
    </div>
  );
}
```

---

## 🔧 P2: JSON-LD 구조화 데이터 (1-2시간)

JSON-LD는 Google, Facebook, LinkedIn 등 SNS와 검색 봇이 이해할 수 있는 구조화된 데이터입니다.

### 1️⃣ Organization (브랜드)

**파일**: `src/app/layout.tsx` (기존 파일에 추가)

```typescript
import { useEffect } from 'react';

export default function RootLayout({ children }: RootLayoutProps) {
  useEffect(() => {
    // JSON-LD: Organization 구조
    const jsonLd = {
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

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.innerHTML = JSON.stringify(jsonLd);
    document.head.appendChild(script);
  }, []);

  return (
    <html lang="ko">
      {/* ... */}
    </html>
  );
}
```

### 2️⃣ Article (랜딩 페이지)

**파일**: `src/app/p/[slug]/page.tsx` (기존 파일에 추가)

```typescript
'use client';

import { useEffect } from 'react';

export default function LandingPage({ params }: PageProps) {
  const { slug } = params;

  useEffect(() => {
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: page.title,
      description: page.description,
      image: page.heroImage,
      datePublished: page.createdAt,
      dateModified: page.updatedAt,
      author: {
        '@type': 'Person',
        name: page.author?.name || '마비즈',
      },
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.innerHTML = JSON.stringify(jsonLd);
    document.head.appendChild(script);
  }, [page]);

  return (
    // ...
  );
}
```

### 3️⃣ 복합 구조 (BreadcrumbList)

```typescript
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: '홈',
      item: 'https://mabizcruisedot.com',
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: '고객 관리',
      item: 'https://mabizcruisedot.com/contacts',
    },
    {
      '@type': 'ListItem',
      position: 3,
      name: contact.name,
      item: `https://mabizcruisedot.com/contacts/${contact.id}`,
    },
  ],
};
```

---

## 🔧 P3: 동적 OG 이미지 (2시간)

### Next.js 동적 OG 이미지 생성

**파일**: `src/app/og.tsx`

```typescript
import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = '마비즈 크루즈닷파트너스 OG 이미지';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 128,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          textAlign: 'center',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
        }}
      >
        마비즈 CRM
      </div>
    ),
    {
      ...size,
    },
  );
}
```

**페이지별 동적 OG 이미지**:

```typescript
// src/app/p/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const alt = 'Landing Page OG';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

interface ImageProps {
  params: Promise<{ slug: string }>;
}

export default async function Image({ params }: ImageProps) {
  const { slug } = await params;
  
  const page = await prisma.crmLandingPage.findUnique({
    where: { slug },
    select: { title: true, description: true },
  });

  if (!page) {
    return new ImageResponse(
      <div style={{ fontSize: 60, color: 'white', background: 'black' }}>
        Page not found
      </div>,
      { ...size }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 60,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          padding: 40,
          gap: 20,
        }}
      >
        <h1 style={{ margin: 0, textAlign: 'center' }}>{page.title}</h1>
        <p style={{ margin: 0, fontSize: 30, opacity: 0.8, textAlign: 'center' }}>
          {page.description}
        </p>
      </div>
    ),
    { ...size }
  );
}
```

---

## ✅ 구현 체크리스트

### P0 (즉시, 1시간)
- [ ] `src/app/(dashboard)/layout.tsx` 메타데이터 추가 (robots: index=false)
- [ ] `src/app/(dashboard)/contacts/page.tsx` 정적 메타데이터 추가
- [ ] `src/app/(dashboard)/admin/page.tsx` 정적 메타데이터 추가

### P1 (우선, 2-3시간)
- [ ] `src/app/p/[slug]/page.tsx` 동적 메타데이터 (generateMetadata)
- [ ] `src/app/l/[code]/page.tsx` 숏링크 메타데이터
- [ ] `src/app/(dashboard)/contacts/[id]/page.tsx` 대시보드 동적 메타데이터

### P2 (중간, 1-2시간)
- [ ] JSON-LD Organization 추가 (layout.tsx)
- [ ] JSON-LD Article 추가 (p/[slug]/page.tsx)
- [ ] JSON-LD BreadcrumbList 추가 (contacts/[id]/page.tsx)

### P3 (선택, 2시간)
- [ ] `src/app/og.tsx` 기본 OG 이미지 생성
- [ ] `src/app/p/[slug]/opengraph-image.tsx` 동적 OG 이미지

---

## 🧪 테스트 및 검증

### 1️⃣ 로컬 검증

```bash
# 타입 체크
npx tsc --noEmit

# 메타데이터 확인 (dev 서버)
npm run dev
# 브라우저 개발자 도구 → 소스 → 페이지 소스 확인
# <title>, <meta name="description">, <meta property="og:...">
```

### 2️⃣ Facebook OG 검증

- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/sharing/)
- URL 입력 → OG 이미지, 제목, 설명 확인

### 3️⃣ Twitter Card 검증

- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- URL 입력 → 미리보기 확인

### 4️⃣ Google Search Console

- 페이지 색인: `site:mabizcruisedot.com`
- 이미지 색인: Search Console → 이미지 보고서

### 5️⃣ Schema.org 검증

- [JSON-LD 검증](https://validator.schema.org/)
- 구조화된 데이터 복사 → 검증

---

## 🚀 배포 전 최종 체크리스트

```bash
# 1. TypeScript 타입 검사
npx tsc --noEmit

# 2. Lint 검사
npm run lint

# 3. 메타데이터 시뮬레이션 (로컬)
npm run dev
# http://localhost:3000/p/[slug] 접속
# 페이지 소스(Ctrl+U) 확인 → <title>, <meta property="og:...">

# 4. Prisma 타입 동기화
npx prisma generate

# 5. 빌드 검증
npm run build 2>&1 | grep -i error

# 6. Git 커밋
git add -A
git commit -m "feat(metadata): Next.js 메타데이터 구현 (P0-P3)"
```

---

## 📚 참고 자료

| 항목 | URL | 용도 |
|------|-----|------|
| **Next.js Metadata API** | https://nextjs.org/docs/app/api-reference/functions/generateMetadata | 공식 문서 |
| **Open Graph** | https://ogp.me | OG 메타데이터 명세 |
| **JSON-LD** | https://json-ld.org | 구조화된 데이터 명세 |
| **Schema.org** | https://schema.org | 마이크로데이터 정의 |
| **Google SEO Starter Guide** | https://developers.google.com/search/docs/beginner/seo-starter-guide | SEO 기본 |

---

## 💡 주요 팁

### 1️⃣ 성능 최적화
```typescript
// ✅ 좋음: 캐싱 활용
export const revalidate = 3600; // 1시간마다 갱신

// ❌ 나쁨: 매 요청마다 DB 쿼리
export async function generateMetadata() {
  const data = await prisma.page.findUnique(...); // 느림
}
```

### 2️⃣ 에러 처리
```typescript
try {
  const page = await prisma.page.findUnique(...);
  if (!page) return notFound(); // 404 응답
} catch (error) {
  console.error('Metadata error:', error);
  return { title: 'Error' }; // Fallback
}
```

### 3️⃣ robots 설정
```typescript
// 공개 페이지
robots: { index: true, follow: true }

// 대시보드 (비공개)
robots: { index: false, follow: false }

// 검색 제외
robots: { noindex: true }
```

### 4️⃣ 이미지 최적화
```typescript
openGraph: {
  images: [
    {
      url: 'https://...image.jpg',
      width: 1200,  // OG 최적화: 1200x630
      height: 630,
      alt: 'Description',
      type: 'image/jpeg',
    },
  ],
}
```

---

## 🔗 관련 파일

- [메타데이터 TypeScript 타입 레퍼런스](METADATA_TYPESCRIPT_TYPES.ts)
- [메타데이터 구현 코드 예시](METADATA_IMPLEMENTATION_EXAMPLES.ts)
- [5분 Quick Start 가이드](METADATA_QUICK_START.md)

---

## 🤝 도움이 필요하신가요?

1. **로컬 테스트 문제**: `npm run dev` → 페이지 소스 확인
2. **SEO 문제**: Google Search Console → Coverage 보고서
3. **이미지 문제**: [OG 이미지 검증](https://www.opengraph.xyz/)

마지막 업데이트: 2026-06-09
