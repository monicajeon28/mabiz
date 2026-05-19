# Menu #38 Phase 4 Wave 3 작업지시서

## 렌탈 SMS 마법사 4단계 풀 구현

**목표**: DeltaCampaignConfig 입력을 위한 인터랙티브 마법사 UI 구현

**일정**: Day 1 (5시간)

**병렬 구조**:
- Agent α: 마법사 메인 + Step 1-2 구현
- Agent β: Step 3-4 + 통합 테스트

---

## Part A: 마법사 메인 페이지

### 파일 1: `src/app/(dashboard)/campaigns/[id]/delta-setup/page.tsx` (50줄)

**역할**: 컴포넌트 조립 + UI 렌더링만

```typescript
import { useDeltaWizard } from '@/hooks/useDeltaWizard';
import { TriggerSelector, MessageSelector, MessagePreview, ScheduleVisualizer } from '@/components/delta-setup';

export default function DeltaSetupPage() {
  const { state, handlers } = useDeltaWizard();
  
  return (
    <div className="mx-auto max-w-2xl">
      <Header currentStep={state.currentStep} />
      
      {state.currentStep === 1 && <TriggerSelector {...handlers} />}
      {state.currentStep === 2 && <MessageSelector {...handlers} />}
      {state.currentStep === 3 && <MessagePreview messages={state.messages} />}
      {state.currentStep === 4 && <ScheduleVisualizer triggerType={state.triggerType} />}
      
      <Navigation currentStep={state.currentStep} {...handlers} />
    </div>
  );
}
```

### 파일 2: `src/hooks/useDeltaWizard.ts` (250줄) ← **신규 custom hook**

**역할**: 상태 관리 + 로직 분리

```typescript
interface DeltaWizardState {
  currentStep: 1 | 2 | 3 | 4;
  campaignId: string;
  triggerType: 'PURCHASE' | 'ABANDONED';
  useDefaultMessages: boolean;
  messages: {
    day0: string;
    day1: string;
    day2: string;
    day3: string;
  };
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

export function useDeltaWizard() {
  const { campaignId } = useParams();
  const [state, setState] = useState<DeltaWizardState>({...});
  
  const isStepValid = useCallback((step: number): boolean => {
    if (step === 1) return !!state.triggerType;
    if (step === 2) {
      // Day 3 필수 입력 ✅
      return state.messages.day0 && state.messages.day1 && 
             state.messages.day2 && state.messages.day3;
    }
    return true;
  }, [state]);
  
  const handleNext = useCallback(() => {
    if (isStepValid(state.currentStep)) {
      setState(prev => ({
        ...prev,
        currentStep: Math.min(prev.currentStep + 1, 4) as 1 | 2 | 3 | 4
      }));
    }
  }, [state, isStepValid]);
  
  const handleSave = useCallback(async () => {
    setState(prev => ({ ...prev, isSaving: true }));
    try {
      const res = await fetch('/api/campaigns/delta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          triggerType: state.triggerType,
          // 직접입력 모드일 때만 전송 (기본값 모드면 undefined)
          deltaDay0Message: state.useDefaultMessages ? undefined : state.messages.day0,
          deltaDay1Message: state.useDefaultMessages ? undefined : state.messages.day1,
          deltaDay2Message: state.useDefaultMessages ? undefined : state.messages.day2,
          deltaDay3Message: state.useDefaultMessages ? undefined : state.messages.day3,
        }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || '저장 실패');
      }
      
      toast.success('렌탈 SMS 설정을 저장했습니다.');
      router.push(`/campaigns/${campaignId}`);
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : '서버 오류'
      }));
      toast.error(error);
    } finally {
      setState(prev => ({ ...prev, isSaving: false }));
    }
  }, [state, campaignId]);
  
  return {
    state,
    handlers: { handleNext, handlePrev, handleSave, setMessage, toggleDefault }
  };
}
```

**로직**:
1. `useParams()` → campaignId 추출
2. `useEffect` → GET /api/campaigns/[id]/delta (기존 설정 로드)
3. 각 Step 변경 시 `isStepValid()` 검증
4. "저장" 클릭 → POST /api/campaigns/delta
5. 에러 처리: 네트워크 오류 / 검증 오류 / 서버 오류 구분
6. 토스트 알림 (완료/실패)

---

## Part B: Step 1 - 트리거 타입 선택 (100줄)

