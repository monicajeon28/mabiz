# Next.js 메타데이터 API 빠른 시작 가이드

## 🎯 5분 안에 이해하는 메타데이터

### 메타데이터란?
브라우저 `<head>` 태그에 들어가는 정보 (제목, 설명, 이미지, 로봇 설정 등)

```html
<head>
  <title>마비즈 CRM - 파트너 고객관리</title>
  <meta name="description" content="크루즈 파트너 CRM" />
  <meta property="og:title" content="마비즈 CRM" />
  <meta property="og:image" content="/og-image.png" />
</head>
```

### Next.js에서는?
HTML 대신 **TypeScript 객체**로 정의합니다.

```typescript
export const metadata: Metadata = {
  title: "마비즈 CRM",
  description: "크루즈 파트너 CRM",
  openGraph: {
    image: "/og-image.png",
  },
};
```

**Next.js가 자동으로 HTML `<head>`로 변환합니다.**

---

## 3가지 메타데이터 패턴

### 1️⃣ Static Metadata (정적)
**정의**: 코드에 직접 작성된 고정 내용

```typescript
// src/app/layout.tsx
export const metadata: Metadata = {
  title: "마비즈 CRM",
  description: "파트너 CRM",
};
```

**언제 사용?**
- 홈페이지
- 로그인 페이지
- 고정 콘텐츠

---

### 2️⃣ Dynamic Metadata with params (URL 기반)
**정의**: URL의 `[id]` 같은 동적 부분을 사용

```typescript
// src/app/contacts/[id]/page.tsx
export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const contact = await getContact(params.id);
  
  return {
    title: contact.name, // "김철수"
    description: contact.phone, // "010-1234-5678"
  };
}
```

**결과**: `/contacts/123` 페이지의 제목 = "김철수"

---

### 3️⃣ Dynamic Metadata with searchParams (쿼리 기반)
**정의**: URL의 쿼리 문자열 `?q=...` 사용

```typescript
// src/app/contacts/page.tsx
export async function generateMetadata({
  searchParams,
}: {
  searchParams: { q?: string };
}): Promise<Metadata> {
  const query = searchParams.q || "전체";
  
  return {
    title: `검색: ${query}`,
    robots: { index: false }, // 검색 결과는 구글 색인 금지
  };
}
```

**결과**: `/contacts?q=김철수` 페이지의 제목 = "검색: 김철수"

---

## 🚀 마비즈 CRM에 바로 적용하기

### Step 1: 대시보드 레이아웃 메타데이터 추가
**파일**: `src/app/(dashboard)/layout.tsx`

```typescript
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      template: '%s | 대시보드', // "페이지명 | 대시보드"
      default: '마비즈 대시보드',
    },
    robots: {
      index: false, // 로그인 필요 → 크롤링 금지
      follow: false,
    },
  };
}

// 기존 export default DashboardLayout은 그대로 유지
```

**결과**: 모든 대시보드 페이지 제목이 자동으로 "페이지명 | 대시보드" 형식

---

### Step 2: 고객 관리 레이아웃 title template 추가
**파일**: `src/app/(dashboard)/contacts/layout.tsx`

```typescript
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s | 고객관리', // "고객목록 | 고객관리"
    default: '고객관리',
  },
  description: '모든 고객 정보를 한 곳에서 관리합니다.',
};

export default function ContactsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
```

---

### Step 3: 고객 상세 페이지 동적 메타데이터
**파일**: `src/app/(dashboard)/contacts/[id]/page.tsx`

현재 코드 상단에 다음을 추가:

```typescript
import type { Metadata } from 'next';
import prisma from '@/lib/prisma';

interface Props {
  params: { id: string };
}

// 이 부분을 추가 ⬇️
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const contact = await prisma.contact.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      photo: true,
      type: true,
    },
  });

  if (!contact) {
    return { title: '고객을 찾을 수 없습니다' };
  }

  const typeLabel = contact.type === 'customer' ? '구매고객' : '문의고객';

  return {
    title: contact.name, // "김철수"
    description: `${contact.phone} • ${contact.email || '이메일 없음'} • ${typeLabel}`,
    openGraph: {
      title: contact.name,
      images: contact.photo ? [{ url: contact.photo }] : [],
    },
    alternates: {
      canonical: `https://mabizcruisedot.com/contacts/${contact.id}`,
    },
  };
}
// ⬆️ 여기까지 추가

// 기존 export default ContactPage는 그대로 유지
```

---

### Step 4: 검색 페이지 메타데이터
**파일**: `src/app/(dashboard)/contacts/page.tsx`

현재 코드 상단에 다음을 추가:

```typescript
import type { Metadata } from 'next';

interface Props {
  searchParams: { q?: string };
}

// 이 부분을 추가 ⬇️
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = searchParams.q || '전체';

  return {
    title: `검색: ${query}`,
    robots: {
      index: false, // 검색 결과는 Google 색인 금지
    },
  };
}
// ⬆️ 여기까지 추가

