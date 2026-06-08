# Next.js 메타데이터 구현 최종 요약 (2026-06-09)

## 📊 마비즈 CRM 현황

### ✅ 구현 완료 (3가지)

| 항목 | 파일 | 상태 | 설명 |
|------|------|------|------|
| Root Metadata | `src/app/layout.tsx` | ✅ 완벽 | title, description, og:image, robots 모두 구현 |
| robots.txt | `src/app/robots.ts` | ✅ 완벽 | Allow /p/, Disallow / (공개 페이지만 색인) |
| sitemap.xml | `src/app/sitemap.ts` | ✅ 완벽 | 1000+ 동적 페이지 자동 생성 |

### ⚠️ 미구현 (4가지, 우선순위 순)

| Priority | 항목 | 영향도 | 예상시간 | 설명 |
|----------|------|--------|---------|------|
| **P0** | Dashboard Layout | 🔴 높음 | 1시간 | robots: index=false 추가 필요 |
| **P1** | 동적 페이지 메타 | 🟡 중간 | 2-3시간 | contacts/[id], p/[slug] 등 |
| **P2** | JSON-LD 스키마 | 🟡 중간 | 1-2시간 | Organization, Article, BreadcrumbList |
| **P3** | 동적 OG 이미지 | 🟢 낮음 | 2시간 | ImageResponse로 동적 생성 |

---

## 🎯 3가지 핵심 패턴

### 패턴 1: Static Metadata (고정)
```typescript
export const metadata = {
  title: '페이지 제목',
  description: '설명',
  robots: { index: false }, // 대시보드는 색인 제외
};
```

**사용처**: 대시보드, 설정, 고정 콘텐츠

---

### 패턴 2: Dynamic Metadata with params (동적)
```typescript
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const page = await db.findUnique({ where: { slug } });
  
  return {
    title: page.title,
    openGraph: { ... }
  };
}
```

**사용처**: 공개 랜딩페이지 (/p/[slug]), 숏링크, 계약서

---

### 패턴 3: Dynamic Metadata with searchParams (검색)
```typescript
export async function generateMetadata({ searchParams }: Props) {
  const { q } = await searchParams;
  const title = q ? `검색: "${q}"` : '기본 제목';
  
  return {
    title,
    robots: { index: false }, // 동적 쿼리는 색인 제외
  };
}
```

**사용처**: 검색결과, 필터 페이지

---

## 📋 체크리스트 (Stage별)

### Stage 1: 필수 기본 (1시간)
- [ ] `src/app/(dashboard)/layout.tsx`에 robots: index=false 추가
- [ ] `src/app/(dashboard)/contacts/page.tsx` 정적 메타 추가
- [ ] `src/app/(dashboard)/admin/page.tsx` 정적 메타 추가
- [ ] 타입 검사: `npx tsc --noEmit`

### Stage 2: 동적 페이지 (2-3시간)
- [ ] `src/app/p/[slug]/page.tsx` 동적 메타 (generateMetadata)
- [ ] `src/app/l/[code]/page.tsx` 숏링크 메타
- [ ] `src/app/(dashboard)/contacts/[id]/page.tsx` 고객 상세 메타
- [ ] 테스트: 로컬 dev, Facebook 검증

### Stage 3: 고급 (1-2시간)
- [ ] JSON-LD Organization (layout.tsx)
- [ ] JSON-LD Article (p/[slug]/page.tsx)
- [ ] JSON-LD BreadcrumbList (contacts/[id]/page.tsx)

### Stage 4: 선택사항 (2시간)
- [ ] `src/app/og.tsx` 기본 OG 이미지
- [ ] `src/app/p/[slug]/opengraph-image.tsx` 동적 생성

---

## 🧪 검증 방법 (필수)

### 1️⃣ 로컬 (가장 빠름)
```bash
npm run dev
# http://localhost:3000/page 접속
# 페이지 소스 (Ctrl+U) → <title>, <meta property="og:..."> 확인
```

### 2️⃣ Facebook OG (가장 정확)
[Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/sharing/)
- URL 입력 → 미리보기 확인

