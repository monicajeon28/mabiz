# SEO 메타데이터 구현 가이드 (실전 매뉴얼)

## 🎯 목표
마비즈 CRM의 5개 주요 페이지에 **심리학 기반 SEO 메타데이터**를 정확하게 적용하여 월간 신규 파트너 50% 증대 (추정).

---

## 📋 4단계 구현 플랜

### Phase 1: 메타데이터 유틸 생성 (40분)

#### 1-1. `src/lib/seo/metadata.ts` 생성

```typescript
/**
 * SEO 메타데이터 통합 관리
 * 
 * 사용법:
 * import { getPageMetadata } from '@/lib/seo/metadata';
 * export const metadata = getPageMetadata('landing');
 */

import type { Metadata } from 'next';

export interface PageMetaConfig {
  title: string;
  description: string;
  keywords: string[];
  ogTitle: string;
  ogDescription: string;
  ogImages: Array<{
    url: string;
    width: number;
    height: number;
    alt: string;
  }>;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  canonical: string;
  noindex?: boolean;
}

// 🟢 변경 지점: 여기서만 메타 값을 수정하면 됨
const pageMetaDatabase: Record<string, PageMetaConfig> = {
  landing: {
    title: '파트너 CRM | 무료 사용, 지금 바로 시작 — 마비즈',
    description:
      '크루즈 판매 파트너의 고민을 한 번에 해결. 고객 관리, 수당 확인, 판매 도구를 통합 플랫폼에서. ' +
      '무료, 회원가입 30초, 바로 시작 가능. 1,500+ 파트너가 이미 사용 중.',
    keywords: [
      '크루즈 판매 CRM',
      '크루즈 판매 파트너',
      '파트너 관리 시스템',
      '수당 관리 플랫폼',
      '영업 자동화 도구',
      '크루즈 여행 판매',
      '파트너 소프트웨어',
      '크루즈 수당 확인',
      '여행 판매원 커뮤니티',
    ],
    ogTitle: '파트너 CRM | 무료로 고객·수당·판매도구 통합관리 — 마비즈',
    ogDescription:
      '1,500+ 크루즈 판매 파트너들이 사용하는 통합 CRM. ' +
      '고객 관리, 수당 확인, 판매 도구를 한 곳에서. 무료, 30초 가입 완료. 지금 시작하세요.',
    ogImages: [
      {
        url: 'https://mabizcruisedot.com/og-image-landing.png',
        width: 1200,
        height: 630,
        alt: '파트너 CRM 플랫폼: 고객관리·수당확인·판매도구 통합',
      },
      {
        url: 'https://mabizcruisedot.com/og-image-square.png',
        width: 1080,
        height: 1080,
        alt: '마비즈 파트너 CRM — 무료 사용, 지금 바로 시작',
      },
    ],
    twitterTitle: '파트너 CRM | 무료 사용, 고객·수당·도구 통합관리',
    twitterDescription:
      '🎯 크루즈 판매 파트너를 위한 통합 CRM\n' +
      '✅ 고객 관리 + 수당 확인 + 판매 도구\n' +
      '✅ 무료 사용, 30초 가입\n' +
      '✅ 1,500+ 파트너 이용 중',
    twitterImage: 'https://mabizcruisedot.com/og-image-twitter.png',
    canonical: 'https://mabizcruisedot.com/landing',
  },

  join: {
    title: '파트너 초대 받기 — 마비즈 크루즈닷파트너스',
    description:
      '크루즈닷 파트너 초대. 무료 가입 후 즉시 판매 시작. ' +
      '고객 관리, 수당 확인, 판매 도구를 한 곳에서 관리하세요. ' +
      '초대받은 파트너만 가능.',
    keywords: [
      '파트너 초대',
      '크루즈 판매 가입',
      '파트너 모집',
      '판매원 커뮤니티',
      '수익 창출',
    ],
    ogTitle: '파트너 초대 — 크루즈 판매로 수익 창출하기',
    ogDescription:
      '초대받은 파트너를 위한 가입 페이지. ' +
      '무료 가입, 30초 완료, 바로 판매 시작. ' +
      '마비즈 크루즈닷파트너스와 함께 하세요.',
    ogImages: [
      {
        url: 'https://mabizcruisedot.com/og-image-join.png',
        width: 1200,
        height: 630,
        alt: '파트너 가입: 무료로 크루즈 판매 시작',
      },
    ],
    twitterTitle: '파트너 가입 — 마비즈 크루즈닷파트너스',
    twitterDescription: '무료 가입, 30초 완료. 지금 크루즈 판매 시작하세요.',
    twitterImage: 'https://mabizcruisedot.com/og-image-join.png',
    canonical: 'https://mabizcruisedot.com/join',
  },

  register: {
    title: '자유 마케터 가입 — 크루즈 판매 시작하기',
    description:
      '초대 없이 누구나 자유 마케터로 가입 가능. ' +
      '크루즈 판매로 수익 창출하세요. ' +
      '무료 가입, 1분 완료, 즉시 판매 시작.',
    keywords: [
      '자유 마케터',
      '크루즈 판매원',
      '부수입',
      '온라인 판매',
      '판매 커뮤니티',
      '수익 창출 플랫폼',
      '프리랜서 기회',
    ],
    ogTitle: '자유 마케터 가입 — 크루즈 판매로 부수입 창출',
    ogDescription:
      '누구나 가능한 자유 마케터 가입. ' +
      '크루즈 판매로 수익 창출. ' +
      '무료 가입, 1분 만에 완료, 바로 시작.',
    ogImages: [
      {
        url: 'https://mabizcruisedot.com/og-image-register.png',
        width: 1200,
        height: 630,
        alt: '자유 마케터 가입 — 누구나 가능한 크루즈 판매',
      },
    ],
    twitterTitle: '자유 마케터 가입 — 크루즈 판매 시작',
    twitterDescription:
      '누구나 가능. 무료 가입, 1분 완료. 지금 시작하세요.',
    twitterImage: 'https://mabizcruisedot.com/og-image-register.png',
    canonical: 'https://mabizcruisedot.com/register/free-marketer',
  },

  dashboard: {
    title: '대시보드 — 마비즈 크루즈닷파트너스',
    description:
      '파트너 대시보드. 고객 관리, 수당 확인, 판매 도구, 계약서 관리를 한 곳에서 관리하세요.',
    keywords: [],
    ogTitle: '',
    ogDescription: '',
    ogImages: [],
    twitterTitle: '',
    twitterDescription: '',
    twitterImage: '',
    canonical: 'https://mabizcruisedot.com/dashboard',
    noindex: true,  // 🔴 로그인 페이지 — 검색 노출 X
  },

  settings: {
    title: '설정 — 마비즈 크루즈닷파트너스',
    description:
      '계정 설정, 문자 발송 설정, 계약서 관리 등을 구성하세요.',
    keywords: [],
    ogTitle: '',
    ogDescription: '',
    ogImages: [],
    twitterTitle: '',
    twitterDescription: '',
    twitterImage: '',
    canonical: 'https://mabizcruisedot.com/settings',
    noindex: true,  // 🔴 로그인 페이지 — 검색 노출 X
  },
};

/**
 * 페이지별 메타데이터 가져오기
 * @param pageKey - 페이지 키 (landing, join, register 등)
 * @returns Metadata 객체 (Next.js 호환)
 */
export function getPageMetadata(pageKey: string): Metadata {
  const config = pageMetaDatabase[pageKey];
  if (!config) {
    console.warn(`[SEO] 메타 설정이 없음: ${pageKey}`);
    return {};
  }

  return {
    title: config.title,
    description: config.description,
    keywords: config.keywords.length > 0 ? config.keywords : undefined,
    alternates: {
      canonical: config.canonical,
    },
    robots: config.noindex
      ? {
          index: false,
          follow: true,
        }
      : undefined,
    openGraph: config.ogImages.length > 0
      ? {
          title: config.ogTitle,
          description: config.ogDescription,
          url: config.canonical,
          siteName: '마비즈 크루즈닷파트너스',
          images: config.ogImages,
          locale: 'ko_KR',
          type: 'website',
        }
      : undefined,
    twitter: config.twitterImage
      ? {
          card: 'summary_large_image',
          title: config.twitterTitle,
          description: config.twitterDescription,
          images: [config.twitterImage],
        }
      : undefined,
  };
}

export { PageMetaConfig, pageMetaDatabase };
```

