# Menu #48: L2 렌즈 - 준비 불안도 해소 시스템

> **목표**: 크루즈 예약 고객의 비자/여권/건강 준비 불안감을 SPIN 질문법으로 해소  
> **기대 효과**: 예약 완료율 38-45% → 75% (+38%p)  
> **상태**: 🟢 API 완성, Phase 2-5 진행 중

---

## 🎯 핵심 기능

### 1. 불안도 평가 (Anxiety Assessment)
SPIN 질문법 기반 5단계 평가로 고객의 준비 불안도를 0-125점으로 산정

**계산 로직**:
- 비자 필요 → +40점
- 여권 유효기간 <180일 → +0-30점
- 첫 크루즈 → +20점
- 자녀 동반 → +20점
- 건강 우려 → +15점/항목
- 준비 복잡도 → +0-25점
- 자신감 격차 → +0-32점

**분류**:
- 🟢 **Low** (<40점): 자신감 있음 → 기본 체크리스트
- 🟡 **Medium** (40-79점): 약간 불안 → 이메일 가이드
- 🔴 **High** (≥80점): 매우 불안 → 1:1 상담 필수

### 2. 맞춤형 준비 가이드 (4가지)
세그먼트별로 최적화된 가이드 PDF 자동 발송

**제공 가이드**:
1. **비자 신청** (4단계): 대상국 확인 → 서류 준비 → 대사관 방문 → 수령
2. **여권 갱신** (3단계): 유효기간 확인 → 서류 준비 → 여권실 신청
3. **건강 관리** (4섹션): 예방접종 → 선내 의료 → 특수 조건 → 준비물
4. **짐 준비** (5섹션): 짐 규정 → 필수물품 → 금지물품 → 통관 절차

### 3. Day 0-3 SMS 자동화
PASONA 카피 + 손실회피 심리학 적용한 4단계 메시지

**Day 0: P(Problem) + A(Agitate)**
- SPIN 질문: "해외 여행 경험은?"
- 심리학: Implication 질문으로 불안감 극대화

**Day 1: S(Solution)**
- 세그먼트별 가이드 PDF 발송
- 권위성: 의료진 자격, 정부 기관 링크

**Day 2: O(Offer) + N(Narrow)**
- 실제 사례 & 선배 후기
- 손실회피: "시간 제한, 지금이 기회"

**Day 3: A(Action)**
- 1:1 상담사 배정
- 삼중선택 + 긴박감

### 4. 불안도 대시보드
KPI 추적 및 성과 분석 대시보드

**주요 지표**:
- 불안도 분포 (Low/Medium/High %)
- 준비 단계별 고객 분포
- SMS 성과 (오픈율 → 클릭율 → 전환율)
- 예상 영향도 (추가 예약, 환불 감소)

---

## 📂 파일 구조

```
src/
├── app/
│   ├── api/
│   │   ├── anxiety-assessment/route.ts         # POST: 불안도 평가
│   │   ├── preparation-guides/[category]/route.ts  # GET: 가이드 조회
│   │   └── sms/anxiety-sequence/route.ts       # POST: SMS 시퀀스
│   ├── (dashboard)/
│   │   └── menu-48-anxiety/page.tsx            # 대시보드 페이지
│   └── ...
│
├── lib/
│   ├── preparation-guides/
│   │   ├── visa-guide.json
│   │   ├── passport-guide.json
│   │   ├── health-guide.json
│   │   └── customs-guide.json
│   ├── anxiety-assessment-utils.ts             # 핵심 계산 로직
│   └── anxiety-assessment-utils.test.ts        # 유닛 테스트
│
├── components/
│   └── menu-48-anxiety-dashboard.tsx           # 대시보드 UI
│
└── prisma/
    ├── schema.prisma                           # L2 필드 추가
    └── migrations/add_l2_anxiety_fields/
        └── migration.sql
```

---

## 🔌 API 명세

### 1. POST /api/anxiety-assessment

**목적**: SPIN 질문 답변으로 불안도 점수 산출 및 저장

**요청**:
```json
{
  "contactId": "cuid123...",
  "organizationId": "cuid456...",
  "hasCruiseExperience": false,
  "visaRequired": true,
  "passportExpiryDays": 120,
  "hasKids": true,
  "healthConcerns": ["배멀미", "고혈압"],
  "preparationComplexity": 4,
  "confidenceLevel": 2
}
```

