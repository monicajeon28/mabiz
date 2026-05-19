# Menu #38 Phase 4 Wave 3: 렌탈 SMS 마법사 Step 1-2 완료

**작업일**: 2026-05-19  
**완료 에이전트**: Alpha  
**커밋**: 0a91cd1  
**산출물**: 911줄 (목표 550줄 초과 달성)  
**다음 작업**: Agent β (Step 3-4 구현 또는 통합 테스트)

---

## 1. 완료된 산출물

### 1.1 useDeltaWizard Hook (378줄)
**경로**: `src/hooks/useDeltaWizard.ts`

#### 상태 관리
```typescript
interface WizardState {
  currentStep: number;           // 1-4
  campaignId: string;
  triggerType: 'PURCHASE' | 'ABANDONED';
  messages: {
    day0: string;               // 90자
    day1: string;               // 160자
    day2: string;               // 160자
    day3: string;               // 160자
  };
  useDefaultMessages: boolean;   // 기본값 ↔ 직접입력
  isLoading: boolean;            // 초기 로드 중
  isSaving: boolean;             // 저장 중
  error: string | null;          // 에러 메시지
}
```

#### 핵심 메서드
1. **초기화 (useEffect)**
   - GET `/api/campaigns/{campaignId}/delta` 호출
   - 404: 기본값으로 초기화 (첫 설정)
   - 200: 기존 설정 로드 (useDefaultMessages=false)
   - 에러: 기본값 사용 (로그만)

2. **isStepValid(step)**
   ```
   Step 1: triggerType ○ (필수)
   Step 2: useDefaultMessages=true || (day0 && day1 && day2 && day3)
   Step 3: true
   Step 4: true
   ```

3. **네비게이션**
   - `handleNext()`: 검증 통과 시만 다음 단계
   - `handlePrev()`: 이전 단계로 (검증 없음)

4. **상태 업데이트**
   - `toggleDefault()`: 모드 전환 시 messages 초기화
   - `setMessage(day, content)`: textarea 값 변경
   - `setTriggerType(type)`: trigger 변경 후 기본값 재계산

5. **저장 (handleSave())**
   ```
   POST /api/campaigns/delta
   요청:
   {
     campaignId: string,
     triggerType: 'PURCHASE',
     deltaDay0Message: string,
     deltaDay1Message: string,
     deltaDay2Message: string,
     deltaDay3Message: string
   }
   
   응답:
   {
     ok: true,
     deltaCampaignConfigId: string,
     campaignId: string,
     triggerType: string,
     messages: [
       { day: 0, content: string },
       { day: 1, content: string },
       { day: 2, content: string },
       { day: 3, content: string }
     ]
   }
   ```

   **에러 처리**
   - HTTP 400: 검증 실패 → toast.error() + state.error = message
   - HTTP 404: 캠페인 없음 → toast.error() + state.error
   - HTTP 500: 서버 에러 → toast.error() + state.error
   - 네트워크: try-catch → toast.error()

   **성공 처리**
   - toast.success('렌탈 SMS 설정이 저장되었습니다.')
   - state.error = null
   - 로그: logger.log('[useDeltaWizard] 설정 저장 성공', ...)

---

### 1.2 TriggerSelector Component (96줄)
**경로**: `src/components/delta-setup/TriggerSelector.tsx`

#### Props
```typescript
interface TriggerSelectorProps {
  value: 'PURCHASE' | 'ABANDONED';
  onChange: (type: 'PURCHASE' | 'ABANDONED') => void;
}
```

#### 렌더링
1. **PURCHASE (활성화)**
   - 라디오 버튼 (선택 가능)
   - 배경: 선택 시 blue-50, 미선택 시 white
   - 배지: ✓ 활성화 (green) + 권장 (blue)

2. **ABANDONED (비활성화)**
   - 라디오 버튼 (disabled)
   - 배경: gray-50 (opacity-50)
   - 배지: 미지원 (gray)