### 3️⃣ Twitter Card
[Twitter Card Validator](https://cards-dev.twitter.com/validator)
- URL 입력 → 미리보기 확인

### 4️⃣ Google Search Console
- 색인: `site:mabizcruisedot.com`
- 몇 주 후 색인 수 확인

### 5️⃣ Schema.org Validator
[JSON-LD 검증](https://validator.schema.org/)

---

## 💡 10가지 핵심 원칙

### 1️⃣ Title 길이
- **최적**: 50-60자
- ❌ 너무 김 (65자+): 검색 결과에서 잘림
- ❌ 너무 짧음 (30자 이하): SEO 약함

### 2️⃣ Description 길이
- **최적**: 150-160자
- ❌ 너무 김 (165자+): 잘림
- ❌ 너무 짧음 (120자 이하): 정보 부족

### 3️⃣ OG 이미지 크기
- **필수**: 1200 × 630 픽셀
- 형식: JPG 또는 PNG
- ❌ 1200x630 이외: 왜곡됨

### 4️⃣ robots 설정
```typescript
// 공개 페이지
robots: { index: true, follow: true }

// 대시보드 (비공개)
robots: { index: false, follow: false, noindex: true }

// 검색 제외
robots: { index: false, noindex: true }
```

### 5️⃣ Canonical URL
```typescript
alternates: {
  canonical: 'https://absolute-url.com/page'
}
```
- 중복 콘텐츠 방지
- 절대 경로 필수 (상대경로 금지)

### 6️⃣ 캐싱 전략
```typescript
export const revalidate = 3600; // 1시간마다 갱신
export const dynamic = 'auto'; // 자동 최적화
```

### 7️⃣ 에러 처리
```typescript
try {
  const data = await db.findUnique();
  if (!data) return notFound(); // 404
  return { title: data.title };
} catch (error) {
  return { title: 'Error' }; // Fallback
}
```

### 8️⃣ 성능 최적화
- ✅ 캐싱 활용 (DB 쿼리 최소화)
- ✅ `take: 100` (Vercel Free: 최대 100개 정적)
- ✅ 이미지 CDN 호스팅 (로컬 서빙 금지)

### 9️⃣ 보안
- ✅ 민감 정보 제외 (비밀번호, API 키)
- ✅ 공개 페이지만 index: true
- ✅ 인증 필요 페이지는 index: false

### 🔟 모니터링
- 주간: Google Search Console 체크
- 월간: 색인 수, CTR, 트래픽 분석
- 분기: SEO 순위 추적

---

## 🚀 배포 전 Final Checklist

```bash
# 1. TypeScript 타입 검사
npx tsc --noEmit
# 결과: 에러 0개

# 2. Lint 검사
npm run lint
# 결과: 경고 0개

# 3. 메타데이터 검증 (로컬)
npm run dev
# http://localhost:3000/p/sample-page
# 페이지 소스 → <title>, <meta> 확인

# 4. Facebook 검증
# https://developers.facebook.com/tools/debug/sharing/
# URL 입력 → OG 미리보기 확인

# 5. 빌드 테스트
npm run build
# 결과: 에러 0개

# 6. Git 커밋
git add -A
git commit -m "feat(metadata): Next.js 메타데이터 구현 (P0-P3)"
git push origin main
```

---

## 📈 예상 SEO 효과

| 지표 | 현재 | 예상 (1개월) |
|------|------|-----------|
| Google 색인 | 10-20개 | 100-500개 |
| 검색 노출 (impression) | 낮음 | 중상 |
| CTR (클릭율) | 기준선 | +15-30% |
| Organic Traffic | 0-10 | 50-200+ |
| Keyword Rankings | 없음 | 50-100개 KW |

---

## 🔗 관련 문서

- [완전 가이드](NEXTJS_METADATA_COMPLETE_GUIDE.md) — 상세 설명 + 코드
- [Quick Start](METADATA_QUICK_START.md) — 5분 요약
- [구현 예시](METADATA_IMPLEMENTATION_EXAMPLES.ts) — 10가지 코드
- [TypeScript 타입](METADATA_TYPESCRIPT_TYPES.ts) — 타입 레퍼런스

---

## ❓ 자주 하는 질문

### Q: 언제까지 구현해야 하나요?
A: 권장 일정
- **즉시 (P0)**: 1주일 내
- **우선 (P1)**: 2주일 내
- **중간 (P2)**: 1개월 내
- **선택 (P3)**: 필요시

### Q: 메타데이터가 없어도 동작하나요?
A: 네, 하지만 SEO에 큰 영향. 공개 페이지는 필수.

### Q: generateMetadata 함수 내 에러 처리?
A: `notFound()` 또는 `try-catch` 필수.

### Q: 이미지 서빙 방식?
A: 항상 CDN (https://absolute-url/image.png)

### Q: 캐싱 설정?
A: 콘텐츠별로:
- 정적 콘텐츠: `revalidate: 86400` (1일)
- 동적 콘텐츠: `revalidate: 3600` (1시간)
- 실시간: `revalidate: 60` (1분)

---

## 📞 도움이 필요하신가요?

1. **로컬 테스트**: `npm run dev` → 페이지 소스 확인
2. **OG 검증**: [OG 이미지 검증](https://www.opengraph.xyz/)
3. **SEO 추적**: Google Search Console → Coverage 보고서
4. **문제 해결**: 로컬 dev 서버에서 콘솔 에러 확인

---

**마지막 업데이트**: 2026-06-09  
**상태**: ✅ 완료 (문서 3개 생성)  
**다음 단계**: Stage 1 구현 시작
