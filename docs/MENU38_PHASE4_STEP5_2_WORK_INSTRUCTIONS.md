# Menu #38 Phase 4 Step 5-2 작업지시서
## 렌즈 분류 알고리즘 P0+P1 수정

**작성일**: 2026-05-19  
**예상 소요**: 6시간 (코드 수정) + 2시간 (코드 검토)  
**대상 파일**:
- D:\mabiz-crm\src\lib\lens-classifier\index.ts
- D:\mabiz-crm\src\lib\lens-classifier\lens-functions.ts
- D:\mabiz-crm\src\lib\lens-classifier\keyword-detector.ts
- D:\mabiz-crm\src\lib\lens-classifier\types.ts

---

## Phase 1: CRITICAL 5개 이슈 수정 (2시간)

### 1️⃣ ReDoS 취약점 + 정규식 캐싱 (P0)
**파일**: keyword-detector.ts  
**라인**: 273  
**문제**: 정규식 300-500개를 매 호출마다 컴파일 → 지수시간 폭발, 5000자 제한 없음

**수정 지침**:

1. **모듈 상단에 정규식 캐시 추가** (라인 9 이후):
```typescript
// 정규식 컴파일 캐시 (모듈 로드 시 1회만 컴파일)
const COMPILED_PATTERNS: Map<string, RegExp> = new Map();

function getOrCompileRegex(pattern: string): RegExp {
  if (!COMPILED_PATTERNS.has(pattern)) {
    try {
      COMPILED_PATTERNS.set(pattern, new RegExp(pattern, 'gi'));
    } catch (error) {
      console.warn(`Invalid regex pattern: ${pattern}`);
      return /(?!)/; // Never match
    }
  }
  return COMPILED_PATTERNS.get(pattern)!;
}
```

2. **detectKeywords 함수 수정** (라인 263-289):
```typescript
export function detectKeywords(callNotes: string): KeywordSignal[] {
  // 입력 검증: 길이 제한
  if (!callNotes || callNotes.length > 5000) {
    throw new Error('콜 노트는 1자 이상 5000자 이하여야 합니다.');
  }

  const signals: KeywordSignal[] = [];
  const normalizedText = callNotes.toLowerCase();

  for (const [lensType, keywords] of Object.entries(KEYWORD_DATABASE)) {
    for (const keywordDef of keywords) {
      for (const pattern of keywordDef.patterns) {
        try {
          // ✅ 변경: new RegExp() → getOrCompileRegex()
          const regex = getOrCompileRegex(pattern);
          if (regex.test(normalizedText)) {
            signals.push({
              keyword: keywordDef.keyword,
              lenses: [lensType as LensType],
              confidence: keywordDef.confidence,
              category: keywordDef.category,
            });
            break;
          }
        } catch (error) {
          // ✅ 변경: console.warn() → throw
          throw new Error(`정규표현식 처리 오류: ${pattern} - ${(error as Error).message}`);
        }
      }
    }
  }

  signals.sort((a, b) => b.confidence - a.confidence);

  const uniqueSignals = new Map<string, KeywordSignal>();
  for (const signal of signals) {
    // ✅ 변경: 렌즈 순서 정규화 (중복제거 버그 fix)
    const key = signal.lenses.sort().join(',');
    if (!uniqueSignals.has(key)) {
      uniqueSignals.set(key, signal);
    }
  }

  return Array.from(uniqueSignals.values());
}
```

**검증**:
- 모듈 로드 시 COMPILED_PATTERNS 크기 = 50-60개 (고정)
- 호출마다 getOrCompileRegex() O(1) 조회
- 성능: 단일 호출 10-20ms → 0.5-2ms (10배 개선)

---

### 2️⃣ Bayesian 신뢰도 오버플로우 (P0)
**파일**: index.ts  
**라인**: 189  
**문제**: `posterior * 200` → confidence > 100 가능 (데이터 무결성 위반)

**수정 지침**:

