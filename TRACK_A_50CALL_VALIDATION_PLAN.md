# Track A: 50콜 실전 검증 설계서

**목표:** 24가지 이의처리(Objection Handling) 전략이 실제 콜에서 +20-30% 효과가 있는지 검증

**검증 기간:** 1주일 (콜 수집) + 3일 (분석) = Week 2-3

---

## Phase 1: 사전 준비 (Day 1-2)

### A5 이의처리 가이드 검토

기존 **A5_BEST_RESPONSES_24_OBJECTIONS.md** 파일에서 24가지 이의처리를 추출:

```
이의 카테고리별 (Track A 문서 기준):

1. 가격/예산 이의 (5가지)
   - "너무 비싸요"
   - "더 싼 상품이 있나요?"
   - "이번 달 예산이 없어요"
   - "할부가 가능한가요?"
   - "할인이 더 있나요?"

2. 결정 유보 (4가지)
   - "다음에 생각해볼게요"
   - "남편/아내와 상의하고 연락드리겠습니다"
   - "지금은 시간이 없어요"
   - "나중에 가능할 것 같아요"

3. 상품/속성 의심 (5가지)
   - "이 상품이 정말 좋은가요?"
   - "배멀미가 심할 수도 있지 않을까?"
   - "선실이 좁지 않을까?"
   - "음식이 입맛에 맞을까?"
   - "짐과 짐 관리는 어떻게?"

4. 자신감/준비 부족 (4가지)
   - "여권/증명서가 필요하지 않을까?"
   - "해외여행 처음이라 불안해요"
   - "나이가 많아서 체력이 걱정돼요"
   - "아이가 어려서 못 데려가지 않을까?"

5. 환경/외부 요인 (3가지)
   - "회사에서 휴가를 못 줄 것 같아요"
   - "가족이 동의하지 않아요"
   - "건강상의 이유로 여행 자체가 어려워요"
   
6. 신뢰도 부족 (3가지)
   - "이 회사를 처음 들었어요"
   - "평가/후기가 부족해요"
   - "사기는 아닐까 걱정돼요"
```

---

## Phase 2: 5명 상담사 훈련 (Day 1-2)

### 훈련 프로세스

```
1. A5 가이드 배포 (Day 1 오전)
   - 파일: A5_BEST_RESPONSES_24_OBJECTIONS.md
   - 형식: 각 이의별 "인정→이유→대안" 3단계
   - 예: "네, 가격이 중요하신 부분 알아요. 
           그런데 크루즈는 항공+숙박+식사가 모두 포함된 거라 
           실제 일일 비용은 훨씬 저렴해요."

2. 역할극 훈련 (Day 2)
   - 각 상담사별 2시간 × 5명 = 10시간
   - 24가지 이의 중 상위 10가지씩 역할극
   - 타겟: "대응 신뢰도" 80% 이상

3. 콜 로깅 시스템 설정 (Day 2)
   - CallLog 모델에 새로운 필드 추가:
     * objectionTypes: string[] (사용한 이의 태그)
     * objectionResponses: {"이의":"대응":"결과":"신뢰도"}
     * customerReaction: "positive" | "neutral" | "rejection"
     * convictionScore (기존): 1-10 척도 강화
```

---

## Phase 3: 50콜 수집 (Day 3-10: 1주일)

### 콜 기록 표준

각 콜 완료 후 상담사가 기록:

```json
{
  "callLogId": "call_xxx",
  "contactId": "contact_yyy",
  "counselorId": "user_zzz",
  "counselorName": "상담사명",
  
  // 콜 기본 정보
  "callDate": "2026-05-25T14:30:00Z",
  "callDuration": 480, // 초 단위
  "callPhase": "opening|desire|implication|close",
  
  // 이의처리 기록
  "objectionTypes": ["가격이의", "결정유보", "신뢰도부족"], // 콜 중 발생한 이의 종류
  
  "objectionHandling": [
    {
      "sequence": 1,
      "objectionCategory": "가격이의",
      "objectMessage": "너무 비싸요", // 고객의 정확한 말
      "counselorResponse": "네, 가격이 중요하신 부분 알아요...", // 상담사 대응
      "responseType": "A5_guide_standard", // 또는 "improvisation"
      "customerReactionImmediate": "긍정", // 즉시 반응
      "result": "success" // 그 이의가 극복되었나?
    },
    {
      "sequence": 2,
      "objectionCategory": "결정유보",
      "objectMessage": "다음에 생각해볼게요",
      "counselorResponse": "...",
      "responseType": "A5_guide_standard",
      "customerReactionImmediate": "중립",
      "result": "partial"
    }
  ],
  
  // 최종 결과
  "finalResult": "conversion" | "scheduled" | "abandoned",
  "customerSentiment": "positive" | "neutral" | "negative",
  "convictionScore": 7, // 1-10
  
  // 세그먼트 정보
  "contactSegment": "A", // A/B/C/D
  "contactAge": 45,
  
  // 메타
  "tags": ["50call_validation", "track_a"]
}
```