### 파일: `components/delta-setup/TriggerSelector.tsx`

**UI**:
```
┌────────────────────────────────────────┐
│ 어떤 상황에서 메시지를 보낼까요?       │
├────────────────────────────────────────┤
│                                        │
│ ┌──────────────────────────────────┐  │
│ │ ○ 구매 후 (PURCHASE)             │  │
│ │   고객이 렌탈을 예약한 직후       │  │
│ │   보내는 자동 메시지              │  │
│ └──────────────────────────────────┘  │
│                                        │
│ ┌──────────────────────────────────┐  │
│ │ ○ 장바구니 이탈 (ABANDONED)      │  │
│ │   예약했으나 미완료 고객 대상      │  │
│ │   (향후 기능, 비활성화)           │  │
│ └──────────────────────────────────┘  │
│                                        │
└────────────────────────────────────────┘
```

**Props**:
```typescript
interface TriggerSelectorProps {
  value: 'PURCHASE' | 'ABANDONED';
  onChange: (value: 'PURCHASE' | 'ABANDONED') => void;
}
```

**구현**:
- 라디오 버튼 (PURCHASE/ABANDONED)
- ABANDONED는 disabled (회색 처리)
- 선택 시 설명 텍스트 표시
- onChange 콜백으로 부모 상태 업데이트

---

## Part C: Step 2 - 메시지 선택 (150줄)

### 파일: `components/delta-setup/MessageSelector.tsx`

**UI**:
```
┌────────────────────────────────────────┐
│ 메시지를 어떻게 설정할까요?            │
├────────────────────────────────────────┤
│ ⓘ 4개 메시지 모두 필수입니다          │
│                                        │
│ ┌──────────────────────────────────┐  │
│ │ ○ 기본값 사용 (추천)             │  │
│ │   심리학 기반 최적화된 메시지    │  │
│ │   (변경 불가)                   │  │
│ └──────────────────────────────────┘  │
│                                        │
│ ┌──────────────────────────────────┐  │
│ │ ○ 직접 입력                      │  │
│ │   내 브랜드에 맞게 커스텀        │  │
│ └──────────────────────────────────┘  │
│                                        │
│ [기본값 모드: 읽기전용]               │
│                                        │
│ Day 0 (여행 전, 불안 해소)           │
│   "여행 전 꼭 준비하세요..."         │
│                                        │
│ Day 1 (선택 고민)                     │
│   "혹시 궁금하신 점은..."            │
│                                        │
│ Day 2 (희소성)                        │
│   "남은 객실 2개! 서둘러요"          │
│                                        │
│ Day 3 (클로징) ✅ 필수               │
│   "마지막 안내: 출발 전 준비물"      │
│                                        │
│ [직접입력 모드: 수정 가능]            │
│                                        │
│ □ Day 0 (최대 90자)                   │
│   [입력 필드]                         │
│   길이: 45/90 ▓▓▓░░░░░░░             │
│                                        │
│ □ Day 1 (최대 160자)                  │
│   [입력 필드]                         │
│   길이: 120/160 ▓▓▓▓▓░░░░░           │
│                                        │
│ □ Day 2 (최대 160자)                  │
│   [입력 필드]                         │
│   길이: 150/160 ▓▓▓▓▓▓░░░            │
│                                        │
│ □ Day 3 ✅ 필수 (최대 160자)         │
│   [입력 필드]                         │
│   길이: 80/160 ▓▓░░░░░░░             │
│                                        │
└────────────────────────────────────────┘
```

**Props**:
```typescript
interface MessageSelectorProps {
  triggerType: 'PURCHASE' | 'ABANDONED';
  useDefault: boolean;
  onToggleDefault: (value: boolean) => void;
  messages: { day0: string; day1: string; day2: string; day3: string };
  onMessageChange: (day: 0 | 1 | 2 | 3, content: string) => void;
  defaultMessages: { day0: string; day1: string; day2: string; day3: string };
}
```

**구현**:
1. 라디오 버튼 2개 (기본값/직접입력)
2. useDefault 토글 시 입력 필드 활성화/비활성화
3. 기본값 모드: 4개 메시지 읽기전용 표시 (data/delta_sms_sequence.json 로드)
4. 직접입력 모드: 4개 textarea 활성화, maxLength 제약
5. 실시간 길이 표시 (예: 45/90)
6. 초과 시 입력 방지
7. **Day 3은 "✅ 필수" 배지로 강조** ← 사용자 선택 반영

