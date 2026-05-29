# Loop 6-D: Contact Auto-Creator 빠른 참조 가이드

## 🎯 핵심 3가지 함수

### 1️⃣ Segment 분류 (A-E)
```typescript
detectSegmentByAge(age?, ageRange?, preferenceType?, familyComposition?) → Segment

// 우선순위
1. preferenceType: "romantic" → A, "family" → B, "culture" → C, "luxury" → D, "senior" → E
2. familyComposition: "couple" → A, "family_with_kids" → B, "multi_generation" → C/D
3. age: 20-30 → A, 31-50 → B, 51-60 → C, 61-70 → D, 70+ → E
```

### 2️⃣ Lens 감지 (L0-L10 + 신뢰도)
```typescript
detectLens(payload) → LensDetectionResult {
  currentLens,    // L0-L10
  confidence,     // 0-100 신뢰도
  triggers        // 감지 근거
}

// 최고 점수 렌즈 자동 선택
L0: 6개월+ 부재중 (신규는 스킵)
L1: 가격 (35점)
L2: 준비 (30-55점)
L3: 경쟁사 (45점)
L4: 피처 (25점)
L5: 의료 (15-20점)
L6: 타이밍 (20-40점) ← 기본값
L7: 가족 (20-30점)
L8: 재방문 (35-55점)
L9: 건강 (40-50점)
L10: 즉시구매 (30-50점)
```

### 3️⃣ Risk Score 계산 (0-100 + 10신호)
```typescript
calculateRiskScore(payload, lens, segment) → RiskScoringResult {
  riskScore,              // 0-100
  riskLevel,              // LOW | MEDIUM | HIGH | CRITICAL
  signals: string[],      // 위험 신호 배열
  recommendedAction       // 자동 추천 액션
}

// 신호 가중치
의료 +25, 가격민감 +20, 준비도낮음 +20, 경쟁사 +15, 
고령 +10, 예약금미 +15, 출발임박 +20, 가족동의미 +10, ...

// Level 기준
0-29: LOW    (표준 Day 0)
30-49: MEDIUM (양육 시퀀스)
50-69: HIGH   (에스컬레이션)
70+: CRITICAL (즉시 개입)
```

---

## 📊 신호(Triggers) 치트시트

### Lens별 최고 신호 (점수 내림차순)

| Lens | 신호 | 점수 | 키워드 |
|------|------|------|--------|
| L1 | 가격 키워드 | 35 | "비싼", "할인", "가격" |
| L3 | 경쟁사 언급 | 45 | "코스타", "로열", "카니발" |
| L9 | 건강 우려 | 40 | "배멀미", "당뇨", "고혈압" |
| L8 | 재구매 경험 | 35 | pastCruiseCount >= 1 |
| L2 | 준비 불안 | 30 | "여권", "준비", "불안" |
| L7 | 가족 이의 | 30 | familyObjections[] |
| L6 | 출발 30일 | 40 | departureDate <= 30days |
| L10 | 결제 입금 | 30 | paymentId + totalPrice |
| L4 | 피처 문의 | 25 | "객실", "기항지", "시설" |
| L5 | 의료 관심 | 20 | age >= 60 + health |

---

## 🏷️ Tags 자동 생성 패턴

### 기본 구조
```
source:{source}               // cruisedot_payment, form_submission, ...
segment:{segment}             // A, B, C, D, E
lens:{lens}                   // L0, L1, ..., L10
risk:{riskLevel}              // LOW, MEDIUM, HIGH, CRITICAL

복합: {segment}_{lens}_{risk}_{priority}
예: A_L1_HIGH_URGENT
    B_L2_MEDIUM_NORMAL
    C_L9_LOW_NORMAL

특수: reactivation_needed, price_sensitive, prep_anxiety, ...
```

### 예시
```
["source:form_submission", 
 "segment:B", 
 "lens:L1", 
 "risk:HIGH", 
 "B_L1_HIGH_PRIORITY", 
 "price_sensitive"]
```

---

## 💡 Webhook Payload 최소/최대 예시

### 최소 (필수 필드만)
```json
{
  "name": "김철수",
  "phone": "010-1234-5678",
  "source": "form_submission"
}
→ segment: B (기본값)
→ lens: L6 (기본값, 신뢰도 25)
→ riskScore: 15 (정보 부족)
```

### 최대 (모든 신호)
```json
{
  "name": "박순희",
  "phone": "010-9876-5432",
  "email": "park@example.com",
  "age": 68,
  "preferenceType": "medical",
  "familyComposition": "multi_generation",
  "cruiseInterest": "europe",
  "budgetRange": "50m-70m",
  "departureDate": "2026-06-20",
  "paymentId": "pay_123",
  "source": "cruisedot_payment",
  "healthConcerns": ["배멀미", "당뇨"],
  "pastCruiseCount": 3,
  "competitorMentioned": ["로열"]
}
→ segment: E (의료 선호)
→ lens: L9 (건강 우려 50점)
→ confidence: 90
→ riskScore: 60+ (여러 신호 누적)
→ riskLevel: HIGH
```