---

#### 1-2. `src/lib/seo/schema.ts` 생성 (JSON-LD)

```typescript
/**
 * JSON-LD 구조화 데이터 생성
 * 
 * Google 검색 결과에 Rich Snippet 표시
 * - Organization 스키마
 * - WebPage 스키마
 * - BreadcrumbList (선택사항)
 */

export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: '마비즈 크루즈닷파트너스',
    url: 'https://mabizcruisedot.com',
    logo: 'https://mabizcruisedot.com/logo.png',
    description: '크루즈 판매 파트너를 위한 통합 CRM 플랫폼',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+82-2-xxxx-xxxx',
      contactType: 'Customer Service',
    },
    sameAs: [
      'https://www.facebook.com/mabizcruisedot',
      'https://www.instagram.com/mabizcruisedot',
      'https://www.youtube.com/@mabizcruisedot',
    ],
  };
}

export function generateWebPageSchema(
  pageTitle: string,
  pageDescription: string,
  pageUrl: string,
  imageUrl?: string
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: pageTitle,
    description: pageDescription,
    url: pageUrl,
    image: imageUrl || 'https://mabizcruisedot.com/og-image.png',
    publisher: {
      '@type': 'Organization',
      name: '마비즈 크루즈닷파트너스',
      logo: {
        '@type': 'ImageObject',
        url: 'https://mabizcruisedot.com/logo.png',
      },
    },
    datePublished: new Date().toISOString(),
  };
}

export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
```

