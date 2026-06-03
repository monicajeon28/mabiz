# TypeScript 타입 안전성 분석 — Playbook/Page.tsx

**작성일**: 2026-06-03  
**분류**: Type Safety Review | CallSituation + Contact 렌즈 통합  
**우선순위**: P1 (기능 결함 위험)

---

## 📋 현재 구현 설계 분석

### 코드 단편
```typescript
// Contact에서 자동 감지
const { lens, callStage, sentiment } = contact;

// 1. Lens 기반 필터
const mainSituation = suggestCallSituations(lens)[0];

// 2. CallStage 추가 필터
const additionalSituations = callStage 
  ? suggestCallSituations(lens, callStage)
  : [];

// 3. Sentiment 기반 우선순위
if (sentiment === 'NEGATIVE') {
  situationList.unshift(CallSituation.COMPLAINT);
}
```

---

## 🔴 TS 타입 안전성 이슈 (5가지)

### Issue 1: Contact 타입 정의 불완전
**현재 상태**:
```typescript
// src/types/contact.ts
export interface Contact {
  // ... 현재는 없음:
  // - lens? 필드 없음
  // - callStage? 필드 없음
  // - sentiment? 필드 없음
}
```

**문제**:
- `contact.lens`, `contact.callStage`, `contact.sentiment` 는 컴파일 타임에 에러 발생
- Optional 필드인지 Required인지 불명확 → 런타임 에러 위험
- 타입스크립트 strict mode에서 `Property 'lens' does not exist` 에러

**위험도**: 🔴 HIGH

---

### Issue 2: suggestCallSituations() 반환 타입 모호
**현재 코드** (line 362-384 in call-situations.ts):
```typescript
export function suggestCallSituations(
  lens: LensType,
  callStage?: string  // ← string이 아니라 특정 타입이어야 함
): CallSituation[] {
  const primary = CALL_SITUATION_ORDER.filter(
    (s) => CALL_SITUATIONS[s].primaryLens === lens
  );
  const rest = CALL_SITUATION_ORDER.filter(
    (s) => CALL_SITUATIONS[s].primaryLens !== lens
  );
  const result = [...primary, ...rest];

  // 버그: result는 배열인데, includes("COMPLAINT")로 문자열 검사
  if (callStage === "COMPLAINT" && !result[0].includes("COMPLAINT")) {
    // ↑ result[0]은 CallSituation (문자열)이고,
    //   includes()는 배열 메서드이므로 타입 에러
    const idx = result.indexOf("COMPLAINT");
    if (idx > 0) {
      result.splice(idx, 1);
      result.unshift("COMPLAINT");
    }
  }

  return result;
}
```

**문제**:
- Line 375: `result[0].includes("COMPLAINT")` → `CallSituation`은 string literal이라 `.includes()` 메서드 없음
- `callStage?: string` → "COMPLAINT" 외에 다른 값도 가능 (검증 없음)
- 함수 반환은 `CallSituation[]`이 맞지만, 파라미터 타입 정의 부실

**위험도**: 🔴 CRITICAL (컴파일 에러 + 런타임 에러)

---

### Issue 3: Sentiment 필드 undefined 처리
**현재 코드**:
```typescript
if (sentiment === 'NEGATIVE') {
  situationList.unshift(CallSituation.COMPLAINT);
}
```

**문제**:
- `sentiment` 타입: `string | undefined`
- NEGATIVE인지만 확인하고, POSITIVE/NEUTRAL/undefined는 처리 안 함
- undefined일 때 동작 불분명 → silent failure 위험

**위험도**: 🟡 MEDIUM

---

### Issue 4: CALL_SITUATIONS 타입 검색 불안전
**현재 코드**:
```typescript
// UI 렌더링
const script = CALL_SITUATIONS[situation];  // situation이 유효한지 보장 없음

if (script) {
  // 사용
} else {
  // 에러 처리 없음
}
```

**문제**:
- `situation`이 CallSituation literal type인지 보장 없음
- 오타나 잘못된 값 입력 시 `undefined` 반환 후 silent failure
- Discriminated union 미활용

**위험도**: 🟡 MEDIUM

---

### Issue 5: 배열 조작 안전성 부족
**현재 코드**:
```typescript
// 문제 1: result[0]이 존재하는지 확인 없음
if (callStage === "COMPLAINT" && !result[0].includes("COMPLAINT")) {
  // ← result가 빈 배열이면 result[0]은 undefined

// 문제 2: unshift/splice는 부작용 발생
result.unshift("COMPLAINT");
result.splice(idx, 1);
// ← 원본 배열 변경 (부작용)
```

