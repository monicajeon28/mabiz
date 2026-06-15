# Landing Pages 블록 커스터마이징 시스템 - 설계 최종 요약

**작성일**: 2026-06-15  
**상태**: 설계 완료 (구현 대기)

---

## 🎯 설계 목표

마비즈 CRM의 Landing Pages 기능을 **블록 기반 페이지 구성 시스템**으로 업그레이드:

1. **확장 가능한 블록 시스템**: 11가지 블록 타입 (Hero, Problem, Solution, Offer, Social Proof, FAQ, CTA, Countdown, Testimonial, Form, Rich Text)
2. **강타입 검증**: Zod + TypeScript로 런타입 안전성 보장
3. **심리학 렌즈 통합**: L6 (타이밍/손실회피), L10 (즉시 구매) 렌즈 내장
4. **응답 데이터 구조화**: 블록별 폼 응답을 blockResponses 배열로 저장

---

## 📦 산출물 (완성)

### 1. 설계 문서
- **LANDING_PAGES_BLOCK_DATA_MODEL.md** (지금 읽고 있는 파일)
  - 블록 및 필드 데이터 모델 상세 정의
  - Prisma 마이그레이션 SQL
  - API 스펙
  - 5단계 구현 로드맵

- **LANDING_PAGES_IMPLEMENTATION_GUIDE.md**
  - Block 생성 예시 (9가지)
  - FormField 생성 예시
  - API 구현 코드 스니펫
  - React 컴포넌트 구현 예시
  - 테스트 코드 템플릿

### 2. TypeScript 타입 & 검증 스키마
- **src/types/landing-page-blocks.ts** (1,100줄)
  - 11가지 Block 타입 인터페이스
  - FormField 타입 정의
  - 22개 Zod 검증 스키마
  - 타입 추론 (z.infer)

---

## 🏗️ 데이터 모델 구조

### Block 구조
```
Block (Discriminated Union)
├── BlockBase (공통 필드)
│   ├── id: string
│   ├── type: BlockType
│   ├── order: number
│   └── enabled: boolean
└── config: BlockConfig (타입별 다름)
    ├── HeroBlockConfig
    ├── ProblemBlockConfig
    ├── SolutionBlockConfig
    ├── OfferBlockConfig
    ├── SocialProofBlockConfig
    ├── FaqBlockConfig
    ├── CtaBlockConfig
    ├── CountdownBlockConfig
    ├── TestimonialBlockConfig
    ├── FormBlockConfig
    └── RichTextBlockConfig
```

### FormField 구조
```
FormField
├── 메타데이터: id, name, label, type
├── 검증: validation (minLength, maxLength, pattern, email)
├── UI: width, className, disabled
├── 조건부: conditional (다른 필드에 따른 표시/숨김)
└── L10 렌즈: emotionalContext (감정적 매력)
```

### Page 구조
```
LandingPageFormConfig
├── version: "1.0"
├── blocks: Block[] (11개 타입 지원)
├── theme: {primaryColor, fontFamily, fontSize, ...}
└── analyticsConfig: {googleAnalyticsId, customEvents, ...}
```

---

## 🔄 응답 데이터 저장

### CrmLandingRegistration 확장
```prisma
model CrmLandingRegistration {
  // 기존 필드
  id            String
  landingPageId String
  name          String
  phone         String
  email         String?
  
  // 신규 필드 (Phase 1)
  blockResponses    Json?      // [{blockId, blockType, responses, submittedAt}]
  emotionalRating   Int?       // L10 렌즈: 1-5
  conversionPath    String[]   // ["hero-cta", "solution-cta"]
  
  // 기존 추적 필드
  utmSource         String?
  utmMedium         String?
  utmCampaign       String?
  metadata          Json?
  funnelStarted     Boolean    @default(false)
  createdAt         DateTime   @default(now())
}
```

---

## 💡 심리학 렌즈 통합

### L6 (타이밍/손실회피)
- **CountdownBlockConfig**: 타이머 표시, 마감일 설정
- **OfferBlockConfig.urgency**: 재고(stock), 가격 마감, 긴박감 텍스트
- **활용**: "지금 신청하지 않으면 50만원을 더 내야 합니다"

### L10 (즉시 구매 클로징)
- **FormField.emotionalContext**: "꿈의 크루즈", "가족과의 추억" 같은 감정적 트리거
- **SelectOption.emotionalAppeal**: 선택지별 감정적 호소
- **conversionPath**: 고객의 클릭 순서 추적 (어떤 CTA에 응답했는지)
- **emotionalRating**: 고객의 감정적 연결도 1-5 점수

---

## 📋 Block 타입별 사용 시나리오

| 블록 | 용도 | L6/L10 | 예시 |
|-----|-----|--------|------|
| Hero | 첫 인상 & 주요 메시지 | L10 감정 | "꿈의 크루즈, 가족과 함께" |
| Problem | 고객 문제 공감 | - | "비용 걱정, 준비 복잡, 건강 우려" |
| Solution | 솔루션 제시 | - | "저렴한 가격, 전문 가이드, 의료진" |
| Offer | 가격/특가 제시 | L6 | "50% 할인, 마감 D-5" |
| Social Proof | 신뢰감 강화 | - | "1,000명 이상 만족" |
| FAQ | 이의 대응 | - | "배멀미, 건강, 취소" 등 |
| CTA | 행동 유도 | L10 | "지금 신청하기" |
| Countdown | 긴박감 생성 | L6 | "⏳ 03:45:30" |
| Testimonial | 고객 후기 | L10 | "58세 교사: 최고의 서비스" |
| Form | 폼 수집 | L10 | "이름, 전화, 크루즈 선택" |
| Rich Text | 자유형 콘텐츠 | - | 마크다운 지원 |

