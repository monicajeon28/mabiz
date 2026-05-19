# Menu #37 콜 플레이북 — Step 5-2 작업지시서

**날짜**: 2026-05-19  
**병렬 에이전트**: γ (JSON 정제) + δ (CRM 통합)  
**예상 시간**: 1시간 (병렬 실행)  
**점수 목표**: 8.5/10

---

## 🎯 Mission

Menu #37 Step 5-1에서 메모리화된 **심리학 이론, 신민형 통합 스크립트, 모니카 욕망 증폭 원칙**을 바탕으로:

1. **Agent γ**: `playbook_rag_master.json` 정제 (50-80개로 필터링 + 심리학 명시 강화)
2. **Agent δ**: CRM 콜 플레이북 탭 추가 + playbook-viewer 최종 완성

---

# Part A: Agent γ — JSON 정제 (playbook_rag_master.json)

## 📋 입력 파일

```
docs/크루즈콜모음/playbook_rag_master.json (현재 상태)
docs/크루즈콜모음/playbook_rag_master_refined.json (참고)
```

## 📝 작업 내용

### 1. 항목 수 정제: 현재 → 50-80개 선정

**기준:**
- **신민형 5단계 원칙** (출처: shinmintype_5step_complete_script.md)
  - Step 1: 패턴 인터럽트 + 라포 형성
  - Step 2: 니즈 SPIN-S (상황 질문)
  - Step 3: 욕망 증폭 4단계 (SPIN-P/I)
  - Step 4: 감정 피크 (5감각 앵커링)
  - Step 5: 클로징 (삼중 선택, 소프트 랜딩)

- **모니카 욕망 증폭 4단계** (출처: monika_call_strategy_voice.md)
  1. 눈 떠주기: "이것도 포함되나요?" (호기심 유발)
  2. 필요성 공감: "다른 분들도..." (사회적 증거)
  3. 감정 증폭: 5감각 앵커링 (가족/럭셔리 이미지)
  4. 행동 유도: "지금 신청하면..." (희소성)

- **클로징 신호 7종** (출처: WO_v7_콜스크립트_95점_달성_작업지시서.md)
  1. "언제까지요?"
  2. "어떻게 해요?"
  3. 3연속 Yes
  4. 구체적 날짜/인원
  5. 예산/결제 질문
  6. 동반자 의사 확인
  7. 지금 vs 나중 선택

### 2. 각 항목 구조 최종 정의

```json
{
  "key": "pb_phase{0-9}_{type}_{sequence}",
  "phase": "0|1|2|3|4|5|6|7|8|9|objection|reset|followup",
  "type": "OPENING|NEEDS|AMPLIFY|POSITIONING|OBJECTION|CLOSING|RESET|FOLLOWUP",
  "customerSegment": "A|B|C|D|E|ALL",
  "trigger": "고객 발화 트리거 (없으면 null)",
  "script": "상담사 멘트 (구체적, 실전용)",
  "psychology": "적용 심리기법 (구분자: |)",
  "shinminStep": "1|2|3|4|5 (신민형 5단계)",
  "monikaAmplifyLevel": "1|2|3|4 (모니카 욕망 증폭 4단계, AMPLIFY type만)",
  "notes": "사용 조건/주의사항",
  "source": "신민형콜|모니카코칭|크루즈v13|PASONA|SPIN|실전사례 중 1개",
  "isActive": true
}
```

### 3. Phase별 목표 수량

| Phase | 타입 | 목표수 | 신민형 원칙 | 모니카 적용 |
|-------|------|--------|-----------|-----------|
| **0** | OPENING | 5개 | Step 1 | X |
| **1** | NEEDS | 8개 | Step 2 | X |
| **2** | AMPLIFY | 12개 | Step 3 | ✅ 레벨 1-4 |
| **3** | POSITIONING | 8개 | Step 4 | X |
| **4** | OBJECTION | 10개 | Step 5 | X |
| **5** | CLOSING | 8개 | Step 5 | X |
| **6** | RESET | 6개 | Step 5 | X |
| **7** | FOLLOWUP | 4개 | 재접촉 | X |
| **계** | | **61개** | | |

### 4. 심리학 이론 강화

현재 `psychology` 필드를 다음처럼 개선:

**기존:** `"psychology": "손실회피|시간제한"`  
**개선:** `"psychology": "Loss Aversion (손실회피 - Kahneman)|Scarcity (희소성 - Cialdini)"`