**기본값 로드**:
```typescript
// useDeltaWizard 훅에서 초기화
const DEFAULT_MESSAGES = {
  day0: deltaSequence[triggerType].day0,  // data/delta_sms_sequence.json
  day1: deltaSequence[triggerType].day1,
  day2: deltaSequence[triggerType].day2,
  day3: deltaSequence[triggerType].day3,  // Day 3도 표시 ✅
};
```

---

## Part D: Step 3 - 메시지 미리보기 (150줄)

### 파일: `components/delta-setup/MessagePreview.tsx`

**UI** (모바일 메시지 창 시뮬레이션):
```
┌────────────────────────────────────────┐
│ 고객에게 이렇게 보입니다              │
├────────────────────────────────────────┤
│                                        │
│ ┌──────────────────────────────────┐  │
│ │ Day 0 (구매 직후)                │  │
│ ├──────────────────────────────────┤  │
│ │ 💬 여행 전 꼭 준비하세요...      │  │
│ │    [환불 가능] [마이페이지]      │  │
│ └──────────────────────────────────┘  │
│                                        │
│ ┌──────────────────────────────────┐  │
│ │ Day 1 (다음날)                   │  │
│ ├──────────────────────────────────┤  │
│ │ 💬 혹시 궁금하신 점은...         │  │
│ │    [캐빈 확인] [문의하기]         │  │
│ └──────────────────────────────────┘  │
│                                        │
│ ┌──────────────────────────────────┐  │
│ │ Day 2 (3일 후)                   │  │
│ ├──────────────────────────────────┤  │
│ │ 💬 남은 객실 2개! 서둘러요       │  │
│ │    [지금 예약] [카톡 문의]        │  │
│ └──────────────────────────────────┘  │
│                                        │
│ ┌──────────────────────────────────┐  │
│ │ Day 3 (7일 후, 선택사항)         │  │
│ ├──────────────────────────────────┤  │
│ │ 💬 마지막 안내: 출발 전 준비물   │  │
│ │    [안내 보기] [문의하기]         │  │
│ └──────────────────────────────────┘  │
│                                        │
└────────────────────────────────────────┘
```

**Props**:
```typescript
interface MessagePreviewProps {
  messages: { day0: string; day1: string; day2: string; day3: string };
}
```

**구현**:
1. 4개 카드 (Day 0-3)
2. 각 카드는 SMS 메시지 창 UI
3. 이모지 + 메시지 본문 + 더미 액션 버튼
4. 메시지 길이 인디케이터 (초록/노랑/빨강)
5. 스크롤 가능 (Day 3는 선택사항이므로 흐리게 처리)

---

## Part E: Step 4 - 일정 시각화 + 저장 (100줄)

### 파일: `components/delta-setup/ScheduleVisualizer.tsx`

**UI**:
```
┌────────────────────────────────────────┐
│ Cron 일정을 확인하세요               │
├────────────────────────────────────────┤
│                                        │
│ 매일 3회 발송 (자동화)                │
│                                        │
│ ┌──────────────────────────────────┐  │
│ │ 🕘 오전 09:00 (KST)              │  │
│ │    Day 0 메시지 발송              │  │
│ │    조회: ~2,400건                 │  │
│ │    예상 시간: <5분                │  │
│ └──────────────────────────────────┘  │
│                                        │
│ ┌──────────────────────────────────┐  │
│ │ 🕐 오후 14:00 (KST)              │  │
│ │    Day 1 메시지 발송              │  │
│ │    조회: ~1,800건                 │  │
│ │    예상 시간: <4분                │  │
│ └──────────────────────────────────┘  │
│                                        │
│ ┌──────────────────────────────────┐  │
│ │ 🕖 오후 19:00 (KST)              │  │
│ │    Day 2/3 메시지 발송            │  │
│ │    조회: ~1,200건                 │  │
│ │    예상 시간: <3분                │  │
│ └──────────────────────────────────┘  │
│                                        │
│ ☑ SMS 발송 활성화 (변경 불가)        │
│ ☑ Cron 자동 실행 (Vercel)            │
│ ☑ SendingHistory 자동 기록            │
│                                        │
└────────────────────────────────────────┘
```

**Props**:
```typescript
interface ScheduleVisualizerProps {
  triggerType: 'PURCHASE' | 'ABANDONED';
}
```

