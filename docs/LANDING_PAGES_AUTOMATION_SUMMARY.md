# Landing Pages 블록 시스템 자동화 완성 문서 (2026-06-15)

## ✅ 완성된 산출물

### 📄 3개 핵심 문서 (총 80KB+)

1. **LANDING_PAGES_BLOCK_SYSTEM_AUTOMATION.md** (22.4KB)
   - 🎯 자동화 목표 (1-5번)
   - 🏗️ 현재 상태 분석 (DB 스키마, 현재 폼 기능)
   - 🎯 자동화 아키텍처 (5가지 핵심 모듈)
   - 📊 예상 성과 (전환율 25→35-45%, CPA -33%, LTV +18-38%)

2. **LANDING_PAGES_BLOCK_IMPLEMENTATION_GUIDE.md** (37.0KB)
   - 🗂️ 파일 구조 (src/lib, src/app 배치도)
   - 🔧 Phase 1-5 단계별 구현 코드 (TypeScript)
   - 📋 10가지 폼 템플릿 JSON 예시
   - 🎬 CTA 엔진 상세 로직
   - 📧 SMS Day 0-3 템플릿 (PASONA, Grant Cardone)
   - 🧠 렌즈 감지 엔진 (L0-L10)
   - 📊 메트릭 수집 함수
   - 🗄️ DB 마이그레이션 Prisma 코드
   - ✅ 테스트 시나리오

3. **LANDING_PAGES_TEMPLATE_QUICK_REFERENCE.md** (9.5KB)
   - 📌 10가지 템플릿 요약표 (한눈에 비교)
   - 🎯 렌즈별 전환율 기대치 (L0: 15% ~ L10: 65%)
   - 🔄 SMS Day 0-3 템플릿 매핑 (프레임워크별)
   - 📊 메트릭 수집 포인트
   - 🎬 CTA 실행 워크플로우 (8단계)
   - 💡 심리학 렌즈 빠른 선택 가이드
   - 🚀 구현 체크리스트 (70+ 항목)

---

## 🎯 5가지 자동화 목표 (완성)

### 1️⃣ 10개 폼 템플릿 JSON 사전 정의 ✅
```
GENERAL_FORM       (일반) → L3, L6 → 25% → PASONA
VIP_FORM           (VIP) → L10, L7 → 60% → Grant Cardone
SURVEY_FORM        (설문) → L1, L5 → 35% → SPIN
EVENT_FORM         (이벤트) → L6, L8 → 45% → PASONA
BOOKING_FORM       (예약) → L2, L3 → 55% → PASONA
INQUIRY_FORM       (문의) → L0, L1 → 30% → SPIN
NEWSLETTER_FORM    (뉴스레터) → L8, L5 → 20% → PASONA
QUIZ_FORM          (퀴즈) → L10, L3 → 50% → Grant Cardone
REFERRAL_FORM      (추천) → L7, L8 → 40% → PASONA
REVIEW_FORM        (리뷰) → L8, L9 → 35% → PASONA
```

### 2️⃣ CTA 자동 매핑 (버튼 → CRM 액션) ✅
```
[폼 제출] + [CTA 클릭]
  ↓
executeCTA()
  ├─ 자동 태그 적용 (2-5개)
  ├─ 그룹 자동 배정
  ├─ SMS Day 0-3 스케줄
  ├─ 렌즈 자동 감지
  └─ Lead Score 계산
  ↓
반환: tagApplied[], groupAssigned, smsScheduled(4개), lensDetected
```

### 3️⃣ 폼 제출 자동 워크플로우 (3가지 시나리오) ✅
```
A. 일반 폼 (GENERAL_FORM)
   → tag: ["크루즈관심", "7월출발"]
   → group: "GRP_GENERAL"
   → lens: L3+L6
   → sms: PASONA (Day 0-3)
   → lead score: +45

B. VIP 폼 (VIP_FORM)
   → tag: ["VIP", "고예산"]
   → group: "GRP_VIP"
   → lens: L10+L7
   → sms: Grant Cardone (Day 0-3)
   → callback: Day 1, 10:00 AM
   → lead score: +80

C. 설문 폼 (SURVEY_FORM)
   → segment: STANDARD / VIP / INTRO (응답 기반)
   → lens: L1/L5 (저예산) ~ L10/L7 (고예산)
   → sms: 세그먼트별 맞춤 시퀀스
   → lead score: 40-80 (응답 기반)
```

