# Menu #38 Phase 4 Wave 4 — P1 59개 수정 작업지시서

## 📋 개요

| 항목 | 내용 |
|------|------|
| **목표** | P1 59개 → 0개 (점수 7.8 → 8.3/10) |
| **방식** | 6에이전트 병렬 (Phase 1) |
| **소요** | 1.5-2시간 |
| **커밋** | 6건 (에이전트별 1건) |
| **다음** | Step 6 코드 리뷰 + Step 7 메모리 업데이트 |

---

## 🎯 3가지 선행 의사결정

✅ **dayConfigs** → `constants/delta.ts`로 이동
✅ **confirm()** → Radix UI Dialog로 전환
✅ **API 캐싱** → React Query 도입

---

## 🚀 Phase 1: 6에이전트 병렬 실행

모든 에이전트가 **동시에** 시작합니다. 아래 순서대로 읽고 작업하세요.

---

# Agent β: 성능 최적화 (15개)

## 📝 담당 범위

| 파일 | P1 개수 | 주요 변경 |
|------|--------|---------|
| `src/hooks/useDeltaWizard.ts` | 8 | setState 배칭, API 캐싱, useCallback 최적화 |
| `src/components/delta-setup/MessageSelector.tsx` | 4 | dayConfigs useMemo, dayConfigs 상수화 |
| `src/components/delta-setup/ScheduleVisualizer.tsx` | 3 | setSchedules 배칭, 실제 API 호출 |

---

## 🔧 상세 작업 지시

### 1. useDeltaWizard.ts — setState 배칭 (P1 1-2)

**현재 (줄 155-162)**:
```typescript
setState((prev) => ({
  ...prev,
  isLoading: false,
  triggerType: data.triggerType || 'PURCHASE',
  messages: loadedMessages,
  useDefaultMessages: false,
  error: null,
}));
```

→ 이미 배칭되어 있으므로 **OK** (검토만)

**추가: React Query 도입** (P1 3-4)

```typescript
import { useQuery } from '@tanstack/react-query';

// 기존 useEffect 제거, 이 코드로 대체:
const { data: existingConfig, isLoading: configLoading } = useQuery({
  queryKey: ['delta-config', campaignId],
  queryFn: async () => {
    const response = await fetch(`/api/campaigns/${campaignId}/delta`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },
  staleTime: 5 * 60 * 1000, // 5분 캐시
  retry: 2,
  enabled: !!campaignId,
});

// useEffect에서 메시지 로드 로직을 useQuery 결과로 대체
useEffect(() => {
  if (existingConfig?.schedule) {
    setState((prev) => ({
      ...prev,
      isLoading: false,
      messages: {
        day0: existingConfig.schedule[0]?.message || '',
        day1: existingConfig.schedule[1]?.message || '',
        day2: existingConfig.schedule[2]?.message || '',
        day3: existingConfig.schedule[3]?.message || '',
      },
      useDefaultMessages: false,
    }));
  }
}, [existingConfig]);
```

### 2. useCallback 의존성 최적화 (P1 5)

**현재 (줄 209)**:
```typescript
const isStepValid = useCallback(
  () => { ... },
  [state.triggerType, state.useDefaultMessages, state.messages]
);
```

→ **OK** (이미 최적화됨)

**검토**: `getDefaultMessages`는 `state.triggerType`만 필요 → **OK**

### 3. MessageSelector — dayConfigs useMemo (P1 6)

**현재**: dayConfigs가 매번 렌더링 시마다 재생성

```typescript
export default function MessageSelector({...}) {
  // 변경: dayConfigs를 props로 받기 또는 useMemo
  const dayConfigs = useMemo(
    () => [
      {
        day: 'day0' as const,
        label: '📲 Day 0: 구매 직후',
        // ... 
      },
      // ...
    ],
    [] // 의존성 없음 (상수)
  );

  return (
    <div>
      {dayConfigs.map((config) => (
        <MessageInput key={config.day} {...config} {...} />
      ))}
    </div>
  );
}
```

### 4. dayConfigs 상수화 (P1 7-8)

**작업**: `constants/delta.ts`에 추가

```typescript
// constants/delta.ts 끝에 추가:
export const MESSAGE_INPUT_CONFIG = [
  {
    day: 'day0' as const,
    label: '📲 Day 0: 구매 직후',
    description: '구매 당일 오전 - 불안감 해소 + 문제인식',
    maxLength: MESSAGE_LIMITS.DAY_0,
    required: true,
  },
  {
    day: 'day1' as const,
    label: '📤 Day 1: +1일',
    description: '구매 다음날 - 사회적 증거 + 구체적 수치',
    maxLength: MESSAGE_LIMITS.DAY_1,
    required: true,
  },
  {
    day: 'day2' as const,
    label: '⏰ Day 2: +2일',
    description: '구매 3일 후 - 긴급성 + 희소성 + 보상',
    maxLength: MESSAGE_LIMITS.DAY_2,
    required: true,
  },
  {
    day: 'day3' as const,
    label: '🚨 Day 3: +3일',
    description: '구매 4일 후 - 최종 긴급성 + 손실회피',
    maxLength: MESSAGE_LIMITS.DAY_3,
    required: true,
  },
] as const;

export type MessageInputConfig = (typeof MESSAGE_INPUT_CONFIG)[number];
```

**MessageSelector에서 import**:
```typescript
import { MESSAGE_INPUT_CONFIG } from '@/constants/delta';

export default function MessageSelector({...}) {
  return (
    <div>
      {MESSAGE_INPUT_CONFIG.map((config) => (
        <MessageInput key={config.day} {...config} {...} />
      ))}
    </div>
  );
}
```

### 5. ScheduleVisualizer — setSchedules 배칭 (P1 9-10)

**현재** (줄 196-211):
```typescript
setSchedules((prev) =>
  prev.map((s) => ({ ...s, isLoading: true }))
);
// ... 0.5초 대기
setSchedules((prev) =>
  prev.map((s) => ({ ...s, isLoading: false }))
);
```