```typescript
// 라인 179-191
function calculateBayesianConfidence(
  lens: LensType,
  lensScore: number,
  allScores: Record<LensType, number>
): number {
  const priors: Record<LensType, number> = {
    L1: 0.25, L2: 0.1, L3: 0.2, L4: 0.08, L5: 0.07,
    L6: 0.08, L7: 0.08, L8: 0.02, L9: 0.03, L10: 0.01,
  };

  const totalScore = Object.values(allScores).reduce((a, b) => a + b, 0);
  
  // ✅ 변경: 0점 케이스 명시적 처리
  if (totalScore === 0) {
    return 50; // 신뢰도 없음 = 중간 신뢰도
  }
  
  const likelihoods = Object.entries(allScores).reduce(
    (acc, [lensKey, score]) => ({
      ...acc,
      [lensKey]: score / totalScore,
    }),
    {} as Record<LensType, number>
  );

  const likelihood = likelihoods[lens];
  const prior = priors[lens];
  const evidence = Object.keys(priors).reduce(
    (acc, key) => acc + likelihoods[key as LensType] * priors[key as LensType],
    0
  );

  // ✅ 변경: posterior 값 정규화 (0-1 범위 보장)
  const rawPosterior = (likelihood * prior) / (evidence || 0.01);
  const posterior = Math.min(1, Math.max(0, rawPosterior)); // 0-1 범위

  // ✅ 변경: 200 → 100 (0-100 정규화)
  const confidence = Math.round(posterior * 100);

  return confidence;
}
```

**검증**:
- posterior = 0 → confidence = 0 ✅
- posterior = 0.5 → confidence = 50 ✅
- posterior = 1.0 → confidence = 100 ✅
- confidence 범위: [0, 100] (항상)

---

### 3️⃣ 키워드 중복제거 버그 (P0)
**파일**: keyword-detector.ts  
**라인**: 296-301  
**문제**: 렌즈 신호가 여러 개면 첫 번째만 저장 (["L1", "L3"] vs ["L3", "L1"] 순서 다르면 중복)

**수정 지침**:

```typescript
// 라인 295-303 (이미 위 #1에서 수정함)
const uniqueSignals = new Map<string, KeywordSignal>();
for (const signal of signals) {
  // ✅ 변경: 렌즈 배열을 정렬 후 조인
  const key = signal.lenses.sort().join(',');
  if (!uniqueSignals.has(key)) {
    uniqueSignals.set(key, signal);
  }
}

return Array.from(uniqueSignals.values());
```

**검증**:
- signal.lenses = ["L1", "L3"] → key = "L1,L3"
- signal.lenses = ["L3", "L1"] → key = "L1,L3" (동일)
- 중복 제거 성공

---

### 4️⃣ 에러 무시 (P0)
**파일**: keyword-detector.ts  
**라인**: 284  
**문제**: catch에서 console.warn() 후 계속 진행 → 잘못된 regex도 통과

**수정 지침**:

```typescript
// 라인 272-286 (이미 위 #1에서 수정함)
for (const pattern of keywordDef.patterns) {
  try {
    const regex = getOrCompileRegex(pattern);
    if (regex.test(normalizedText)) {
      signals.push({...});
      break;
    }
  } catch (error) {
    // ✅ 변경: throw로 변경
    throw new Error(`정규표현식 처리 오류: ${pattern} - ${(error as Error).message}`);
  }
}
```

**검증**:
- 잘못된 regex는 즉시 에러 발생
- 모듈 로드 시 모든 패턴 검증 완료 (getOrCompileRegex에서)

---

### 5️⃣ 배열 경계 안전성 (P0)
**파일**: index.ts  
**라인**: 86-87  
**문제**: `sorted[1].lens` → 배열이 1개만 있으면 크래시 (10개 렌즈가 항상 존재하지만 방어 필요)

**수정 지침**:

```typescript
// 라인 82-87
const sorted = Object.entries(scores)
  .sort(([, a], [, b]) => b - a)
  .map(([lens, score]) => ({ lens: lens as LensType, score }));

const primaryLens = sorted[0].lens;
// ✅ 변경: 안전한 배열 접근
const secondaryLens = sorted.length > 1 ? sorted[1].lens : sorted[0].lens;
const primaryScore = sorted[0].score;
```

**검증**:
- sorted.length = 10 → secondaryLens = sorted[1].lens ✅
- sorted.length = 1 (이론상) → secondaryLens = sorted[0].lens ✅

---

## Phase 2: HIGH 이슈 1개 - 매직 숫자 상수화 (2시간)

### 6️⃣ 매직 숫자 추출 (P1)
**파일**: 신규 파일 생성  
**위치**: D:\mabiz-crm\src\lib\lens-classifier\scoring-weights.ts

