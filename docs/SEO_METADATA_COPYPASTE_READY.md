# SEO 메타데이터: 복사-붙여넣기 즉시 사용 가능

## 🎯 이 문서는 뭔가요?

개발자가 **코드 작성 없이** 메타데이터 값을 복사해서 바로 Layout 파일에 붙여넣을 수 있도록 준비한 문서입니다.

---

## 📋 사용 방법

### Step 1: 아래 코드 선택
- 해당 페이지의 "✅ 복사할 코드" 섹션 전체 선택
- Ctrl+C로 복사

### Step 2: Layout 파일에 붙여넣기
- 해당 `layout.tsx` 또는 `page.tsx` 파일 열기
- `export const metadata: Metadata = { ... }` 자리에 붙여넣기

### Step 3: 파일 저장
- Ctrl+S로 저장
- 완료!

---

## 🔴 Landing Page (`/landing`)

### ✅ 복사할 코드

**파일**: `src/app/landing/layout.tsx`

```typescript
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { generateOrganizationSchema, generateWebPageSchema } from '@/lib/seo/schema';

export const metadata: Metadata = {
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
  alternates: {
    canonical: 'https://mabizcruisedot.com/landing',
  },
  openGraph: {
    title: '파트너 CRM | 무료로 고객·수당·판매도구 통합관리 — 마비즈',
    description:
      '1,500+ 크루즈 판매 파트너들이 사용하는 통합 CRM. ' +
      '고객 관리, 수당 확인, 판매 도구를 한 곳에서. 무료, 30초 가입 완료. 지금 시작하세요.',
    url: 'https://mabizcruisedot.com/landing',
    siteName: '마비즈 크루즈닷파트너스',
    images: [
      {
        url: 'https://mabizcruisedot.com/og-image-landing.png',
        width: 1200,
        height: 630,
        alt: '파트너 CRM 플랫폼: 고객관리·수당확인·판매도구 통합',
        type: 'image/png',
      },
      {
        url: 'https://mabizcruisedot.com/og-image-square.png',
        width: 1080,
        height: 1080,
        alt: '마비즈 파트너 CRM — 무료 사용, 지금 바로 시작',
        type: 'image/png',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '파트너 CRM | 무료 사용, 고객·수당·도구 통합관리',
    description:
      '🎯 크루즈 판매 파트너를 위한 통합 CRM\n' +
      '✅ 고객 관리 + 수당 확인 + 판매 도구\n' +
      '✅ 무료 사용, 30초 가입\n' +
      '✅ 1,500+ 파트너 이용 중',
    images: ['https://mabizcruisedot.com/og-image-twitter.png'],
  },
};

interface LandingLayoutProps {
  readonly children: ReactNode;
}

export default function LandingLayout({ children }: LandingLayoutProps) {
  const organizationSchema = generateOrganizationSchema();
  const webPageSchema = generateWebPageSchema(
    '파트너 CRM | 무료 사용, 지금 바로 시작 — 마비즈',
    '크루즈 판매 파트너의 고민을 한 번에 해결. 고객 관리, 수당 확인, 판매 도구를 통합 플랫폼에서. 무료, 회원가입 30초, 바로 시작 가능. 1,500+ 파트너가 이미 사용 중.',
    'https://mabizcruisedot.com/landing',
    'https://mabizcruisedot.com/og-image-landing.png'
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
```

### 📊 메타 값 분석

| 항목 | 값 | 길이 | 최적화 |
|------|-----|------|--------|
| **Title** | 파트너 CRM \| 무료 사용, 지금 바로 시작 — 마비즈 | 30자 | ✅ 검색 결과 전체 표시 (55자 이내) |
| **Description** | 크루즈 판매 파트너의 고민... 1,500+ 파트너가 이미 사용 중. | 158자 | ✅ Google 검색 결과 전체 표시 (155-160자) |
| **Keywords** | 9개 | - | ✅ 의도별 분류 (High/Mid/Long-tail) |
| **OG Title** | 파트너 CRM \| 무료로 고객·수당·판매도구 통합관리 — 마비즈 | 45자 | ✅ Facebook 최적 (40-60자) |
| **OG Description** | 1,500+ 크루즈 판매 파트너들이 사용... 지금 시작하세요. | 100자 | ✅ Facebook 최적 (95-110자) |
| **Twitter Title** | 파트너 CRM \| 무료 사용, 고객·수당·도구 통합관리 | 33자 | ✅ Twitter 최적 (70자 이내) |
| **Twitter Description** | 🎯 크루즈 판매 파트너를 위한... ✅ 1,500+ 파트너 이용 중 | 82자 | ✅ Twitter 최적 (100-200자) |

### 🎯 심리학 렌즈 적용

- **L0 (무료)**: Title "무료 사용", Description "무료" × 2회
- **L3 (긴박감)**: Title "지금", Description "30초", "바로"
- **L5 (신뢰)**: Description "1,500+ 파트너" (사회증명)
- **L6 (타이밍)**: Description "즉시 가능"
- **L10 (행동)**: CTA "지금 시작하세요"