---

## 🚀 구현 5단계 로드맵

### Phase 1: 기초 인프라 (1주)
- ✅ TypeScript 타입 시스템 완성 (src/types/landing-page-blocks.ts)
- ✅ Zod 검증 스키마 작성
- [ ] Prisma 마이그레이션 생성 & 실행
- [ ] 기존 formConfig 데이터 마이그레이션 (필요시)

### Phase 2: 어드민 에디터 (2주)
- [ ] Block 추가/삭제/재정렬 UI
- [ ] 각 블록 Config 에디터 (11개 타입)
- [ ] 실시간 JSON 미리보기
- [ ] Split-screen 에디터

### Phase 3: 고객 뷰 (1주)
- [ ] BlockRenderer 컴포넌트 (11개 블록 타입)
- [ ] FormBlockView with 필드 검증
- [ ] 응답 저장 (blockResponses)

### Phase 4: L6/L10 렌즈 통합 (1주)
- [ ] CountdownBlockView (L6 타이밍)
- [ ] emotionalRating, conversionPath 추적 (L10)
- [ ] 우급감 & 재고 표시

### Phase 5: 테스트 & 배포 (1주)
- [ ] E2E 테스트 (Playwright)
- [ ] 성능 최적화 (Lighthouse 90+)
- [ ] 스테이징 검증
- [ ] 운영 배포

---

## 🔐 설계 원칙

### 1. 확장성
- Discriminated Union으로 새 블록 타입 추가 간단
- Zod 스키마 한 개 추가하면 자동 검증

### 2. 타입 안전성
- TypeScript + Zod로 런타임 검증
- formConfig 저장 시 검증 강제

### 3. 성능
- formConfig는 단일 JSON 필드 (정규화 불필요)
- blockResponses는 응답 저장 시만 사용 (읽기 최적화)

### 4. 심리학 통합
- L6: Countdown, Urgency, Stock 렌더링
- L10: emotionalContext, emotionalAppeal, conversionPath 추적

### 5. 마이그레이션 안전성
- version: "1.0" 으로 향후 마이그레이션 대비
- 기존 formConfig 호환성 유지 (필요시)

---

## 📊 파일 체크리스트

### 작성된 파일
- ✅ docs/LANDING_PAGES_BLOCK_DATA_MODEL.md (9KB)
- ✅ src/types/landing-page-blocks.ts (1,100줄)
- ✅ docs/LANDING_PAGES_IMPLEMENTATION_GUIDE.md (2KB)
- ✅ docs/LANDING_PAGES_DESIGN_SUMMARY.md (이 파일)

### 구현 필요 파일
- [ ] prisma/migrations/[timestamp]_add_block_system/migration.sql
- [ ] src/app/api/landing-pages/validate-block/route.ts
- [ ] src/components/landing-pages/BlockRenderer.tsx
- [ ] src/components/landing-pages/BlockEditor.tsx
- [ ] src/components/landing-pages/blocks/HeroBlockView.tsx
- [ ] src/components/landing-pages/blocks/FormBlockView.tsx
- [ ] ... (9개 블록 타입)

---

## 🎓 다음 단계

### 즉시 수행 가능
1. src/types/landing-page-blocks.ts 생성 ✅
2. Prisma 마이그레이션 생성
3. 기존 API에 검증 추가

### Phase 별 구현
- Phase 2 시작 전: 어드민 에디터 설계 회의
- Phase 3 시작 전: 고객 뷰 반응형 디자인 확정
- Phase 4 시작 전: L6/L10 추적 대시보드 설계

---

## 📚 참고 자료

### 설계 문서
1. **LANDING_PAGES_BLOCK_DATA_MODEL.md**: 전체 데이터 모델 상세
2. **LANDING_PAGES_IMPLEMENTATION_GUIDE.md**: 구현 코드 예시
3. **CLAUDE.md**: 심리학 렌즈 & 마케팅 프레임워크

### TypeScript 타입
- src/types/landing-page-blocks.ts

### 기존 코드
- src/components/forms/FormBuilder.tsx: 폼 필드 구현 참고
- src/app/api/landing-pages/[id]/route.ts: API 구현 참고
- src/lib/landing-page-utils.ts: 유틸리티 함수

---

## ✅ 설계 검증 체크리스트

- ✅ 11개 블록 타입 정의 완료
- ✅ FormField 타입 정의 완료
- ✅ 22개 Zod 검증 스키마 작성
- ✅ Prisma 마이그레이션 설계 완료
- ✅ API 스펙 정의 완료
- ✅ L6/L10 렌즈 통합 전략 수립
- ✅ 5단계 구현 로드맵 수립
- ⏳ 구현 시작 대기

---

**상태**: 설계 완료 → 구현 준비 완료  
**예상 일정**: Phase 1-2: 3주, Phase 3-5: 3주 (총 6주)  
**담당자**: 풀스택 개발 팀