→ 2번 호출 → **배칭으로 1번 호출**

```typescript
const loadStats = async () => {
  try {
    setError(null);
    setSchedules((prev) =>
      prev.map((s) => ({ ...s, isLoading: true }))
    );

    // 실제 API 호출로 변경 (0.5초 setTimeout 제거)
    const response = await fetch(`/api/campaigns/${campaignId}/delta/stats`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000), // 5초 timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // 배칭: 1회 setState 호출
    setSchedules((prev) =>
      prev.map((s) => {
        const count = data.estimatesByHour[s.hour];
        return {
          ...s,
          isLoading: false,
          expectedCount: count,
        };
      })
    );

    logger.info('[ScheduleVisualizer] 예상 발송 건수 로드 완료');
  } catch (err) {
    // ... 에러 처리
    setSchedules((prev) =>
      prev.map((s) => ({ ...s, isLoading: false }))
    );
  }
};
```

### 6. 0.5초 setTimeout 제거 (P1 11)

**현재**:
```typescript
await new Promise((resolve) => setTimeout(resolve, 500));
```

→ 실제 API 호출로 대체 (위 코드 참고)

### 7. 불필요한 객체 생성 방지 (P1 12-13)

**현재 MessageSelector (줄 93-101)**:
```typescript
style={{
  width: `${percent}%`
}}
```

→ Tailwind로 통합 (동적 값이므로 inline style 필요하지만, 계산 최적화)

```typescript
// 부모에서 memoization
const progressWidth = useMemo(() => `${percent}%`, [percent]);

<div style={{ width: progressWidth }} />
```

### 8. React.memo 적용 (P1 14-15)

```typescript
// MessageCard component
export const MessageCard = React.memo(function MessageCard({...}) {
  return (...)
});

// ScheduleCard component
export const ScheduleCard = React.memo(function ScheduleCard({...}) {
  return (...)
});
```

---

## ✅ 검증 체크리스트 (Agent β)

- [ ] useState 배칭 확인 (setState 호출 횟수 ↓)
- [ ] React Query 캐싱 작동 (DevTools 확인)
- [ ] dayConfigs useMemo 적용
- [ ] MESSAGE_INPUT_CONFIG 상수화
- [ ] setSchedules 배칭 (1회 호출)
- [ ] setTimeout 제거, 실제 API 호출
- [ ] React.memo 적용
- [ ] `npm run dev` 실행, 성능 개선 체감
- [ ] React DevTools Profiler로 렌더링 횟수 감소 확인

---

## 💾 커밋 메시지 (Agent β)

```
perf(delta): P1 성능 최적화 - setState 배칭, React Query, useMemo, React.memo

- React Query로 GET /api/campaigns/[id]/delta 캐싱 (5분 staleTime)
- MESSAGE_INPUT_CONFIG constants/delta.ts로 이동
- dayConfigs useMemo + React.memo 적용
- setSchedules 배칭 (2회 → 1회 setState)
- 0.5초 setTimeout 제거, 실제 API 호출로 대체
- 불필요한 객체 생성 최소화

점수 개선: 7.8/10 → 8.1/10 (예상)
```

---

# Agent γ: 접근성 (10개)

## 📝 담당 범위

| 파일 | P1 개수 | 주요 변경 |
|------|--------|---------|
| `src/components/delta-setup/MessageSelector.tsx` | 5 | confirm()→Modal, aria-* 강화 |
| `src/components/delta-setup/MessagePreview.tsx` | 3 | aria-label 상세화, 에러 접근성 |
| `src/components/delta-setup/ScheduleVisualizer.tsx` | 2 | 에러 메시지 접근성 |

---

## 🔧 상세 작업 지시

### 1. confirm() → Radix UI Dialog 전환 (P1 1-3)

**현재** (MessageSelector, 줄 129):
```typescript
if (confirm('입력한 메시지가 사라집니다. 기본값으로 변경할까요?')) {
  onToggleDefault(newValue);
}
```

**변경**: Radix Dialog 사용

```bash
# 먼저 설치
npm install @radix-ui/react-dialog @radix-ui/react-slot
```

**MessageSelector.tsx 수정**:
```typescript
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react'; // 닫기 아이콘

export default function MessageSelector({...}) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleToggleDefault = (newValue: boolean) => {
    if (newValue === true && !useDefault && hasUserInput) {
      setShowConfirm(true); // Modal 열기
    } else {
      onToggleDefault(newValue);
    }
  };

  const handleConfirm = () => {
    onToggleDefault(true);
    setShowConfirm(false);
  };

  return (
    <>
      {/* 기존 MessageSelector 코드 */}
      
      {/* 확인 다이얼로그 */}
      <Dialog.Root open={showConfirm} onOpenChange={setShowConfirm}>
        <Dialog.Portal>
          <Dialog.Overlay 
            className="fixed inset-0 bg-black/50 z-40"
            aria-hidden="true"
          />
          <Dialog.Content 
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 w-96 z-50"
            aria-labelledby="dialog-title"
            aria-describedby="dialog-description"
          >
            <div className="flex items-start justify-between mb-4">
              <Dialog.Title 
                id="dialog-title"
                className="text-lg font-semibold text-gray-900"
              >
                ⚠️ 메시지 손실 경고
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  className="text-gray-500 hover:text-gray-700"
                  aria-label="대화 창 닫기"
                >
                  <X size={20} />
                </button>
              </Dialog.Close>
            </div>

            <Dialog.Description 
              id="dialog-description"
              className="text-sm text-gray-600 mb-6"
            >
              입력한 메시지가 모두 사라지고 기본값으로 변경됩니다. 
              정말 변경하시겠습니까?
            </Dialog.Description>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                취소
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                변경하기
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
```

### 2. aria-label 상세화 (P1 4-5)