### 수집 목표

```
Week 2 (5월 25-31):
- 상담사A: 10콜
- 상담사B: 10콜
- 상담사C: 10콜
- 상담사D: 10콜
- 상담사E: 10콜
= 총 50콜
```

---

## Phase 4: 통계 분석 (Day 11-13: 3일)

### 분석 1: 이의별 회복율

```typescript
// 이의 회복율 = 성공 횟수 / 총 사용 횟수

interface ObjectionRecoveryStats {
  objectionType: string;           // "가격이의", "결정유보" 등
  totalUsed: number;               // 총 사용 횟수
  successCount: number;            // 극복 성공 횟수
  partialCount: number;            // 부분 성공
  recoveryRate: number;            // success + partial / total
  confidence: number;              // 95% CI 범위
  avgConvictionScore: number;      // 해당 이의 처리 후 평균 신뢰도
}

// 예상 결과:
[
  {
    objectionType: "가격이의",
    totalUsed: 18,
    successCount: 15,
    partialCount: 2,
    recoveryRate: 0.94,
    confidence: "0.88-1.0",
    avgConvictionScore: 8.2
  },
  {
    objectionType: "결정유보",
    totalUsed: 12,
    successCount: 8,
    partialCount: 3,
    recoveryRate: 0.92,
    confidence: "0.80-1.0",
    avgConvictionScore: 7.5
  },
  // ... 24가지 모두
]
```

### 분석 2: 세그먼트별 효과 비교

```typescript
// 세그먼트(A/B/C/D)별로 이의처리 효과가 다른가?

interface SegmentObjectionAnalysis {
  segment: "A" | "B" | "C" | "D";
  callCount: number;
  objectionsPerCall: number;  // 콜당 평균 이의 개수
  avgRecoveryRate: number;    // 평균 회복율
  conversionRate: number;     // 최종 전환율
  avgConvictionScore: number; // 최종 신뢰도
  topObjections: string[];    // 이 세그먼트에서 가장 많이 나온 이의 TOP 3
  topResponses: string[];     // 가장 효과적인 대응 TOP 3
}

// 기대 결과:
// Segment A (신혼): 0.95 회복율, 80% 전환
// Segment B (자녀): 0.89 회복율, 72% 전환
// Segment C (40-55세): 0.91 회복율, 75% 전환
// Segment D (55세+): 0.88 회복율, 70% 전환
```

### 분석 3: 상담사별 편차

```typescript
interface CounselorPerformance {
  counselorId: string;
  counselorName: string;
  callCount: number;
  avgObjectionsPerCall: number;
  avgRecoveryRate: number;
  conversionRate: number;
  avgConvictionScore: number;
  strengthAreas: string[];      // 이 상담사가 잘 처리하는 이의
  improvementAreas: string[];   // 개선 필요 이의
}

// 목적: 상담사별 편차 파악
//        → "이 상담사는 가격이의에 강하고, 
//           이 상담사는 신뢰도 이의에 약하다" 파악
```

### 분석 4: 기대효과 vs 실제효과

```
기대 효과: +20-30%
  - 이전 콜(A4 가이드 없음): 평균 전환율 55%
  - 이제 콜(A5 가이드 사용): 예상 전환율 75-85%

검증 방식:
  1. 50콜의 최종 전환율 계산
  2. 이전 4주 평균 전환율과 비교
  3. Statistical Significance 테스트 (Chi-square)
     H0: 효과 없음 (55% = 55%)
     H1: 효과 있음 (55% ≠ 현재%)
     α = 0.05 (신뢰도 95%)
  
  4. Effect Size 계산 (Cohen's h)
     기대: 0.3 이상 (중간 이상 효과)
```

---

## Phase 5: 산출물 생성 (Day 13)

### TRACK_A_50CALL_VALIDATION_RESULT.md

