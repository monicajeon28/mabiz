# Menu #48: L2 렌즈 - 준비 불안도 해소 (2026-05-25)

## 🎯 목표
비자/여권/건강 준비 불안감 해소 → 예약 완료율 **38-45% → 75%** (+38%p)

---

## 📊 불안도 산출 알고리즘 (0-125점)

### 기본 점수 구성
| 항목 | 점수 | 조건 |
|------|------|------|
| visa_required | +40 | 비자 필요 국가 |
| passport_days_left | +0-30 | 180일 미만일수록 높음 |
| first_time_cruise | +20 | 첫 크루즈 여행 |
| family_with_kids | +20 | 자녀 동반 |
| health_concerns | +15/항목 | 배멀미, 당뇨, 고혈압 등 |
| preparation_complexity | +0-25 | 복잡도 점수 × 5 |
| confidence_gap | +0-32 | (5 - 자신감) × 8 |

### 불안도 분류
```
anxietyScore < 40 → 'low' (자신감 있음)
40 ≤ anxietyScore < 80 → 'medium' (약간 불안)
anxietyScore ≥ 80 → 'high' (매우 불안)
```

---

## 🔄 준비 단계 (preparationStage)

| 단계 | 설명 | 우선순위 |
|------|------|---------|
| inquiry | 초기 문의 (결정 전) | - |
| visa_concern | 비자 신청 필요 (긴급) | **P0** |
| health_concern | 건강 관련 우려 (배멀미/당뇨 등) | **P1** |
| passport_concern | 여권 갱신 필요 (긴급) | **P0** |
| ready | 준비 완료 (탑승 준비) | - |

---

## 📱 Day 0-3 SMS 자동화 시퀀스

### 심리학 적용: PASONA + 손실회피

#### Day 0: P(Problem) + A(Agitate) - 불안감 인식 & 자극
**Type**: SPIN 질문 챗봇
- **High Anxiety**: "해외 여행 경험은 어떻게 되세요?"
- **Medium**: "크루즈 준비, 어디까지 진행되셨나요?"
- **Low**: "설렘이 반반이신가요?"

**심리학**: Implication 질문으로 미준비의 위험성 강조
- "비자/여권 미준비시 탑승 불가 상황도 가능한데 그게 걱정되세요?"

#### Day 1: S(Solution) - 해결책 제시
**Type**: 세그먼트별 가이드 발송
```
visa_required → [대사관 연락처 + 체크리스트 PDF]
passport_renewal → [갱신 절차 + 급행 옵션]
health_concern → [배멀미약 + 의료 서비스 + 선실 위치 팁]
first_time_cruise → [선내 투어 영상 + FAQ]
```

**심리학**: 권위성 + 신뢰 설계
- 의료진 자격 강조 (MD, 간호사)
- 정부 기관 링크 (외교부, 여권청)

#### Day 2: O(Offer) + N(Narrow) - 증거 & 긴박감
**Type**: 실제 사례 & 후기 + 시간 제한
- **고불안도**: "선배 탑승자 영상 후기" + "시간 마감 공지"
- **중간불안도**: "FAQ + 자주 묻는 질문 통합 답변"
- **저불안도**: "선택 가이드 + 옵션 안내"

**심리학**: 사회증명 + 손실회피
- "이렇게 준비한 분들이 최고의 경험 했어요"
- "비자 승인 평균 14일, 지금이 바로 시작해야 할 때예요"

#### Day 3: A(Action) - 최종 결정 촉구
**Type**: 1:1 상담 + 긴박감 극대화
- **Urgent CTA**: "🔴 남은 시간 48시간! 지금 상담사 배정"
- **상담 내용**:
  - 비자 준비 현황 확인
  - 건강 관련 선내 의료 서비스 안내
  - 맞춤형 준비 체크리스트 검토
  - 예약 확정 전 최종 확인

**심리학**: 삼중선택 + 긴박감
1. "상담 예약 → 즉시 진행" (최고 수익)
2. "가이드만 받기 → 스스로 준비" (일반)
3. "다음에 알려주기 → 놓친 기회" (손실 강조)

---

## 📂 파일 구조