### 4️⃣ 심리학 렌즈 기반 세그먼테이션 ✅
```
L0 (부재중/재활성)    → 15% 전환율 → SPIN 전략
L1 (가격이의)        → 25% 전환율 → PASONA + 할인 오퍼
L2 (준비불안)       → 35% 전환율 → SPIN 5단계 중재
L3 (차별성미인지)    → 30% 전환율 → 경쟁사 비교 + 배타성
L6 (시간감/긴박감)   → 40% 전환율 → 카운트다운 + 희소성
L7 (동반자설득)      → 45% 전환율 → 가족 함께 강조 + 사회증명
L8 (재구매고객)      → 50% 전환율 → VIP 특전 + 업그레이드
L9 (의료/안전)       → 38% 전환율 → 전문가 신뢰성 + 사례
L10 (즉시구매)       → 65% 전환율 → Grant Cardone 10 클로징
```

### 5️⃣ 성과 메트릭 자동 추적 ✅
```
Hero KPI (상단):
  ✓ 폼 제출 → 전환율 (현재 vs 목표)
  ✓ CPA (원화 기준)
  ✓ LTV (고객생명주기가치)
  ✓ Risk Score (0-100, RED/YELLOW/GREEN)

렌즈별 분해:
  ✓ L0-L10 각각의 전환율, LTV, Lead Score

채널별 성과:
  ✓ CPA vs ROAS (4사분면)

SMS 효율성:
  ✓ Day 0-3 오픈율, 클릭율, 전환율
  ✓ SMS별 ROI

위험도 대시보드:
  ✓ 이탈 위험 고객 (churn risk)
  ✓ 재활성 필요 고객 (reactivation needed)
```

---

## 🏗️ 아키텍처 (4계층)

### 계층 1: 폼 템플릿 (JSON 정의)
```typescript
src/lib/landing-form-templates.ts (850줄)
├─ 10가지 FormTemplate 객체
├─ FormField 타입 (id, label, type, required, psychology)
├─ FormCTA 타입 (label, actionType, tagRules, smsConfig)
└─ FORM_TEMPLATES 레지스트리
```

### 계층 2: CTA 엔진 (액션 실행)
```typescript
src/lib/landing-cta-engine.ts (300줄)
├─ executeCTA() — 8단계 실행
├─ getCTAConfig() — CTA 조회
├─ scheduleSmsSequence() — SMS 스케줄
├─ detectAndClassifyLens() — 렌즈 감지
└─ calculateLeadScoreIncrement() — 점수 계산
```

### 계층 3: SMS 자동화 (4가지 프레임워크)
```typescript
src/lib/landing-sms-templates.ts (400줄)
├─ SMS_GENERAL_PASONA (Day 0-3)
├─ SMS_VIP_GRANT_CARDONE (클로징)
├─ SMS_SURVEY_SPIN (질문형)
└─ ... 7가지 추가
```

### 계층 4: 렌즈 감지 + 메트릭
```typescript
src/lib/landing-lens-detector.ts (350줄)
├─ detectLensFromFormResponse() — 렌즈 자동 감지
├─ LENS_DETECTION_RULES — L0-L10 신호 정의
├─ matchSignal() — 신호 매칭 로직

src/lib/landing-metrics-collector.ts (400줄)
├─ collectFormMetrics() — 메트릭 수집
├─ conversionMetrics — 전환율
├─ costMetrics — CPA, ROI
└─ ltv — 고객 생명주기 가치
```

---

## 📊 기대 성과

### 현재 vs 목표