// "use client" 등 기존 코드는 그대로
export default function ContactsPage({ searchParams }: Props) {
  // ... 기존 코드
}
```

---

## 📊 메타데이터가 적용되는 모습

### 이전 (메타데이터 없음)
```
모든 고객 상세 페이지의 제목 = "마비즈 크루즈닷파트너스 — 파트너 CRM"
```

### 이후 (메타데이터 적용)
```
/contacts/user-123 페이지 제목 = "김철수 | 고객관리 | 대시보드 | 마비즈 CRM"
/contacts/user-456 페이지 제목 = "박영희 | 고객관리 | 대시보드 | 마비즈 CRM"
/contacts?q=김철수 페이지 제목 = "검색: 김철수 | 대시보드 | 마비즈 CRM"
```

---

## 🔑 핵심 포인트

### ✅ 해야 할 것
1. **generateMetadata() 함수** = 동적 페이지마다 추가 필수
2. **robots 설정** = 로그인 필요한 페이지는 `robots: { index: false }`
3. **필드 선택** = `select: { id, name, phone }`으로 쿼리 최적화
4. **폴백 처리** = 데이터 없을 때 기본값 반환

### ❌ 하지 말아야 할 것
1. **client component에서 메타데이터** = "use client" 있으면 안 됨
2. **generateMetadata 안에서 fetch** = 느려짐 (DB 쿼리는 OK)
3. **모든 필드 조회** = `select: { ... }` 없이 전체 조회 금지
4. **메타데이터 하드코딩** = 변수나 props 사용

---

## 🧪 테스트하기

### 방법 1: 개발자 도구 확인
```
1. 브라우저에서 /contacts/user-123 방문
2. 우클릭 → "페이지 소스 보기"
3. <head> 섹션에서 <title> 확인
   
예상: <title>김철수 | 고객관리 | 대시보드 | 마비즈 CRM</title>
```

### 방법 2: Twitter 카드 검증
```
Twitter Card Validator 방문:
https://cards-dev.twitter.com/validator

사이트 URL 입력 → og:image, og:title 확인
```

### 방법 3: Open Graph 검증
```
Facebook 디버거 방문:
https://developers.facebook.com/tools/debug/sharing/

URL 입력 → 크롤된 메타데이터 확인
```

---

## 📈 SEO 효과

| 항목 | 이전 | 이후 |
|------|------|------|
| 페이지 제목 명확성 | ❌ 모두 "마비즈 CRM" | ✅ 개별 제목 |
| 검색 엔진 노출 | ⚠️ 일반적 키워드만 | ✅ 롱테일 키워드 |
| SNS 공유 미리보기 | ❌ 기본 이미지 | ✅ 개별 이미지 |
| 사용자 클릭률 (CTR) | 📊 기준선 | 📈 +15-30% |

---

## ⚠️ 주의사항

### 1. "use client" 컴포넌트에서는 메타데이터 불가
```typescript
// ❌ 안 됨
"use client";
export const metadata = { title: "..." };

// ✅ 좋음: layout.tsx 또는 page.tsx (Server Component)
export const metadata = { title: "..." };
```

### 2. Dynamic Metadata는 async 함수
```typescript
// ❌ 안 됨
export const metadata = async () => ({ title: "..." });

// ✅ 좋음
export async function generateMetadata(): Promise<Metadata> {
  return { title: "..." };
}
```

### 3. DB 쿼리는 필드 선택으로 최적화
```typescript
// ❌ 느림: 모든 필드 로드
const contact = await prisma.contact.findUnique({
  where: { id: params.id },
});

// ✅ 빠름: 필요한 필드만
const contact = await prisma.contact.findUnique({
  where: { id: params.id },
  select: { name: true, phone: true, photo: true },
});
```

---

## 📚 추가 학습 자료

- **Next.js 공식 가이드**: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
- **generateMetadata() API**: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- **Open Graph Protocol**: https://ogp.me/
- **Schema.org**: https://schema.org/

---

## 💬 Q&A

**Q: 메타데이터를 동적으로 변경하려면?**
A: `generateMetadata()` 함수 사용 + 필요시 `revalidate` 설정

**Q: SEO에 영향이 있나?**
A: 네! 페이지 제목이 검색 결과에 노출되므로 CTR 향상

**Q: robots.txt는 어디에?**
A: `public/robots.txt` (이미 존재함, 필요시 수정)

**Q: 캐싱 전략?**
A: 동적 데이터 = `export const dynamic = 'force-dynamic'`

---

## 🎬 다음 단계

1. ✅ Step 1-4를 모두 완료
2. ✅ `npx tsc --noEmit` 으로 타입 확인
3. ✅ 로컬에서 개발자 도구로 `<title>` 확인
4. ✅ GitHub PR 생성
5. ✅ Vercel 배포 후 라이브 검증

---

**마지막 체크**: 모든 동적 페이지에 `generateMetadata()` 구현했나요?