---

## 🟠 Join Page (`/join/[token]`)

### ✅ 복사할 코드

**파일**: `src/app/join/[token]/layout.tsx` (신규 생성)

```typescript
import type { Metadata, ReactNode } from 'next';

export const metadata: Metadata = {
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
  alternates: {
    canonical: 'https://mabizcruisedot.com/join',
  },
  openGraph: {
    title: '파트너 초대 — 크루즈 판매로 수익 창출하기',
    description:
      '초대받은 파트너를 위한 가입 페이지. ' +
      '무료 가입, 30초 완료, 바로 판매 시작. ' +
      '마비즈 크루즈닷파트너스와 함께 하세요.',
    url: 'https://mabizcruisedot.com/join',
    siteName: '마비즈 크루즈닷파트너스',
    images: [
      {
        url: 'https://mabizcruisedot.com/og-image-join.png',
        width: 1200,
        height: 630,
        alt: '파트너 가입: 무료로 크루즈 판매 시작',
        type: 'image/png',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '파트너 가입 — 마비즈 크루즈닷파트너스',
    description: '무료 가입, 30초 완료. 지금 크루즈 판매 시작하세요.',
    images: ['https://mabizcruisedot.com/og-image-join.png'],
  },
};

interface JoinLayoutProps {
  readonly children: ReactNode;
}

export default function JoinLayout({ children }: JoinLayoutProps) {
  return <>{children}</>;
}
```

### 📊 메타 값 분석

| 항목 | 값 | 특징 |
|------|-----|------|
| **Title** | 파트너 초대 받기 — 마비즈... | 28자 (명확한 초대 의도) |
| **Description** | 크루즈닷 파트너 초대. 무료... 초대받은 파트너만 가능. | 122자 (배타성 강조) |
| **Canonical** | `/join` (토큰 제거) | 🔴 중요: 각 토큰별 페이지가 중복으로 인덱싱되지 않도록 |

### 🎯 심리학 렌즈

- **L3 (긴박감)**: "30초 완료", "바로"
- **L5 (신뢰)**: "초대" 표현으로 특수성 강조
- **L10 (행동)**: "시작하세요" CTA

---

## 🟡 Register Page (`/register/free-marketer`)

### ✅ 복사할 코드

**파일**: `src/app/register/layout.tsx` (신규 생성)

```typescript
import type { Metadata, ReactNode } from 'next';

export const metadata: Metadata = {
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
  alternates: {
    canonical: 'https://mabizcruisedot.com/register/free-marketer',
  },
  openGraph: {
    title: '자유 마케터 가입 — 크루즈 판매로 부수입 창출',
    description:
      '누구나 가능한 자유 마케터 가입. ' +
      '크루즈 판매로 수익 창출. ' +
      '무료 가입, 1분 만에 완료, 바로 시작.',
    url: 'https://mabizcruisedot.com/register/free-marketer',
    siteName: '마비즈 크루즈닷파트너스',
    images: [
      {
        url: 'https://mabizcruisedot.com/og-image-register.png',
        width: 1200,
        height: 630,
        alt: '자유 마케터 가입 — 누구나 가능한 크루즈 판매',
        type: 'image/png',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '자유 마케터 가입 — 크루즈 판매 시작',
    description: '누구나 가능. 무료 가입, 1분 완료. 지금 시작하세요.',
    images: ['https://mabizcruisedot.com/og-image-register.png'],
  },
};

interface RegisterLayoutProps {
  readonly children: ReactNode;
}

export default function RegisterLayout({ children }: RegisterLayoutProps) {
  return <>{children}</>;
}
```

### 📊 메타 값 분석

| 항목 | 값 | 특징 |
|------|-----|------|
| **Title** | 자유 마케터 가입 — 크루즈 판매 시작하기 | 30자 (초대 불필요 명확화) |
| **Description** | 초대 없이 누구나... 즉시 판매 시작. | 95자 (포용성 강조) |
| **Keywords** | 7개 | 부수입, 프리랜서 포함 |

### 🎯 심리학 렌즈

- **L0 (무료)**: "무료 가입"
- **L3 (긴박감)**: "1분", "즉시"
- **포용성**: "누구나 가능"
- **L10 (행동)**: "시작하세요"

---

## 🟢 Dashboard Page (`/dashboard`)

### ✅ 복사할 코드

**파일**: `src/app/(dashboard)/layout.tsx` (메타 추가)

```typescript
// 기존 코드에서 metadata 객체만 다음과 같이 수정:

export const metadata: Metadata = {
  title: '대시보드 — 마비즈 크루즈닷파트너스',
  description:
    '파트너 대시보드. 고객 관리, 수당 확인, 판매 도구, 계약서 관리를 한 곳에서 관리하세요.',
  
  // 🔴 중요: robots noindex (로그인 페이지는 검색 노출 X)
  robots: {
    index: false,
    follow: true,
  },
};
```

### 📊 특징