3. **설명 박스**
   - blue-50 배경
   - "트리거란?" 정의 포함

#### 통합
```typescript
const { state, setTriggerType } = useDeltaWizard(campaignId);
// <TriggerSelector value={state.triggerType} onChange={setTriggerType} />
```

---

### 1.3 MessageSelector Component (191줄)
**경로**: `src/components/delta-setup/MessageSelector.tsx`

#### Props
```typescript
interface MessageSelectorProps {
  triggerType: 'PURCHASE' | 'ABANDONED';
  useDefault: boolean;
  onToggleDefault: () => void;
  messages: {
    day0: string;
    day1: string;
    day2: string;
    day3: string;
  };
  onMessageChange: (day: DayKey, content: string) => void;
  defaultMessages: DefaultMessages;
}
```

#### 렌더링
1. **모드 선택 라디오**
   - "기본값 사용 (추천)": Day 0-3 읽기전용 (green-50 선택)
   - "직접 입력": Day 0-3 textarea 활성화 (blue-50 선택)

2. **메시지 입력 (4개 항목)**
   ```
   Day 0: 📲 구매 직후 (90자, rows=2)
   Day 1: 📤 +1일 (160자, rows=3)
   Day 2: ⏰ +2일 (160자, rows=3)
   Day 3: 🚨 +3일 (160자, rows=3, "✅ 필수" 배지)
   ```

3. **글자수 표시**
   - 기본값 모드: 읽기전용 display
   - 직접입력 모드:
     - textarea 실시간 글자 수 표시 (예: 45/90)
     - 80% 초과: ⚠️ 남은 글자 경고 (LMS 전환 예고)

4. **작성 가이드 박스**
   - Day별 심리학 원리 설명
   - maxChars 명시
   - "기본값 추천" 안내

#### 통합
```typescript
const { state, defaultMessages, toggleDefault, setMessage } = useDeltaWizard(campaignId);
// <MessageSelector 
//   useDefault={state.useDefaultMessages}
//   onToggleDefault={toggleDefault}
//   messages={state.messages}
//   onMessageChange={setMessage}
//   defaultMessages={defaultMessages}
// />
```

---

### 1.4 DeltaSetupPage (246줄)
**경로**: `src/app/(dashboard)/campaigns/[id]/delta-setup/page.tsx`

#### URL
```
/campaigns/[id]/delta-setup
```

#### 레이아웃
1. **헤더**
   - 제목: "렌탈 SMS 마법사"
   - 설명: "고객의 여행 상품 구매 후 4일에 걸쳐..."

2. **진행도 바**
   ```
   [████████  ] Step 2/4
   ```

3. **Step별 컴포넌트**
   - **Step 1**: TriggerSelector
   - **Step 2**: MessageSelector
   - **Step 3**: 메시지 미리보기 (Day 0-3 display + 글자수)
   - **Step 4**: 발송 스케줄 (Day별 시간 + trigger 설명)

4. **네비게이션**
   ```
   [이전] [다음]           (Step 1-3)
   [이전] [저장]           (Step 4)
   ```
   - "이전": Step 1 일 때 disabled
   - "다음": isStepValid(currentStep)=false일 때 disabled
   - "저장": isSaving=true일 때 "저장 중..." 표시

5. **에러 메시지**
   - state.error 표시 (red-50 배경)

6. **로딩 상태**
   - state.isLoading: 스켈레톤 (3개 라인)

#### 저장 흐름
```typescript
handleSaveAndClose = async () => {
  await handleSave();  // POST /api/campaigns/delta
  if (!state.error) {
    setTimeout(() => {
      router.push(`/campaigns/${campaignId}`);  // 1.5초 후
    }, 1500);
  }
}
```

---

## 2. API 통합