**구현**:
1. 3개 Cron 시간 카드 (고정값: 09:00/14:00/19:00 KST)
2. 각 카드에 예상 발송 건수 표시 (SendingHistory 쿼리 기반)
3. 체크박스 (읽기전용, 정보 표시용)
4. Day 2/3 메시지가 있으면 "Day 2/3 모두"로, 없으면 "Day 2만" 표시

---

## Part F: 통합 및 라우팅

### 라우팅: `/campaigns/[id]/delta-setup`

**네비게이션**:
1. `/campaigns/[id]` (캠페인 상세) → "Delta SMS 설정" 버튼 → `/campaigns/[id]/delta-setup`
2. 마법사 완료 후 → `/campaigns/[id]` 자동 리다이렉트

### API 의존성:
- GET /api/campaigns/[id]/delta (기존 설정 로드)
- POST /api/campaigns/delta (신규 설정 저장)

---

## 에이전트 배정

### Track 1 Wave 3

- **Agent α**: 마법사 메인 + Step 1-2
  - src/app/(dashboard)/campaigns/[id]/delta-setup/page.tsx (300줄)
  - components/delta-setup/TriggerSelector.tsx (100줄)
  - components/delta-setup/MessageSelector.tsx (150줄)

- **Agent β**: Step 3-4 + 통합
  - components/delta-setup/MessagePreview.tsx (150줄)
  - components/delta-setup/ScheduleVisualizer.tsx (100줄)
  - /campaigns/[id] 수정 (마법사 버튼 추가, +20줄)

---

## 기술 스펙

### 사용 라이브러리:
- React Hooks (useState, useEffect, useCallback)
- Next.js 15 (useRouter, useParams)
- Zod (클라이언트 검증, 선택사항)
- Recharts (예상 발송 건수 차트, 선택사항)

### 환경:
- TypeScript strict mode
- Tailwind CSS 또는 기존 CSS
- 모바일 반응형 필수

---

## 검증 체크리스트

### Step 1: 트리거 선택
- ✅ PURCHASE 선택 가능
- ✅ ABANDONED 비활성화 (회색)
- ✅ 선택 시 설명 표시

### Step 2: 메시지 선택
- ✅ 기본값 선택 시 읽기전용 표시
- ✅ 직접입력 선택 시 textarea 활성화
- ✅ 길이 제한 실시간 표시 (90자/160자)
- ✅ 초과 입력 방지

### Step 3: 미리보기
- ✅ 4개 Day 모두 표시
- ✅ SMS 창 UI 시뮬레이션
- ✅ 길이 인디케이터 (초록/노랑/빨강)

### Step 4: 일정 시각화
- ✅ 3개 Cron 시간 표시 (09:00/14:00/19:00)
- ✅ 예상 발송 건수 표시
- ✅ 체크박스 (읽기전용)

### 마법사 통합
- ✅ "이전/다음" 네비게이션
- ✅ Step별 유효성 검증
- ✅ "저장" 버튼 (클릭 시 API 호출)
- ✅ 토스트 알림 (완료/실패)
- ✅ 진행도 바 (Step 1/4, 2/4 등)

---

## 산출물 (사용자 피드백 반영)

| 파일 | 라인 | 역할 | 변경 |
|------|------|------|------|
| page.tsx | 50 | 마법사 메인 (UI 조립만) | ✅ 분리됨 |
| useDeltaWizard.ts | 250 | custom hook (상태+로직) | ✅ 신규 |
| TriggerSelector.tsx | 100 | Step 1 | - |
| MessageSelector.tsx | 150 | Step 2 (Day 3 필수화) | ✅ 업데이트 |
| MessagePreview.tsx | 150 | Step 3 | - |
| ScheduleVisualizer.tsx | 100 | Step 4 | - |
| [id] 수정 | +20 | 마법사 버튼 | - |
| **총계** | **820** | **병렬 2에이전트** | |

**커밋 수**: 1개 (마법사 전체)

**개선 효과**:
- ✅ 상태 로직 분리 → 유지보수성 ↑
- ✅ Day 3 필수 → 완성도 ↑
- ✅ 기본값에 Day 3 포함 → UX 일관성 ↑
- ✅ 에러 처리 세분화 → 버그 추적 ↑

---

## 승인 대기

사용자 확인: "응" → Step 5-2 에이전트 실행 시작
