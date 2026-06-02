# Phase 5-2 + Auto P2-P3 완전 구현 SOP

> **무한루프 절대법칙 Phase 3: SOP 정의**  
> 거장단 5명 토론 결과 반영 (CRM, 퍼널, TS, 보안, 심리학)

---

## 📋 Two-Track 작업 개요

### Track A: Playbook 완전화 (2시간)
**목표:** Contact 렌즈/상태 → 8가지 상황별 스크립트 자동 추천

### Track B: Auto P2-P3 (2시간)
**목표:** 클릭 추적 + SMS 자동 생성

---

## 🎯 Track A: Playbook 완전화 (2시간)

### 1️⃣ 8가지 상황별 스크립트 라이브러리 (30분)

**파일:** `src/lib/playbook/call-situations.ts` (신규, 500줄)

#### 상황 분류 (Enum)

```typescript
// Core 4가지 (필수)
enum CallSituation {
  PRICE_OBJECTION = 'PRICE_OBJECTION',           // 가격 이의
  HEALTH_CONCERN = 'HEALTH_CONCERN',             // 건강 문제
  REFUND_REQUEST = 'REFUND_REQUEST',             // 환불/변경
  COMPLAINT = 'COMPLAINT',                       // 불만 처리
  
  // Growth 4가지 (추가)
  FOOD_CONSULTATION = 'FOOD_CONSULTATION',       // 음식 상담
  UPSELL = 'UPSELL',                             // 상향 판매
  REBOOKING = 'REBOOKING',                       // 추가 예약
  CONTRACT_RENEWAL = 'CONTRACT_RENEWAL'          // 재계약
}
```

#### 상황별 오프닝 라인 3개 (심리학 + 렌즈)

```typescript
const CALL_SITUATION_OPENINGS = {
  [CallSituation.PRICE_OBJECTION]: {
    opening1: "선사와 직결되어 있어서 싼 거예요. (L10 권위)",
    opening2: "환불 100% 보장이니까 안심하세요. (L6 손실회피)",
    opening3: "월 33,000원부터 시작할 수 있습니다. (L1 가치)",
    lenses: ['L10', 'L6', 'L1'],
    rebuttal: "신뢰하기 어렵다면, 온라인 후기 확인해보세요."
  },
  
  [CallSituation.HEALTH_CONCERN]: {
    opening1: "부모님 건강이 최우선이시죠? (L9 신뢰)",
    opening2: "건강검진 무료로 해드립니다. (L5 자기투영)",
    opening3: "선박 의료팀과 미리 협의하니까요. (L9 신뢰)",
    lenses: ['L9', 'L5'],
    rebuttal: "의료진 경력을 확인해드릴 수 있어요."
  },
  
  [CallSituation.REFUND_REQUEST]: {
    opening1: "정책을 정확히 안내해드리겠습니다. (L3 차별)",
    opening2: "투명성 100%가 우리 원칙입니다. (L10 권위)",
    opening3: "빠른 처리로 도와드리겠습니다. (L6 긴박)",
    lenses: ['L3', 'L10', 'L6'],
    rebuttal: "위약금은 선사 규정이지만, 최대한 도와드릴게요."
  },
  
  [CallSituation.COMPLAINT]: {
    opening1: "정말 답답하셨겠어요. 완전 이해합니다. (L0 공감)",
    opening2: "우리는 그렇게 다르게 합니다. (L3 차별)",
    opening3: "다음번은 완벽하게 할 거 약속합니다. (L8 재구매)",
    lenses: ['L0', 'L3', 'L8'],
    rebuttal: "어떤 점을 가장 개선하고 싶으신가요?"
  },
  
  [CallSituation.FOOD_CONSULTATION]: {
    opening1: "한국인이라 밥맛이 중요하지요? (L7 공감)",
    opening2: "우리 인솔자가 맛집을 알거든요. (L8 재구매)",
    opening3: "건강한 식단도 안내해드립니다. (L9 신뢰)",
    lenses: ['L7', 'L8', 'L9'],
    rebuttal: "사전에 식성을 알려주시면 좋습니다."
  },
  
  [CallSituation.UPSELL]: {
    opening1: "더 좋은 경험을 원하시나요? (L8 재구매)",
    opening2: "프리미엄 혜택이 정말 다릅니다. (L5 자기투영)",
    opening3: "이 한정 오퍼는 오늘까지만입니다. (L6 희소)",
    lenses: ['L8', 'L5', 'L6'],
    rebuttal: "기본도 좋지만, 프리미엄은 정말 특별합니다."
  },
  
  [CallSituation.REBOOKING]: {
    opening1: "또 가고 싶으신가요? 정말 반갑습니다. (L8 재구매)",
    opening2: "특가 상품이 나왔어요. (L6 희소)",
    opening3: "얼른 예약 부탁드려요. (L6 긴박)",
    lenses: ['L8', 'L6'],
    rebuttal: "언제쯤 가고 싶으신데요?"
  },
  
  [CallSituation.CONTRACT_RENEWAL]: {
    opening1: "올해 여행 계획을 세우셨나요? (L8 재구매)",
    opening2: "골드 회원은 평생 할인이에요. (L10 권위)",
    opening3: "다음 여행을 더 잘 준비해드릴게요. (L5 자기투영)",
    lenses: ['L8', 'L10', 'L5'],
    rebuttal: "이번엔 어디를 꿈꾸세요?"
  }
};
```