**위험도**: 🔴 HIGH

---

## ✅ 개선안 3가지

---

## 개선안 1️⃣: 완전한 타입 정의 (최소 정책)

### Step 1: Contact 타입 확장

```typescript
// src/types/contact.ts

import type { LensType } from '@/lib/types/lens';
import type { CallSituation } from '@/lib/playbook/call-situations';

/**
 * 콜 상태 (렌즈 감지 기반)
 */
export type CallStageType = 
  | 'COMPLAINT'      // 불만 처리 통화
  | 'OBJECTION'      // 이의 대응 통화
  | 'UPSELL'         // 업셀 제안 통화
  | 'FOLLOWUP'       // 후속 추적 통화
  | 'REGULAR';       // 정기 통화 (기본값)

/**
 * 감정 상태 (AI 음성 분석 또는 상담사 수동 입력)
 */
export type SentimentType = 
  | 'POSITIVE'       // 긍정적 (구매 신호)
  | 'NEGATIVE'       // 부정적 (불만/거부)
  | 'NEUTRAL';       // 중립 (판단 보류)

/**
 * Contact + 렌즈/콜 상태 (PlaybookViewer 전용)
 * 
 * 이 타입은 Contact에 렌즈 감지 결과를 추가한 확장 버전입니다.
 * PlaybookViewer에서만 사용하며, API 응답에는 포함되지 않습니다.
 * 
 * @see src/app/(dashboard)/tools/playbook-viewer/page.tsx
 */
export interface ContactWithPlaybookContext extends Contact {
  /** 감지된 렌즈 (렌즈 감지 엔진에서 설정) */
  lens: LensType | null;
  
  /** 현재 콜 상태 (상담사가 선택) */
  callStage?: CallStageType;
  
  /** 고객 감정 상태 (AI 분석 또는 상담사 입력) */
  sentiment?: SentimentType;
}

/**
 * Contact 기본 인터페이스
 * (기존 코드 호환성 유지)
 */
export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  type: string;
  cruiseInterest: string | null;
  budgetRange: string | null;
  adminMemo: string | null;
  assignedUserId: string | null;
  lastContactedAt: string | null;
  purchasedAt: string | null;
  departureDate: string | null;
  productName: string | null;
  bookingRef: string | null;
  tags: string[];
  leadScore: number;
  sourceOrgId: string | null;
  age?: number | null;
  maritalStatus?: string | null;
  childrenCount?: number | null;
  segmentOverride?: string | null;
  groups: { group: { id: string; name: string } }[];
  callLogs: CallLog[];
  memos: Memo[];
  sharedCallLogs: (CallLog & { _sharedFrom: string })[];
  vipSequences: { id: string; funnelId: string; status: string; startDate: string }[];
  lastPaymentStatus?: string | null;
  lastPaymentAt?: string | null;
  lastRefundedAt?: string | null;
  paymentStatusNote?: string | null;
}
```

### Step 2: 안전한 헬퍼 함수

```typescript
// src/lib/playbook/call-situations.ts 에 추가

import type { CallStageType, SentimentType, ContactWithPlaybookContext } from '@/types/contact';

/**
 * CallStageType 검증 (런타임 타입 가드)
 */
export function isValidCallStage(value: unknown): value is CallStageType {
  const validStages: CallStageType[] = [
    'COMPLAINT',
    'OBJECTION',
    'UPSELL',
    'FOLLOWUP',
    'REGULAR',
  ];
  return typeof value === 'string' && validStages.includes(value as CallStageType);
}

/**
 * SentimentType 검증 (런타임 타입 가드)
 */
export function isValidSentiment(value: unknown): value is SentimentType {
  const validSentiments: SentimentType[] = [
    'POSITIVE',
    'NEGATIVE',
    'NEUTRAL',
  ];
  return typeof value === 'string' && validSentiments.includes(value as SentimentType);
}

/**
 * Contact → ContactWithPlaybookContext 안전 변환
 * 렌즈가 없으면 null로 설정 (기본값)
 */
export function toPlaybookContext(
  contact: Contact,
  detectedLens?: LensType | null,
  callStage?: unknown,
  sentiment?: unknown
): ContactWithPlaybookContext {
  return {
    ...contact,
    lens: detectedLens ?? null,
    callStage: isValidCallStage(callStage) ? callStage : undefined,
    sentiment: isValidSentiment(sentiment) ? sentiment : undefined,
  };
}
```

### Step 3: 개선된 suggestCallSituations() 함수