**응답**:
```json
{
  "contactId": "cuid123...",
  "anxietyScore": 87,
  "anxietyCategory": "high",
  "preparationStage": "visa_concern",
  "breakdown": {
    "visaRequired": 40,
    "passportDaysLeft": 25,
    "firstTimeCruise": 20,
    "familyWithKids": 20,
    "healthConcerns": 30,
    "preparationComplexity": 0,
    "confidenceGap": 0
  },
  "recommendations": [
    "비자 신청 프로세스 가이드 제공",
    "배멀미 관리 팁 및 약물 정보",
    "선내 의료진 소개"
  ],
  "nextActions": [
    "1:1 상담사 배정 및 화상 상담 예약",
    "Day 0 SMS: 불안도 진단 봇 시작",
    "Day 1 SMS: 세그먼트별 가이드 PDF 발송"
  ],
  "smsSequenceTemplate": "high_anxiety_support"
}
```

### 2. GET /api/preparation-guides/[category]

**목적**: 카테고리별 준비 가이드 조회

**파라미터**: `category` = visa | passport_renewal | health | customs

**응답**:
```json
{
  "category": "visa",
  "title": "비자 신청 가이드",
  "description": "크루즈 여행을 위한 비자 준비 완벽 가이드",
  "content": {
    "steps": [...],
    "checklist": [...],
    "faq": [...]
  },
  "estimatedReadTime": 8,
  "lastUpdated": "2026-05-25"
}
```

### 3. POST /api/sms/anxiety-sequence

**목적**: Day 0-3 SMS 자동화 시퀀스 시작

**요청**:
```json
{
  "contactId": "cuid123...",
  "organizationId": "cuid456...",
  "anxietyCategory": "high",
  "preparationStage": "visa_concern",
  "smsSequenceTemplate": "high_anxiety_support"
}
```

**응답**:
```json
{
  "contactId": "cuid123...",
  "sequenceStarted": true,
  "schedules": [
    {
      "day": 0,
      "sendTime": "10:00",
      "template": {
        "type": "spin_question",
        "content": "해외 여행 경험은?"
      },
      "delay": 0
    },
    ...
  ],
  "totalMessages": 8,
  "estimatedCompletion": "2026-05-28T20:00:00Z"
}
```

---

## 🧠 심리학 프레임워크

### SPIN 판매법 (5단계 질문)

```
S (Situation) → "해외 경험은 어떻게 되세요?"
              ↓
P (Problem) → "비자/여권 준비가 복잡하신가요?"
              ↓
I (Implication) → "미준비시 탑승 불가인데, 그게 걱정되세요?"
                  ↓
N (Need) → "준비 과정을 단계별로 안내받으면 도움될까요?"
           ↓
R (Reward) → "우리가 체크리스트+상담사 제공하면?"
```

### PASONA 카피 구조 (Day 0-3)

| Day | 단계 | 목표 | 심리학 | 예시 |
|-----|------|------|--------|------|
| 0 | P+A | 불안감 인식 | Implication | "미준비시 탑승 불가?" |
| 1 | S | 해결책 제시 | 권위성 | "의료진 자격 강조" |
| 2 | O+N | 사례+시간제한 | 사회증명 | "선배 후기 + 48시간 제한" |
| 3 | A | 즉시행동 | 손실회피 | "지금이 마지막 기회" |

### 손실회피 (Loss Aversion)

고객이 "얻는 것"보다 "잃는 것"을 더 중요하게 여기는 심리를 활용:

```
"비자 미신청 → 탑승 불가 → $5000 손실"
"이 기회를 놓치면 → 다음 일정은 3개월 후"
```

---

## 📊 성과 목표

### 주요 KPI

| KPI | 현재 | 목표 | 증가 |
|-----|------|------|------|
| 예약 완료율 (고불안도) | 38-45% | 75% | **+38%p** |
| 상담 예약율 | 22.8% | 35-40% | **+12%p** |
| SMS 클릭율 | 38.5% | 45-50% | **+6.5%p** |
| 환불/취소율 | 12% | 8% | **-4%p** |

### 월별 예상 효과

고객 324명 기준 (High 98, Medium 126, Low 100):

```
추가 예약: 48-78명/월
환불 감소: 30-45명/월
예상 매출: $228,000 - $345,000/월
```

---

## 🚀 사용법

### 1. 불안도 평가 시작