---

### Phase 2: Layout 파일 수정 (2시간)

#### 2-1. Landing 페이지 메타 업데이트

**파일**: `src/app/landing/layout.tsx`

**변경 전**:
```typescript
export const metadata: Metadata = {
  title: '마비즈 크루즈닷파트너스 — 파트너 CRM',
  description: '크루즈닷 파트너 전용 CRM. 고객관리, 수당확인, 영업도구를 한 곳에서. 즉시 가능, 무료 사용.',
  keywords: [...],
  // ... 기존 설정
};
```

**변경 후**:
```typescript
import { getPageMetadata, pageMetaDatabase } from '@/lib/seo/metadata';

export const metadata = getPageMetadata('landing');

// Landing 페이지는 정적이므로, 추가로 JSON-LD 주입:
const landingMeta = pageMetaDatabase['landing'];
const webPageSchema = generateWebPageSchema(
  landingMeta.title,
  landingMeta.description,
  landingMeta.canonical,
  landingMeta.ogImages[0]?.url
);
// ... <script> 태그에서 JSON-LD 주입
```

---

#### 2-2. Join 페이지 Layout 신규 생성

**파일**: `src/app/join/[token]/layout.tsx` (신규)

```typescript
import type { Metadata, ReactNode } from 'next';
import { getPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = getPageMetadata('join');

interface JoinLayoutProps {
  readonly children: ReactNode;
}

export default function JoinLayout({ children }: JoinLayoutProps) {
  return <>{children}</>;
}
```

---

#### 2-3. Register 페이지 Layout 신규 생성

**파일**: `src/app/register/layout.tsx` (신규)

```typescript
import type { Metadata, ReactNode } from 'next';
import { getPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = getPageMetadata('register');

interface RegisterLayoutProps {
  readonly children: ReactNode;
}

export default function RegisterLayout({ children }: RegisterLayoutProps) {
  return <>{children}</>;
}
```

---

#### 2-4. Dashboard Layout 메타 추가

**파일**: `src/app/(dashboard)/layout.tsx`

**변경**:
```typescript
import { getPageMetadata } from '@/lib/seo/metadata';

export const metadata = getPageMetadata('dashboard');
// ✅ robots: index: false 자동 적용됨 (noindex 페이지)
```

---

#### 2-5. Settings Layout 메타 추가

**파일**: `src/app/(dashboard)/settings/layout.tsx` (신규)

```typescript
import type { Metadata, ReactNode } from 'next';
import { getPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = getPageMetadata('settings');

interface SettingsLayoutProps {
  readonly children: ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return <>{children}</>;
}
```

---

### Phase 3: OG 이미지 제작

#### 3-1. 이미지 파일 목록

| 파일명 | 크기 | 사용처 | 배경 |
|--------|------|--------|------|
| `og-image-landing.png` | 1200×630 | Facebook, LinkedIn, Twitter | 마비즈 브랜드 색 + 대시보드 스크린 |
| `og-image-square.png` | 1080×1080 | Instagram, Pinterest | 4개 영역 분할 (고객/수당/도구/커뮤니티) |
| `og-image-join.png` | 1200×630 | 초대 링크 공유 | "초대받으셨습니다" 메시지 + 브랜드 색 |
| `og-image-register.png` | 1200×630 | 가입 페이지 공유 | "누구나 가능한 크루즈 판매" 메시지 |
| `og-image-twitter.png` | 1200×630 | Twitter 전용 (16:9) | Landing 이미지와 동일 또는 변형 |

#### 3-2. 이미지 제작 기준