#### 함수: Lens별 상황 추천

```typescript
export function suggestCallSituations(
  lens: string,
  callStage?: string
): CallSituation[] {
  // Lens가 L1이면 PRICE_OBJECTION 우선
  // Lens가 L9면 HEALTH_CONCERN 우선
  // callStage가 CUSTOMER이면 COMPLAINT/REBOOKING 추천
  
  const situationsByLens: Record<string, CallSituation[]> = {
    'L0': [CallSituation.COMPLAINT, CallSituation.REBOOKING],
    'L1': [CallSituation.PRICE_OBJECTION, CallSituation.UPSELL],
    'L2': [CallSituation.HEALTH_CONCERN, CallSituation.REFUND_REQUEST],
    'L3': [CallSituation.UPSELL, CallSituation.REBOOKING],
    'L6': [CallSituation.PRICE_OBJECTION, CallSituation.REBOOKING],
    'L8': [CallSituation.REBOOKING, CallSituation.CONTRACT_RENEWAL],
    'L9': [CallSituation.HEALTH_CONCERN, CallSituation.COMPLAINT],
    'L10': [CallSituation.UPSELL, CallSituation.CONTRACT_RENEWAL],
  };
  
  return situationsByLens[lens] || [CallSituation.FOOD_CONSULTATION];
}
```

### 2️⃣ VoicePlayback 네트워크 3모드 (30분)

**파일 수정:** `src/app/(dashboard)/playbook/VoicePlayback.tsx`

#### 3가지 네트워크 모드

```typescript
type NetworkMode = 'WIFI' | 'CELLULAR' | 'OFFLINE';

function detectNetworkMode(): NetworkMode {
  if (!navigator.onLine) return 'OFFLINE';
  
  const connection = (navigator as any).connection;
  if (!connection) return 'WIFI'; // 지원 안 하면 기본값
  
  // effectiveType: 4g, 3g, 2g, slow-2g
  if (connection.saveData) return 'CELLULAR'; // 데이터 절약 모드
  if (connection.effectiveType === '4g') return 'WIFI';
  if (['3g', '2g', 'slow-2g'].includes(connection.effectiveType)) return 'CELLULAR';
  
  return 'WIFI'; // 기본값
}

// 모드별 동작
const modeConfig = {
  WIFI: {
    // 실시간 스트리밍 (저지연)
    streaming: true,
    cache: false,
    fallback: 'text'
  },
  CELLULAR: {
    // 캐시된 음성 재생 (빠름)
    streaming: false,
    cache: true,
    fallback: 'text'
  },
  OFFLINE: {
    // 텍스트만 (음성 비활성)
    streaming: false,
    cache: false,
    fallback: 'text_only'
  }
};
```

#### 네트워크 변경 이벤트 구독

```typescript
useEffect(() => {
  const connection = (navigator as any).connection;
  if (!connection) return;
  
  function handleConnectionChange() {
    const mode = detectNetworkMode();
    setNetworkMode(mode);
    setAudioEnabled(mode !== 'OFFLINE');
  }
  
  connection.addEventListener('change', handleConnectionChange);
  return () => connection.removeEventListener('change', handleConnectionChange);
}, []);
```

### 3️⃣ Contact 상태 자동 통합 (1시간)

**파일 수정:** `src/app/(dashboard)/playbook/page.tsx`

#### Contact 상태 감지

```typescript
// Contact에서 자동 감지
const { lens, callStage, sentiment } = contact;

// 1. Lens 기반 필터
const mainSituation = suggestCallSituations(lens)[0];

// 2. CallStage 추가 필터 (선택)
const additionalSituations = callStage 
  ? suggestCallSituations(lens, callStage)
  : [];

// 3. Sentiment 기반 우선순위
if (sentiment === 'NEGATIVE') {
  situationList.unshift(CallSituation.COMPLAINT);
}

// 최종: Lens → CallStage → Sentiment 순서로 스크립트 정렬
const sortedSituations = [
  mainSituation,
  ...additionalSituations.filter(s => s !== mainSituation),
  ...(sentiment === 'NEGATIVE' ? [CallSituation.COMPLAINT] : [])
];
```

