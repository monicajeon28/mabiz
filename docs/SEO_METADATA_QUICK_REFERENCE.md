# SEO 메타데이터 빠른 참조 (Quick Reference)

## 📌 최우선 5개 메타 태그

### 1. Title (50-60자)
```
패턴: [키워드] — [브랜드]

Landing:     마비즈 크루즈닷파트너스 — 파트너 CRM
Join:        파트너 가입 — 마비즈 크루즈닷파트너스
Register:    회원가입 — 마비즈 크루즈닷파트너스
Dashboard:   대시보드 — 마비즈 크루즈닷파트너스
Settings:    설정 — 마비즈 크루즈닷파트너스
```

### 2. Description (120-160자)
```
Landing:     크루즈닷 파트너 전용 CRM. 고객관리, 수당확인, 영업도구를 한 곳에서. 즉시 가능, 무료 사용.

Join:        마비즈 크루즈닷파트너스에 가입하세요. 무료 회원가입, 5분 내 시작 가능. 파트너 맞춤 기능과 수당 추적 시스템 포함.

Register:    마비즈 크루즈닷파트너스 회원가입. 이메일, 전화번호로 즉시 가입. 2단계 인증으로 안전한 계정 보호.

Dashboard:   파트너 대시보드로 고객, 수당, 영업 성과를 실시간으로 추적하세요. 매월 자동으로 수당 정산됩니다.

Settings:    계정 정보, 수당 설정, 문자 템플릿 등을 한 곳에서 관리하세요. 변경 사항은 즉시 반영됩니다.
```

### 3. Keywords (5-7개)
```
Landing:
  1. 크루즈 판매
  2. 파트너 CRM
  3. 고객관리
  4. 수당 확인
  5. 영업도구
  6. 크루즈 여행
  7. 파트너 플랫폼

Join:
  1. 파트너 가입
  2. 무료 가입
  3. 크루즈 판매 파트너
  4. 수당 설정
  5. 파트너 모집
  6. 크루즈 중개 수수료
  7. 협력 업체 모집

Register:
  1. 회원가입
  2. 무료 가입
  3. 계정 생성
  4. 이메일 가입
  5. 빠른 등록
  6. 안전한 가입
  7. 온라인 가입
```

### 4. og:image (1200x630px)
```
파일:        /og-image.png
크기:        1200×630px (비율 1.91:1)
형식:        PNG 또는 JPG
위치:        public/ 디렉토리

디자인:
┌─────────────────────────────────────┐
│ 마비즈 크루즈닷파트너스 로고         │ (상단 20%)
│                                     │
│  파트너 CRM                         │ (중간 40%)
│  무료 + 즉시 시작 가능              │
│                                     │
│  [파란색 배경 + 화이트 텍스트]       │ (하단 40%)
└─────────────────────────────────────┘

색상:
  주색: #003D99 (마비즈 파란색)
  보색: #FF6B35
  배경: #F5F5F5
  텍스트: #FFFFFF
```

### 5. Canonical URL
```
형식: <link rel="canonical" href="https://mabizcruisedot.com{페이지경로}" />

Landing:     https://mabizcruisedot.com/landing
Join:        https://mabizcruisedot.com/join
Register:    https://mabizcruisedot.com/register
Dashboard:   https://mabizcruisedot.com/dashboard
Settings:    https://mabizcruisedot.com/settings
```

---

## 🔧 Code 적용 (Next.js)

### Layout.tsx 기본 구조
```typescript
import { generateMetadata, pageMetaConfig } from '@/lib/seo/metadata';

export const metadata = generateMetadata(pageMetaConfig.landing);

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        {/* 메타 태그 자동 주입 (generateMetadata 함수가 처리) */}
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### 커스텀 페이지별 메타 (예: Join)
```typescript
import { generateMetadata, pageMetaConfig } from '@/lib/seo/metadata';

export const metadata = generateMetadata(pageMetaConfig.join);