```
src/
├── app/
│   ├── api/
│   │   ├── anxiety-assessment/
│   │   │   └── route.ts (SPIN 챗봇 + 점수 산출)
│   │   ├── preparation-guides/
│   │   │   └── [category]/
│   │   │       └── route.ts (visa/passport/health/customs)
│   │   └── sms/
│   │       └── anxiety-sequence/
│   │           └── route.ts (Day 0-3 자동화)
│   ├── (dashboard)/
│   │   └── menu-48-anxiety/
│   │       └── page.tsx (대시보드)
│   └── ...
│
├── lib/
│   └── preparation-guides/
│       ├── visa-guide.json (4단계 비자 신청)
│       ├── passport-guide.json (3단계 여권 갱신)
│       ├── health-guide.json (4섹션 건강 관리)
│       └── customs-guide.json (4섹션 짐 준비)
│
├── components/
│   └── menu-48-anxiety-dashboard.tsx (KPI + 차트)
│
└── prisma/
    ├── schema.prisma (L2 필드 추가)
    └── migrations/
        └── add_l2_anxiety_fields/
            └── migration.sql
```

---

## 🔌 API 엔드포인트 (3개)

### 1. POST /api/anxiety-assessment
**요청**:
```json
{
  "contactId": "cuid...",
  "organizationId": "cuid...",
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
  "contactId": "cuid...",
  "anxietyScore": 87,
  "anxietyCategory": "high",
  "preparationStage": "visa_concern",
  "breakdown": {
    "visaRequired": 40,
    "passportDaysLeft": 25,
    "firstTimeCruise": 20,
    "familyWithKids": 20,
    "healthConcerns": 30
  },
  "recommendations": [
    "비자 신청 프로세스 가이드 제공",
    "배멀미 관리 팁 및 약물 정보",
    "선내 의료진 소개"
  ],
  "nextActions": [
    "1:1 상담사 배정",
    "Day 0 SMS: 불안도 진단 봇",
    "Day 1 SMS: 세그먼트별 가이드"
  ],
  "smsSequenceTemplate": "high_anxiety_support"
}
```

### 2. GET /api/preparation-guides/[category]
**카테고리**: visa, passport_renewal, health, customs

**응답**:
```json
{
  "category": "visa",
  "title": "비자 신청 가이드",
  "description": "...",
  "content": { ... },
  "estimatedReadTime": 8,
  "lastUpdated": "2026-05-25"
}
```

### 3. POST /api/sms/anxiety-sequence
**요청**:
```json
{
  "contactId": "cuid...",
  "organizationId": "cuid...",
  "anxietyCategory": "high",
  "preparationStage": "visa_concern",
  "smsSequenceTemplate": "high_anxiety_support"
}
```

**응답**:
```json
{
  "contactId": "cuid...",
  "sequenceStarted": true,
  "schedules": [
    {
      "day": 0,
      "sendTime": "10:00",
      "template": { "type": "spin_question", ... },
      "delay": 0
    },
    ...
  ],
  "totalMessages": 8,
  "estimatedCompletion": "2026-05-28T20:00:00Z"
}
```

---

## 📊 Prisma Schema 확장

### Contact 모델 추가 필드

```prisma
// L2 Lens: 준비 불안도 평가 (Menu #48)
anxietyScore               Int                         @default(0)
anxietyCategory            String?                    @default("low") @db.VarChar(20)
preparationStage           String?                    @default("inquiry") @db.VarChar(50)
visaRequired               Boolean                    @default(false)
passportDaysLeft           Int?
firstTimeCruise            Boolean                    @default(false)
familyWithKids             Boolean                    @default(false)
healthConcerns             String?                    // 쉼표 구분
anxietyAssessmentAt        DateTime?
anxietySequenceStartedAt   DateTime?
```

---

## 📈 대시보드 KPI (5개)

| KPI | 현재 | 목표 | 증가 |
|-----|------|------|------|
| 예약 완료율 (고불안도) | 38-45% | 75% | **+38%p** |
| 상담 예약율 | 22.8% | 35-40% | **+12%p** |
| SMS 클릭율 | 38.5% | 45-50% | **+6.5%p** |
| 환불/취소율 | 12% | 8% | **-4%p** |
| 월 추가 예약 | - | +48-78명 | **+115%** |

---