### GET /api/campaigns/[id]/delta (읽기)
**호출 시점**: useDeltaWizard 초기화  
**요청**: -  
**응답**:
```json
{
  "ok": true,
  "campaignId": "...",
  "deltaCampaignConfigId": "...",
  "triggerType": "PURCHASE",
  "schedule": [
    {
      "day": 0,
      "time": "09:00",
      "message": "...",
      "charCount": 45,
      "type": "SMS"
    },
    ...
  ],
  "stats": {
    "totalSent": 0,
    "totalSuccess": 0,
    "totalFailure": 0,
    "successRate": 0,
    "lastExecutedAt": null
  },
  "isConfigured": false
}
```

### POST /api/campaigns/delta (저장)
**호출 시점**: Step 4에서 "저장" 클릭  
**요청**:
```json
{
  "campaignId": "...",
  "triggerType": "PURCHASE",
  "deltaDay0Message": "...",
  "deltaDay1Message": "...",
  "deltaDay2Message": "...",
  "deltaDay3Message": "..."
}
```

**응답** (201 Created):
```json
{
  "ok": true,
  "deltaCampaignConfigId": "...",
  "campaignId": "...",
  "triggerType": "PURCHASE",
  "messages": [
    { "day": 0, "content": "..." },
    { "day": 1, "content": "..." },
    { "day": 2, "content": "..." },
    { "day": 3, "content": "..." }
  ]
}
```

**에러 응답**:
- **400**: 검증 실패
  ```json
  {
    "ok": false,
    "error": "INVALID_INPUT",
    "message": "Day 0 메시지는 90자 이하여야 합니다.",
    "errors": { "deltaDay0Message": "..." }
  }
  ```
- **404**: 캠페인 없음
  ```json
  {
    "ok": false,
    "error": "NOT_FOUND",
    "message": "캠페인을 찾을 수 없습니다."
  }
  ```
- **500**: 서버 에러
  ```json
  {
    "ok": false,
    "error": "INTERNAL_SERVER_ERROR",
    "message": "서버 오류가 발생했습니다."
  }
  ```

---

## 3. 파일 구조

```
src/
├── hooks/
│   └── useDeltaWizard.ts          (378줄)
├── components/
│   └── delta-setup/
│       ├── TriggerSelector.tsx     (96줄)
│       └── MessageSelector.tsx     (191줄)
└── app/
    └── (dashboard)/
        └── campaigns/
            └── [id]/
                └── delta-setup/
                    └── page.tsx     (246줄)
```

---

## 4. 기술 스택

- **언어**: TypeScript (strict mode)
- **프레임워크**: Next.js 15, React 18+
- **상태 관리**: React Hooks (useState, useEffect, useCallback)
- **UI**: Tailwind CSS (기존 스타일 준용)
- **통신**: Fetch API (with retry logic는 없음, 단순 구현)
- **로깅**: console.error (debug) + logger.warn/error (business)
- **검증**: 없음 (API 서버에서 검증, 클라이언트는 UI 제한만)

---

## 5. 사용 흐름 (사용자 관점)

1. **캠페인 상세 페이지에서 "렌탈 SMS 설정" 버튼 클릭**
   ```
   /campaigns/[id] → /campaigns/[id]/delta-setup
   ```

2. **Step 1: 트리거 선택**
   - PURCHASE 선택 (기본값, ABANDONED 비활성화)
   - "다음" 클릭

3. **Step 2: 메시지 설정**
   - "기본값 사용" 또는 "직접 입력" 선택
   - 기본값: Day 0-3 읽기전용 표시
   - 직접입력: 각 Day별 textarea에 입력 (글자수 제한)
   - "다음" 클릭

4. **Step 3: 미리보기**
   - Day 0-3 메시지 내용 확인
   - SMS/LMS 타입 확인
   - "다음" 클릭

5. **Step 4: 스케줄 확인**
   - Day별 발송 시간 확인 (모두 09:00)
   - "저장" 클릭

6. **API 호출**
   ```
   POST /api/campaigns/delta
   → 201 Created
   → toast.success('렌탈 SMS 설정이 저장되었습니다.')
   → 1.5초 후 /campaigns/[id]로 리다이렉트
   ```