**MessagePreview.tsx**:

현재 (줄 99):
```typescript
aria-label={`Day ${day} 메시지: ${statusInfo.label}`}
```

→ 더 상세하게:
```typescript
aria-label={`Day ${day} 메시지: ${label}, ${description}, 글자 수 ${message.length}/${maxChars}, ${statusInfo.label}`}
```

**ScheduleVisualizer.tsx**:

현재 (줄 104):
```typescript
aria-label={`${schedule.time} 스케줄: ${schedule.description}`}
```

→ 더 상세하게:
```typescript
aria-label={`${formatTimeKST(schedule.hour)} (한국 기준) 스케줄: ${schedule.description}, 예상 발송 건수 ${estimateSendingCount(schedule.hour).estimate}`}
```

### 3. aria-describedby 추가 (P1 6)

**MessageInput (MessageSelector 내부)**:

```typescript
function MessageInput({...}: {
  day: 'day0' | 'day1' | 'day2' | 'day3';
  label: string;
  description: string;
  // ...
}) {
  const inputId = `message-input-${day}`;
  const descriptionId = `message-description-${day}`;

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-gray-900">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </span>
        </div>
      </label>
      <p id={descriptionId} className="text-xs text-gray-600 mb-2">
        {description}
      </p>
      <textarea
        id={inputId}
        aria-describedby={descriptionId}
        aria-label={`${label} 입력 필드, 최대 ${maxLength}자`}
        // ... 나머지 props
      />
    </div>
  );
}
```

### 4. aria-live 강화 (P1 7)

**ScheduleVisualizer에서 에러 표시** (줄 246):

```typescript
{error && (
  <div
    className="bg-red-50 border border-red-200 rounded-lg p-4"
    role="alert"
    aria-live="assertive"
    aria-atomic="true"
  >
    <h3 className="font-medium text-red-900 mb-2">⚠️ 오류 발생</h3>
    <p className="text-sm text-red-800">{error}</p>
  </div>
)}
```

### 5. 포커스 관리 (P1 8-9)

**MessageSelector.tsx에서 Modal 열릴 때**:

```typescript
import { useRef, useEffect } from 'react';

export default function MessageSelector({...}) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const handleToggleDefault = (newValue: boolean) => {
    if (newValue === true && !useDefault && hasUserInput) {
      setShowConfirm(true);
      // 다음 렌더링 후 포커스 이동
      setTimeout(() => confirmButtonRef.current?.focus(), 0);
    } else {
      onToggleDefault(newValue);
    }
  };

  return (
    <>
      {/* ... */}
      <Dialog.Root open={showConfirm} onOpenChange={setShowConfirm}>
        {/* ... */}
        <button
          ref={confirmButtonRef}
          onClick={handleConfirm}
          // ...
        >
          변경하기
        </button>
      </Dialog.Root>
    </>
  );
}
```

### 6. WCAG 색상 대비 검증 (P1 10)

모든 배경색/전경색 조합이 WCAG AA (4.5:1) 이상인지 확인

**검증 도구**: https://webaim.org/resources/contrastchecker/

- ✓ 녹색 (green-600 on green-50): 충분함
- ✓ 황색 (amber-600 on amber-50): 충분함
- ✓ 빨강 (red-600 on red-50): 충분함

---

## ✅ 검증 체크리스트 (Agent γ)

- [ ] Radix Dialog 설치 및 import 확인
- [ ] confirm() 완전 제거, Dialog로 대체
- [ ] aria-label 상세화 (MessagePreview, ScheduleVisualizer)
- [ ] aria-describedby 적용 (MessageInput)
- [ ] aria-live="assertive" 추가 (에러)
- [ ] 포커스 관리 (Modal 열릴 때 자동 이동)
- [ ] WCAG 색상 대비 검증 (4.5:1 이상)
- [ ] 스크린 리더 테스트 (음성 읽기 확인)
- [ ] 키보드 네비게이션 (Tab, Shift+Tab, Enter, Esc)

---

## 💾 커밋 메시지 (Agent γ)

```
a11y(delta): P1 접근성 강화 - confirm()→Dialog, aria-* 상세화

- confirm() → Radix UI Dialog로 전환 (접근성 향상)
- aria-label 상세화 (MessagePreview, ScheduleVisualizer)
- aria-describedby 추가 (MessageInput)
- aria-live="assertive" 에러 메시지 (즉시 공지)
- 포커스 관리 (Modal 열릴 때 자동 이동)
- WCAG AA 색상 대비 검증

점수 개선: 7.8/10 → 8.05/10 (예상)
```

---

# Agent δ: UX/애니메이션 (10개)

## 📝 담당 범위

| 파일 | P1 개수 | 주요 변경 |
|------|--------|---------|
| `src/app/(dashboard)/campaigns/[id]/delta-setup/page.tsx` | 3 | Step 전환 애니메이션 |
| `src/components/delta-setup/MessagePreview.tsx` | 4 | 로딩 시각화, 프로그레스 바 애니메이션 |
| `src/components/delta-setup/ScheduleVisualizer.tsx` | 3 | 성공/에러 피드백, 버튼 상태 |

---

## 🔧 상세 작업 지시

### 1. Step 전환 애니메이션 (P1 1-2)

**page.tsx에서 Step 컴포넌트 래핑**:

```typescript
import { motion, AnimatePresence } from 'framer-motion';

export default function DeltaSetupPage({...}) {
  const { state, handleNext, handlePrev } = useDeltaWizard(campaignId);

  const stepVariants = {
    enter: { opacity: 0, x: 50 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 },
  };

  return (
    <div className="space-y-6">
      {/* 진행도 바 */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={`h-1 flex-1 rounded-full transition-colors ${
              step <= state.currentStep ? 'bg-blue-500' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Step 컴포넌트 애니메이션 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={state.currentStep}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.3 }}
        >
          {state.currentStep === 1 && (
            <TriggerSelector {...props} />
          )}
          {state.currentStep === 2 && (
            <MessageSelector {...props} />
          )}
          {state.currentStep === 3 && (
            <MessagePreview {...props} />
          )}
          {state.currentStep === 4 && (
            <ScheduleVisualizer {...props} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
```

**package.json에 framer-motion 추가**:
```bash
npm install framer-motion
```

### 2. 로딩 스켈레톤 (P1 3)

**MessagePreview.tsx**:

```typescript
import Skeleton from '@/components/ui/skeleton';

export default function MessagePreview({messages}: MessagePreviewProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    // 기존 코드
  );
}
```

### 3. 프로그레스 바 부드러운 애니메이션 (P1 4)

**MessageInput에서 프로그레스 바** (MessageSelector 내부):

```typescript
const percent = Math.min((length / maxLength) * 100, 100);

<div
  className="h-2 rounded-full bg-gray-200 overflow-hidden"
  role="progressbar"
  aria-valuenow={length}
  aria-valuemin={0}
  aria-valuemax={maxLength}
>
  <div
    className={`h-full transition-all duration-300 ${
      length <= maxLength * 0.8
        ? 'bg-green-500'
        : length <= maxLength * 0.95
        ? 'bg-amber-500'
        : 'bg-red-500'
    }`}
    style={{ width: `${percent}%` }}
  />
</div>
```

### 4. Day 3 배지 강조 애니메이션 (P1 5)

**constants/delta.ts에서 badge 필드가 이미 있으므로**, MessageInput에서 표시:

```typescript
import { keyframes, css } from '@emotion/react';

const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
`;

function MessageInput({...}: {
  // ...
  required: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="block">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-gray-900">
            {label}
            {required && (
              <span 
                className="text-green-600 ml-1 font-bold animate-pulse"
                title="필수 입력"
              >
                ✅
              </span>
            )}
          </span>
        </div>
      </label>
      {/* ... */}
    </div>
  );
}
```

또는 Tailwind animation:
```typescript
<span className="text-green-600 ml-1 font-bold animate-pulse">
  ✅ 필수
</span>
```

### 5. 성공 토스트 애니메이션 (P1 6)

**useDeltaWizard.ts에서 handleSave 성공 시**:

```typescript
if (response.ok) {
  const data = await response.json();
  
  toast({
    title: '✅ 저장 완료',
    description: '메시지 설정이 저장되었습니다.',
    variant: 'default',
    duration: 3000,
  });

  // 1초 후 리다이렉트
  setTimeout(() => {
    router.push(`/campaigns/${campaignId}`);
  }, 1000);
}
```

### 6. 에러 상태 시각화 (P1 7)

**ScheduleVisualizer에서 에러 시**:

```typescript
{error && (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.2 }}
    className="bg-red-50 border-2 border-red-300 rounded-lg p-4 animate-pulse"
    role="alert"
    aria-live="assertive"
  >
    <h3 className="font-medium text-red-900 mb-2">⚠️ 오류 발생</h3>
    <p className="text-sm text-red-800">{error}</p>
  </motion.div>
)}
```

### 7. 버튼 hover/active 상태 (P1 8-9)

Tailwind 기본 hover/active 상태 강화:

```typescript
<button
  className={`
    px-4 py-2 rounded-lg font-medium
    transition-all duration-200
    ${state.currentStep < 4
      ? 'bg-blue-500 text-white hover:bg-blue-600 active:scale-95'
      : 'bg-green-500 text-white hover:bg-green-600 active:scale-95 shadow-lg'
    }
    disabled:opacity-50 disabled:cursor-not-allowed
  `}
  disabled={!isStepValid(state.currentStep)}
>
  {state.currentStep === 4 ? '저장' : '다음'}
</button>
```

### 8. 모바일 터치 피드백 (P1 10)

```typescript
<button
  className="active:scale-95 transition-transform duration-100"
  onTouchStart={(e) => {
    e.currentTarget.style.opacity = '0.8';
  }}
  onTouchEnd={(e) => {
    e.currentTarget.style.opacity = '1';
  }}
>
  {/* ... */}
</button>
```

---

## ✅ 검증 체크리스트 (Agent δ)

- [ ] framer-motion 설치
- [ ] Step 전환 애니메이션 작동
- [ ] 로딩 스켈레톤 표시
- [ ] 프로그레스 바 부드러운 색상 변화 (300ms)
- [ ] Day 3 배지 펄스 애니메이션
- [ ] 성공 토스트 피드백 (3초)
- [ ] 에러 상태 시각화 (pulse + border)
- [ ] 버튼 hover/active 상태 부드러움
- [ ] 모바일에서 터치 피드백 확인

---

## 💾 커밋 메시지 (Agent δ)

```
ux(delta): P1 UX/애니메이션 개선 - Step 전환, 로딩, 피드백

- framer-motion으로 Step 전환 애니메이션 (fade-in/out, slide)
- 로딩 스켈레톤 (MessagePreview)
- 프로그레스 바 부드러운 색상 변화 (transition-all 300ms)
- Day 3 배지 펄스 애니메이션 (animate-pulse)
- 성공 토스트 애니메이션 (3초, 자동 닫힘)
- 에러 상태 시각화 (pulse + border)
- 버튼 hover/active 상태 강화 (scale-95)
- 모바일 터치 피드백

점수 개선: 7.8/10 → 8.1/10 (예상)
```

---

# Agent ε: 에러 처리 (6개)

## 📝 담당 범위

| 파일 | P1 개수 | 주요 변경 |
|------|--------|---------|
| `src/hooks/useDeltaWizard.ts` | 4 | Timeout, 재시도, 상세 분류 |
| `src/components/delta-setup/ScheduleVisualizer.tsx` | 2 | API 에러 상세화 |

---

## 🔧 상세 작업 지시

### 1. API Timeout 처리 (P1 1)

**useDeltaWizard.ts의 fetch 호출**:

```typescript
// 초기 로드 (GET)
const response = await fetch(`/api/campaigns/${campaignId}/delta`, {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' },
  signal: AbortSignal.timeout(5000), // 5초 timeout
});

if (!response.ok) {
  if (response.status === 408) { // Request Timeout
    throw new Error('요청이 시간초과되었습니다. 다시 시도하세요.');
  }
  // ... 기타 상태 코드 처리
}
```

**저장 (POST)**:
```typescript
const response = await fetch('/api/campaigns/delta', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
  signal: AbortSignal.timeout(10000), // 10초 (POST는 더 길게)
});
```

### 2. 재시도 로직 (P1 2-3)

**utils/retry.ts 생성**:

```typescript
export interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  backoffMultiplier?: number;
}

export async function retryFetch<T>(
  url: string,
  options: RequestInit & RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 2,
    delayMs = 1000,
    backoffMultiplier = 2,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;
  let delay = delayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.json() as Promise<T>;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // 마지막 시도가 아니면 재시도
      if (attempt < maxRetries) {
        logger.warn(`[retryFetch] ${url} 재시도 ${attempt + 1}/${maxRetries}`, {
          delay,
          error: lastError.message,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= backoffMultiplier; // 지수 백오프
      }
    }
  }

  throw lastError || new Error('Network error');
}
```

**useDeltaWizard.ts에서 사용**:

```typescript
import { retryFetch } from '@/utils/retry';

const loadExistingConfig = async () => {
  try {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const data = await retryFetch(`/api/campaigns/${campaignId}/delta`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      maxRetries: 2,
    });

    // ... 기존 로직
  } catch (err) {
    // ... 기존 에러 처리
  }
};
```

### 3. 상세한 에러 분류 (P1 4)

**constants/error-messages.ts 생성**:

```typescript
export const ERROR_MESSAGES = {
  NETWORK: {
    TIMEOUT: '요청이 시간초과되었습니다. 네트워크 연결을 확인하고 다시 시도하세요.',
    NOT_FOUND: '네트워크에 연결할 수 없습니다.',
    OFFLINE: '오프라인 상태입니다. 인터넷 연결을 확인하세요.',
  },
  VALIDATION: {
    MISSING_FIELD: '필수 필드가 비어있습니다.',
    INVALID_LENGTH: '메시지 길이가 범위를 벗어났습니다.',
    INVALID_TYPE: '입력값 형식이 잘못되었습니다.',
  },
  SERVER: {
    INTERNAL_ERROR: '서버 오류가 발생했습니다. 잠시 후 다시 시도하세요.',
    UNAUTHORIZED: '권한이 없습니다.',
    FORBIDDEN: '접근이 거부되었습니다.',
    NOT_FOUND: '요청한 리소스를 찾을 수 없습니다.',
  },
  UNKNOWN: '알 수 없는 오류가 발생했습니다. 다시 시도하세요.',
} as const;

export function getErrorMessage(error: Error | string, defaultKey = 'UNKNOWN'): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('timeout')) return ERROR_MESSAGES.NETWORK.TIMEOUT;
    if (message.includes('offline')) return ERROR_MESSAGES.NETWORK.OFFLINE;
    if (message.includes('not found')) return ERROR_MESSAGES.SERVER.NOT_FOUND;

    return ERROR_MESSAGES.UNKNOWN;
  }

  return String(error) || ERROR_MESSAGES.UNKNOWN;
}
```

**useDeltaWizard.ts에서 사용**:

```typescript
import { getErrorMessage } from '@/constants/error-messages';

const handleSave = useCallback(async () => {
  try {
    // ... 저장 로직
  } catch (err) {
    const errorMsg = getErrorMessage(err, 'UNKNOWN');
    setState((prev) => ({ ...prev, isSaving: false, error: errorMsg }));
    toast({
      title: '오류',
      description: errorMsg,
      variant: 'destructive',
    });
  }
}, []);
```

### 4. 사용자 친화적 메시지 (P1 5)

**useDeltaWizard.ts의 필드별 에러** (이미 P0에서 구현):

```typescript
if (response.status === 400) {
  let errorMsg = '입력값 검증 실패';

  if (data.errors && typeof data.errors === 'object') {
    const fieldErrors = data.errors as Record<string, string>;

    // 사용자 친화적 메시지로 변환
    if (fieldErrors.deltaDay0Message) {
      errorMsg = `Day 0 메시지가 90자를 초과했습니다. ${fieldErrors.deltaDay0Message}`;
    } else if (fieldErrors.deltaDay1Message) {
      errorMsg = `Day 1 메시지가 160자를 초과했습니다. ${fieldErrors.deltaDay1Message}`;
    }
    // ... 기타
  }
}
```

### 5. 에러 복구 버튼 (P1 6)

**ScheduleVisualizer에서 에러 시 재시도 버튼**:

```typescript
{error && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <h3 className="font-medium text-red-900 mb-2">⚠️ {error}</h3>
    <div className="flex gap-2">
      <button
        onClick={() => loadStats()} // 재시도 함수 재호출
        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
      >
        재시도
      </button>
      <button
        onClick={() => setError(null)}
        className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
      >
        닫기
      </button>
    </div>
  </div>
)}
```

---

## ✅ 검증 체크리스트 (Agent ε)

- [ ] AbortSignal.timeout(5000) 적용 (모든 fetch)
- [ ] retryFetch 유틸 생성 + 지수 백오프
- [ ] ERROR_MESSAGES constants 생성
- [ ] getErrorMessage() 함수 테스트
- [ ] 필드별 에러 메시지 재확인
- [ ] 에러 복구 버튼 (재시도) 작동
- [ ] timeout 테스트 (DevTools Network throttle)
- [ ] 재시도 로직 테스트 (모의 실패 → 자동 재시도)

---

## 💾 커밋 메시지 (Agent ε)

```
fix(error): P1 에러 처리 강화 - Timeout, 재시도, 상세 분류

- AbortSignal.timeout(5/10초) 적용 (GET/POST)
- retryFetch 유틸 + 지수 백오프 (exponential backoff)
- ERROR_MESSAGES constants + getErrorMessage()
- 필드별 에러 메시지 사용자 친화적 변환
- 에러 복구 버튼 (재시도, 닫기)

점수 개선: 7.8/10 → 8.05/10 (예상)
```

---

# Agent ζ: 유지보수 (14개)

## 📝 담당 범위

| 파일 | P1 개수 | 주요 변경 |
|------|--------|---------|
| `src/constants/delta.ts` | 8 | MESSAGE_INPUT_CONFIG, 타입 강화, helper 함수 |
| `src/hooks/useDeltaWizard.ts` | 4 | 함수 분리, 주석 보완, 코드 중복 제거 |
| `src/utils/error-messages.ts` | 2 | 에러 상수화, 로깅 표준화 |

---

## 🔧 상세 작업 지시

### 1. MESSAGE_INPUT_CONFIG 상수화 (P1 1, Agent β와 협력)

**constants/delta.ts에 추가** (이미 Agent β가 추가함, 여기서는 확인만):

```typescript
export const MESSAGE_INPUT_CONFIG = [
  {
    day: 'day0' as const,
    label: '📲 Day 0: 구매 직후',
    description: '구매 당일 오전 - 불안감 해소 + 문제인식',
    maxLength: MESSAGE_LIMITS.DAY_0,
    required: true,
  },
  // ...
] as const;
```

### 2. API 응답 타입 정의 (P1 2-3)

**types/delta.ts 생성**:

```typescript
export interface DeltaCampaignSchedule {
  day: number;
  message: string;
  sentCount?: number;
  openRate?: number;
}

export interface DeltaConfigResponse {
  ok: boolean;
  campaignId: string;
  triggerType: 'PURCHASE' | 'ABANDONED';
  schedule: DeltaCampaignSchedule[];
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeltaCampaignStats {
  estimatesByHour: {
    [hour: number]: number;
  };
  totalEstimate: number;
  lastUpdatedAt: string;
}

export interface DeltaErrorResponse {
  ok: false;
  error: string;
  message: string;
  errors?: Record<string, string>;
  status: number;
}
```

**useDeltaWizard.ts에서 import + 타입 적용**:

```typescript
import type { DeltaConfigResponse, DeltaCampaignStats } from '@/types/delta';

// useQuery 결과에 타입 지정
const { data: existingConfig } = useQuery<DeltaConfigResponse>({
  queryKey: ['delta-config', campaignId],
  // ...
});

// handleSave에서 응답 타입 지정
const data = await response.json() as DeltaConfigResponse | DeltaErrorResponse;
```

### 3. Helper 함수 분리 (P1 4-8)

**utils/delta-helpers.ts 생성**:

```typescript
import { MESSAGE_LIMITS } from '@/constants/delta';

/**
 * 메시지 길이 유효성 검증
 */
export function validateMessageLength(
  day: 0 | 1 | 2 | 3,
  message: string
): { isValid: boolean; error?: string } {
  const maxLength = [MESSAGE_LIMITS.DAY_0, MESSAGE_LIMITS.DAY_1, MESSAGE_LIMITS.DAY_2, MESSAGE_LIMITS.DAY_3][day];
  
  if (message.trim().length === 0) {
    return { isValid: false, error: `Day ${day} 메시지는 필수입니다.` };
  }

  if (message.length > maxLength) {
    return { isValid: false, error: `Day ${day} 메시지는 ${maxLength}자 이하여야 합니다.` };
  }

  return { isValid: true };
}

/**
 * 시간 포맷 (KST)
 */
export function formatTimeKST(hour: number): string {
  if (hour < 12) {
    return `오전 ${hour}:00`;
  } else if (hour === 12) {
    return `정오 12:00`;
  } else {
    return `오후 ${hour - 12}:00`;
  }
}

/**
 * 예상 발송 건수 계산
 */
export function estimateSendingCount(
  hour: number,
  variance: string = '(±25%, 지난 7일 평균)'
): { estimate: string; variance: string } {
  const estimates: Record<number, string> = {
    9: '약 2,400건',
    14: '약 1,800건',
    19: '약 1,200건',
  };

  return {
    estimate: estimates[hour] || '알 수 없음',
    variance,
  };
}

/**
 * 메시지 상태 계산
 */
export function getMessageStatus(length: number, maxLength: number): 'safe' | 'warning' | 'danger' {
  const percent = (length / maxLength) * 100;
  if (percent <= 80) return 'safe';
  if (percent <= 95) return 'warning';
  return 'danger';
}

/**
 * 모든 메시지가 입력되었는지 확인
 */
export function areAllMessagesValid(
  messages: { day0: string; day1: string; day2: string; day3: string }
): boolean {
  return (
    !!messages.day0.trim() &&
    !!messages.day1.trim() &&
    !!messages.day2.trim() &&
    !!messages.day3.trim()
  );
}
```

**useDeltaWizard.ts에서 import + 사용**:

```typescript
import { validateMessageLength, areAllMessagesValid } from '@/utils/delta-helpers';

const isStepValid = useCallback((step: number): boolean => {
  switch (step) {
    case 1:
      return !!state.triggerType;
    case 2:
      if (state.useDefaultMessages) return true;
      return areAllMessagesValid(state.messages);
    case 3:
    case 4:
      return true;
    default:
      return false;
  }
}, [state.triggerType, state.useDefaultMessages, state.messages]);

const setMessage = useCallback(
  (day: 'day0' | 'day1' | 'day2' | 'day3', content: string) => {
    const dayNum = parseInt(day.replace('day', '')) as 0 | 1 | 2 | 3;
    const validation = validateMessageLength(dayNum, content);

    if (!validation.isValid) {
      logger.warn('[useDeltaWizard] 메시지 길이 검증 실패', {
        day,
        length: content.length,
        error: validation.error,
      });
    }

    setState((prev) => ({
      ...prev,
      messages: { ...prev.messages, [day]: content },
    }));
  },
  []
);
```

### 4. 로깅 표준화 (P1 9-10)

**logger 사용 일관성 확인** (이미 대부분 구현됨):

모든 로깅이 다음 형식을 따르는지 확인:

```typescript
logger.info('[ComponentName] 설명', { key1: value1, key2: value2 });
logger.warn('[ComponentName] 경고', { ... });
logger.error('[ComponentName] 오류', { ... });
```

예시:
```typescript
logger.info('[useDeltaWizard] 초기 설정 로드 완료', {
  campaignId,
  triggerType: data.triggerType,
});

logger.warn('[useDeltaWizard] 메시지 길이 초과', {
  campaignId,
  day: 'day0',
  length: message.length,
  maxLength: MESSAGE_LIMITS.DAY_0,
});
```

### 5. 주석 보완 (P1 11-12)

**복잡한 로직에 WHY 주석 추가**:

```typescript
// 기존 설정이 있으면 커스텀 모드로 전환
// (기본값이 아닌 사용자가 입력한 메시지를 보여주기 위함)
const loadedMessages = {
  day0: data.schedule[0]?.message || '',
  // ...
};

setState((prev) => ({
  ...prev,
  useDefaultMessages: false, // 이미 저장된 메시지가 있으면 기본값 사용 불가
}));
```

### 6. 코드 중복 제거 (P1 13-14)

**MessageCard 렌더링 로직 추상화** (이미 대부분 추상화됨):

MessagePreview에서 DAY_CONFIG를 사용하도록 확인:

```typescript
import { DAY_CONFIG } from '@/constants/delta';

export default function MessagePreview({messages}: MessagePreviewProps) {
  return (
    <div className="space-y-4">
      {DAY_CONFIG.map((config) => (
        <MessageCard
          key={config.day}
          day={config.day}
          message={messages[`day${config.day}` as keyof typeof messages]}
          label={config.label}
          description={config.description}
        />
      ))}
    </div>
  );
}
```

---

## ✅ 검증 체크리스트 (Agent ζ)

- [ ] types/delta.ts 생성 (DeltaConfigResponse, DeltaCampaignStats, 등)
- [ ] utils/delta-helpers.ts 생성 (7개 함수)
- [ ] useDeltaWizard.ts에서 helper 함수 import + 사용
- [ ] 모든 fetch 결과에 타입 지정
- [ ] 로깅 형식 일관성 확인 ([ComponentName] 형식)
- [ ] 주석 보완 (복잡한 조건, 알고리즘)
- [ ] 코드 중복 제거 (DAY_CONFIG 기반 map)
- [ ] 타입 검사 (`npm run type-check` 또는 `tsc --noEmit`)

---

## 💾 커밋 메시지 (Agent ζ)

```
refactor(delta): P1 유지보수 개선 - 타입강화, helper분리, 주석보완

- types/delta.ts 생성 (DeltaConfigResponse, DeltaCampaignStats)
- utils/delta-helpers.ts 생성 (7개 함수: validateLength, formatTime, etc)
- useDeltaWizard.ts에서 helper import + 사용
- 모든 API 응답에 타입 지정
- 로깅 형식 표준화 ([ComponentName] + context 객체)
- 주석 추가 (WHY, 복잡한 로직)
- DAY_CONFIG 기반 렌더링으로 코드 중복 제거

점수 개선: 7.8/10 → 8.1/10 (예상)
```

---

# Agent α: 확장성 + 테스트 (3개)

## 📝 담당 범위

| 파일 | P1 개수 | 주요 변경 |
|------|--------|---------|
| `src/constants/delta.ts` | 1 | Day 4+ 동적 추가 구조 확인 |
| `src/__tests__/` | 2 | 엣지 케이스 + 모킹 개선 |

---

## 🔧 상세 작업 지시

### 1. Day 4+ 동적 확장 (P1 1)

**constants/delta.ts에서 DAY_CONFIG 검증**:

```typescript
// DAY_CONFIG는 이미 배열 기반이므로 Day 4+ 추가 가능
export const DAY_CONFIG = [
  {
    day: 0,
    label: 'Day 0',
    // ...
  },
  {
    day: 1,
    label: 'Day 1',
    // ...
  },
  {
    day: 2,
    label: 'Day 2',
    // ...
  },
  {
    day: 3,
    label: 'Day 3',
    // ...,
    badge: '✅ 필수 (Phase 2)',
  },
  // Day 4를 추가하려면:
  // {
  //   day: 4,
  //   label: 'Day 4',
  //   title: '+4일',
  //   description: '최종 리마인더',
  //   emoji: '💬',
  //   maxLength: MESSAGE_LIMITS.DAY_3, // 새 제한값 추가 필요
  //   psychology: 'Commitment (약속)',
  //   triggerType: 'PURCHASE' as const,
  //   isRequired: false,
  // },
] as const;
```

**문서화**: Day 4+ 추가 시 필요한 단계를 README에 명시

```markdown
## Day 4 이상 추가하는 방법

1. `constants/delta.ts`에서:
   - `MESSAGE_LIMITS`에 `DAY_4: 160` 추가
   - `DAY_CONFIG` 배열에 new object 추가

2. `useDeltaWizard.ts`에서:
   - `WizardState.messages` type을 `day0 | day1 | ... | day4` 확장
   - `getDefaultMessages()` 자동 반영 (배열이므로)

3. `types/delta.ts`에서:
   - `DeltaCampaignSchedule` 타입 확인 (이미 동적)

4. API `/api/campaigns/[id]/delta` 응답에서:
   - `schedule[4]` 포함 확인

5. 테스트 추가: `MessagePreview.test.tsx`에 Day 4 렌더링 테스트
```

### 2. 엣지 케이스 테스트 추가 (P1 2)

**useDeltaWizard.test.ts에 추가**:

```typescript
describe('Edge Cases: Message Input', () => {
  it('should handle empty message correctly', () => {
    const { result } = renderHook(() => useDeltaWizard('campaign_123'));

    act(() => {
      result.current.setMessage('day0', '');
    });

    expect(result.current.isStepValid(2)).toBe(false);
  });

  it('should trim whitespace-only message', () => {
    const { result } = renderHook(() => useDeltaWizard('campaign_123'));

    act(() => {
      result.current.setMessage('day0', '   ');
    });

    expect(result.current.isStepValid(2)).toBe(false);
  });

  it('should handle special characters in message', () => {
    const { result } = renderHook(() => useDeltaWizard('campaign_123'));
    const specialMessage = '안녕하세요! 🎉 50% 할인 [링크]';

    act(() => {
      result.current.setMessage('day0', specialMessage);
    });

    expect(result.current.state.messages.day0).toBe(specialMessage);
  });

  it('should truncate message longer than maxLength', () => {
    const { result } = renderHook(() => useDeltaWizard('campaign_123'));
    const longMessage = 'a'.repeat(200); // 200자 > 90자 제한

    act(() => {
      result.current.setMessage('day0', longMessage);
    });

    expect(result.current.state.messages.day0.length).toBeLessThanOrEqual(90);
  });

  it('should handle exact maxLength boundary', () => {
    const { result } = renderHook(() => useDeltaWizard('campaign_123'));
    const exactMessage = 'a'.repeat(90); // Day 0 정확히 90자

    act(() => {
      result.current.setMessage('day0', exactMessage);
    });

    expect(result.current.state.messages.day0).toBe(exactMessage);
    expect(result.current.isStepValid(2)).toBe(false); // day1-3 필요
  });
});
```

### 3. 모킹 개선 (P1 3)

**useDeltaWizard.test.ts에 setup.ts 추가**:

```typescript
// src/__tests__/setup.ts
import { server } from '@/mocks/server';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Jest config에서 setupFilesAfterEnv에 이 파일 포함
```

**mocks/server.ts 생성**:

```typescript
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const server = setupServer(
  // GET /api/campaigns/[id]/delta
  http.get('/api/campaigns/:campaignId/delta', ({ params }) => {
    return HttpResponse.json({
      ok: true,
      campaignId: params.campaignId,
      triggerType: 'PURCHASE',
      schedule: [
        { day: 0, message: 'Day 0 default message' },
        { day: 1, message: 'Day 1 default message' },
        { day: 2, message: 'Day 2 default message' },
        { day: 3, message: 'Day 3 default message' },
      ],
      organizationId: 'org_test_123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }),

  // POST /api/campaigns/delta
  http.post('/api/campaigns/delta', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      ok: true,
      message: '저장되었습니다.',
      campaignId: (body as any).campaignId,
    });
  }),

  // GET /api/campaigns/[id]/delta/stats
  http.get('/api/campaigns/:campaignId/delta/stats', () => {
    return HttpResponse.json({
      estimatesByHour: {
        9: 2400,
        14: 1800,
        19: 1200,
      },
      totalEstimate: 5400,
      lastUpdatedAt: new Date().toISOString(),
    });
  })
);
```

**package.json에 msw 설치**:

```bash
npm install --save-dev msw
```

---

## ✅ 검증 체크리스트 (Agent α)

- [ ] DAY_CONFIG가 이미 배열 기반 (Day 4+ 확장 구조 확인)
- [ ] 엣지 케이스 테스트 추가 (empty, whitespace, special chars, maxLength boundary)
- [ ] mocks/server.ts 생성 (GET/POST 엔드포인트)
- [ ] setup.ts 생성 (beforeAll/afterEach/afterAll)
- [ ] Jest config에 setupFilesAfterEnv 추가
- [ ] msw 설치 확인
- [ ] 기존 테스트 + 엣지 케이스 모두 통과
- [ ] coverage 확인 (목표: 80%+)

---

## 💾 커밋 메시지 (Agent α)

```
test(delta): P1 테스트 개선 - 엣지케이스, msw 모킹

- 엣지 케이스 테스트 추가 (empty, whitespace, special chars, boundary)
- MSW (Mock Service Worker) 도입
- mocks/server.ts 생성 (GET/POST 엔드포인트)
- 테스트 setup.ts 생성 (beforeAll/afterEach)
- 기존 테스트 마이그레이션 (stub → msw)

점수 개선: 7.8/10 → 8.05/10 (예상)
```

---

## 📊 Phase 1 전체 요약

| 에이전트 | 담당 | P1 | 소요 | 커밋 | 상태 |
|---------|------|-----|------|------|------|
| **β** | 성능 | 15 | 1.5h | perf(delta) | 진행중 |
| **γ** | 접근성 | 10 | 1h | a11y(delta) | 진행중 |
| **δ** | UX/애니메이션 | 10 | 1.5h | ux(delta) | 진행중 |
| **ε** | 에러처리 | 6 | 0.75h | fix(error) | 진행중 |
| **ζ** | 유지보수 | 14 | 1.5h | refactor(delta) | 진행중 |
| **α** | 확장성+테스트 | 3 | 0.75h | test(delta) | 진행중 |
| **총합** | **P1 59개** | **59** | **1.5-2h** | **6건** | **병렬 실행** |

---

## 🎯 다음 단계 (Step 4)

모든 에이전트가 **동시에** 작업 시작 → 

**Step 4**: 사용자 승인 (진행 가능한가?)

**Step 5**: 메모리화

**Step 6**: 코드 리뷰 (10렌즈, 3명 병렬)

**Step 7**: 메모리 업데이트 + 다음 Wave

---

**모든 에이전트 준비 완료!** ✅

추천 대로 에이전트 실행 시작하시겠습니까?
