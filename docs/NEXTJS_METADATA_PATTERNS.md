# Next.js 메타데이터 API 완전 가이드 (마비즈 CRM)

## 📋 목차
1. [현황 분석](#현황-분석)
2. [메타데이터 유형 3가지](#메타데이터-유형-3가지)
3. [구현 패턴 (TypeScript)](#구현-패턴-typescript)
4. [라우트별 적용 체크리스트](#라우트별-적용-체크리스트)
5. [성능 최적화](#성능-최적화)

---

## 현황 분석

### ✅ 구현 완료
- **Root Metadata** (`src/app/layout.tsx`): 완벽한 Open Graph + Twitter + robots 설정
- **Sitemap** (`src/app/sitemap.ts`): 동적 생성 (CRM 랜딩 페이지 500개 + 숏링크 500개)
- **폰트 최적화**: Noto Sans KR subset + display:swap + preload

### ⚠️ 미구현 항목
- 동적 메타데이터 (`generateMetadata()`) — 고객상세, 계약서, 제휴 파트너 페이지
- Layout 계층 구조 메타데이터 — 대시보드, 섹션별 title template
- JSON-LD 구조화 데이터 — SoftwareApplication + FAQPage
- robots.txt 고급 설정 — /admin, /sign-in, /api 크롤링 제외

---

## 메타데이터 유형 3가지

### 1️⃣ Static Metadata
**정의**: 빌드 시간에 정해지는 고정 내용

```typescript
export const metadata: Metadata = {
  title: "마비즈 CRM",
  description: "파트너 전용 CRM",
};
```

**사용 시기**:
- 홈페이지 (`/`)
- 로그인 (`/sign-in`)
- 약관 페이지

---

### 2️⃣ Dynamic Metadata (params 기반)
**정의**: URL 경로 매개변수에서 동적 생성

```typescript
export async function generateMetadata({
  params,
}: { params: { id: string } }): Promise<Metadata> {
  const contact = await getContact(params.id);
  return {
    title: contact.name,
    description: `${contact.phone}`,
  };
}
```

**사용 시기**:
- 고객 상세 (`/contacts/[id]`)
- 계약서 상세 (`/contracts/[id]`)
- 제휴 파트너 프로필 (`/partner/[id]`)

---

### 3️⃣ Dynamic Metadata (searchParams 기반)
**정의**: 쿼리 문자열에서 동적 생성

```typescript
export async function generateMetadata({
  searchParams,
}: { searchParams: { q?: string } }): Promise<Metadata> {
  return {
    title: `검색: ${searchParams.q || "전체"}`,
    robots: "noindex, follow", // 검색 결과는 색인 금지
  };
}
```

**사용 시기**:
- 고객 검색 (`/contacts?q=김철수`)
- 계약서 필터링 (`/contracts?status=pending`)

---

## 구현 패턴 (TypeScript)

### 패턴 1: 대시보드 레이아웃 메타데이터

**파일**: `src/app/(dashboard)/layout.tsx`

```typescript
import type { Metadata } from 'next';
import { getMabizSession } from '@/lib/auth';

export async function generateMetadata(): Promise<Metadata> {
  const session = await getMabizSession();

  return {
    title: {
      // 각 하위 페이지 제목이 "제목 | 대시보드" 형식으로 표시됨
      template: '%s | 대시보드',
      default: '마비즈 대시보드',
    },
    description: '파트너 판매현황, 고객관리, 수당 확인',
    robots: {
      index: false, // 로그인 필요 → 크롤링 금지
      follow: false,
    },
  };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ... 기존 코드
}
```

---

### 패턴 2: 고객 상세 페이지 (Dynamic Metadata)

**파일**: `src/app/(dashboard)/contacts/[id]/page.tsx`

```typescript
import type { Metadata } from 'next';
import prisma from '@/lib/prisma';

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const contact = await prisma.contact.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      type: true,
      photo: true,
      cruiseInterest: true,
      organizationId: true,
    },
  });

  if (!contact) {
    return {
      title: '고객을 찾을 수 없습니다',
      description: '요청한 고객 정보가 없습니다.',
    };
  }

  return {
    title: contact.name,
    description: `${contact.phone} • ${contact.email || '이메일 없음'} • ${
      contact.type === 'customer' ? '구매고객' : '문의고객'
    }`,
    openGraph: {
      title: contact.name,
      description: `${contact.phone}`,
      type: 'profile',
      url: `https://mabizcruisedot.com/contacts/${contact.id}`,
      images: contact.photo
        ? [{ url: contact.photo, width: 400, height: 400, alt: contact.name }]
        : [],
    },
    alternates: {
      canonical: `https://mabizcruisedot.com/contacts/${contact.id}`,
    },
  };
}

export default async function ContactPage({ params }: Props) {
  // ... 기존 코드
}
```

---

### 패턴 3: 계약서 상세 페이지 (Public Document)

**파일**: `src/app/contract/[id]/page.tsx`

```typescript
import type { Metadata } from 'next';
import prisma from '@/lib/prisma';

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const contract = await prisma.contractInstance.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      createdAt: true,
      organizationId: true,
      partner: {
        select: {
          name: true,
          logoUrl: true,
        },
      },
    },
  });

  if (!contract) {
    return {
      title: '계약서를 찾을 수 없습니다',
      description: '요청한 계약서가 없습니다.',
      robots: { index: false, follow: false },
    };
  }

  const formattedDate = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(contract.createdAt);

  return {
    title: contract.title,
    description: `${contract.partner.name} 계약서 • ${formattedDate}`,
    openGraph: {
      title: contract.title,
      description: `${contract.partner.name}과의 계약서`,
      type: 'article',
      url: `https://mabizcruisedot.com/contract/${contract.id}`,
      publishedTime: contract.createdAt.toISOString(),
      authors: [contract.partner.name],
      images: contract.partner.logoUrl
        ? [
            {
              url: contract.partner.logoUrl,
              width: 1200,
              height: 630,
              alt: contract.partner.name,
            },
          ]
        : [
            {
              url: '/og-image.png',
              width: 1200,
              height: 630,
              alt: '마비즈 CRM',
            },
          ],
    },
    alternates: {
      canonical: `https://mabizcruisedot.com/contract/${contract.id}`,
    },
  };
}