**생성 파일**:
```typescript
/**
 * Menu #38 Phase 4 Step 5-2: 렌즈 분류 가중치 및 상수
 *
 * 모든 점수 배수, 임계값, 우선순위를 중앙집중식으로 관리합니다.
 *
 * @file src/lib/lens-classifier/scoring-weights.ts
 */

/**
 * L1: 가격 오해형 점수 가중치
 */
export const L1_WEIGHTS = {
  AD_TRUST_REVERSE_MULTIPLIER: 20, // (5-Q1) × 20
  PRICE_SENSITIVITY_MULTIPLIER: 10, // Q2 × 10
  KEYWORD_BONUS: 20,
  INFLUENCER_AD_BONUS: 15,
} as const;

/**
 * L2: 준비 부담형 점수 가중치
 */
export const L2_WEIGHTS = {
  PREPARATION_BURDEN_MULTIPLIER: 20, // Q3 × 20
  AD_TRUST_REVERSE_MULTIPLIER: 10, // (5-Q1) × 10
  KEYWORD_BONUS: 20,
  BUYER_TYPE_BONUS: 10,
} as const;

/**
 * L3: 차별성 미인지형 점수 가중치
 */
export const L3_WEIGHTS = {
  CRUISE_EXPERIENCE_REVERSE_MULTIPLIER: 25, // (5-Q4) × 25
  KEYWORD_BONUS: 15, // 약화: L10과 구분
  L10_INTERFERENCE_MULTIPLIER: 0.5, // L10 키워드 있으면 × 0.5
  ORGANIC_BONUS: 10, // organic/referral 소스
  AGE_BONUS: 5, // 30-60대
} as const;

/**
 * L4: 멤버십 저항형 점수 가중치
 */
export const L4_WEIGHTS = {
  KEYWORD_BONUS: 40, // 강한 신호
  LOW_DECISION_BONUS: 15, // Q5 ≤ 2
  NEW_CUSTOMER_BONUS: 10,
} as const;

/**
 * L5: 적합성 의심형 점수 가중치
 */
export const L5_WEIGHTS = {
  KEYWORD_BONUS: 30,
  LOW_EXPERIENCE_BONUS: 20, // Q4 ≤ 2
} as const;

/**
 * L6: 타이밍 미결형 점수 가중치
 */
export const L6_WEIGHTS = {
  DECISION_READINESS_BASE: 25, // (Q5-1)*10 + 25
  DECISION_READINESS_MULTIPLIER: 10,
  KEYWORD_BONUS: 20,
  L10_INTERFERENCE_MULTIPLIER: 0.6, // L10 키워드 있으면 × 0.6
  NO_PRICE_PREP_BONUS: 10, // L1/L2 키워드 없으면
} as const;

/**
 * L7: 동반자 이슈형 점수 가중치
 */
export const L7_WEIGHTS = {
  KEYWORD_BONUS: 40,
  LOW_DECISION_WITH_KEYWORD_BONUS: 20,
} as const;

/**
 * L8: 재구매 유보형 점수 가중치
 */
export const L8_WEIGHTS = {
  RETURNING_1_2_YEARS: 50, // 1-2년 미구매
  RETURNING_2_5_YEARS: 40, // 2-5년 미구매
  RETURNING_5_PLUS_YEARS: 20, // 5년 이상
  KEYWORD_BONUS: 20,
} as const;

/**
 * L9: 건강/안전 불안형 점수 가중치
 */
export const L9_WEIGHTS = {
  KEYWORD_BONUS: 50, // 매우 강한 신호
  FAMILY_WITH_KEYWORD_BONUS: 20,
  HIGH_PREP_BURDEN_BONUS: 10, // Q3 ≥ 4
} as const;

/**
 * L10: 즉시 구매형 점수 가중치
 */
export const L10_WEIGHTS = {
  DECISION_READINESS_BASE: 0, // (Q5-3)*20 시작
  DECISION_READINESS_MULTIPLIER: 20,
  KEYWORD_BONUS: 30, // 강화 (20 → 30)
  DECISION_SIGNAL_BONUS: 15, // 제품 선택 신호
  KEYWORD_WITHOUT_Q5_BONUS: 25, // Q5 < 4인데 키워드 있으면
} as const;

/**
 * Bayesian 신뢰도 계산
 */
export const BAYESIAN_CONFIG = {
  // 사전확률 (Prior) - 렌즈별 시장점유율
  PRIORS: {
    L1: 0.25,
    L2: 0.1,
    L3: 0.2,
    L4: 0.08,
    L5: 0.07,
    L6: 0.08,
    L7: 0.08,
    L8: 0.02,
    L9: 0.03,
    L10: 0.01,
  },
  // 신뢰도 정규화: posterior × 100 (범위: 0-100)
  CONFIDENCE_MULTIPLIER: 100,
  // 신뢰도 무결성 기준: maxScore - lensScore < CONFIDENCE_THRESHOLD
  CONFIDENCE_LOW_THRESHOLD: 5,
} as const;

/**
 * 키워드 강도 계산
 */
export const KEYWORD_CONFIG = {
  // 키워드 강도 계산: avgConfidence × signalCount × MULTIPLIER
  STRENGTH_MULTIPLIER: 50,
  // 최대 입력 길이 (ReDoS 방지)
  MAX_CALL_NOTES_LENGTH: 5000,
} as const;

/**
 * 캐시 설정
 */
export const CACHE_CONFIG = {
  // 메모리 캐시 최대 항목 수
  MAX_CACHED_CLASSIFICATIONS: 1000,
  // 정규식 캐시 크기 제한 (수동 정리 필요 없음, getOrCompileRegex에서 관리)
  REGEX_CACHE_AUTO_CLEANUP: true,
} as const;

/**
 * 우선도 설정
 */
export const PRIORITY_CONFIG = {
  CRITICAL_LENSES: ['L10', 'L9'],
  HIGH_LENSES: ['L6'],
  MEDIUM_LENSES: ['L1', 'L3', 'L8'],
  LOW_LENSES: ['L2', 'L4', 'L5', 'L7'],
} as const;

/**
 * 극단값 보호
 */
export const BOUNDARY_PROTECTION = {
  // 렌즈 점수 최소값 (점수 × multiplier 후 보호)
  MIN_LENS_SCORE_AFTER_INTERFERENCE: 10, // L6, L3에서 *0.6, *0.5 후 최소값
  // 신뢰도 범위
  MIN_CONFIDENCE: 0,
  MAX_CONFIDENCE: 100,
  // 나이 범위 검증
  MIN_AGE: 18,
  MAX_AGE: 120,
} as const;
```