```typescript
// src/lib/playbook/call-situations.ts 기존 함수 수정

/**
 * 렌즈 + 콜 상태 기반 상황 추천 (타입 안전)
 * 
 * @param lens 렌즈 타입 (L0-L10)
 * @param callStage 콜 상태 (COMPLAINT | OBJECTION | ... | undefined)
 * @returns 추천 상황 배열 (우선순위 정렬)
 * 
 * @example
 * const situations = suggestCallSituations('L6', 'COMPLAINT');
 * // → ['COMPLAINT', 'PRICE_OBJECTION', ...]
 */
export function suggestCallSituations(
  lens: LensType,
  callStage?: CallStageType
): CallSituation[] {
  // 1️⃣ 렌즈 기반 주요 상황 추천 (primaryLens 일치)
  const primary = CALL_SITUATION_ORDER.filter(
    (s) => CALL_SITUATIONS[s].primaryLens === lens
  );

  // 2️⃣ 나머지 상황 (tier: CORE → GROWTH 순)
  const rest = CALL_SITUATION_ORDER.filter(
    (s) => CALL_SITUATIONS[s].primaryLens !== lens
  );

  // 3️⃣ 결과 배열 생성 (불변성 유지)
  let result: CallSituation[] = [...primary, ...rest];

  // 4️⃣ 콜 상태가 COMPLAINT면 최우선 배치
  if (callStage === 'COMPLAINT') {
    const complaintIdx = result.indexOf('COMPLAINT');
    
    // COMPLAINT가 이미 첫 번째가 아니면 이동
    if (complaintIdx > 0) {
      // 원본 배열 수정하지 않고 새 배열 생성
      result = [
        'COMPLAINT',
        ...result.slice(0, complaintIdx),
        ...result.slice(complaintIdx + 1),
      ];
    } else if (complaintIdx === -1) {
      // COMPLAINT이 없는 경우 (비정상)
      console.warn('[suggestCallSituations] COMPLAINT not found in CALL_SITUATION_ORDER');
    }
  }

  return result;
}

/**
 * 감정 기반 상황 추가 (Sentiment → CallSituation 매핑)
 * 
 * NEGATIVE 감정이 감지되면 COMPLAINT를 최우선으로 추천
 */
export function prioratizeBySentiment(
  situations: CallSituation[],
  sentiment?: SentimentType
): CallSituation[] {
  if (sentiment !== 'NEGATIVE') {
    return situations;
  }

  // NEGATIVE → COMPLAINT 최우선
  const complaintIdx = situations.indexOf('COMPLAINT');
  if (complaintIdx > 0) {
    return [
      'COMPLAINT',
      ...situations.slice(0, complaintIdx),
      ...situations.slice(complaintIdx + 1),
    ];
  } else if (complaintIdx === -1) {
    // COMPLAINT이 목록에 없으면 추가
    return ['COMPLAINT', ...situations];
  }

  return situations;
}
```

### Step 4: PlaybookViewer 사용 예시

```typescript
// src/app/(dashboard)/tools/playbook-viewer/page.tsx

import { 
  suggestCallSituations, 
  prioratizeBySentiment,
  toPlaybookContext,
  type CallStageType,
  type SentimentType 
} from '@/lib/playbook/call-situations';
import type { ContactWithPlaybookContext } from '@/types/contact';

export default function PlaybookViewerPage() {
  // ... 상태 정의
  const [contactData, setContactData] = useState<ContactWithPlaybookContext | null>(null);

  // Contact 데이터 로드 (예: API에서)
  const loadContact = async (contactId: string) => {
    const res = await fetch(`/api/contacts/${contactId}`);
    const contact = await res.json();
    
    // 렌즈 감지 (별도 엔진)
    const lens = await detectLens(contact);
    
    // ContactWithPlaybookContext로 변환
    const contextContact = toPlaybookContext(
      contact,
      lens,
      contact.callStage,  // 선택사항
      contact.sentiment   // 선택사항
    );
    
    setContactData(contextContact);
  };

  // 상황 추천 로직 (타입 안전)
  const getSuggestedSituations = () => {
    if (!contactData?.lens) {
      console.warn('Lens not detected');
      return [];
    }

    // 1️⃣ 렌즈 + 콜 상태 기반 추천
    let situations = suggestCallSituations(
      contactData.lens,
      contactData.callStage as CallStageType | undefined
    );

    // 2️⃣ 감정 기반 우선순위 조정
    situations = prioratizeBySentiment(
      situations,
      contactData.sentiment as SentimentType | undefined
    );

    return situations;
  };

  return (
    <div>
      {/* UI 렌더링 */}
      {getSuggestedSituations().map(situation => (
        <div key={situation}>
          {/* 안전함 */}
        </div>
      ))}
    </div>
  );
}
```