**1200×630px (Facebook/LinkedIn)**:
- 텍스트 상단 마진: 80px
- 텍스트 하단 마진: 100px
- 폰트: Noto Sans KR Bold (48px)
- 색상: 마비즈 메인 색 (예: #2563eb)

**1080×1080px (Instagram)**:
- 4개 영역: 각 270×270px
- 각 영역에 아이콘 + 라벨
- 하단 배너: "마비즈 | 무료 시작" (20% 높이)

---

### Phase 4: 검증 (1시간)

#### 4-1. TypeScript 검증

```bash
npx tsc --noEmit
```

**예상 결과**: ✅ 0 에러

---

#### 4-2. Lighthouse SEO 점수

```bash
npm run build
npx lighthouse https://mabizcruisedot.com/landing --view
```

**목표**: 📊 SEO 점수 80점 이상
- Title/Description: ✅
- Meta tags: ✅
- Robots: ✅
- Canonical: ✅

---

#### 4-3. Facebook Sharing Debugger

[https://developers.facebook.com/tools/debug/](https://developers.facebook.com/tools/debug/)

**입력**: `https://mabizcruisedot.com/landing`

**확인사항**:
- [ ] OG Title 표시
- [ ] OG Description 표시
- [ ] OG Image 표시 (1200×630)

---

#### 4-4. Google Search Console

[https://search.google.com/search-console](https://search.google.com/search-console)

**작업**:
1. Sitemap 제출 → `https://mabizcruisedot.com/sitemap.xml`
2. URL 검사 → `/landing` 페이지 검색
3. 메타데이터 확인

---

## 💾 커밋 명령어

```bash
# Phase 1-2 완료 후
git add src/lib/seo/metadata.ts src/lib/seo/schema.ts
git add src/app/landing/layout.tsx
git add src/app/join/[token]/layout.tsx
git add src/app/register/layout.tsx
git add src/app/(dashboard)/layout.tsx
git add src/app/(dashboard)/settings/layout.tsx

# Phase 3 완료 후
git add public/og-image-*.png

# Phase 4 완료 후 (검증 완료)
git commit -m "feat(seo): 5개 페이지 메타데이터 + 심리학 렌즈 통합

- Landing: PASONA 6단계 + 사회증명 (1,500+ 파트너)
- Join: 초대 의도 + 긴박감 (30초)
- Register: 자유 마케터 + 부수입 키워드
- Dashboard/Settings: robots noindex (로그인 페이지)
- OG 이미지 4종 추가 (1200x630, 1080x1080)
- JSON-LD 스키마 자동 생성

예상 효과: 신규 파트너 +50%, 클릭율 +25%"
```

---

## 📊 효과 측정 (배포 후 추적)

### 1주일
- [ ] Google Search Console 크롤링 상태 확인
- [ ] 인덱싱된 페이지 확인

### 1개월
- [ ] 검색 분석 데이터 수집 (노출, 클릭, CTR, 순위)
- [ ] 각 페이지별 CTR 비교 (Before vs After)

### 3개월
- [ ] 신규 파트너 유입 수 확인
- [ ] 각 채널별 전환율 분석
- [ ] SEO 키워드 순위 상승 확인

---

## 🎯 심리학 검증 체크리스트

**각 페이지마다 확인**:

### Landing
- [ ] L0 (무료): Title + Description에 "무료" 2회 이상
- [ ] L3 (긴박감): "지금", "30초", "바로" 포함
- [ ] L5 (신뢰): 사회증명 수치 (1,500+) 포함
- [ ] L6 (타이밍): "즉시 가능" 표현
- [ ] L10 (행동): "지금 시작" CTA

### Join
- [ ] L3 (긴박감): "30초", "즉시" 포함
- [ ] L5 (신뢰): "초대받은" 표현으로 특수성 강조
- [ ] L10 (행동): "가입" 명령조

### Register
- [ ] L0 (무료): "무료 가입" 명확
- [ ] L3 (긴박감): "1분", "즉시" 포함
- [ ] 포용성: "누구나" 표현
- [ ] L10 (행동): "시작" 명령조

---

## 🚨 주의사항

### ❌ 금지 사항
1. 메타 태그에 거짓 정보 기재 (Google 패널티)
2. Keyword stuffing (키워드 반복 > 10회)
3. robots 설정 후 테스트 없이 배포

### ✅ 필수 확인
1. 모든 OG 이미지는 public/ 폴더에 배치
2. Canonical URL은 프로토콜 포함 (https://)
3. 로그인 페이지는 반드시 robots: index: false
4. JSON-LD는 <script> 태그에서 dangerouslySetInnerHTML 사용

---

## 📞 문제 해결

### Q: OG 이미지가 Facebook에 표시되지 않음
**A**: 1. 이미지 파일 존재 확인 2. CDN/캐시 초기화 3. Facebook Debugger에서 "Scrape Again"

### Q: 메타 태그가 Google에 보이지 않음
**A**: 1. robots: index 확인 2. Sitemap 제출 확인 3. 크롤링 요청 (Search Console)

### Q: TypeScript 타입 에러
**A**: `src/lib/seo/metadata.ts`에서 `PageMetaConfig` 인터페이스 확인

---

**마지막 업데이트**: 2026-06-09
**버전**: 1.0
**다음 단계**: Phase 1부터 순차 실행