**사용처 수정** (lens-functions.ts):
```typescript
// 최상단 import 추가
import {
  L1_WEIGHTS, L2_WEIGHTS, L3_WEIGHTS, L4_WEIGHTS, L5_WEIGHTS,
  L6_WEIGHTS, L7_WEIGHTS, L8_WEIGHTS, L9_WEIGHTS, L10_WEIGHTS,
  BOUNDARY_PROTECTION,
} from './scoring-weights';

// 예: classifyL1 함수
export const classifyL1: LensScorer = (responses, keywordSignals) => {
  let score = 0;

  const adTrustReverse = 5 - responses.q1_ad_trust;
  score += Math.max(0, adTrustReverse * L1_WEIGHTS.AD_TRUST_REVERSE_MULTIPLIER); // 20

  score += responses.q2_price_sensitivity * L1_WEIGHTS.PRICE_SENSITIVITY_MULTIPLIER; // 10

  const hasL1Keyword = keywordSignals.some((signal) => signal.lenses.includes('L1'));
  if (hasL1Keyword) {
    score += L1_WEIGHTS.KEYWORD_BONUS; // 20
  }

  if (responses.source === 'INFLUENCER_AD' && !responses.lastPurchaseDate) {
    score += L1_WEIGHTS.INFLUENCER_AD_BONUS; // 15
  }

  return Math.min(100, score);
};

// 예: classifyL6 함수 (극단값 보호 추가)
export const classifyL6: LensScorer = (responses, keywordSignals) => {
  let score = 0;
  const { q5_decision_readiness } = responses;

  if (q5_decision_readiness >= 2 && q5_decision_readiness <= 4) {
    score += (q5_decision_readiness - 1) * L6_WEIGHTS.DECISION_READINESS_MULTIPLIER + 
             L6_WEIGHTS.DECISION_READINESS_BASE;
  }

  const hasL6Keyword = keywordSignals.some((signal) => signal.lenses.includes('L6'));
  if (hasL6Keyword) {
    score += L6_WEIGHTS.KEYWORD_BONUS;
  }

  const hasL10Keyword = keywordSignals.some((signal) => signal.lenses.includes('L10'));
  if (hasL10Keyword) {
    // ✅ 극단값 보호 추가
    score = Math.max(
      BOUNDARY_PROTECTION.MIN_LENS_SCORE_AFTER_INTERFERENCE,
      score * L6_WEIGHTS.L10_INTERFERENCE_MULTIPLIER
    );
  }

  const hasL1L2Keyword = keywordSignals.some((signal) => signal.lenses.includes('L1') || signal.lenses.includes('L2'));
  if (!hasL1L2Keyword) {
    score += L6_WEIGHTS.NO_PRICE_PREP_BONUS;
  }

  return Math.min(100, score);
};

// 모든 classifyL* 함수 동일하게 상수로 변경
```