**장점**:
- ✅ 컴파일 타임 타입 검사
- ✅ 런타임 타입 가드 (검증)
- ✅ 불변성 유지 (부작용 제거)
- ✅ 명확한 의도 (함수명 + 파라미터)

**단점**:
- 타입 정의 추가 (코드량 증가)

---

## 개선안 2️⃣: Discriminated Union (권장)

타입 안전성을 최대화하려면 **Discriminated Union** 패턴을 사용:

```typescript
// src/lib/playbook/call-situations.ts

/**
 * 콜 상황 추천 결과 (Discriminated Union)
 * 성공/실패를 타입 수준에서 구분
 */
export type SituationRecommendationResult = 
  | {
      type: 'success';
      situations: CallSituation[];
      primaryReason: 'lens' | 'sentiment' | 'callstage';
    }
  | {
      type: 'error';
      code: 'INVALID_LENS' | 'INVALID_CALLSTAGE' | 'NO_SITUATIONS_FOUND';
      message: string;
    };

/**
 * 안전한 상황 추천 (Discriminated Union)
 * 
 * @example
 * const result = suggestCallSituationsSafe('L6', 'COMPLAINT');
 * 
 * if (result.type === 'success') {
 *   console.log(result.situations);
 * } else {
 *   console.error(result.message);
 * }
 */
export function suggestCallSituationsSafe(
  lens: LensType,
  callStage?: CallStageType,
  sentiment?: SentimentType
): SituationRecommendationResult {
  // 렌즈 검증
  if (!lens) {
    return {
      type: 'error',
      code: 'INVALID_LENS',
      message: 'Lens is required but not provided',
    };
  }

  // 콜 상태 검증
  if (callStage && !isValidCallStage(callStage)) {
    return {
      type: 'error',
      code: 'INVALID_CALLSTAGE',
      message: `Invalid callStage: ${callStage}`,
    };
  }

  // 렌즈 기반 추천
  const primary = CALL_SITUATION_ORDER.filter(
    (s) => CALL_SITUATIONS[s].primaryLens === lens
  );

  if (primary.length === 0) {
    return {
      type: 'error',
      code: 'NO_SITUATIONS_FOUND',
      message: `No situations found for lens: ${lens}`,
    };
  }

  const rest = CALL_SITUATION_ORDER.filter(
    (s) => CALL_SITUATIONS[s].primaryLens !== lens
  );

  let situations: CallSituation[] = [...primary, ...rest];

  // 콜 상태 우선순위
  let primaryReason: 'lens' | 'sentiment' | 'callstage' = 'lens';
  if (callStage === 'COMPLAINT') {
    const idx = situations.indexOf('COMPLAINT');
    if (idx > 0) {
      situations = ['COMPLAINT', ...situations.slice(0, idx), ...situations.slice(idx + 1)];
      primaryReason = 'callstage';
    }
  }

  // 감정 우선순위
  if (sentiment === 'NEGATIVE' && primaryReason === 'lens') {
    const idx = situations.indexOf('COMPLAINT');
    if (idx > 0) {
      situations = ['COMPLAINT', ...situations.slice(0, idx), ...situations.slice(idx + 1)];
      primaryReason = 'sentiment';
    }
  }

  return {
    type: 'success',
    situations,
    primaryReason,
  };
}
```

**사용 예시**:

```typescript
const result = suggestCallSituationsSafe(contactData.lens, contactData.callStage, contactData.sentiment);

switch (result.type) {
  case 'success':
    console.log(`Recommended situations (${result.primaryReason}):`, result.situations);
    break;
  case 'error':
    console.error(`[${result.code}] ${result.message}`);
    break;
}
```

**장점**:
- ✅ 성공/실패를 타입 수준에서 구분 (exhaustiveness check)
- ✅ 런타임 에러 처리 명확
- ✅ 추천 이유를 명시 (UI에서 사용 가능)

---

## 개선안 3️⃣: Zod 스키마 검증 (Enterprise)

대규모 애플리케이션에서는 **런타임 검증**이 필수:

```typescript
// src/lib/schemas/contact.ts

import { z } from 'zod';
import type { LensType, CallStageType, SentimentType } from '@/types/contact';

/**
 * RuntimeSchema: Contact + Playbook Context
 * - API 응답 검증
 * - URL 파라미터 검증
 * - 폼 입력 검증
 */

const LensSchema = z.enum([
  'L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10',
] as const);

const CallStageSchema = z.enum([
  'COMPLAINT', 'OBJECTION', 'UPSELL', 'FOLLOWUP', 'REGULAR',
] as const);

const SentimentSchema = z.enum([
  'POSITIVE', 'NEGATIVE', 'NEUTRAL',
] as const).optional();

/**
 * PlaybookContext 스키마 (API 응답 검증)
 */
export const PlaybookContextSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  // ... 기존 Contact 필드
  lens: LensSchema.nullable(),
  callStage: CallStageSchema.optional(),
  sentiment: SentimentSchema,
});

export type PlaybookContext = z.infer<typeof PlaybookContextSchema>;

/**
 * URL 파라미터 검증
 */
export const PlaybookParamsSchema = z.object({
  lens: LensSchema.optional(),
  callStage: CallStageSchema.optional(),
  sentiment: SentimentSchema.optional(),
});

export type PlaybookParams = z.infer<typeof PlaybookParamsSchema>;
```

**API 라우트에서 사용**:

```typescript
// src/app/api/contacts/[id]/playbook-context/route.ts

import { PlaybookContextSchema } from '@/lib/schemas/contact';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const contact = await db.contact.findUnique({ where: { id: params.id } });
    const lens = await detectLens(contact);

    const data = {
      ...contact,
      lens,
      callStage: contact.callStage as CallStageType | undefined,
      sentiment: contact.sentiment as SentimentType | undefined,
    };

    // 런타임 검증
    const validated = PlaybookContextSchema.parse(data);

    return Response.json({ ok: true, data: validated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json(
        { ok: false, error: err.flatten() },
        { status: 400 }
      );
    }
    throw err;
  }
}
```

**장점**:
- ✅ API 응답 런타임 검증
- ✅ 타입 & 값 검증 동시 수행
- ✅ 자동 에러 메시지 생성
- ✅ OpenAPI/타입 스크립트 자동 동기화

---

## 📊 세 개선안 비교표

| 기준 | 개선안 1️⃣ | 개선안 2️⃣ | 개선안 3️⃣ |
|-----|---------|---------|---------|
| **구현 난도** | 낮음 | 중간 | 높음 |
| **타입 안전성** | 고 | 매우 고 | 매우 고 |
| **런타임 검증** | 수동 | 수동 | 자동 |
| **에러 처리** | 암시적 | 명시적 | 매우 명시적 |
| **API 검증** | ❌ | ❌ | ✅ |
| **추천 대상** | 중규모 프로젝트 | 타입 안전 필수 | Enterprise |
| **코드량 증가** | +50줄 | +70줄 | +150줄 |

---

## 🎯 즉시 적용 체크리스트

### Phase 1️⃣: 긴급 (오늘)
- [ ] Issue 2 수정: `result[0].includes()` → `result.indexOf()` 변경
- [ ] Issue 1 수정: Contact 타입에 `lens`, `callStage`, `sentiment` 필드 추가
- [ ] Issue 5 수정: 배열 불변성 유지 (`result.slice()` 사용)

### Phase 2️⃣: 단기 (이번 주)
- [ ] 개선안 1 완전 적용 (타입 검증 함수 추가)
- [ ] suggestCallSituations() 함수 재작성
- [ ] PlaybookViewer 페이지 업데이트

### Phase 3️⃣: 중기 (이번 달)
- [ ] 개선안 2 적용 (Discriminated Union)
- [ ] SituationRecommendationResult 타입 도입
- [ ] UI에서 에러 처리 강화

### Phase 4️⃣: 장기 (향후)
- [ ] Zod 스키마 도입 (개선안 3)
- [ ] API 응답 자동 검증
- [ ] OpenAPI 문서 자동 생성

---

## 📝 참고 코드 위치

| 파일 | 라인 | 현황 |
|-----|-----|------|
| `src/types/contact.ts` | - | Contact 타입 (확장 필요) |
| `src/lib/playbook/call-situations.ts` | 362-384 | suggestCallSituations() (버그 있음) |
| `src/app/(dashboard)/tools/playbook-viewer/page.tsx` | 177-200 | 사용 예시 |

---

## 🔗 관련 메모리 파일

- [[call_situations_refactoring]] — Call Situations 렌즈 매핑 설계 (2026-06-02)
- [[playbook_viewer_implementation]] — PlaybookViewer 렌즈 통합 구현 (2026-06-01)

