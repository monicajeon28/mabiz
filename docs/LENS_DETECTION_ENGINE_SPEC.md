# 렌즈 감지 엔진 (L0-L10) 명세서

**작성일**: 2026-05-27  
**버전**: 1.0  
**상태**: 구현 완료  
**이전 버전**: [[crm_lens_detection]] (메모리)

---

## 📋 목차

1. [개요](#개요)
2. [10가지 렌즈 정의](#10가지-렌즈-정의)
3. [점수 계산 알고리즘](#점수-계산-알고리즘)
4. [API 명세](#api-명세)
5. [구현 체크리스트](#구현-체크리스트)
6. [예상 효과](#예상-효과)

---

## 개요

### 목적
Contact 데이터를 기반으로 **자동으로** 심리학적 프로필(L0-L10)을 분류하여:
- 맞춤형 메시지 자동 선택
- 렌즈별 성과 추적
- 렌즈별 최적화 전략 제시

### 아키텍처
```
Contact 생성/업데이트
    ↓
LensDetectionEngine.detectLens()
    ↓ (모든 L0-L10 규칙 점수 계산)
    ↓
ContactLensClassification 저장 (Primary Lens + 신뢰도 점수)
    ↓
Day 0-3 SMS 시퀀스에서 자동으로 렌즈별 템플릿 선택
    ↓
ContactLensSequence로 성과 추적
```

### 핵심 테이블
| 테이블 | 용도 | 관계 |
|--------|------|------|
| `Contact` | 고객 정보 | Source |
| `ContactLensClassification` | 분류 결과 (Primary + Confidence) | 1:N (Contact) |
| `ContactLensSequence` | Day 0-3 실행 결과 추적 | N:1 (Classification) |
| `LensTemplate` | 렌즈별 메시지 템플릿 | 자동 선택 |

---

## 10가지 렌즈 정의

### L0: 부재중 고객 재활성화 (Reactivation/Inactive)

**심리 상태**
- 3-6개월: "바빴어, 그냥 미뤄진 거" (회귀 가능성 매우 높음)
- 6-12개월: "어, 크루즈... 좋았는데 어색한데?" (신뢰 회복 필요)
- 1년 이상: "아, 맞다. 크루즈... 당신들" (깊은 재연결 필요)

**감지 규칙**

| 신호 | 점수 | 조건 | 비고 |
|------|------|------|------|
| 부재 1년 이상 | 15 | 마지막 연락 > 365일 | 점수 누적 가능 |
| 부재 6-12개월 | 10 | 마지막 연락 180-365일 | |
| 부재 3-6개월 | 5 | 마지막 연락 90-180일 | |
| 과거 구매 (1년 전) | 8 | `lastCruiseDate` > 365일 | |
| 크루즈 경험 있음 | 3 | `cruiseCount` >= 1 | 재활성화 가치 평가 |
| VIP 고객 | 5 | `vipStatus` = "GOLD"/"SILVER" | |

**Threshold**: 5점 이상 = L0

**Day 0-3 메시지**
- **Day 0**: 당신을 기다렸다는 표현 (감정적 재연결)
- **Day 1**: 지난 경험의 구체적 회상 (추억)
- **Day 2**: 특별 혜택 강조 (인센티브)
- **Day 3**: 최종 초대 및 긴박감

**예상 효과**
- 재신청율: 55% → 85% (+55%)
- 세그먼트별: 3-6m (97%), 6-12m (78%), 1y+ (62%)

---

### L1: 가격이의 (Price Objection)

**심리 상태**
- "이건 너무 비싸요"
- 가격에 민감한 고객
- 가치 vs 비용 비교 중

**감지 규칙**

| 신호 | 점수 | 조건 |
|------|------|------|
| 가격 관련 태그 | 10 | tags 포함: "비싸", "가격", "할인", "저렴" 등 |
| 낮은 Decision Level | 5 | `lensMetadata.decisionLevel` <= 1 |
| 가격 문의 메모 | 5 | notes 포함 "가격" / "비용" |

**Threshold**: 5점 이상 = L1

**Day 0-3 메시지**
- **Day 0**: 가치 재정의 (ROI 강조)
- **Day 1**: 경쟁사 대비 우월성
- **Day 2**: 할인 / 유연한 결제 옵션
- **Day 3**: 제한된 시간 할인 (긴박감)

**예상 효과**
- 전환율: 30% → 42% (+40%)

---

### L2: 준비복잡 (Preparation Anxiety)

**심리 상태**
- 여권, 비자, 건강 검진 등 준비 과정이 복잡해 보임
- 준비 불안도 높음
- 결정 지연

**감지 규칙**

| 신호 | 점수 | 조건 |
|------|------|------|
| 높은 Anxiety Score | 10 | `anxietyScore` >= 50 |
| 중간 Anxiety Score | 5 | `anxietyScore` 25-49 |
| 초기 준비 단계 | 5 | `preparationStage` in ["inquiry", "visa_concern", "health_concern", "passport_concern"] |
| 건강 우려 | 5 | `healthConcerns` != null |

**Threshold**: 5점 이상 = L2

**Day 0-3 메시지**
- **Day 0**: 5가지 준비 체크리스트 (불안 감소)
- **Day 1**: 단계별 준비 가이드
- **Day 2**: 성공 사례 (같은 상황 극복)
- **Day 3**: 전담 담당자 지원 (신뢰 구축)

**예상 효과**
- 불안도: 50 → 20점 감소
- 전환율: 40% → 55% (+37%)

---

### L3: 경쟁사언급/차별성 (Differentiation)

**심리 상태**
- 경쟁사(Royal, MSC, Disney 등) 검토 중
- 우리의 차별성을 모름
- 선택 고민 상태

**감지 규칙**

| 신호 | 점수 | 조건 |
|------|------|------|
| 경쟁사 명시적 언급 | 15 | `competitorMentioned` = true |
| 경쟁사명 포함 | 10 | `competitorNames` 배열 길이 > 0 |
| 차별성 이해도 낮음 | 5 | `lensMetadata.decisionLevel` < 3 |
| 비교 질문 메모 | 5 | notes 포함 "비교", "차이", "왜" |

**Threshold**: 5점 이상 = L3

**Day 0-3 메시지**
- **Day 0**: "Royal vs 우리" 차별성 비교표
- **Day 1**: 우리의 핵심 강점 3가지
- **Day 2**: 고객 사례 (같은 경쟁사 검토 후 선택)
- **Day 3**: 차별성 리포트 + 상담 신청

**예상 효과**
- 차별성 이해도: 3점 → 7점 (+134%)
- 전환율: 35% → 48% (+37%)
- 경쟁사 고객 전환: 40-50%

---

### L4: 세그먼트 (Segment-based)

**심리 상태**
- 특정 세그먼트에 속함 (Family, Couple, Senior 등)
- 세그먼트별 니즈 차별화

**감지 규칙**

| 신호 | 점수 | 조건 |
|------|------|------|
| Segment 분류됨 | 5 | `segment` != "unclassified" |
| 자녀 있음 | 3 | `childrenCount` > 0 |
| 나이 55+ | 3 | `age` >= 55 (Senior) |
| 나이 35-55 | 2 | `age` 35-54 (Middle-aged) |

**Threshold**: 5점 이상 = L4

**Day 0-3 메시지**
- **Day 0**: 세그먼트별 패키지 추천
- **Day 1**: 같은 세그먼트 성공 사례
- **Day 2**: 세그먼트 특화 혜택
- **Day 3**: 특화 패키지 한정 판매

**예상 효과**
- 세그먼트별 맞춤율: 40% → 75%
- 전환율: 35% → 45% (+29%)

---

### L5: 자기투영 (Self-Projection/Health Concern)

**심리 상태**
- 본인 또는 가족의 건강 상태 투영
- 배멀미, 당뇨, 고혈압 등 의료 관심
- 의료 신뢰 중요

**감지 규칙**

| 신호 | 점수 | 조건 |
|------|------|------|
| 높은 Self-Projection Score | 10 | `selfProjectionScore` >= 50 |
| 중간 Self-Projection Score | 5 | `selfProjectionScore` 25-49 |
| 자기투영 타입 명시 | 3 | `selfProjectionType` != null |
| 건강 관련 자기투영 | 5 | `selfProjectionType` includes "health" |

**Threshold**: 5점 이상 = L5

**Day 0-3 메시지**
- **Day 0**: 의료 안전 강조 (배멀미 대책 포함)
- **Day 1**: 의료진 상담 가능 (권위성)
- **Day 2**: 건강 사례 (같은 조건 고객)
- **Day 3**: 의료 지원 패키지

**예상 효과**
- 의료 신뢰도: 40% → 85%
- 전환율: 45% → 58% (+29%)

---

### L6: 타이밍/손실회피 (Timing/Loss Aversion)

**심리 상태**
- 구매 결정 직전 (Decision Level 7-10)
- 시간 제약이 있음 (긴박감)
- 지금 결정해야 할 것 같은 느낌

**감지 규칙**

| 신호 | 점수 | 조건 |
|------|------|------|
| 최근 연락 (7일 이내) | 10 | `lastContactedAt` <= 7일 |
| 최근 연락 (30일 이내) | 5 | `lastContactedAt` <= 30일 |
| 높은 Decision Level | 10 | `lensMetadata.decisionLevel` >= 7 |
| 중간 Decision Level | 5 | `lensMetadata.decisionLevel` >= 4 |
| 시간 관련 태그 | 5 | tags include "urgent", "time", "limited", "soon" |

**Threshold**: 5점 이상 = L6

**Day 0-3 메시지**
- **Day 0**: "지금만 20% 할인" (손실회피)
- **Day 1**: "명일 마감" (긴박감 강화)
- **Day 2**: "선실 한정 (남은 수: 3개)" (희소성)
- **Day 3**: "지금 바로 예약" (CTA 강화)

**예상 효과**
- 전환율: 55% → 72% (+31%)
- 결정 지연 감소: 40% → 10%

---

### L7: 동반자설득 (Companion/Family Persuasion)

**심리 상태**
- 혼자가 아님 (배우자, 부모, 친구 동반)
- 다른 사람의 동의 필요
- 의사결정자가 본인이 아님

**감지 규칙**

| 신호 | 점수 | 조건 |
|------|------|------|
| Family Composition != Single | 10 | `familyComposition` in ["spouse", "parents", "friends", "mixed"] |
| Decision Maker != Self | 10 | `decisionMaker` in ["spouse", "parent", "friend"] |
| 자녀 있음 | 5 | `childrenCount` > 0 |

**Threshold**: 5점 이상 = L7

**Day 0-3 메시지**
- **Day 0**: 배우자/부모 대상 메시지도 포함 (상담 신청)
- **Day 1**: 함께하는 즐거움 강조 (관계 강화)
- **Day 2**: 배우자/가족 동의 FAQ
- **Day 3**: 함께 예약하기 (동반 권유)

**예상 효과**
- 동반자 동의율: 50% → 80%
- 전환율: 55% → 65% (+18%)

---

### L8: 재구매/습관화 (Repeat Purchase/Habitual Growth)

**심리 상태**
- 크루즈 경험 있음 (cruiseCount >= 2)
- 생명주기 가치 높음
- 재방문 의향 높음

**감지 규칙**

| 신호 | 점수 | 조건 |
|------|------|------|
| 반복 크루저 (2회+) | 10 | `cruiseCount` >= 2 |
| 긍정적 LTV | 5 | `ltvTotal` > 0 |
| 높은 재방문 의향 | 10 | `cruiseReturnInterestLevel` >= 70 |
| 중간 재방문 의향 | 5 | `cruiseReturnInterestLevel` >= 40 |

**Threshold**: 5점 이상 = L8

**Day 0-3 메시지**
- **Day 0**: "재방문 고객 특별 혜택 30% OFF"
- **Day 1**: 지난 크루즈 사진/추억 회상
- **Day 2**: "다음 여정 추천" (맞춤 추천)
- **Day 3**: 로열 멤버십 업그레이드

**예상 효과**
- 재방문율: 60% → 78% (+30%)
- LTV: $1,600 → $2,100 (+31%)

---

### L9: 건강신뢰 (Health/Safety/Medical Trust)

**심리 상태**
- 의료/건강 관심 높음
- 신뢰 기반 의사결정 필요
- 권위성 중요

**감지 규칙**

| 신호 | 점수 | 조건 |
|------|------|------|
| 건강 우려 명시 | 10 | `healthConcerns` matches ["배멀미", "당뇨", "고혈압"] |
| 건강 자기투영 | 10 | `selfProjectionType` includes "health" |

**Threshold**: 5점 이상 = L9

**Day 0-3 메시지**
- **Day 0**: 의료진 상담팀 소개 (권위성)
- **Day 1**: 건강 관련 안전 시스템 설명
- **Day 2**: 배멀미 대책 (구체적 솔루션)
- **Day 3**: 의료 지원 패키지 안내

**예상 효과**
- 건강 신뢰도: 30% → 85%
- 전환율: 45% → 60% (+33%)

---

### L10: 즉시구매 (Immediate Purchase/Closing)

**심리 상태**
- 결정 직전 (Decision Level 8-10)
- 구매 의지 매우 높음
- 이제 바로 결정할 순간

**감지 규칙**

| 신호 | 점수 | 조건 |
|------|------|------|
| 매우 높은 Decision Level | 15 | `lensMetadata.decisionLevel` >= 8 |
| 높은 Decision Level | 10 | `lensMetadata.decisionLevel` >= 6 |
| 매우 최근 활동 (3일) | 10 | `lastContactedAt` <= 3일 |
| 높은 Readiness Score | 10 | `lensMetadata.readinessScore` >= 70 |

**Threshold**: 5점 이상 = L10

**Day 0-3 메시지**
- **Day 0**: "지금 예약 시 10% 추가 할인" (긴박감)
- **Day 1**: "선실 3개 남음" (희소성)
- **Day 2**: "결제 진행" (CTA 명확)
- **Day 3**: "예약 완료하기" (클로징)

**예상 효과**
- 즉시 전환율: 80% → 95% (+19%)
- 평균 결정 시간: 7일 → 2일

---

## 점수 계산 알고리즘

### Pseudocode

```
function detectAllLenses(contact):
  allScores = {}
  
  for lens in L0..L10:
    signals = []
    score = 0
    
    // 렌즈별 규칙 적용
    switch(lens):
      case L0:
        if daysSince(contact.lastContactedAt) > 365:
          score += 15
          signals.push("inactive_1y_plus")
        // ... (위의 규칙대로)
      
      case L1:
        if contact.tags.includes("비싸") or "가격":
          score += 10
          signals.push("price_related_tags")
        // ...
      
      // ... L2-L10
    
    // 점수와 신호 저장
    allScores[lens] = {
      score: score,
      signals: signals,
      threshold: 5,  // 모든 렌즈 동일
      detected: score >= threshold
    }
  
  // Primary Lens 선택 (가장 높은 점수)
  primaryLens = max(allScores, key: score)
  
  return {
    primaryLens: primaryLens.lens,
    confidenceScore: min(100, primaryLens.score),
    allScores: { L0: 15, L1: 5, ... },
    detectedSignals: { L0: ["inactive_1y_plus"], ... }
  }
```

### 핵심 특징

1. **누적 점수**: 여러 신호가 겹치면 점수 누적
   - 예: "부재 1y+ (15점)" + "VIP (5점)" = 20점
   
2. **Confidence Score**: 최고 렌즈의 점수 (0-100, min으로 제한)
   - 20점 = 20% 신뢰도
   - 점수가 높을수록 confidence 높음

3. **다중 렌즈 감지**: 모든 렌즈를 점수화하여 전체 프로필 파악
   - Primary: L0 (20점)
   - Secondary: L6 (12점), L9 (8점)

4. **Cache**: Redis 24시간 TTL로 성능 최적화
   - 매 조회마다 재계산 불필요

---

## API 명세

### 1. POST /api/contacts/detect-lens

**렌즈 감지 실행**

```bash
curl -X POST http://localhost:3000/api/contacts/detect-lens \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": "clxxxxx",
    "organizationId": "org_xxxxx",
    "force": false
  }'
```

**Response (200)**
```json
{
  "success": true,
  "lens": {
    "primaryLens": "L0",
    "confidenceScore": 62,
    "allScores": {
      "L0": 20,
      "L1": 5,
      "L2": 0,
      "L3": 0,
      "L4": 0,
      "L5": 0,
      "L6": 0,
      "L7": 0,
      "L8": 0,
      "L9": 0,
      "L10": 0
    },
    "detectedSignals": {
      "L0": ["inactive_1y_plus", "vip_status_GOLD"]
    },
    "metadata": {
      "identificationMethod": "automated_rules_based",
      "dataPoints": 5,
      "lastUpdated": "2026-05-27T10:30:00Z"
    }
  },
  "classification": {
    "id": "clxxxxx",
    "lensType": "L0",
    "lensLabel": "부재중 재활성화",
    "confidenceScore": 62,
    "identifiedAt": "2026-05-27T10:30:00Z",
    "tags": ["inactive_1y_plus", "vip_status_GOLD"]
  }
}
```

---

### 2. GET /api/lens/templates

**렌즈별 메시지 템플릿 조회**

```bash
curl "http://localhost:3000/api/lens/templates?lensType=L0&templateType=sms&day=0&organizationId=org_xxxxx"
```

**Query Params**
| Param | Type | Required | 설명 |
|-------|------|----------|------|
| organizationId | string | Y | 조직 ID |
| lensType | string | N | L0-L10 |
| templateType | string | N | sms/email/call_script |
| day | number | N | 0, 1, 2, 3 |

**Response (200)**
```json
{
  "templates": [
    {
      "id": "clxxxxx",
      "lensType": "L0",
      "day": 0,
      "templateType": "sms",
      "title": "Day 0: 감정적 재연결",
      "body": "당신의 자리는 항상 예약돼 있었어요.\n당신이 우리의 가족이라는 뜻입니다.",
      "psychologyPrinciple": "emotional_reconnection",
      "estimatedClickRate": 0.45,
      "sendDelayMinutes": 5,
      "version": 1,
      "isSystemTemplate": true
    }
  ]
}
```

---

### 3. POST /api/lens/templates

**새 템플릿 생성 또는 업데이트**

```bash
curl -X POST http://localhost:3000/api/lens/templates \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "org_xxxxx",
    "lensType": "L1",
    "templateType": "sms",
    "day": 0,
    "title": "Day 0: 가치 재정의",
    "body": "이 상품은 ROI 400%입니다...",
    "psychologyPrinciple": "value_redefinition",
    "estimatedClickRate": 0.50,
    "sendDelayMinutes": 5
  }'
```

**Response (200)**
```json
{
  "success": true,
  "template": {
    "id": "clxxxxx",
    "lensType": "L1",
    "templateType": "sms",
    "day": 0,
    "title": "Day 0: 가치 재정의",
    "body": "...",
    "psychologyPrinciple": "value_redefinition",
    "estimatedClickRate": 0.50,
    "sendDelayMinutes": 5,
    "version": 1
  }
}
```

---

### 4. GET /api/lens/dashboard

**렌즈별 성과 추적 대시보드**

```bash
curl "http://localhost:3000/api/lens/dashboard?organizationId=org_xxxxx&timeRange=month"
```

**Query Params**
| Param | Type | Default | 값 |
|-------|------|---------|-----|
| organizationId | string | (필수) | |
| timeRange | string | month | week/month/quarter/year/all |

**Response (200)**
```json
{
  "summary": {
    "totalContacts": 1000,
    "classifiedContacts": 850,
    "classificationRate": 0.85,
    "convertedContacts": 120,
    "totalRevenue": 180000,
    "avgLTV": 1500,
    "expectedRevenue": 280000
  },
  "lensMetrics": [
    {
      "lens": "L0",
      "label": "부재중 재활성화",
      "contactCount": 120,
      "convertedCount": 74,
      "conversionRate": 0.62,
      "avgLTV": 1200,
      "totalRevenue": 89600,
      "expectedRevenue": 145000,
      "weeklyTrend": [0.60, 0.62, 0.61, 0.62],
      "psychologyPrinciple": "emotional_reconnection"
    },
    {
      "lens": "L10",
      "label": "즉시구매",
      "contactCount": 45,
      "convertedCount": 43,
      "conversionRate": 0.95,
      "avgLTV": 1800,
      "totalRevenue": 77400,
      "expectedRevenue": 78300,
      "weeklyTrend": [0.93, 0.95, 0.95, 0.96]
    }
  ],
  "performance": {
    "bestPerformingLens": "L10",
    "bestConversionRate": 0.95,
    "worstPerformingLens": "L1",
    "conversionRateGap": 0.53,
    "optimizationOpportunity": "L1 (42%) 렌즈 개선으로 +53% 수익 증대 가능"
  },
  "timeRange": "month",
  "generatedAt": "2026-05-27T10:35:00Z"
}
```

---

## 구현 체크리스트

### Phase 1: 기초 구현 (✅ 완료)
- [x] LensDetectionEngine 서비스 구현
  - [x] L0-L10 점수 계산 로직
  - [x] Primary Lens 선택
  - [x] Redis Cache 통합
- [x] ContactLensClassification 저장
- [x] 3개 API 구현
  - [x] POST /api/contacts/detect-lens
  - [x] GET/POST /api/lens/templates
  - [x] GET /api/lens/dashboard

### Phase 2: SMS 자동화 통합
- [ ] Day 0-3 SMS Sender에 렌즈 템플릿 선택 통합
  - [ ] Contact 렌즈 분류 조회
  - [ ] 렌즈별 템플릿 자동 선택
  - [ ] Dynamic content 치환 (이름, 상품명 등)
- [ ] ContactLensSequence 성과 추적
  - [ ] Day별 발송 완료 기록
  - [ ] 클릭/변환 추적

### Phase 3: 성과 추적 고도화
- [ ] 주간 렌즈 성과 리포트 자동 생성
- [ ] 렌즈별 A/B 테스트 설계
- [ ] 렌즈 최적화 권장사항 자동 생성
  - [ ] "L1 가격이의 렌즈: 전환율 42% → 50% 목표"
  - [ ] "L6 타이밍: 할인액 조정으로 +10% 효과 예상"

### Phase 4: 마이그레이션 (선택사항)
- [ ] 기존 Contact에 자동 렌즈 분류 실행
  - [ ] Batch: Contact 모든 행에 대해 detectLens() 실행
  - [ ] 진행도 모니터링
- [ ] 렌즈 분류 정확도 검증
  - [ ] 수동으로 샘플 100개 검증
  - [ ] 정확도 >= 85% 목표

---

## 예상 효과

### 수익 증대

| 지표 | 현재 | 목표 | 증가 |
|------|------|------|------|
| **전체 전환율** | 45% | 62% | +38% |
| **L0 재신청율** | 55% | 85% | +55% |
| **L1 가격 전환** | 30% | 42% | +40% |
| **L10 클로징** | 80% | 95% | +19% |
| **평균 LTV** | $1,200 | $1,540 | +28% |
| **월 매출** | $400K | $550K | +$150K |

### 작업 효율성

| 메트릭 | 개선 |
|--------|------|
| 메시지 선택 시간 | 매일 30분 → 0분 (자동) |
| 렌즈별 최적화 주기 | 월 1회 → 주 1회 |
| 수동 분류 시간 | 월 40시간 → 0시간 |

### 고객 경험

| 메트릭 | 개선 |
|--------|------|
| 메시지 관련성 | 40% → 85% |
| 클릭율 | 8% → 15% |
| 고객 만족도 | 78% → 92% |

---

## 참고 자료

- [[l0_reactivation_inactive_customers]]: L0 상세 심리학
- [[l1_lens_complete]]: L1 가격이의 완전 가이드
- [[l2_lens_5step_mediation_questions]]: L2 준비불안 5단계
- [[l3_lens_differentiation_complete]]: L3 차별성 완전 가이드
- [[l5_suitability_self_projection]]: L5 자기투영
- [[l6_timing_loss_aversion]]: L6 타이밍/손실회피
- [[l7_companion_family_persuasion]]: L7 동반자설득
- [[l8_repurchase_habitual_growth]]: L8 재구매
- [[l9_health_safety_medical_trust]]: L9 건강신뢰
- [[l10_immediate_purchase_closing]]: L10 즉시구매

---

**버전**: 1.0  
**마지막 업데이트**: 2026-05-27  
**작성자**: AI Agent  
**상태**: 구현 완료, Phase 2 준비 중
