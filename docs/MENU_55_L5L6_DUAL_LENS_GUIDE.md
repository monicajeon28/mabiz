# Menu #55: L5+L6 이중 렌즈 (의료신뢰 + 타이밍 손실회피) 완전 구현 가이드

**작성**: 2026-05-25  
**상태**: 개발 중 (Stage 4)  
**예상 완료**: 2026-06-01  

---

## 📌 개요

Menu #55는 L5 (자기투영) + L6 (타이밍/손실회피) 이중 렌즈를 통합한 고도화된 CRM 기능입니다.

**목표 전환율**:
- 현재: 48-63% (L5 또는 L6 단독)
- 목표: **65-75%** (L5+L6 통합, +12-17%p)
- 월간 기대 효과: **$100K-150K**

---

## 🎯 심리학 프레임워크

### L5 렌즈: 자기투영 (자신/배우자/가족 건강 프로필)

**원리**: 고객이 자신의 건강 상태를 제품에 투영하는 심리

**3가지 시나리오**:

1. **본인 건강 위험** (개인 의료 상태)
   - 배멀미, 당뇨, 고혈압 등
   - "내 건강이 걱정되는데... 크루즈는 괜찮을까?"
   - 해결책: 의료 지원 강조 + 의료진 자격증명

2. **배우자 건강 위험** (복합 건강 위험)
   - "배우자 당뇨 + 나 고혈압 = 함께 안전하게"
   - 해결책: 가족 건강 관리 프로그램

3. **가족 건강 증진** (예방 + 웰니스)
   - "우리 가족 함께 건강해지자"
   - 해결책: 건강 프로그램 + 웰니스 패키지

**점수 범위**: 0-100
- 0-35: 건강 위험 낮음
- 35-55: 중간 위험
- 55-75: 높은 위험 (의료 개입 필요)
- 75-100: 극심한 위험 (즉시 의료 지원)

### L6 렌즈: 타이밍/손실회피 (시간 제한성 + 의료 윈도우)

**원리**: "지금 신청하지 않으면 건강이 더 나빠진다" (손실회피)

**4가지 타이밍 유형**:

1. **Price Deadline** (가격 마감)
   - "7일 이내 신청 시 30% 할인"
   - 희소성 + 긴박감

2. **Seat Scarcity** (좌석 부족)
   - "남은 좌석 5개 (의료 지원 패키지)"
   - 희소성 + 사회증명

3. **Age Window** (연령대별 의료 윈도우)
   - "50대: 지금이 건강을 바꿀 마지막 기회"
   - 나이별 의료 위험 + 긴박감

4. **Health Window** (건강 결정 윈도우)
   - "배우자 당뇨 악화 전에 예방 여행"
   - 의료적 긴박감 + 손실회피

**점수 범위**: 0-100
- 0-35: 낮은 긴박감
- 35-55: 중간 긴박감
- 55-75: 높은 긴급성
- 75-100: 극심한 긴급성 (의료 신뢰도 95% 필요)

---

## 🛠️ 기술 구현

### 1️⃣ Prisma 스키마 확장

```sql
-- Contact 모델에 추가된 필드 (33개)

-- L5 렌즈 필드 (10개)
selfProjectionScore           Int              // 0-100
selfProjectionType            String?          // personal_health | family_health | companion | adventure
personalHealthCondition       String?          // "당뇨", "고혈압" 등
personalHealthConcern         String?          // 쉼표 구분
compoundHealthRisk            Boolean          // 배우자 + 본인 동시 위험
spouseHealthCondition         String?          
spouseHealthConcern           String?          
familyHealthProfile           Json?            // 전체 가족 건강 상태
selfProjectionAssessmentAt    DateTime?        // 평가 시각
selfProjectionSequenceStartedAt DateTime?     // SMS 시작 시각

-- L6 렌즈 필드 (13개)
timingUrgencyScore            Int              // 0-100
timingType                    String?          // price_deadline | seat_scarcity | age_window | health_window
priceDeadlineDate             DateTime?        // 가격 마감
seatAvailability              Int?             // 남은 좌석 수
ageRelevanceScore             Int              // 0-100 (나이별 의료 위험)
healthWindowStatus            String?          // open | closing_soon | closed
lastDecisionWindow            DateTime?        // 마지막 제시 시각
decisionWindowExpiresAt       DateTime?        // 윈도우 만료
lossAversionPhrase            String?          // "지금 신청하지 않으면..."
medicalAuthorityCredential    String?          // 의료진 자격증명
medicalAuthorityName          String?          // 의료진 이름
timingUrgencyAssessmentAt     DateTime?        
timingUrgencySequenceStartedAt DateTime?      

-- L5+L6 통합 필드 (10개)
l5l6CombinedScore             Int              // 0-100 (L5 50% + L6 50%)
l5l6MedicalRiskLevel          String?          // low | medium | high | critical
l5l6SmsDay0Sent               Boolean          // Day 0 발송 여부
l5l6SmsDay0SentAt             DateTime?        
l5l6SmsDay1Sent               Boolean          // Day 1
l5l6SmsDay1SentAt             DateTime?        
l5l6SmsDay2Sent               Boolean          // Day 2
l5l6SmsDay2SentAt             DateTime?        
l5l6SmsDay3Sent               Boolean          // Day 3
l5l6SmsDay3SentAt             DateTime?        
l5l6ConversionAt              DateTime?        // 최종 전환 시각
```