## 🧠 적용된 심리학 렌즈

### L2: 준비 복잡도 (5-Step Mediation Questions)
**SPIN 질문법**:
1. **Situation**: "해외 경험은?"
2. **Problem**: "준비가 복잡하신가?"
3. **Implication**: "미준비 시 후속 영향?"
4. **Need**: "필요한 정보는?"
5. **Reward**: "체계적 준비의 이득?"

### 추가 렌즈
- **L6 (타이밍/손실회피)**: "비자 승인 평균 14일, 지금이 시작해야 할 때"
- **L9 (의료신뢰)**: 의료진 자격 강조, 선내 의료 서비스
- **L10 (즉시 구매)**: Day 3 삼중선택 + 상담사 즉시 배정

### PASONA 카피라이팅
```
P(Problem): 비자, 여권, 건강... 준비가 복잡해요
A(Agitate): 미준비시 탑승 불가? 정말 그럴까요?
S(Solution): 우리가 체계적으로 안내해드립니다
O(Offer): 세그먼트별 가이드 + 1:1 상담사 배정
N(Narrow): 남은 시간 48시간, 지금이 마지막 기회
A(Action): 상담 예약 → 즉시 시작!
```

---

## ✅ 구현 체크리스트

### Phase 1: API 개발 (완료)
- [x] 불안도 평가 엔드포인트 (POST /api/anxiety-assessment)
- [x] 준비 가이드 조회 (GET /api/preparation-guides/[category])
- [x] SMS 시퀀스 API (POST /api/sms/anxiety-sequence)
- [x] 4개 준비 가이드 JSON (visa/passport/health/customs)

### Phase 2: 데이터베이스
- [x] Prisma 스키마 확장 (L2 필드 8개)
- [x] 마이그레이션 파일 생성
- [ ] 마이그레이션 실행 (배포 시)

### Phase 3: UI/대시보드
- [x] Menu #48 대시보드 컴포넌트 (5가지 차트)
- [x] KPI 카드 (5개)
- [x] Day 0-3 SMS 성과 라인 차트
- [ ] 고객별 불안도 상세 조회 페이지

### Phase 4: SMS 자동화 통합
- [ ] ScheduledSms 테이블과 연동
- [ ] 크론 잡으로 Day 0-3 발송
- [ ] 응답 추적 (오픈율, 클릭율)

### Phase 5: 테스트 & 최적화
- [ ] Unit test (불안도 계산 검증)
- [ ] Integration test (API 동작 확인)
- [ ] SMS A/B 테스트 (2개 변형 자동 비교)
- [ ] 성과 모니터링 (일일/주간 리포팅)

---

## 🚀 배포 계획 (2026-05-27까지)

### 2026-05-25 (금)
- [x] API 3개 완성
- [x] 준비 가이드 4개 생성
- [x] 대시보드 컴포넌트 완성
- [x] Prisma 스키마 + 마이그레이션

### 2026-05-26 (토)
- [ ] 데이터베이스 마이그레이션 실행
- [ ] SMS 자동화 통합 (ScheduledSms)
- [ ] 테스트 (Unit + Integration)

### 2026-05-27 (일)
- [ ] 프로덕션 배포
- [ ] 모니터링 대시보드 활성화
- [ ] 고불안도 고객 2-3명 테스트

---

## 📞 Stage 3 에이전트 협력

| 담당 | 역할 | 상태 |
|-----|------|------|
| β (Menu #42) | 팀정산 L5 렌즈 구현 | 🔄 진행중 |
| Menu #48 | 준비 불안도 L2 | ✅ API 완성 |
| θ (Menu #45 API) | 7개 엔드포인트 구현 | 🔄 진행중 |

---

## 📝 메모리 파일 링크

- [[menu_38_sms_template_design]] — SMS 템플릿 4가지 라이프사이클
- [[rental_sms_3day_sequence]] — Day 0-3 자동화 기본 구조
- [[l2_lens_5step_mediation_questions]] — SPIN 질문법
- [[spin_selling_complete]] — SPIN 판매법 완전 가이드
- [[pasona_framework_complete]] — PASONA 6단계 카피

---

**마지막 업데이트**: 2026-05-25 | **상태**: API 완성, Phase 2-5 진행 예정