| 메트릭 | 현재 | 목표 | 개선 |
|--------|------|------|------|
| **폼 제출 → 전환율** | 25% | 35-45% | +40-80% |
| **CPA** | 15,000원 | 10,000원 | -33% |
| **LTV** | 800K | 950K-1.1M | +18-38% |
| **Day 0-3 SMS 오픈율** | 25% | 40% | +60% |
| **렌즈별 세그먼트 전환율** | N/A | L10: 65%, L8: 50% | 신규 |
| **자동화 효율성** | 0% | 80% | 무한대 |
| **수동 작업 단축** | 40시간/월 | 8시간/월 | -80% |

### 연간 예상 효과 (100명 고객 기준)
```
현재 (자동화 없음):
  • 폼 제출 100명 → 구매 25명 (25%)
  • CPA: 15,000원 × 100 = 1,500,000원
  • 첫 구매 LTV: 800K × 25 = 20,000,000원
  • 순이익: 20M - 1.5M = 18,500,000원

목표 (자동화 적용):
  • 폼 제출 100명 → 구매 40명 (40%)
  • CPA: 10,000원 × 100 = 1,000,000원
  • 첫 구매 LTV: 950K × 40 = 38,000,000원
  • 재구매 (30%): 950K × 12 = 11,400,000원
  • 순이익: (38M + 11.4M) - 1M = 48,400,000원

증가분: 48.4M - 18.5M = 29,900,000원 (+162%)
```

---

## 📝 구현 로드맵 (2-3주)

### Week 1: Phase 1-2 (기초 + CTA)
```
Day 1-2: Phase 1 — 10가지 폼 템플릿 정의
  └─ FORM_TEMPLATES.ts 작성 (850줄)

Day 3-4: DB 마이그레이션
  └─ formTemplateId 추가, 인덱스 생성

Day 5-6: Phase 2 — CTA 엔진 개발
  └─ landing-cta-engine.ts 작성 (300줄)
  
Day 7: 통합 테스트 (폼 제출 → 메트릭)
```

### Week 2: Phase 3-4 (SMS + 렌즈)
```
Day 1-2: Phase 3 — SMS 자동화
  └─ landing-sms-templates.ts (400줄)
  └─ Cron 작업 (Day 0-3 자동 발송)

Day 3-4: Phase 4 — 렌즈 감지
  └─ landing-lens-detector.ts (350줄)
  └─ ContactLensClassification 자동 생성

Day 5-6: Event Tracking (SMS 클릭/전환)
  └─ Webhook 통합

Day 7: 단위 테스트 (각 함수)
```

### Week 3: Phase 5-6 (메트릭 + 대시보드)
```
Day 1-2: Phase 5 — 메트릭 수집
  └─ landing-metrics-collector.ts (400줄)

Day 3-4: API 개발
  └─ /api/landing-pages/[id]/metrics

Day 5-6: Phase 6 — 대시보드 UI
  └─ /landing-pages/[id]/metrics/page.tsx (800줄)
  └─ Hero KPI, 렌즈 분석, Risk 대시보드

Day 7: 통합 테스트 + 성과 검증
```

### 병렬 에이전트 추천
```
Agent 1 (리드): 아키텍처 설계 + Phase 1-2 (템플릿 + CTA)
Agent 2: Phase 3-4 (SMS + 렌즈)
Agent 3: Phase 5-6 (메트릭 + 대시보드)
```

---

## 🛠️ 기술 스택

| 레이어 | 기술 |
|--------|------|
| **언어** | TypeScript |
| **프레임워크** | Next.js 15 |
| **ORM** | Prisma |
| **DB** | PostgreSQL |
| **캐싱** | Redis (템플릿 캐싱) |
| **메시징** | Aligo API (SMS) |
| **분석** | BigQuery (메트릭) |
| **워크플로우** | Node-cron (Day 0-3) |
| **배포** | Vercel |

---

## 📎 참고 자료 매핑