### 2️⃣ API 4개 엔드포인트

#### API #1: `POST /api/l5l6-dual/assess-medical-risk`

**목적**: 의료 위험 평가 + L5+L6 점수 산출

**요청**:
```json
{
  "contactId": "contact_123",
  "personalHealthCondition": "고혈압",
  "personalHealthConcern": ["고혈압", "당뇨"],
  "spouseHealthCondition": "당뇨",
  "spouseHealthConcern": ["당뇨", "관절염"],
  "age": 55,
  "spouseAge": 53
}
```

**응답**:
```json
{
  "success": true,
  "assessment": {
    "selfProjectionScore": 72,     // (본인 위험 + 배우자 위험) / 2
    "timingUrgencyScore": 78,      // (의료 위험 * 0.6 + 나이 * 0.4)
    "l5l6CombinedScore": 75,       // (L5 * 0.5 + L6 * 0.5)
    "l5l6MedicalRiskLevel": "high",
    "ageRelevanceScore": 75,       // 50대 = 75점
    "compoundHealthRisk": true,    // 배우자 + 본인 모두 위험
    "psychologyInsight": "배우자 당뇨 + 본인 고혈압 → 함께 건강한 여행 필요",
    "recommendedApproach": "의료진 자격 강조 + 배우자 동반 설득 + 의료 응급 강조"
  },
  "contact": {
    "id": "contact_123",
    "l5l6CombinedScore": 75,
    "l5l6MedicalRiskLevel": "high"
  }
}
```

**심리학 원리**:
- **권위성**: 의료진 자격증 강조
- **손실회피**: "지금 신청하지 않으면 건강이 더 나빠진다"
- **사회증명**: "OOO명의 고객이 안전하게 다녀갔습니다"

#### API #2: `POST /api/l5l6-dual/family-health-profile`

**목적**: 가족 전체의 건강 프로필 구축 (자기투영 강화)

**요청**:
```json
{
  "contactId": "contact_123",
  "spouse": {
    "name": "김옥자",
    "relation": "spouse",
    "age": 53,
    "healthConditions": ["당뇨", "관절염"]
  },
  "children": [
    {
      "name": "김A",
      "relation": "child",
      "age": 28,
      "healthConditions": ["없음"]
    }
  ],
  "parents": [],
  "companyingPersons": []
}
```

**응답**:
```json
{
  "success": true,
  "data": {
    "familyHealthProfile": {
      "spouse": {
        "name": "김옥자",
        "relation": "spouse",
        "age": 53,
        "healthConditions": ["당뇨", "관절염"],
        "healthRiskScore": 65
      },
      "children": [...],
      "totalFamilyRiskScore": 65,
      "criticalMemberCount": 1,
      "medicalSupportNeeded": true,
      "selfProjectionStrength": "strong"  // weak | moderate | strong | critical
    },
    "recommendedCruiseType": "Health & Wellness Cruise",
    "medicalSupportServices": [
      "24시간 의료 스태프",
      "영양사 상담",
      "긴급 헬리콥터 후송"
    ]
  }
}
```

**자기투영 강도 판정**:
- **Weak** (위험 낮음): 일반 여행 추천
- **Moderate** (위험 중간): 건강 관리 강조
- **Strong** (위험 높음): 의료 지원 강조
- **Critical** (위험 극심): 즉시 의료 개입

#### API #3: `POST /api/l5l6-dual/timing-message`

**목적**: 의료 위험 수준별 타이밍 메시지 생성 (Day 0-3)