export default async function ContractPage({ params }: Props) {
  // ... 기존 코드
}
```

---

### 패턴 4: 검색 페이지 (searchParams 기반)

**파일**: `src/app/(dashboard)/contacts/page.tsx`

```typescript
import type { Metadata } from 'next';

interface Props {
  searchParams: { q?: string; type?: string; status?: string };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = searchParams.q || '전체';
  const typeLabel = {
    customer: '구매고객',
    inquiry: '문의고객',
  }[searchParams.type || ''] || '';

  const title = typeLabel 
    ? `${typeLabel} 검색: ${query}`
    : `고객 검색: ${query}`;

  return {
    title,
    description: `마비즈 CRM에서 ${query}에 대한 고객 검색 결과를 확인합니다.`,
    robots: {
      index: false, // 검색 결과는 색인하지 않음
      follow: false,
    },
    // searchParams 포함 URL은 캐시하지 않도록 설정
  };
}

export default function ContactsPage({ searchParams }: Props) {
  // ... 기존 코드
}
```

---

### 패턴 5: 제휴 파트너 프로필 (API 연동)

**파일**: `src/app/partner/[agentId]/page.tsx`

```typescript
import type { Metadata } from 'next';
import prisma from '@/lib/prisma';

interface Props {
  params: { agentId: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const partner = await prisma.user.findUnique({
    where: { id: params.agentId },
    select: {
      id: true,
      name: true,
      email: true,
      profileImageUrl: true,
      member: {
        select: {
          tier: true,
          totalCommission: true,
        },
      },
      organization: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!partner) {
    return {
      title: '파트너를 찾을 수 없습니다',
      robots: { index: false },
    };
  }

  const tierLabel = {
    bronze: '브론즈',
    silver: '실버',
    gold: '골드',
    platinum: '플래티넘',
  }[partner.member?.tier || 'bronze'] || '파트너';

  return {
    title: `${partner.name} | ${tierLabel} 파트너 | 마비즈`,
    description: `${partner.organization?.name} ${partner.name} 파트너 프로필. 수당: ${
      partner.member?.totalCommission?.toLocaleString('ko-KR') || '0'
    }원`,
    openGraph: {
      title: `${partner.name} | ${tierLabel} 파트너`,
      description: `${partner.organization?.name}의 ${tierLabel} 파트너`,
      type: 'profile',
      url: `https://mabizcruisedot.com/partner/${params.agentId}`,
      images: partner.profileImageUrl
        ? [{ url: partner.profileImageUrl, width: 400, height: 400, alt: partner.name }]
        : [],
    },
    alternates: {
      canonical: `https://mabizcruisedot.com/partner/${params.agentId}`,
    },
  };
}

export default async function PartnerProfilePage({ params }: Props) {
  // ... 기존 코드
}
```

---

### 패턴 6: 섹션별 레이아웃 (Layout Hierarchy)

**파일**: `src/app/(dashboard)/contacts/layout.tsx`

```typescript
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s | 고객관리',
    default: '고객관리',
  },
  description: '모든 고객 정보를 한 곳에서 관리합니다. 검색, 필터링, 그룹화 기능 지원.',
};

export default function ContactsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

**결과**: 
- `/contacts/all` → 제목: "고객목록 | 고객관리 | 대시보드 | 마비즈 CRM"
- `/contacts/inquiries` → 제목: "문의고객 | 고객관리 | 대시보드 | 마비즈 CRM"

---

### 패턴 7: JSON-LD 구조화 데이터

**파일**: `src/lib/json-ld.ts`

```typescript
import { Metadata } from 'next';

export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: '마비즈 크루즈닷파트너스',
    url: 'https://mabizcruisedot.com',
    logo: 'https://mabizcruisedot.com/logo.png',
    description: '크루즈 파트너 전용 CRM 플랫폼',
    sameAs: [
      'https://www.facebook.com/cruisedot',
      'https://www.instagram.com/cruisedot',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '1234-5678',
      contactType: 'Customer Support',
      email: 'support@mabizcruisedot.com',
    },
  };
}

export function generateSoftwareApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: '마비즈 크루즈닷파트너스',
    description: '크루즈 파트너 전용 CRM. 고객관리, 수당확인, 영업도구.',
    url: 'https://mabizcruisedot.com',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'KRW',
      availability: 'https://schema.org/InStock',
      description: '무료 파트너 CRM',
    },
    author: {
      '@type': 'Organization',
      name: '마비즈',
      url: 'https://mabizcruisedot.com',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '127',
    },
  };
}

export function generateContactProfileSchema(contact: {
  name: string;
  phone: string;
  email?: string;
  photo?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: contact.name,
    telephone: contact.phone,
    email: contact.email || undefined,
    image: contact.photo || undefined,
  };
}
```

**Root Layout에서 사용**:

```typescript
// src/app/layout.tsx <head> 섹션
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify(generateOrganizationSchema()),
  }}
/>
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify(generateSoftwareApplicationSchema()),
  }}
/>
```

---

### 패턴 8: 동적 OG 이미지 생성 (Next.js 14+)

**파일**: `src/app/og.tsx` (또는 동적 경로용)

```typescript
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const title = searchParams.get('title') || '마비즈 크루즈닷파트너스';
  const description = searchParams.get('desc') || '파트너 전용 CRM';

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 48,
          color: 'white',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          width: '100%',
          height: '100%',
          padding: '50px',
          textAlign: 'center',
          justifyContent: 'center',
          alignItems: 'center',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: '"Noto Sans KR"',
        }}
      >
        <div style={{ fontSize: 60, fontWeight: 'bold', marginBottom: '20px' }}>
          {title}
        </div>
        <div style={{ fontSize: 32, color: '#e0e7ff' }}>
          {description}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
```

**동적 페이지에서 사용**:

```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const contact = await getContact(params.id);

  return {
    openGraph: {
      title: contact.name,
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(contact.name)}&desc=${encodeURIComponent(
            contact.phone,
          )}`,
          width: 1200,
          height: 630,
          alt: contact.name,
        },
      ],
    },
  };
}
```

---

## 라우트별 적용 체크리스트

### ✅ 이미 구현된 라우트
- `/` (홈) — 완벽한 Static Metadata
- `/landing` — 완벽한 Static Metadata
- `/sitemap.xml` — 동적 생성
- `/robots.txt` — 기본 설정

### ⚠️ 즉시 구현 필요 (P0)
- `src/app/(dashboard)/layout.tsx` — generateMetadata() + robots:noindex 추가
- `src/app/(dashboard)/contacts/layout.tsx` — title template 추가

### ⚠️ 우선순위 높음 (P1)
- `src/app/(dashboard)/contacts/[id]/page.tsx` — Dynamic Metadata
- `src/app/contract/[id]/page.tsx` — Dynamic Metadata
- `src/app/partner/[agentId]/page.tsx` — Dynamic Metadata

### ⚠️ 우선순위 중간 (P2)
- `src/app/(dashboard)/contacts/page.tsx` — searchParams 메타데이터
- JSON-LD 구조화 데이터 추가

---

## 성능 최적화

### 1. 캐싱 전략

```typescript
export const revalidate = 3600; // 1시간마다 재검증
// 또는
export const dynamic = 'force-static'; // 정적 생성
```

### 2. 데이터 페칭 최적화

```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // 🔴 나쁜 예: 전체 객체 조회
  const contact = await prisma.contact.findUnique({
    where: { id: params.id },
  });

  // 🟢 좋은 예: 필요한 필드만 선택
  const contact = await prisma.contact.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      photo: true, // OG 이미지용
    },
  });
}
```

### 3. 폴백 처리

```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: params.id },
      select: { name: true, phone: true },
    });

    if (!contact) {
      // 404 상황 처리
      return {
        title: '고객을 찾을 수 없습니다',
        robots: { index: false },
      };
    }

    return {
      title: contact.name,
      description: contact.phone,
    };
  } catch (error) {
    // 에러 로깅
    console.error('Metadata generation failed:', error);

    // 기본값 반환
    return {
      title: '마비즈 CRM',
      description: '파트너 CRM',
    };
  }
}
```

---

## 자동화 체크리스트

배포 전 다음을 확인하세요:

- [ ] `src/app/layout.tsx` — Root metadata 검증
- [ ] `src/app/(dashboard)/layout.tsx` — robots:noindex, title template 추가
- [ ] `src/app/(dashboard)/contacts/layout.tsx` — title template 추가
- [ ] `src/app/(dashboard)/contacts/[id]/page.tsx` — generateMetadata() 구현
- [ ] `src/app/contract/[id]/page.tsx` — generateMetadata() 구현
- [ ] `src/app/partner/[agentId]/page.tsx` — generateMetadata() 구현
- [ ] `src/lib/json-ld.ts` — JSON-LD 스키마 생성 함수 작성
- [ ] Root layout `<head>`에 JSON-LD `<script>` 추가
- [ ] `public/robots.txt` — /admin, /sign-in, /api 제외 규칙 검증
- [ ] TSC 검증: `npx tsc --noEmit`

---

## 참고 자료

- [Next.js Metadata API](https://nextjs.org/docs/app/building-your-application/optimizing/metadata)
- [generateMetadata()](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Schema.org Types](https://schema.org/)
- [Open Graph Protocol](https://ogp.me/)