---

## 🔧 Contact.lensMetadata 구조

```typescript
{
  currentLens: string,              // "L1", "L9", etc
  confidence: number,               // 0-100
  triggers: string[],               // ["price_objection_keywords", "budget_range_50m"]
  detectedAt: string,               // ISO datetime
  detectionMethod: "auto_webhook",  // detection 방식
  recommendedAction: string         // "PRICE_NEGOTIATION_CALL"
}
```

---

## 🎯 Risk Level별 추천 액션

| Risk Level | 액션 | SMS | 콜 | 시간 |
|-----------|------|-----|-----|------|
| **CRITICAL** | URGENT_HEALTH_SCREENING | X | 즉시 | 1시간 |
| **CRITICAL** | EMERGENCY_LAST_MINUTE | SMS | 즉시 | 1시간 |
| **HIGH** | PREPARATION_GUIDANCE | SMS | 옵션 | 12시간 |
| **HIGH** | FAMILY_PERSUASION | SMS | 콜 | 24시간 |
| **MEDIUM** | PAYMENT_REMINDER | SMS | X | 24시간 |
| **MEDIUM** | INTEREST_CLARIFICATION | SMS | X | 24시간 |
| **LOW** | STANDARD_DAY0_SMS | SMS | X | 48시간 |

---

## 📈 기대 효과 요약

| 지표 | Before | After | 개선 |
|------|--------|-------|------|
| Contact 자동화율 | 70% | 95% | +25% |
| Segment 정확도 | 85% | 95% | +10% |
| Lens 감지 정확도 | 70% | 85% | +15% |
| Risk Score 자동화 | 0% | 100% | +100% |
| 수동 개입 시간 | 2시간/일 | 20분/일 | 85% 단축 |
| Day 0 SMS 발송 시간 | 수동 | 자동 (리얼타임) | 100% 자동화 |

---

## 🚀 통합 예시 (createOrUpdateContact)

```typescript
import { createOrUpdateContact } from '@/lib/contact-auto-creator';

// 1. 고객 데이터 수신 (Webhook)
const payload: WebhookPayload = {
  name: "김철수",
  phone: "010-1234-5678",
  age: 45,
  preferenceType: "family",
  familyComposition: "family_with_kids",
  inquiryMessage: "비싼데 할인 가능한가요?",
  source: "form_submission"
};

// 2. 자동 생성/업데이트 (한 줄!)
const result = await createOrUpdateContact("org_123", payload);

// 3. 결과
if (result.success) {
  console.log(`
    ✅ Contact 생성됨: ${result.contactId}
    📊 Segment: ${result.segment} (family)
    🎯 Lens: ${result.lens} (L1: 가격민감, 신뢰도 ${result.lensConfidence}%)
    ⚠️ Risk: ${result.riskScore} (${result.riskLevel})
    🏷️ Tags: ${result.tags.join(', ')}
    
    💡 다음 액션: ${lensMetadata.recommendedAction}
  `);
  
  // 4. 자동 SMS/콜 트리거
  triggerAutomation({
    contactId: result.contactId,
    action: result.lensMetadata.recommendedAction,
    lens: result.lens,
    segment: result.segment
  });
}
```

---

## 📌 자주 묻는 질문 (FAQ)

### Q1: Segment가 A인데 나이가 50살? 
**A**: preferenceType이 우선이므로 "romantic" 또는 "couple"을 명시했을 가능성. 데이터 확인 필요.

### Q2: Lens 신뢰도가 낮으면 (confidence < 50)?
**A**: 신호가 부족하다는 뜻. 추가 문의 또는 Day 0 SMS로 수집.

### Q3: Risk Score가 중복 계산?
**A**: 아니오. 10가지 신호가 **OR 조건** (모두 합산). 각 신호는 최대 1회만 카운트.

### Q4: Tags가 너무 많은데?
**A**: 정상. 필터링 용도로는 `segment:A, lens:L1, risk:HIGH` 3개만 사용하면 충분.

### Q5: 렌즈를 바꾸고 싶으면?
**A**: Contact 업데이트 시 `detectLens` 재실행. 자동으로 최고 점수 렌즈로 업데이트됨.

---

## 🔗 관련 파일

- **구현**: `src/lib/contact-auto-creator.ts` (882줄)
- **상세 문서**: `docs/loop6_agent_d_contact_auto_creator_completion.md`
- **타입 정의**: `src/lib/types/lens.ts` (참고)
- **테스트**: `__tests__/lib/contact-auto-creator.test.ts` (작성 예정)

---

**Last Updated**: 2026-05-29 | **Commit**: ac16684