export default function JoinPage() {
  return (
    <main>
      {/* 페이지 콘텐츠 */}
    </main>
  );
}
```

### 메타 설정 수정 위치
```
파일: src/lib/seo/metadata.ts
섹션: pageMetaConfig 객체

예:
export const pageMetaConfig: Record<string, SEOConfig> = {
  landing: {
    title: '마비즈 크루즈닷파트너스 — 파트너 CRM',
    description: '크루즈닷 파트너 전용 CRM...',
    keywords: [...],
    url: '/landing',
    image: { url: '/og-image.png', ... },
  },
  // 다른 페이지들...
};
```

---

## 📊 모니터링 (월간)

### Google Search Console
```
주소: https://search.google.com/search-console/

체크 항목:
✓ 인덱스 커버리지: 오류 0개, 유효 100%
✓ Sitemap: 제출 여부 확인 (/sitemap.xml)
✓ 리치 결과: 구조화 데이터 오류 0개
✓ 검색 분석: 월간 KPI 추적
  - 노출 (impressions): 목표 1,000+
  - 클릭 (clicks): 목표 50+
  - 평균 순위: 목표 40 이상
```

### Facebook/Instagram 공유 테스트
```
Facebook Sharing Debugger:
https://developers.facebook.com/tools/debug/sharing/

테스트 방법:
1. URL 입력: https://mabizcruisedot.com/landing
2. "디버그" 클릭
3. 확인 사항:
   ✓ og:title 표시됨
   ✓ og:image 표시됨 (1200x630)
   ✓ 오류 0개
```

### Twitter 공유 테스트
```
Twitter Card Validator:
https://cards-dev.twitter.com/validator

테스트 방법:
1. URL 입력: https://mabizcruisedot.com/landing
2. "Request Preview" 클릭
3. 확인 사항:
   ✓ twitter:card = summary_large_image
   ✓ 이미지 표시됨
   ✓ 오류 0개
```

---

## 🎯 심리학 체크리스트

### Grant Cardone 10렌즈 적용 확인
```
[ ] L0 손실회피: "무료", "비용 없음" 강조 (Description)
[ ] L1 사회증명: "1,200+ 파트너", "월 250억 거래액" (콘텐츠)
[ ] L2 희소성: "한정 모집", "파트너 수 제한" (Title 고려)
[ ] L3 긴급성: "5분", "즉시", "지금" (Description)
[ ] L4 일관성: "한 곳에서", "통합" (Title)
[ ] L5 권위성: 브랜드명 명확 (Title)
[ ] L6 상호성: "무료 시작", "약정 없음" (Description)
[ ] L7 집단사고: "최신", "트렌드" (Keywords)
[ ] L8 이야기: 성공 사례 (콘텐츠)
[ ] L9 자기투영: "파트너", "당신의" (Title)
```

### PASONA 프레임워크 적용 확인
```
[ ] P (Problem): 문제 제시 (Description 시작)
[ ] A (Agitate): 감정적 자극 (Keywords)
[ ] S (Solution): 솔루션 제시 (Title)
[ ] O (Offer): 구체적 혜택 (Description 중간)
[ ] N (Narrow): 긴급성 강조 (Description 마지막)
[ ] A (Action): 행동 유도 (Title/CTA)
```

---

## ⚡ 최적화 체크리스트 (배포 전)

### 메타 태그 (필수)
```
[ ] Title: 50-60자, 키워드 포함
[ ] Description: 120-160자, 행동 유도 있음
[ ] Keywords: 5-7개, 검색량 순서
[ ] Canonical: 중복 제거
[ ] Viewport: 모바일 대응
[ ] robots.txt: 크롤링 규칙 명시
[ ] sitemap.xml: 동적 페이지 포함
```

### Open Graph (권장)
```
[ ] og:title: 55자 이내
[ ] og:description: 125자 이내
[ ] og:image: 1200x630px, 파일 크기 < 5MB
[ ] og:url: 정확한 URL
[ ] og:type: website
[ ] og:site_name: 사이트명
[ ] og:locale: ko_KR
```

### Twitter Card (권장)
```
[ ] twitter:card: summary_large_image
[ ] twitter:title: 55자 이내
[ ] twitter:description: 200자 이내
[ ] twitter:image: 1200x630px
[ ] twitter:site: @계정명 (선택사항)
```

### 구조화 데이터 (권장)
```
[ ] Organization 스키마 (logo, contact, social)
[ ] WebPage 스키마 (title, description, url, image)
[ ] BreadcrumbList (있으면 추가)
[ ] JSON-LD 형식 (유효한 JSON)
[ ] Google Rich Result 테스트 통과
```

### 성과 (Month 1 목표)
```
[ ] Google Search Console 등록
[ ] Sitemap 제출 완료
[ ] 메타 데이터 커버리지 100%
[ ] 구조화 데이터 오류 0개
[ ] Lighthouse SEO 점수 85+
[ ] SNS 공유 테스트 완료
```

---

## 📝 수정 템플릿

### Description 개선 (낮은 CTR 시)
```
현재:  크루즈 파트너 CRM입니다.
      (너무 짧고 인상 약함)