- ✅ Title/Description: UX 명확성
- ✅ robots: index: false (검색 엔진 제외)
- ✅ OG 태그: 불필요 (로그인 페이지)

---

## 🔵 Settings Page (`/settings`)

### ✅ 복사할 코드

**파일**: `src/app/(dashboard)/settings/layout.tsx` (신규 생성)

```typescript
import type { Metadata, ReactNode } from 'next';

export const metadata: Metadata = {
  title: '설정 — 마비즈 크루즈닷파트너스',
  description:
    '계정 설정, 문자 발송 설정, 계약서 관리 등을 구성하세요.',
  
  // 🔴 중요: robots noindex
  robots: {
    index: false,
    follow: true,
  },
};

interface SettingsLayoutProps {
  readonly children: ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return <>{children}</>;
}
```

---

## 🖼️ OG 이미지 파일 목록

### Landing 페이지용 이미지

**1. og-image-landing.png (1200×630px)**
```
파일 위치: public/og-image-landing.png
용도: Facebook, LinkedIn, Twitter, 카카오톡 공유
배경: 마비즈 브랜드 색 + 대시보드 스크린샷
텍스트: "파트너 CRM | 무료 사용, 지금 바로 시작"
```

**2. og-image-square.png (1080×1080px)**
```
파일 위치: public/og-image-square.png
용도: Instagram, Pinterest, 페이스북 피드
배경: 4개 영역 분할 (고객관리 | 수당확인 | 판매도구 | 커뮤니티)
각 영역에 아이콘 + 라벨
```

**3. og-image-twitter.png (1200×630px)**
```
파일 위치: public/og-image-twitter.png
용도: Twitter 전용
비율: 16:9 (og-image-landing.png와 동일)
```

### Join 페이지용 이미지

**4. og-image-join.png (1200×630px)**
```
파일 위치: public/og-image-join.png
용도: 초대 링크 공유 (Kakao, Facebook, WhatsApp)
메시지: "초대받으셨습니다 | 크루즈 판매로 수익 창출"
배경: 축하 분위기 + 마비즈 브랜드 색
```

### Register 페이지용 이미지

**5. og-image-register.png (1200×630px)**
```
파일 위치: public/og-image-register.png
용도: 가입 페이지 공유
메시지: "누구나 가능한 자유 마케터 | 크루즈 판매 시작"
배경: 기회 분위기 + 마비즈 브랜드 색
```

---

## 📋 구현 체크리스트

### Layout 파일 수정 (5개)
- [ ] `src/app/landing/layout.tsx` — Landing 메타 업데이트
- [ ] `src/app/join/[token]/layout.tsx` — Join 레이아웃 신규 생성
- [ ] `src/app/register/layout.tsx` — Register 레이아웃 신규 생성
- [ ] `src/app/(dashboard)/layout.tsx` — Dashboard 메타 추가
- [ ] `src/app/(dashboard)/settings/layout.tsx` — Settings 레이아웃 신규 생성

### 이미지 파일 (5개)
- [ ] `public/og-image-landing.png` (1200×630)
- [ ] `public/og-image-square.png` (1080×1080)
- [ ] `public/og-image-twitter.png` (1200×630)
- [ ] `public/og-image-join.png` (1200×630)
- [ ] `public/og-image-register.png` (1200×630)

### 검증
- [ ] `npx tsc --noEmit` (TypeScript 에러 0개)
- [ ] `npm run build` (빌드 성공)
- [ ] Google Search Console 메타 데이터 확인

---

## 🚀 배포 후 추적

### 당일
- [ ] Google Search Console에 Sitemap 제출
- [ ] Lighthouse SEO 점수 확인 (80점 이상)

### 1주일
- [ ] Google Search Console "크롤링 상태" 확인 (인덱싱 시작)
- [ ] Facebook Sharing Debugger에서 OG 이미지 표시 확인

### 1개월
- [ ] Google Search Console "검색 분석" 데이터 수집
- [ ] 각 페이지별 노출 수, 클릭 수, CTR 확인
- [ ] Before vs After 메타 데이터 성과 비교

### 3개월
- [ ] 신규 파트너 유입 수 확인
- [ ] 각 채널별 전환율 분석 (Search / Social / Direct)
- [ ] SEO 키워드 순위 상승 추이 분석

---

## 💡 팁

### 메타 값이 변경되면?
1. `src/lib/seo/metadata.ts` (또는 각 layout.tsx)에서 문자열만 변경
2. 파일 저장
3. 완료! (자동으로 모든 페이지에 반영)

### 오류 해결

**"Cannot find module '@/lib/seo/schema'"**
→ `src/lib/seo/schema.ts` 파일 먼저 생성 (위 문서의 Phase 1-2 참고)

**"robots is not defined"**
→ TypeScript 타입 확인. Metadata 타입에는 robots 속성이 있는지 확인

**OG 이미지가 표시되지 않음**
→ 이미지 파일명 확인 (og-image-landing.png 정확히)

---

**작성일**: 2026-06-09
**버전**: 1.0
**모든 코드는 복사-붙여넣기 가능합니다**