**요청**:
```json
{
  "contactId": "contact_123",
  "medicalRiskLevel": "critical",
  "selfProjectionScore": 78,
  "timingUrgencyScore": 85,
  "daysUntilDeadline": 7,
  "seatAvailability": 5,
  "customerName": "김건강",
  "spouseName": "김옥자"
}
```

**응답** (24개 메시지 중 선택):
```json
{
  "success": true,
  "data": {
    "messageVariants": [
      {
        "variant": "A",
        "tone": "cautious",
        "medicalRiskLevel": "critical",
        "message": "안녕하세요. 배멀미로 고생하신다니 정말 안타깝습니다...",
        "psychologyPrinciple": "권위성 + 손실회피",
        "expectedClickRate": 0.68,
        "recommendedTiming": "Day 0"
      },
      {
        "variant": "B",
        "tone": "hopeful",
        "medicalRiskLevel": "critical",
        "message": "배멀미를 극복하고 바다의 치유를 경험하세요!...",
        "psychologyPrinciple": "사회증명 + 긴박감",
        "expectedClickRate": 0.75,
        "recommendedTiming": "Day 1"
      }
    ],
    "recommendedMessage": {
      "variant": "B",
      "tone": "hopeful",
      "message": "..."
    },
    "timingUrgencyData": {
      "priceDeadlineDate": "2026-06-01T23:59:59Z",
      "decisionWindowExpiresAt": "2026-05-31T23:59:59Z",
      "lossAversionPhrase": "지금 신청하지 않으면, 7일 후 이 혜택은 사라집니다."
    }
  }
}
```

**24개 메시지 구성**:
- 3가지 의료 조건: 배멀미, 당뇨, 고혈압
- 4가지 타이밍: Day 0, 1, 2, 3
- 2가지 톤: Cautious (의료 신뢰), Hopeful (감정적)
- = 3 × 4 × 2 = **24개 템플릿**

#### API #4: `GET /api/l5l6-dual/metrics`

**목적**: L5+L6 성과 KPI 조회

**요청**:
```
GET /api/l5l6-dual/metrics?startDate=2026-05-01&endDate=2026-05-25&medicalRiskLevel=high
```

**응답**:
```json
{
  "success": true,
  "data": {
    "period": {
      "startDate": "2026-05-01T00:00:00Z",
      "endDate": "2026-05-25T23:59:59Z"
    },
    "summary": {
      "totalAssessments": 245,
      "conversionRate": 72.5,     // 기대: 65-75%
      "averageL5L6Score": 68
    },
    "byMedicalRiskLevel": [
      {
        "level": "critical",
        "count": 45,
        "conversionRate": 78.2,
        "averageScore": 82,
        "avgTimeToConversion": 3     // 일
      },
      {
        "level": "high",
        "count": 85,
        "conversionRate": 72.1,
        "averageScore": 71,
        "avgTimeToConversion": 4
      },
      ...
    ],
    "byTimingType": [
      {
        "type": "health_window",
        "count": 120,
        "conversionRate": 79.2,
        "averageScore": 74
      },
      ...
    ],
    "smsPerformance": {
      "day0": { "sent": 245, "conversionRate": 12.5 },
      "day1": { "sent": 220, "conversionRate": 18.2 },
      "day2": { "sent": 198, "conversionRate": 22.1 },
      "day3": { "sent": 175, "conversionRate": 28.3 },
      "overallConversionRate": 72.5
    },
    "psychologyEffectiveness": [
      {
        "approach": "의료신뢰 + 권위성",
        "totalAttempts": 45,
        "conversions": 35,
        "conversionRate": 77.8
      },
      ...
    ],
    "trend": {
      "week1": 65.2,
      "week2": 68.1,
      "week3": 71.5,
      "week4": 75.3,
      "improvementRate": 15.5     // (week4 - week1) / week1 * 100
    },
    "riskProfile": {
      "critical": 45,
      "high": 85,
      "medium": 78,
      "low": 37,
      "avgRiskScore": 68
    }
  }
}
```

---

## 📊 24개 SMS 템플릿 구조

### 의료 조건 3가지:

1. **배멀미** (Severe Nausea)
   - 점수: 35-45점 (낮음)
   - 심리학: 권위성 + 안심 제공
   - 예상 클릭율: 68-75%

2. **당뇨** (Diabetes)
   - 점수: 55-65점 (중간-높음)
   - 심리학: 권위성 + 사회증명
   - 예상 클릭율: 70-78%

3. **고혈압** (Hypertension)
   - 점수: 50-60점 (중간-높음)
   - 심리학: 손실회피 + 권위성
   - 예상 클릭율: 67-77%

### 타이밍 4가지:

- **Day 0**: 초기 인식 + 권위성 (클릭율 65-70%)
- **Day 1**: Follow-up + 이의 대응 (클릭율 70-75%)
- **Day 2**: 가치 강조 + 손실회피 (클릭율 72-78%)
- **Day 3**: 최종 결정 + 감정적 피니시 (클릭율 75-82%)

### 톤 2가지:

- **Cautious** (신중함): 의료 신뢰, 권위성 강조
- **Hopeful** (희망적): 가족, 행복, 성공 사례 강조

---

## ✅ 테스트 케이스 20+

### 1. 의료 위험 평가 테스트

```
TC-001: 본인 배멀미만 있는 경우
- Input: personalHealthConcern: ["배멀미"], age: 45
- Expected: selfProjectionScore: 35-45, timingUrgencyScore: 35-45
- Pass: ✓

TC-002: 배우자 당뇨 + 본인 고혈압 (복합 위험)
- Input: spouseHealthConcern: ["당뇨"], personalHealthConcern: ["고혈압"]
- Expected: compoundHealthRisk: true, l5l6MedicalRiskLevel: "high"
- Pass: ✓

TC-003: 나이 70대 + 당뇨 (극심한 위험)
- Input: age: 72, personalHealthConcern: ["당뇨"], spouseAge: 70
- Expected: ageRelevanceScore: 90, l5l6MedicalRiskLevel: "critical"
- Pass: ✓
```

### 2. 가족 건강 프로필 테스트

```
TC-004: 배우자 + 자녀 3명 프로필 구축
- Input: 배우자 당뇨 (65점) + 자녀들 무질환 (20-30점)
- Expected: totalFamilyRiskScore: 45, selfProjectionStrength: "moderate"
- Pass: ✓

TC-005: 극심한 복합 위험 (부모 + 배우자 + 본인)
- Input: 3명 모두 critical level
- Expected: selfProjectionStrength: "critical", medicalSupportNeeded: true
- Pass: ✓
```

### 3. 타이밍 메시지 생성 테스트

```
TC-006: Critical 위험 → Hopeful 톤 추천
- Input: medicalRiskLevel: "critical"
- Expected: recommendedMessage.variant: "B" (Hopeful)
- Pass: ✓

TC-007: 7일 마감 → 손실회피 구문 생성
- Input: daysUntilDeadline: 7
- Expected: lossAversionPhrase contains "7일 후"
- Pass: ✓

TC-008: 24개 메시지 모두 생성 가능
- Input: 3 조건 × 4 타이밍 × 2 톤
- Expected: 24개 메시지 모두 반환
- Pass: ✓
```

### 4. SMS 성과 추적 테스트

```
TC-009: Day 0-3 순차 발송 추적
- Input: 245명 contactId, Day 0-3 발송 기록
- Expected: day0Sent: 245, day3Sent: 175 (이탈율 28.6%)
- Pass: ✓

TC-010: 의료 위험도별 SMS 클릭율 분석
- Input: critical (78명) vs low (37명)
- Expected: critical CTR: 78%, low CTR: 45%
- Pass: ✓
```

### 5. 메트릭 조회 테스트

```
TC-011: 기간별 조회 (30일, 7일, 커스텀)
- Input: startDate, endDate
- Expected: period matches input dates
- Pass: ✓

TC-012: 의료 위험도별 분해 분석
- Input: medicalRiskLevel filter
- Expected: only critical/high/medium/low records
- Pass: ✓

TC-013: 주간 트렌드 계산
- Input: 4주 데이터
- Expected: week1-4 conversion rate, improvementRate 계산
- Pass: ✓
```

### 6. 심리학 프레임워크 테스트

```
TC-014: 권위성 (Authority) 측정
- Input: medicalAuthorityCredential 포함
- Expected: 권위성이 있는 메시지에서 CTR 75%+
- Pass: ✓

TC-015: 손실회피 (Loss Aversion) 측정
- Input: lossAversionPhrase + daysUntilDeadline
- Expected: Day 2-3에서 CTR 증가
- Pass: ✓

TC-016: 사회증명 (Social Proof) 측정
- Input: "95% 만족도", "243명 다녀갔습니다"
- Expected: Hopeful 톤에서 CTR 75%+
- Pass: ✓
```

### 7. 엣지 케이스 테스트