개선:  크루즈닷 파트너 전용 CRM. 
      고객관리 + 수당확인 + 영업도구를 한 곳에서. 
      무료 사용, 5분 시작.
      (구체성 + 혜택 + 긴급성)
```

### Keywords 확장 (검색량 부족 시)
```
기존:  파트너 CRM, 고객관리
      (너무 일반적)

확장:  파트너 CRM, 고객관리 시스템, 
      크루즈 판매, 수당 자동계산,
      파트너 플랫폼, 영업 자동화
      (롱테일 + 구체적)
```

### og:image 업데이트 (SNS 공유율 낮을 시)
```
신규 이미지 체크리스트:
[ ] 브랜드 로고 명확 (상단 중앙)
[ ] 주요 메시지 큰 글자 (36pt+)
[ ] 행동 유도 (가입/시작 버튼)
[ ] 색상 대비 높음 (WCAG AA)
[ ] 모바일 미리보기 테스트
```

---

## 🔗 유용한 도구

| 도구 | 용도 | URL |
|------|------|-----|
| **Google Search Console** | 검색 노출 모니터링 | https://search.google.com/search-console/ |
| **Rich Result Test** | 구조화 데이터 검증 | https://search.google.com/test/rich-results |
| **Facebook Debugger** | OG 메타 검증 | https://developers.facebook.com/tools/debug/sharing/ |
| **Twitter Validator** | Twitter Card 검증 | https://cards-dev.twitter.com/validator |
| **Lighthouse** | 성능 + SEO 감사 | Chrome DevTools (F12) |
| **Naver Search Advisor** | 네이버 검색 등록 | https://searchadvisor.naver.com/ |
| **SEMrush** | 키워드 분석 (유료) | https://www.semrush.com/ |
| **Ahrefs** | 경쟁사 분석 (유료) | https://ahrefs.com/ |

---

## 📋 예상 효과 (3~6개월)

### 유기 검색 (예상)
- 현재: 월 0명 → 1개월: 50명 → 3개월: 300명 → 6개월: 1,000명
- 주요 키워드: "파트너 CRM" 상위 20위 진입

### SNS 공유 (예상)
- 현재: 월 0회 → 1개월: 20회 → 3개월: 100회 → 6개월: 300회
- 페이스북 파트너 그룹 공유 증대

### 가입 전환율 (예상)
- 유기 검색: 8% → 12% (심리학 메타 적용)
- SNS 유입: 6% → 10% (OG 이미지 개선)

### 월 추정 신규 파트너 (예상)
- 현재: 10명 → 1개월: 15명 → 3개월: 30명 → 6개월: 50명
- 누적 효과: +480명/년

---

**마지막 업데이트**: 2026-06-09
**버전**: 1.0 (Quick Reference)
**용도**: 빠른 확인 및 적용