```markdown
# Track A: 50콜 검증 결과

## Executive Summary
- 총 콜 수: 50개
- 최종 전환율: 76% (기대 +21% vs 기존 55%)
- 이의 회복율: 평균 0.92 (92%)
- 통계적 유의성: p=0.018 (95% 신뢰도에서 유의함)

## 이의별 회복율 TOP 5
1. 가격이의: 94% (18회 사용, 17회 성공)
2. 신뢰도부족: 90% (10회 사용, 9회 성공)
3. 자신감부족: 89% (9회 사용, 8회 성공)
...

## 세그먼트별 분석
- Segment A: 78% 회복율, 82% 전환
- Segment B: 91% 회복율, 78% 전환
- Segment C: 89% 회복율, 74% 전환
- Segment D: 86% 회복율, 71% 전환

## 상담사별 편차
- 상담사A: 가격이의 강점 (100%), 신뢰도 약점 (70%)
- 상담사B: 전체 균형형 (평균 92%)
...

## 주요 발견사항
1. "일일 비용 환산" 대응이 가격이의에 94% 효과
2. Segment A(신혼)는 이의가 적음 (0.8개/콜 vs 1.3개/콜)
3. Segment D(55세+)는 배멀미 이의 높음 (35% vs 12% 평균)

## 개선 권장안
1. Segment D 대상 "배멀미 예방" 대응 강화 필요
2. 상담사별 약점 이의 추가 훈련 실시
3. Week 2 콜에서 상담사 능력 교차배치 실행
```

### TRACK_A_BEST_PRACTICES.md

```markdown
# Track A: 검증된 Best Practices

## "이 이의에는 이 대응이 70% 이상 효과"

### 가격이의 → 일일 비용 환산 (94% 효과)
"3박 4일에 300만원이 비싸신 이유를 알아요.
그런데 항공료 100만, 숙박 120만, 식사 80만이 포함되니까
일일 기준으로는 50만원 정도예요.
일반 해외여행과 비교하면 훨씬 저렴하죠?"

성공 사례: "아, 그렇게 따지니까 맞네요"

### 결정유보 → 시간 제약 생성 (88% 효과)
"네, 잘 생각해보시는 것이 좋아요.
다만 우리 상품은 5월 출항이 마감되고 있어서,
생각을 정하시면 바로 연락 주세요."

### 신뢰도부족 → 후기 + 전문성 노출 (90% 효과)
"저희는 크루즈 전문 여행사예요.
지난해 4500명의 고객분들과 함께했고,
평점이 4.8점이에요..."

### 배멀미(D 세그먼트) → 의료 시설 + 약물 (82% 효과)
"배멀미 걱정하시는 분들 많아요.
크루즈는 병원, 약사, 응급실이 모두 있고,
예방약도 미리 드릴 수 있어요."

### 자녀 동반(B 세그먼트) → 교육 프로그램 강조 (85% 효과)
"아이들을 위한 프로그램이 풍부해요.
키즈클럽, 요리교실, 문화체험...
부모님들이 휴식하면서 아이들은 경험해요."
```

---

## 성공 기준

✅ 5명 상담사 훈련 완료 (A5 가이드 암기)
✅ 50콜 수집 완료 (Day 3-10)
✅ 이의별 회복율 계산 (≥70% 확인)
✅ 세그먼트별 효과 분석 (A>B>C>D 예상)
✅ 상담사별 편차 분석 (강점/약점 파악)
✅ 기대 +20-30% 효과 검증 (Statistical Significance)
✅ Best Practices 문서 완성

---

## 타임라인

- **Day 1-2 (5월 22-23):** A5 가이드 검토 + 상담사 훈련
- **Day 3-10 (5월 24-31):** 50콜 수집 (Week 2)
- **Day 11-13 (6월 1-3):** 통계 분석
- **Day 13 (6월 3):** 최종 산출물 완성

---

## 참고: CallLog 모델 확장 필드

```prisma
model CallLog {
  // 기존 필드
  id String @id @default(cuid())
  contactId String
  userId String
  content String?
  result String?
  duration Int?
  convictionScore Int?
  createdAt DateTime @default(now())
  
  // Track A 추가 필드
  objectionTypes String[] @default([])  // ["가격이의", "결정유보"]
  objectionHandling Json? // 상세 기록
  customerReaction String?  // "positive" | "neutral" | "rejection"
  callPhase String?  // "opening" | "desire" | "implication" | "close"
  counselorName String?  // 빠른 조회용
  contactSegment String?  // A/B/C/D
  tags String[] @default([])  // ["50call_validation", "track_a"]
}
```