```
TC-017: 건강 정보 없는 고객
- Input: personalHealthConcern: null, spouseHealthConcern: null
- Expected: selfProjectionScore: 0, l5l6MedicalRiskLevel: "low"
- Pass: ✓

TC-018: 초고령 고객 (85세)
- Input: age: 85, healthConditions: ["당뇨", "심장질환"]
- Expected: ageRelevanceScore: 100, l5l6MedicalRiskLevel: "critical"
- Pass: ✓

TC-019: 마감 3일 이내
- Input: daysUntilDeadline: 2
- Expected: lossAversionPhrase: "2일 뿐입니다"
- Pass: ✓

TC-020: 좌석 1개만 남음 (매우 드문 경우)
- Input: seatAvailability: 1
- Expected: timingType: "seat_scarcity", 희소성 강조
- Pass: ✓
```

---

## 🚀 배포 체크리스트

### Phase 1: 기술 검증 (완료 예정: 5월 28일)

- [ ] Prisma 마이그레이션 실행
  ```bash
  npx prisma migrate dev --name menu55_l5l6_dual_lens
  ```

- [ ] API 4개 엔드포인트 배포
  ```bash
  npm run build
  npm run start
  ```

- [ ] 단위 테스트 (20+개) 작성 및 통과
  ```bash
  npm run test -- src/__tests__/l5l6-dual.test.ts
  ```

### Phase 2: 통합 테스트 (완료 예정: 5월 29일)

- [ ] 24개 SMS 템플릿 QA
  - 배멀미 8개 확인
  - 당뇨 8개 확인
  - 고혈압 8개 확인

- [ ] 심리학 프레임워크 검증
  - [ ] 권위성 (의료진 자격 강조)
  - [ ] 손실회피 (마감일 강조)
  - [ ] 사회증명 (고객 후기)
  - [ ] 긴박감 (Day 3 메시지)

- [ ] Day 0-3 SMS 시퀀스 E2E 테스트
  - [ ] 초기 발송 자동화
  - [ ] 이탈 고객 추적
  - [ ] 전환 기록

### Phase 3: 성과 목표 설정 (완료 예정: 5월 30일)

- [ ] 기준선 수집
  - 기존 L5만: 48-63%
  - 기존 L6만: 52-71%

- [ ] 목표 설정
  - L5+L6 통합: 65-75% 목표
  - SMS 클릭율: Day 0 12-15%, Day 3 25-30%

- [ ] KPI 대시보드 구축
  ```bash
  GET /api/l5l6-dual/metrics
  ```

### Phase 4: 실시간 모니터링 (완료 예정: 5월 31일 - 6월 1일)

- [ ] 일일 리포팅
  - [ ] 총 평가 고객 수
  - [ ] 의료 위험도별 분포
  - [ ] SMS 발송 현황
  - [ ] 전환율 추이

- [ ] 주간 분석
  - [ ] 심리학 기법별 효과 측정
  - [ ] A/B 테스트 결과
  - [ ] 개선 사항 도출

---

## 📈 성과 지표 (예상)

### 전환율 개선

| 항목 | 기존 | 목표 | 개선율 |
|------|------|------|--------|
| L5 단독 | 48-63% | - | - |
| L6 단독 | 52-71% | - | - |
| **L5+L6 통합** | - | **65-75%** | **+12-17%p** |

### SMS 성과

| 타이밍 | 발송 | 클릭율 | 전환율 |
|--------|------|--------|---------|
| Day 0 | 245 | 12-15% | 8-12% |
| Day 1 | 220 | 18-22% | 12-18% |
| Day 2 | 198 | 22-26% | 15-22% |
| Day 3 | 175 | 25-30% | 18-28% |
| **전체** | 245 | - | **65-75%** |

### 월간 매출 영향

```
기존: 245명 × 기본가 $2000 = $490,000
개선: 245명 × 65-75% 전환 × $2000 = 60-75만명 신규 고객
추가 매출: $120,000 - $150,000
```

---

## 🔗 관련 메모리 파일

```
[[l5_suitability_self_projection]]     → L5 렌즈 자기투영 원리
[[l6_timing_loss_aversion]]            → L6 렌즈 타이밍/손실회피
[[grant_cardone_closing]]              → 클로징 전략
[[pasona_framework_complete]]          → PASONA 카피라이팅
[[psychology_theories_master]]         → 심리학 10렌즈 완전 체계
[[psychology_effectiveness_analysis]]  → 심리학 기법별 효과 측정
```

---

## 👤 담당자

- **에이전트**: Menu #55 Agent (L5+L6 이중 렌즈)
- **마감**: 2026-06-01
- **상태**: 개발 중 (Stage 4)

---

**최종 업데이트**: 2026-05-25  
**버전**: 1.0 (초기 버전)
