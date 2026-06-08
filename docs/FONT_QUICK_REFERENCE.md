# 폰트 설정 빠른 참조 (5분 시작)

## 🚀 3가지만 기억하세요

### 1️⃣ Typography 컴포넌트 임포트

```tsx
import {
  Heading,
  Body,
  Caption,
  Label,
  Number,
} from "@/components/Typography";
```

### 2️⃣ 컴포넌트 사용

```tsx
// 제목
<Heading level="h1">페이지 제목</Heading>
<Heading level="h2">섹션 제목</Heading>

// 본문
<Body>기본 본문입니다.</Body>
<Body size="sm">작은 본문입니다.</Body>

// 작은 텍스트
<Caption>보조 정보</Caption>

// 라벨
<Label htmlFor="email" required>이메일</Label>

// 숫자 (통화 포맷)
<Number value={1234.56} format="currency" locale="ko-KR" />
// 결과: ₩1,234.56
```

### 3️⃣ Tailwind 클래스 (선택사항)

```tsx
// 컴포넌트 없이 직접 사용
<h1 className="text-4xl font-bold">제목</h1>
<p className="text-base leading-relaxed">본문</p>
<span className="text-xs text-muted-foreground">캡션</span>
```

---

## 📏 크기 가이드

| 용도 | 컴포넌트 | 크기 | 예시 |
|------|---------|------|------|
| **메인 제목** | `<Heading level="h1">` | 36px | 페이지 제목 |
| **섹션 제목** | `<Heading level="h2">` | 30px | "고객 관리" |
| **소제목** | `<Heading level="h3">` | 24px | "2026년 상반기" |
| **기본 본문** | `<Body>` | 16px | ✅ 권장 크기 |
| **작은 본문** | `<Body size="sm">` | 14px | 설명 텍스트 |
| **캡션** | `<Caption>` | 12px | "최종 수정: 2026-06-09" |

---

## 💡 자주 사용하는 패턴

### 헤더 + 본문 조합

```tsx
<section className="space-y-4">
  <Heading level="h1">제목</Heading>
  <Body>설명 문단입니다.</Body>
</section>
```

### 통계 박스

```tsx
<Stat
  label="총 매출"
  value={1234567}
  format="currency"
  unit="원"
  change={12.5}
/>
```

### 폼 입력

```tsx
<div className="space-y-2">
  <Label htmlFor="name" required>이름</Label>
  <input id="name" type="text" />
</div>
```

### 강조 텍스트

```tsx
<Body>
  이것은 <Highlight color="gold">중요한</Highlight> 부분입니다.
</Body>
```

---

## 🎨 색상 강조

```tsx
// 노란색 (기본)
<Highlight>중요</Highlight>

// 다른 색상
<Highlight color="blue">정보</Highlight>
<Highlight color="green">성공</Highlight>
<Highlight color="red">오류</Highlight>
<Highlight color="gold">황금</Highlight>

// 굵게
<Highlight bold>매우 중요</Highlight>
```

---

## 🔢 숫자 포맷

```tsx
// 기본
<Number value={1234.56} />
// → 1,234.56

// 통화 (한국)
<Number value={50000} format="currency" locale="ko-KR" />
// → ₩50,000

// 통화 (미국)
<Number value={1234.56} format="currency" locale="en-US" />
// → $1,234.56

// 백분율
<Number value={0.95} format="percent" />
// → 95.0%

// 접미사
<Number value={95} suffix="%" />
// → 95%
```

---

## ✅ TypeScript 타입

```typescript
// level은 반드시 "h1" ~ "h6" 중 하나
<Heading level="h1">OK</Heading>
<Heading level="h7">❌ Error</Heading>

// size는 "base" | "sm" | "xs" | "lg" 중 하나
<Body size="base">OK</Body>
<Body size="xl">❌ Error</Body>

// format은 "default" | "currency" | "percent"
<Number format="currency">OK</Number>
<Number format="money">❌ Error</Number>
```

---

## 🛠️ 문제 해결

### 폰트가 안 보임
- `src/app/layout.tsx`에서 `notoSansKR` 임포트 확인
- DevTools Network 탭에서 fonts.gstatic.com 확인

### 타입 오류
- 타입 정의는 `src/lib/fonts.ts`에 있음
- IDE에서 자동 완성으로 올바른 값 확인

### 캡션이 너무 작음
- `<Caption>` 대신 `<Body size="sm">` 사용 권장

---

## 📚 자세한 내용

더 자세한 설정은 **`FONT_SETUP_GUIDE.md`** 참고

---

**핵심:** 컴포넌트 사용 → 자동으로 올바른 폰트 + 크기 + 색상 적용 ✨