**적용할 이론 (메모리: psychology_theories_master.md 참고):**
1. **Loss Aversion** (Kahneman) — 손실을 이익보다 2배 크게 인지
2. **Social Proof** (Cialdini) — "다른 분들도..."
3. **Narrative Transportation** (Green & Brock) — 스토리텔링
4. **Priming** — 사전 자극 (럭셔리, 가족 이미지)
5. **Scarcity** (Cialdini) — 시간/물량 제한
6. **Commitment** (Cialdini) — 작은 약속→큰 약속 (commitment escalation)

### 5. 데이터 소스 명시

`source` 필드에 출처를 명시:

```
신민형콜         → shinmintype_5step_complete_script.md
모니카코칭       → monika_call_strategy_voice.md
크루즈v13        → 크루즈닷_최종콜스크립트_v13.md
PASONA           → pasona_framework_complete.md
SPIN             → spin_selling_complete.md
실전사례         → 맥스 클로징된 콜, 사라 클로징 완료된 콜 등
```

### 6. 산출물

**파일명:** `docs/크루즈콜모음/playbook_rag_master_v2_refined.json`

**검증 체크리스트:**
- [ ] 총 항목 수: 50-80개 (목표: 61개)
- [ ] 각 phase별 수량 확인
- [ ] psychology 필드에 이론가명(Kahneman/Cialdini/Green&Brock) 포함
- [ ] AMPLIFY type만 monikaAmplifyLevel 필드 포함
- [ ] source 필드 모두 채움
- [ ] isActive: true로 모두 설정
- [ ] JSON 유효성 검증 (JSON 포맷 정상)

**커밋 메시지:**
```
refactor(playbook): JSON 정제 (61개 + 심리학/신민형/모니카 명시)
```

---

# Part B: Agent δ — CRM 통합 (tools/page.tsx + playbook-viewer)

## 📋 입력 파일

```
src/app/(dashboard)/tools/page.tsx (현재 4탭)
src/app/(dashboard)/tools/playbook-viewer/page.tsx (부분 완성)
```

## 📝 작업 내용

### 1. tools/page.tsx에 "콜 플레이북" 탭 추가

**위치:** line 42 mainTab 상태 정의 수정

**현재:**
```tsx
const [mainTab,  setMainTab]   = useState<"sms" | "playbook" | "call-feedback" | "qa-library">("playbook");
```

**변경:**
```tsx
const [mainTab,  setMainTab]   = useState<"sms" | "playbook" | "call-feedback" | "call-playbook" | "qa-library">("playbook");
```

**탭 정의 추가 (line 42 아래):**
```tsx
const MAIN_TABS = [
  { key: "sms",           label: "📱 SMS 템플릿" },
  { key: "playbook",      label: "📋 플레이북 (DB)" },
  { key: "call-feedback", label: "🎤 콜 피드백" },
  { key: "call-playbook", label: "📚 콜 플레이북" },
  { key: "qa-library",    label: "❓ Q&A 라이브러리" },
];
```

**탭 렌더링 (메인 UI 영역):**
```tsx
<div className="flex gap-2 border-b border-gray-200 mb-6 overflow-x-auto">
  {MAIN_TABS.map((tab) => (
    <button
      key={tab.key}
      onClick={() => setMainTab(tab.key as typeof mainTab)}
      className={`px-4 py-2 font-medium border-b-2 transition-colors ${
        mainTab === tab.key
          ? "border-navy-900 text-navy-900"
          : "border-transparent text-gray-600 hover:text-gray-900"
      }`}
    >
      {tab.label}
    </button>
  ))}
</div>
```

### 2. "콜 플레이북" 탭 컨텐츠 구성