```typescript
// 1. 고객 SPIN 질문 수집
const assessment = await fetch('/api/anxiety-assessment', {
  method: 'POST',
  body: JSON.stringify({
    contactId: 'abc123',
    organizationId: 'org456',
    hasCruiseExperience: false,
    visaRequired: true,
    passportExpiryDays: 120,
    hasKids: true,
    healthConcerns: ['배멀미'],
    preparationComplexity: 4,
    confidenceLevel: 2,
  }),
});

const result = await assessment.json();
// → anxietyScore: 87 (high)
// → smsSequenceTemplate: "high_anxiety_support"
```

### 2. 맞춤형 가이드 발송

```typescript
// 2. 불안도별 준비 가이드 조회
const guide = await fetch(
  '/api/preparation-guides/visa'
);

const content = await guide.json();
// → 4단계 비자 신청 가이드 PDF
// → 체크리스트 + FAQ + 대사관 연락처
```

### 3. SMS 자동화 시작

```typescript
// 3. Day 0-3 SMS 시퀀스 시작
const sms = await fetch('/api/sms/anxiety-sequence', {
  method: 'POST',
  body: JSON.stringify({
    contactId: 'abc123',
    organizationId: 'org456',
    anxietyCategory: 'high',
    preparationStage: 'visa_concern',
    smsSequenceTemplate: 'high_anxiety_support',
  }),
});

const schedule = await sms.json();
// → 8개 메시지 (Day 0-3)
// → 자동 발송 스케줄 생성
```

---

## 🔧 설정 및 커스터마이징

### 불안도 점수 조정

`src/lib/anxiety-assessment-utils.ts`의 `calculateAnxietyScore` 함수:

```typescript
// 기본값
const visaScore = 40;
const passportScore = 30;
const firstTimeCruiseScore = 20;
// ... 필요시 조정
```

### SMS 템플릿 추가

`src/app/api/sms/anxiety-sequence/route.ts`의 `baseTemplates`:

```typescript
const baseTemplates = {
  custom_template: [
    {
      day: 0,
      variant: 1,
      type: 'spin_question',
      content: '커스텀 메시지...',
    },
    // ... 추가 메시지
  ],
};
```

### 준비 가이드 편집

`src/lib/preparation-guides/*.json` 파일을 직접 편집

---

## 🧪 테스트

### 유닛 테스트 실행

```bash
npm test -- src/lib/anxiety-assessment-utils.test.ts
```

### API 테스트

```bash
# 불안도 평가
curl -X POST http://localhost:3000/api/anxiety-assessment \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": "test123",
    "organizationId": "org456",
    "hasCruiseExperience": false,
    "visaRequired": true,
    "passportExpiryDays": 120,
    "hasKids": true,
    "healthConcerns": ["배멀미"],
    "preparationComplexity": 4,
    "confidenceLevel": 2
  }'

# 가이드 조회
curl http://localhost:3000/api/preparation-guides/visa

# SMS 시퀀스
curl -X POST http://localhost:3000/api/sms/anxiety-sequence \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": "test123",
    "organizationId": "org456",
    "anxietyCategory": "high",
    "preparationStage": "visa_concern",
    "smsSequenceTemplate": "high_anxiety_support"
  }'
```

---

## 📈 모니터링

### 대시보드 접근

```
http://localhost:3000/(dashboard)/menu-48-anxiety
```

### 추적 메트릭

1. **불안도 분포**: Low/Medium/High 고객 수
2. **준비 단계**: inquiry → visa_concern → health_concern → ready
3. **SMS 성과**: Day별 오픈율 → 클릭율 → 전환율
4. **예약 완료율**: 목표 75% 달성 추적

---

## 🔗 관련 메모리 파일

- [[menu_38_sms_template_design]] — SMS 템플릿 4가지 라이프사이클
- [[l2_lens_5step_mediation_questions]] — SPIN 질문법 완전 가이드
- [[spin_selling_complete]] — SPIN 판매법 실전
- [[pasona_framework_complete]] — PASONA 6단계 카피라이팅
- [[grant_cardone_rebuttal]] — 이의 대응 15가지

---

## 📞 문의 & 피드백

- **API 수정**: 요청/응답 포맷 변경 필요시
- **SMS 템플릿**: 효과성 낮은 메시지 개선
- **대시보드**: 추가 KPI 요청
- **성과**: 월별 리뷰 및 최적화

---

**마지막 업데이트**: 2026-05-25  
**버전**: 1.0 (API 완성)  
**상태**: 🟢 프로덕션 준비 완료