---

## 6. 주요 구현 패턴

### 6.1 Hook 패턴 (useDeltaWizard)
```typescript
const {
  state,                    // WizardState
  defaultMessages,          // DefaultMessages
  isStepValid,             // (step: number) => boolean
  handleNext,              // () => void
  handlePrev,              // () => void
  toggleDefault,           // () => void
  setMessage,              // (day: DayKey, content: string) => void
  setTriggerType,          // (type: TriggerType) => void
  handleSave,              // () => Promise<void>
} = useDeltaWizard(campaignId);
```

### 6.2 조건부 렌더링 패턴
```typescript
{state.currentStep === 1 && <TriggerSelector ... />}
{state.currentStep === 2 && <MessageSelector ... />}
{state.currentStep === 3 && <MessagePreview ... />}
{state.currentStep === 4 && <ScheduleVisualizer ... />}
```

### 6.3 에러 처리 패턴
```typescript
try {
  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 400) {
      // 검증 실패
    } else if (response.status === 404) {
      // 캠페인 없음
    } else {
      // 서버 에러
    }
  }
  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.message);
  }
  // 성공
} catch (err) {
  // 네트워크 에러
}
```

---

## 7. 다음 작업 (Agent β)

### Option A: Step 3-4 통계/스케줄 상세화
- Step 3: 기본값 vs 직접입력 비교 표시
- Step 4: 실시간 통계 (발송 예정 고객수, 성공률 등)

### Option B: 통합 테스트
- E2E 테스트 (Playwright)
  - Step 1-4 완주 시나리오
  - 기본값 ↔ 직접입력 전환
  - 에러 케이스 (400/404/500)
- 단위 테스트 (Jest)
  - isStepValid() 검증 로직
  - setMessage() 글자수 제한
  - handleSave() API 호출

### Option C: 배포 준비
- 환경변수 확인 (.env.local)
- Next.js 빌드 성공 확인
- Vercel 배포

### 추천: Option A → Option B → Option C 순서

---

## 8. 코드 리뷰 체크리스트

- [x] TypeScript strict mode 준수
- [x] React Hooks 올바른 사용 (종속성 배열 포함)
- [x] 에러 처리 (try-catch + 타입별 메시지)
- [x] 로깅 (console.error + logger)
- [x] UI 일관성 (Tailwind CSS, 기존 스타일 준용)
- [x] 접근성 (label, aria-label 기본, radio 사용)
- [x] 성능 (useCallback 최적화, 불필요한 리렌더링 방지)
- [x] 문서화 (주석, JSDoc)

---

## 9. 알려진 제한사항

1. **ABANDONED trigger 미지원**
   - 현재 UI에서 비활성화 (회색 처리)
   - 향후 구현 예정

2. **Step 3-4 실시간 통계 없음**
   - Day별 발송 예정 고객수 미표시
   - Day별 성공률 미표시

3. **중복 저장 방지 없음**
   - isSaving=true 동안 버튼 비활성화는 되지만
   - 더블 클릭 가능성 존재

4. **타임아웃 처리 없음**
   - API 응답 없을 시 무한 대기 가능
   - 향후 AbortController 추가 필요

---

## 10. 커밋 정보

```
커밋 해시: 0a91cd1
작성자: monicajeon28
메시지: feat(delta-setup): 렌탈 SMS 마법사 Step 1-2 + useDeltaWizard hook

파일:
- src/hooks/useDeltaWizard.ts (+378)
- src/components/delta-setup/TriggerSelector.tsx (+96)
- src/components/delta-setup/MessageSelector.tsx (+191)
- src/app/(dashboard)/campaigns/[id]/delta-setup/page.tsx (+246)

총 라인: +911줄
```

---

**다음 에이전트**: β (Step 3-4 구현 또는 통합 테스트)  
**예상 소요 시간**: 2-3시간 (선택사항에 따라)  
**우선순위**: Step 3-4 > 통합 테스트 > 배포 준비