**레이아웃:**
```
┌────────────────────────────────────────────┐
│ 🎤 콜 플레이북 라이브러리                   │ [새창 열기↗]
├────────────────────────────────────────────┤
│ 신민형 5단계 통합 스크립트 + 모니카 원칙   │
│ 클로징률 최적화 데이터                      │
├────────────────────────────────────────────┤
│ [고객 세그먼트 선택▼]                      │
│ [오프닝] [니즈발굴] [욕망증폭] ... [클로징]│
│                                            │
│ 스크립트 카드 (50-80개 중 선택됨)          │
│ ┌──────────────────────────────────────┐  │
│ │ Phase 0: 오프닝                      │  │
│ │ "15분 안에..."                       │  │
│ │ [심리: 손실회피] [신민형:Step1]      │  │
│ │ [복사] [새창 열기]                   │  │
│ └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

**구현 (line ~200 이후, mainTab === "call-playbook" 조건):**

```tsx
{mainTab === "call-playbook" && (
  <div className="space-y-6">
    {/* 헤더 + 새창 열기 */}
    <div className="flex items-center justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold text-navy-900">콜 플레이북 라이브러리</h2>
        <p className="text-sm text-gray-600">신민형 5단계 + 모니카 욕망 증폭 원칙</p>
      </div>
      <a
        href="/tools/playbook-viewer"
        target="_blank"
        rel="noopener noreferrer"
        className="px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 flex items-center gap-2"
      >
        새창 열기 <ExternalLink className="w-4 h-4" />
      </a>
    </div>

    {/* playbook-viewer 인라인 임베드 또는 링크 */}
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <p className="text-sm text-blue-900">
        💡 <strong>팁:</strong> "새창 열기"를 클릭하여 전체 화면 모드에서 모든 스크립트를 탐색하세요.
      </p>
    </div>
  </div>
)}
```

**아이콘 import 추가 (line 5):**
```tsx
import { ExternalLink } from "lucide-react";
```

### 3. playbook-viewer/page.tsx 최종 완성

**현황:** Phase 필터, customerSegment 드롭다운, 클로징신호 체크박스 UI는 이미 구현됨

**추가 작업:**

#### 3.1. API 응답 타입 정의 보강

```tsx
type PlaybookItem = {
  id: string;
  key: string;
  phase: string;
  type: string;
  customerSegment: string;
  trigger: string | null;
  script: string;
  psychology: string;
  shinminStep?: string;  // 신민형 5단계
  monikaAmplifyLevel?: string; // 모니카 욕망 증폭 레벨 (1-4)
  source?: string; // 데이터 소스
  notes: string;
  isActive: boolean;
  priority?: number;
  scriptTab?: string;
  productCode?: string;
  sectionOrder?: number;
};
```

#### 3.2. 심리학 배지 필터 추가 (선택사항)

```tsx
const PSYCHOLOGY_LIST = [
  "Loss Aversion",
  "Social Proof",
  "Narrative Transportation",
  "Priming",
  "Scarcity",
  "Commitment",
];

// 상태 추가
const [selectedPsychology, setSelectedPsychology] = useState<string | null>(null);

// 필터링 로직
const filteredByPsych = selectedPsychology
  ? filteredItems.filter(i => i.psychology?.includes(selectedPsychology))
  : filteredItems;
```

#### 3.3. 신민형 5단계 배지 표시

```tsx
const SHINMIN_STEPS = {
  "1": { label: "Step 1: 라포", color: "bg-blue-100 text-blue-800" },
  "2": { label: "Step 2: 니즈 SPIN", color: "bg-green-100 text-green-800" },
  "3": { label: "Step 3: 욕망증폭", color: "bg-purple-100 text-purple-800" },
  "4": { label: "Step 4: 감정피크", color: "bg-pink-100 text-pink-800" },
  "5": { label: "Step 5: 클로징", color: "bg-red-100 text-red-800" },
};