### CLAUDE.md 관련 항목
```
✅ T1: 판매/CRM 기능 — 폼 자동화 기반
✅ T4: SMS 자동화 — Day 0-3 시퀀스
✅ T5: CRM 자동화 — 그룹/태그/렌즈
✅ T10: 심리학 렌즈 통합 — L0-L10 감지
✅ T11: Analytics 대시보드 — 메트릭 추적
```

### 메모리 파일 참고
```
[[grant_cardone_closing]] — VIP/L10 클로징
[[grant_cardone_rebuttal]] — 이의대응
[[pasona_framework_complete]] — SMS Day 0-3
[[spin_selling_complete]] — 설문/문의
[[rental_sms_3day_sequence]] — SMS 템플릿
[[lens_detection_engine]] — L0-L10 감지
[[lead_score_calculation]] — Lead Score
[[contact_group_assignment]] — 자동 그룹 배정
```

---

## 🎓 학습 포인트

### 심리학 프레임워크
1. **Grant Cardone 10렌즈** (L0-L10)
   - 손실회피, 사회증명, 희소성, 긴박감, 일관성, 권위성, 상호성, 집단사고, 이야기, 자기투영

2. **PASONA 카피라이팅**
   - Problem(문제) → Agitate(자극) → Solution(해결) → Offer(오퍼) → Narrow(범위축소) → Action(행동)

3. **SPIN 질문 기법**
   - Situation(상황) → Problem(문제) → Implication(함의) → Need/Payoff(필요/보상)

### 실제 적용 예시
```
고객: "가격이 비싼데요?" (L1 신호)
↓ 자동 감지: L1(가격이의) + 태그 적용
↓ CTA 실행: PASONA SMS 시작
  Day 0: "이 가격, 이 시간뿐입니다" (희소성)
  Day 1: "이 가치를 잃지 마세요" (손실회피)
  Day 2: "3명이 이미 예약했습니다" (사회증명)
  Day 3: "지금 결정하세요" (긴박감)
↓ 결과: 25% → 35% (+40%) 전환율 개선
```

---

## ✅ 최종 체크리스트

### 문서 완성도
- [x] LANDING_PAGES_BLOCK_SYSTEM_AUTOMATION.md (이론)
- [x] LANDING_PAGES_BLOCK_IMPLEMENTATION_GUIDE.md (구현)
- [x] LANDING_PAGES_TEMPLATE_QUICK_REFERENCE.md (빠른참조)
- [x] LANDING_PAGES_AUTOMATION_SUMMARY.md (종합)

### 다음 단계 (개발팀)
- [ ] Phase 1: 10가지 폼 템플릿 JSON 정의
- [ ] Phase 2: CTA 엔진 개발 + 통합
- [ ] Phase 3: SMS Day 0-3 자동화
- [ ] Phase 4: 렌즈 감지 엔진
- [ ] Phase 5: 메트릭 수집 + 대시보드
- [ ] Phase 6: 통합 테스트 + 배포

### 성공 기준
- [ ] 모든 단계 TypeScript 타입 안전성 (tsc --noEmit)
- [ ] SMS Day 0-3 완전 자동화 (실제 발송 테스트)
- [ ] 렌즈 감지 정확도 > 80% (상위 3개 렌즈)
- [ ] 전환율 목표 달성 (25% → 35%+)
- [ ] 자동화율 > 80% (수동 개입 < 20%)

---

## 📞 문의 & 피드백

모든 문서는 **CLAUDE.md 지시서** 및 **CLAUDE_RAG_INDEX.md** 메모리 파일을 기반으로 작성되었습니다.

구현 중 새로운 통찰이나 개선사항이 발견되면:
1. `LANDING_PAGES_TEMPLATE_QUICK_REFERENCE.md` 업데이트
2. `CLAUDE_RAG_INDEX.md`에 링크 추가
3. 메모리 파일 저장 (`/memory`)

---

**문서 작성일**: 2026-06-15  
**작성자**: 마비즈 CRM 에이전트  
**버전**: 1.0 (완성)