#### UI: 자동 추천 스크립트 상단 고정

```jsx
<div className="mb-6 p-4 bg-blue-100 rounded-lg">
  <h3 className="font-bold mb-2">📌 이 고객에게 추천</h3>
  {sortedSituations.map(situation => (
    <button
      key={situation}
      className="block w-full text-left p-2 mb-2 bg-white rounded hover:bg-blue-50"
      onClick={() => openScript(situation)}
    >
      {CALL_SITUATION_OPENINGS[situation].opening1}
    </button>
  ))}
</div>
```

---

## 🎯 Track B: Auto P2-P3 (2시간)

### 1️⃣ ToolClickTracker API (1시간)

**파일:** `src/app/api/tools/click-tracker/route.ts` (신규, 350줄)

#### 저장 정보 (PII 절대 금지)

```typescript
interface ClickEvent {
  userId: string;          // 영업사원 ID
  scriptId: string;        // 스크립트 ID
  event: 'click' | 'use' | 'success'; // 클릭/사용/성공
  situation?: string;      // CallSituation
  timestamp: Date;
  durationMs?: number;     // 사용 시간
}

// ❌ 절대 금지: contactId, phone, email, name 등 PII
```

#### API 엔드포인트

```typescript
// POST /api/tools/click-tracker
// Body: { scriptId, event, situation, durationMs }
// Response: { success: true, trackId }

// GET /api/tools/click-tracker/stats
// Query: { scriptId, days: 7 }
// Response: { usageCount, successCount, successRate, ranking }
```

#### 권한 제어

```typescript
// AGENT/FREE_SALES: 본인 기록만 조회 가능
// MANAGER: 팀 기록 조회 가능
// ADMIN/OWNER: 조직 전체 조회 가능
```

### 2️⃣ AutoFeedbackGenerator (1시간)

**파일:** `src/app/api/tools/auto-feedback/route.ts` (신규, 300줄)

#### 자동 SMS 생성 파이프라인

```typescript
// 1. Contact 생성 → Lens 감지 (ONE-TIME)
const lens = detectLandingLens(signupData); // "L0", "L1", ..., "L10"

// 2. 기존 PASONA Day0-3 템플릿 로드
const smsTemplates = SMS_TEMPLATES_BY_LENS[lens];
// smsTemplates.day0, .day1, .day2, .day3

// 3. 변수 치환 (이름, 제품, 할인 등)
const personalizedDay0 = smsTemplates.day0
  .replace('{{name}}', contact.name)
  .replace('{{discount}}', '30%');

// 4. ScheduledSms 테이블에 등록
await createScheduledSms([
  { content: personalizedDay0, scheduledAt: now + 0h, day: 0 },
  { content: personalizedDay1, scheduledAt: now + 24h, day: 1 },
  { content: personalizedDay2, scheduledAt: now + 48h, day: 2 },
  { content: personalizedDay3, scheduledAt: now + 72h, day: 3 }
]);

// 5. Cron job이 자동으로 발송
```

#### 권한 제어

```typescript
// Manager: 자신의 Contact 대상 SMS만 확인 + 수정 불가
// Admin/Owner: 조직 전체 SMS 조회 + 수정 가능
```

---

## 🔐 보안 체크리스트 (필수)

- [ ] ToolClickTracker: contactId 저장 금지 (userId만)
- [ ] SMS 로그: audit log 분리
- [ ] 권한 제어: Manager 자기 Contact만
- [ ] 재시도: 최대 3회 (GDPR)
- [ ] 민감정보: 절대 로깅 금지

---

## 📊 구현 순서 (병렬)

### Agent-Playbook (1시간)
1. call-situations.ts (8가지 상황 + 오프닝)
2. VoicePlayback.tsx 수정 (네트워크 3모드)
3. playbook/page.tsx 수정 (자동 필터링)

### Agent-Auto (1시간)
1. click-tracker/route.ts (저장 + 조회)
2. auto-feedback/route.ts (SMS 자동 생성)

### 최종 검증 (15분)
- npx tsc --noEmit → 0 에러
- 병합 + 커밋

---

## ✅ 성공 지표

| 메트릭 | 목표 | 검증 방법 |
|--------|------|---------|
| Playbook 로딩 | <500ms | DevTools Performance |
| 음성 재생 (WiFi) | <1s | 실제 테스트 |
| 음성 재생 (Cellular) | <2s | 캐시 로드 |
| SMS 생성 자동화 | 100% | DB 확인 |
| ToolClickTracker 정확도 | 99%+ | 수동 체크 vs 기록 비교 |

---

**Phase 5-2 완전 구현 SOP 완료!**