// 스크립트 카드에 배지 추가
{selectedItem?.shinminStep && (
  <span className={`px-2 py-1 rounded text-xs font-medium ${SHINMIN_STEPS[selectedItem.shinminStep]?.color}`}>
    {SHINMIN_STEPS[selectedItem.shinminStep]?.label}
  </span>
)}
```

#### 3.4. 모니카 욕망 증폭 레벨 표시 (AMPLIFY type만)

```tsx
{selectedItem?.type === "AMPLIFY" && selectedItem?.monikaAmplifyLevel && (
  <div className="bg-purple-50 border border-purple-200 rounded p-3">
    <p className="text-xs font-semibold text-purple-900">
      모니카 욕망 증폭: 레벨 {selectedItem.monikaAmplifyLevel}
    </p>
    <p className="text-xs text-purple-700 mt-1">
      {["", "눈 떠주기", "필요성 공감", "감정 증폭", "행동 유도"][
        parseInt(selectedItem.monikaAmplifyLevel)
      ]}
    </p>
  </div>
)}
```

#### 3.5. 데이터 소스 표시

```tsx
{selectedItem?.source && (
  <div className="text-xs text-gray-500 mt-2">
    출처: {selectedItem.source}
  </div>
)}
```

### 4. API 엔드포인트 검증

**필수 쿼리 파라미터:**
- `?phase={0-9}` — Phase 필터링
- `?customerSegment={A|B|C|D|E|ALL}` — 고객 세그먼트
- `?type={OPENING|NEEDS|AMPLIFY|...}` — 타입 필터링

**응답 예시:**
```json
{
  "ok": true,
  "items": [
    {
      "id": "pb_001",
      "key": "pb_phase0_opening_001",
      "phase": "0",
      "type": "OPENING",
      "customerSegment": "ALL",
      "script": "안녕하세요...",
      "psychology": "Loss Aversion (손실회피 - Kahneman)",
      "shinminStep": "1",
      "source": "신민형콜",
      "notes": "콜 시작 1분 내...",
      "isActive": true
    }
  ],
  "total": 61
}
```

### 5. 산출물

**파일:**
- `src/app/(dashboard)/tools/page.tsx` (수정)
- `src/app/(dashboard)/tools/playbook-viewer/page.tsx` (완성)

**검증 체크리스트:**
- [ ] tools/page.tsx mainTab에 "call-playbook" 추가
- [ ] MAIN_TABS 배열 추가
- [ ] 콜 플레이북 탭 UI 렌더링
- [ ] 새창 열기 버튼 동작 (ExternalLink 아이콘)
- [ ] playbook-viewer 페이지 로드 확인
- [ ] Phase 필터 동작 확인
- [ ] customerSegment 드롭다운 동작 확인
- [ ] 심리학 배지 표시 확인
- [ ] 신민형 5단계 배지 표시 확인
- [ ] 모니카 욕망 증폭 레벨 표시 (AMPLIFY type만)
- [ ] 데이터 소스 표시 확인
- [ ] 클로징 신호 7종 체크박스 동작 확인
- [ ] 반응형 디자인 (모바일) 확인

**커밋 메시지:**
```
feat(tools): 콜 플레이북 탭 추가 + playbook-viewer 완성
- tools/page.tsx에 "콜 플레이북" 5번째 탭 추가
- playbook-viewer 심리학/신민형/모니카 배지 추가
- 새창 열기 기능 통합
```

---

## 📊 산출물 요약

| Agent | 파일 | 타입 | 라인 |
|-------|------|------|------|
| **γ** | playbook_rag_master_v2_refined.json | JSON | 61개 항목 |
| **δ** | tools/page.tsx | 수정 | +30줄 |
| **δ** | playbook-viewer/page.tsx | 수정 | +50줄 |
| **총합** | 3파일 | | ~140줄 |

---

## ✅ 완료 기준

### Agent γ 완료 조건
- ✅ JSON 항목: 50-80개 (목표: 61개)
- ✅ 심리학 이론 명시 (Kahneman/Cialdini/Green&Brock)
- ✅ 신민형 5단계 명시 (ShimminStep 필드)
- ✅ 모니카 욕망 증폭 4단계 명시 (AMPLIFY type)
- ✅ 데이터 소스 명시 (source 필드)
- ✅ JSON 포맷 유효성 검증

### Agent δ 완료 조건
- ✅ tools/page.tsx에 "콜 플레이북" 탭 추가
- ✅ MAIN_TABS 배열 정의
- ✅ 새창 열기 버튼 구현
- ✅ playbook-viewer 페이지 로드 확인
- ✅ Phase/customerSegment 필터 동작
- ✅ 심리학 배지 표시
- ✅ 신민형 5단계 배지 표시
- ✅ 모니카 욕망 증폭 표시
- ✅ 데이터 소스 표시
- ✅ 클로징 신호 체크박스 동작
- ✅ 반응형 디자인 확인

---

## 🎯 검증 방법

```bash
# 1. JSON 유효성
node -e "const d=require('./docs/크루즈콜모음/playbook_rag_master_v2_refined.json'); console.log('항목수:', d.length, '심리학포함:', d.filter(x=>x.psychology?.includes('Kahneman')).length)"

# 2. 빌드
npm run build

# 3. 개발 서버 시작
npm run dev

# 4. 수동 테스트 (브라우저)
# /tools → "콜 플레이북" 탭 클릭 → "새창 열기" → playbook-viewer 로드
# Phase 필터: [0][1][2][3]...[9] 버튼 동작
# customerSegment: ALL → A → B 선택 시 필터링
# 심리학 배지: "Loss Aversion (손실회피 - Kahneman)" 표시
# 신민형 배지: "Step 1: 라포" 표시
# 모니카 표시: AMPLIFY type에서 "욕망 증폭: 레벨 3" 표시
```

---

## 📌 주의사항

1. **JSON 특수문자**: 스크립트에 따옴표/쌍따옴표 있으면 escape (`\"`)
2. **psychology 필드**: 복수 이론 적용 시 `|` 구분자 사용
3. **isActive**: 모든 항목 `true`로 설정 (비활성 항목 없음)
4. **Phase 순서**: phase 필드가 정렬되어야 UI 필터링 정상 작동
5. **customerSegment**: A/B/C/D/E/ALL만 유효 (다른 값 오류)
6. **playbook-viewer 로드**: /api/tools/playbook 엔드포인트가 JSON 데이터 반환하는지 확인