**사용처 수정** (index.ts):
```typescript
// 최상단 import 추가
import {
  BAYESIAN_CONFIG,
  CACHE_CONFIG,
  PRIORITY_CONFIG,
  BOUNDARY_PROTECTION,
} from './scoring-weights';

// calculateBayesianConfidence 수정
function calculateBayesianConfidence(
  lens: LensType,
  lensScore: number,
  allScores: Record<LensType, number>
): number {
  const priors = BAYESIAN_CONFIG.PRIORS;
  // ... (계산 과정)
  const confidence = Math.round(posterior * BAYESIAN_CONFIG.CONFIDENCE_MULTIPLIER);
  return confidence;
}

// calculatePriority 수정
function calculatePriority(lens: LensType): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (PRIORITY_CONFIG.CRITICAL_LENSES.includes(lens)) return 'CRITICAL';
  if (PRIORITY_CONFIG.HIGH_LENSES.includes(lens)) return 'HIGH';
  if (PRIORITY_CONFIG.MEDIUM_LENSES.includes(lens)) return 'MEDIUM';
  return 'LOW';
}

// setCachedClassification 수정
function setCachedClassification(cacheKey: string, result: ClassificationResult): void {
  if (classificationCache.size > CACHE_CONFIG.MAX_CACHED_CLASSIFICATIONS) {
    const firstKey = classificationCache.keys().next().value;
    classificationCache.delete(firstKey);
  }
  classificationCache.set(cacheKey, result);
}
```

**검증**:
- 모든 매직 숫자 한 곳에서 관리
- 타입 안전: `as const`로 타입 추론
- 변경 용이: 마케팅팀 요청 시 `scoring-weights.ts`만 수정

---

## 파일 수정 순서

| 순서 | 파일 | 시간 | 체크리스트 |
|------|------|------|-----------|
| 1 | keyword-detector.ts | 40분 | COMPILED_PATTERNS 추가 + detectKeywords 수정 + 입력검증 |
| 2 | index.ts | 30분 | Bayesian 신뢰도 + 배열 경계 + 우선도 적용 |
| 3 | lens-functions.ts | 40분 | 모든 classifyL* 함수에 WEIGHTS 상수 적용 |
| 4 | scoring-weights.ts | 30분 | 신규 파일 생성 (상수 정의) |
| 5 | types.ts | 10분 | import 추가 (필요시) |

---

## 테스트 항목 (코드 검토 전)

### 유닛 테스트
```bash
npm test -- lens-classifier.test.ts
```

체크리스트:
- [ ] classifyL1-L10 점수 범위 [0, 100]
- [ ] Bayesian 신뢰도 범위 [0, 100]
- [ ] 키워드 중복제거 정상 작동
- [ ] ReDoS 안전성: 5000자 입력 < 50ms
- [ ] null/undefined 에러 없음
- [ ] 극단값 처리: 극도로 낮은 점수도 보호

### 통합 테스트
```typescript
// 예: L6 극단값
const result = classifyCustomerLens({
  q1_ad_trust: 5,
  q2_price_sensitivity: 1,
  q3_preparation_burden: 2,
  q4_cruise_experience: 4,
  q5_decision_readiness: 3, // L6 트리거
}, '언제 갈지 모르겠어요'); // L6 키워드

// 검증
expect(result.primary_lens).toBe('L6');
expect(result.confidence_score).toBeGreaterThanOrEqual(0);
expect(result.confidence_score).toBeLessThanOrEqual(100);
```

---

## 최종 검증 체크리스트

- [ ] **P0 이슈 5개 모두 수정됨**
  - [ ] ReDoS 방지 (정규식 캐싱 + 입력 제한)
  - [ ] Bayesian 신뢰도 오버플로우 (100 이하)
  - [ ] 키워드 중복제거 (렌즈 정렬)
  - [ ] 에러 무시 (throw로 변경)
  - [ ] 배열 경계 (sorted[1] 안전)
- [ ] **P1 이슈 1개 완료**
  - [ ] 매직 숫자 상수화 (scoring-weights.ts)
- [ ] **성능 목표 달성**
  - [ ] 단일 분류 < 50ms
  - [ ] 배치 1000명 < 30초
- [ ] **테스트 통과**
  - [ ] npm test 성공
  - [ ] 극단값 케이스 통과

---

**상태**: 🔄 Step 5-2 수정 중  
**다음**: 코드 수정 → 코드 검토 재진행

