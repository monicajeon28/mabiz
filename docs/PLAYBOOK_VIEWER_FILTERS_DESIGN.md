# PlaybookViewer 필터 UI 설계 상세 (2026-06-02)

## 레이아웃 개선안

### 현재 (As-Is) 레이아웃 문제
```
┌────────────────────────────────────┐
│ 콜 플레이북 라이브러리              │
├────────────────────────────────────┤
│                                    │
│ [필터버튼] [필터버튼] [필터버튼]    │ ← 필터가 가로로 흩어짐
│ [필터버튼] [필터버튼]              │
│                                    │
│ 결과:                              │
│ [카드] [카드] [카드]                │
│ [카드] [카드] [카드]                │
│                                    │
└────────────────────────────────────┘

문제점:
1. 필터 조건을 한눈에 볼 수 없음
2. 필터 간 관계성 불명확 (어떤 필터가 어떤 역할?)
3. 모바일에서 스크롤 필요
4. 선택된 필터 상태를 추적하기 어려움
```

### 개선안: Fixed Sidebar + Content

```
┌─────────────────────────────────────────────────────────┐
│ 콜 플레이북 라이브러리 (새창 열기 버튼)                   │
├────────────────┬────────────────────────────────────────┤
│  필터 (250px)  │ 결과 (calc(100% - 250px))              │
│                │                                        │
│  🔍 검색창     │ 선택된 필터:                            │
│  ┌──────────┐ │ ├─ Segment: A (남성 30-40대)          │
│  │입력...   │ │ ├─ Phase: 클로징 ✓                    │
│  └──────────┘ │ ├─ Psychology: L6 손실회피 ✓          │
│               │ └─ Status: 성공사례 ✓                  │
│               │                                        │
│ ┌───────────┐ │ 결과: 12개 플레이북                     │
│ │1. 고객세그 │ │                                        │
│ │  ○ 모든고객│ │ ┌─────────────────────────────┐      │
│ │  ○ A (커플)│ │ │ 📌 거절 대응 스크립트 #1   │      │
│ │  ○ B (가족)│ │ │ (클로징 Phase | L6 손실회피) │      │
│ │  ○ C (중년)│ │ │                             │      │
│ │  ○ D (50-60)│ │ 가격 이의 대응 → 가치 재정의  │      │
│ │  ○ E (60대) │ │                             │      │
│ │ └────────┘ │ │ 신민형: Step 5 (클로징)      │      │
│ │            │ │ 심리학: 손실회피 강조          │      │
│ │ ┌────────┐ │ │ 기대효과: +92% ROI           │      │
│ │ │2. 제품  │ │ │ ⭐⭐⭐⭐⭐ (4.8/5)           │      │
│ │ │○모든상품│ │ │                             │      │
│ │ │○ GOLD  │ │ │ [💾 저장] [📋 복사]          │      │
│ │ │○GENERAL│ │ └─────────────────────────────┘      │
│ │ └────────┘ │                                        │
│ │            │ ┌─────────────────────────────┐      │
│ │ ┌────────┐ │ │ 📌 거절 대응 스크립트 #2   │      │
│ │ │3. 심리학│ │ │ (클로징 Phase | L10 즉시) │      │
│ │ │☑ L6    │ │ │                             │      │
│ │ │☐ L10   │ │ [더 보기...]                  │      │
│ │ └────────┘ │ └─────────────────────────────┘      │
│ │            │                                        │
│ │ ┌────────┐ │                                        │
│ │ │4.PASONA│ │ 페이지네이션: < 1 2 3 >                │
│ │ │☐Problem│ │                                        │
│ │ │☑Affinity│ │                                        │
│ │ │☑Solution│ │                                        │
│ │ │☐ Offer │ │                                        │
│ │ └────────┘ │                                        │
│ │            │                                        │
│ │ ┌────────┐ │                                        │
│ │ │5.신민형 │ │                                        │
│ │ │☐Step 1 │ │                                        │
│ │ │☐Step 2 │ │                                        │
│ │ │☐Step 3 │ │                                        │
│ │ │☑Step 4 │ │                                        │
│ │ │☑Step 5 │ │                                        │
│ │ └────────┘ │                                        │
│ │            │                                        │
│ │ ┌────────┐ │                                        │
│ │ │6. ROI  │ │                                        │
│ │ │        │ │                                        │
│ │ │50%    100%200% │                                 │
│ │ │◀──|────|────▶│ │                                 │
│ │ │      75-100% │ │                                 │
│ │ └────────┘ │                                        │
│ │            │                                        │
│ │ ┌────────┐ │                                        │
│ │ │7.사례  │ │                                        │
│ │ │☑성공   │ │                                        │
│ │ │☐개선   │ │                                        │
│ │ │☐교육   │ │                                        │
│ │ └────────┘ │                                        │
│ │            │                                        │
│ │ [↻ 초기화 ] │                                        │
│ │ [💾 저장] │                                        │
│ │ [🔗 공유] │                                        │
│                                        │                                        │
│                                        │                                        │
└────────────────┴────────────────────────────────────────┘
```

---

## 필터별 상세 설계

### 필터 1: 고객 세그먼트 (CUSTOMER_SEGMENTS)

**타입**: Radio Button (단일선택)
**기본값**: ALL
**표시**: 6개

```tsx
// 데이터 구조
const SEGMENT_FILTER = [
  {
    key: "ALL",
    label: "모든 고객",
    description: "모든 세그먼트 (A-E)",
    emoji: "🌐",
    color: "bg-gray-100",
  },
  {
    key: "A",
    label: "A: 30대 커플",
    description: "신혼/신혼예정 (L7: 동반자설득)",
    emoji: "💑",
    color: "bg-pink-100",
  },
  {
    key: "B",
    label: "B: 40대 가족",
    description: "아동동반 (L8: 재구매 습관)",
    emoji: "👨‍👩‍👧‍👦",
    color: "bg-blue-100",
  },
  {
    key: "C",
    label: "C: 중년 부부",
    description: "부부여행 전문 (L6: 손실회피)",
    emoji: "👫",
    color: "bg-purple-100",
  },
  {
    key: "D",
    label: "D: 50-60대",
    description: "중년 여유층 (L5: 자기투영)",
    emoji: "🧑‍🦱",
    color: "bg-green-100",
  },
  {
    key: "E",
    label: "E: 60대+",
    description: "은퇴층/여유층 (L9: 의료신뢰)",
    emoji: "👴",
    color: "bg-orange-100",
  },
];

// UI 렌더링 (Tailwind)
<div className="space-y-2">
  {SEGMENT_FILTER.map((seg) => (
    <label key={seg.key} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
      <input
        type="radio"
        name="segment"
        value={seg.key}
        checked={selectedSegment === seg.key}
        onChange={(e) => setSelectedSegment(e.target.value)}
        className="w-4 h-4 mt-1"
      />
      <div className="flex-1">
        <div className="font-medium text-sm text-gray-900">{seg.emoji} {seg.label}</div>
        <div className="text-xs text-gray-600">{seg.description}</div>
      </div>
    </label>
  ))}
</div>
```

---

### 필터 2: 제품 유형 (PRODUCT_TYPE)

**타입**: Radio Button (단일선택)
**기본값**: ALL
**표시**: 3개

```tsx
const PRODUCT_FILTER = [
  {
    key: "ALL",
    label: "모든 상품",
    emoji: "🎁",
    count: 412, // DB에서 동적 계산
  },
  {
    key: "GOLD",
    label: "GOLD (프리미엄)",
    emoji: "👑",
    count: 287,
    description: "고가 럭셔리 크루즈",
  },
  {
    key: "GENERAL",
    label: "GENERAL (일반)",
    emoji: "🚢",
    count: 125,
    description: "스탠다드 크루즈",
  },
];

// UI
<div className="space-y-2">
  {PRODUCT_FILTER.map((prod) => (
    <label key={prod.key} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
      <input
        type="radio"
        name="product"
        value={prod.key}
        checked={selectedProduct === prod.key}
        onChange={(e) => setSelectedProduct(e.target.value)}
      />
      <div className="flex-1">
        <div className="font-medium text-sm">{prod.emoji} {prod.label}</div>
        {prod.description && <div className="text-xs text-gray-500">{prod.description}</div>}
      </div>
      <span className="text-xs text-gray-500 font-mono">{prod.count}</span>
    </label>
  ))}
</div>
```

---

### 필터 3: 심리학 렌즈 (PSYCHOLOGY_LENS)

**타입**: Checkbox (다중선택)
**기본값**: [] (모두 선택 해제)
**표시**: 10개 (확장 가능)

```tsx
const PSYCHOLOGY_LENSES = [
  {
    key: "L0",
    label: "L0: 기본 인식",
    emoji: "🔍",
    description: "초기 관심 유도",
    color: "bg-gray-100 text-gray-800",
  },
  {
    key: "L1",
    label: "L1: 불완전 정보",
    emoji: "❓",
    description: "불확실성 감정 자극",
    color: "bg-blue-100 text-blue-800",
  },
  {
    key: "L6",
    label: "L6: 손실회피",
    emoji: "⚡",
    description: "타이밍/기회비용 강조",
    color: "bg-red-100 text-red-800",
  },
  {
    key: "L10",
    label: "L10: 즉시구매",
    emoji: "🎯",
    description: "제한된 보너스/긴박감",
    color: "bg-purple-100 text-purple-800",
  },
  // ... 더 추가
];

// UI with badges
<div className="space-y-2">
  {PSYCHOLOGY_LENSES.map((lens) => (
    <label key={lens.key} className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
      <input
        type="checkbox"
        checked={selectedLenses.includes(lens.key)}
        onChange={(e) => {
          if (e.target.checked) {
            setSelectedLenses([...selectedLenses, lens.key]);
          } else {
            setSelectedLenses(selectedLenses.filter(l => l !== lens.key));
          }
        }}
        className="w-4 h-4 mt-1"
      />
      <div className="flex-1">
        <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${lens.color}`}>
          {lens.emoji} {lens.label}
        </div>
        <div className="text-xs text-gray-600 mt-1">{lens.description}</div>
      </div>
    </label>
  ))}
</div>
```

---

### 필터 4: PASONA 스테이지 (PASONA_STAGE)

**타입**: Checkbox (다중선택)
**기본값**: [] (모두 선택 해제)
**표시**: 4개

```tsx
const PASONA_STAGES = [
  {
    key: "problem",
    label: "P: 문제 인식",
    emoji: "⚠️",
    color: "bg-red-100 text-red-800",
    description: "고객의 pain point 인식시키기",
  },
  {
    key: "affinity",
    label: "A: 공감",
    emoji: "🤝",
    color: "bg-yellow-100 text-yellow-800",
    description: "감정적 공감과 신뢰 구축",
  },
  {
    key: "solution",
    label: "S: 해결책",
    emoji: "💡",
    color: "bg-green-100 text-green-800",
    description: "우리 상품이 어떻게 해결하는가",
  },
  {
    key: "offer",
    label: "O: 제안",
    emoji: "🎁",
    color: "bg-blue-100 text-blue-800",
    description: "구체적 가격/조건 제시",
  },
  {
    key: "narrow",
    label: "N: 좁혀진범위",
    emoji: "🎯",
    color: "bg-purple-100 text-purple-800",
    description: "결정 선택지 축소",
  },
  {
    key: "action",
    label: "A: 행동",
    emoji: "⚡",
    color: "bg-orange-100 text-orange-800",
    description: "즉시 액션 요청",
  },
];

// UI with visual timeline
<div className="space-y-3">
  <div className="text-xs font-semibold text-gray-600">PASONA 흐름</div>
  <div className="flex gap-1 mb-3">
    {PASONA_STAGES.map((stage) => (
      <div
        key={stage.key}
        className={`flex-1 h-1 rounded-full ${
          selectedPasona.includes(stage.key)
            ? stage.color.split(" ")[0]
            : "bg-gray-200"
        }`}
      />
    ))}
  </div>
  <div className="space-y-2">
    {PASONA_STAGES.map((stage) => (
      <label key={stage.key} className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50">
        <input
          type="checkbox"
          checked={selectedPasona.includes(stage.key)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedPasona([...selectedPasona, stage.key]);
            } else {
              setSelectedPasona(selectedPasona.filter(p => p !== stage.key));
            }
          }}
        />
        <div className="flex-1">
          <div className="text-sm font-medium">{stage.emoji} {stage.label}</div>
          <div className="text-xs text-gray-600">{stage.description}</div>
        </div>
      </label>
    ))}
  </div>
</div>
```

---

### 필터 5: 신민형 5단계 (SHINMIN_STEPS)

**타입**: Checkbox (다중선택)
**기본값**: [] (모두 선택 해제)
**표시**: 5개

```tsx
const SHINMIN_STEPS_FILTER = [
  {
    key: "1",
    step: "Step 1",
    label: "라포 형성",
    emoji: "👋",
    color: "bg-blue-100 text-blue-800",
    description: "신뢰 관계 구축",
  },
  {
    key: "2",
    step: "Step 2",
    label: "니즈 SPIN",
    emoji: "❓",
    color: "bg-green-100 text-green-800",
    description: "문제 발굴/예상",
  },
  {
    key: "3",
    step: "Step 3",
    label: "욕망 증폭",
    emoji: "✨",
    color: "bg-purple-100 text-purple-800",
    description: "감정 자극 및 흥미 극대화",
  },
  {
    key: "4",
    step: "Step 4",
    label: "감정 피크",
    emoji: "❤️",
    color: "bg-pink-100 text-pink-800",
    description: "최고 감정 지점 포착",
  },
  {
    key: "5",
    step: "Step 5",
    label: "클로징",
    emoji: "🎯",
    color: "bg-red-100 text-red-800",
    description: "최종 의사결정 유도",
  },
];

// UI with progression visual
<div className="space-y-3">
  <div className="text-xs font-semibold text-gray-600">신민형 5단계</div>
  <div className="flex gap-1 mb-3">
    {SHINMIN_STEPS_FILTER.map((step, idx) => (
      <React.Fragment key={step.key}>
        <div
          className={`flex-1 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
            selectedSteps.includes(step.key)
              ? step.color
              : "bg-gray-200 text-gray-600"
          }`}
        >
          {step.step}
        </div>
        {idx < SHINMIN_STEPS_FILTER.length - 1 && (
          <div className="text-gray-400 self-center">→</div>
        )}
      </React.Fragment>
    ))}
  </div>
  {/* 체크박스 목록 */}
</div>
```

---

### 필터 6: ROI 기대 효과 (ROI_RANGE)

**타입**: Range Slider (연속선택)
**기본값**: [0, 200]
**범위**: 0% ~ 200%+

```tsx
// UI with dual thumb slider
<div className="space-y-3">
  <div className="text-sm font-medium">기대 ROI 범위</div>
  <div className="flex items-center gap-2">
    <input
      type="range"
      min="0"
      max="200"
      value={roiRange[0]}
      onChange={(e) => {
        const newVal = parseInt(e.target.value);
        if (newVal <= roiRange[1]) {
          setRoiRange([newVal, roiRange[1]]);
        }
      }}
      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
    />
  </div>
  <div className="flex justify-between text-xs text-gray-600">
    <span>{roiRange[0]}%</span>
    <span>~</span>
    <span>{roiRange[1]}%{roiRange[1] >= 200 ? "+" : ""}</span>
  </div>
  
  {/* 빠른 선택 */}
  <div className="flex gap-1 flex-wrap">
    {[
      { label: "보수 (50-75%)", range: [50, 75] },
      { label: "표준 (75-100%)", range: [75, 100] },
      { label: "고성과 (100%+)", range: [100, 200] },
    ].map((preset) => (
      <button
        key={preset.label}
        onClick={() => setRoiRange(preset.range)}
        className={`text-xs px-3 py-1 rounded-full border ${
          roiRange[0] === preset.range[0] && roiRange[1] === preset.range[1]
            ? "bg-navy-900 text-white border-navy-900"
            : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
        }`}
      >
        {preset.label}
      </button>
    ))}
  </div>
</div>
```

---

### 필터 7: 사례 유형 (CASE_TYPE)

**타입**: Checkbox (다중선택)
**기본값**: ["SUCCESS"] (성공사례만)
**표시**: 3개

```tsx
const CASE_TYPES = [
  {
    key: "SUCCESS",
    label: "✅ 성공사례",
    emoji: "🏆",
    description: "실제 클로징한 통화 기록",
    color: "bg-green-100 text-green-800",
  },
  {
    key: "IMPROVEMENT",
    label: "📊 개선사례",
    emoji: "📈",
    description: "부족했던 부분을 교정한 사례",
    color: "bg-yellow-100 text-yellow-800",
  },
  {
    key: "EDUCATIONAL",
    label: "📚 교육사례",
    emoji: "🎓",
    description: "신입 교육용 기초 스크립트",
    color: "bg-blue-100 text-blue-800",
  },
];

// UI
<div className="space-y-2">
  {CASE_TYPES.map((caseType) => (
    <label key={caseType.key} className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50">
      <input
        type="checkbox"
        checked={selectedCaseTypes.includes(caseType.key)}
        onChange={(e) => {
          if (e.target.checked) {
            setSelectedCaseTypes([...selectedCaseTypes, caseType.key]);
          } else {
            setSelectedCaseTypes(selectedCaseTypes.filter(ct => ct !== caseType.key));
          }
        }}
      />
      <div className="flex-1">
        <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${caseType.color}`}>
          {caseType.emoji} {caseType.label}
        </div>
        <div className="text-xs text-gray-600 mt-1">{caseType.description}</div>
      </div>
    </label>
  ))}
</div>
```

---

### 필터 8: 음성 톤 (TONE_OF_VOICE)

**타입**: Radio Button (단일선택)
**기본값**: null (모두)
**표시**: 3개

```tsx
const VOICE_TONES = [
  {
    key: "quiet",
    label: "조용한 설득",
    emoji: "🤫",
    description: "차분하고 신뢰감 있는 톤",
    example: "생각의 전환을 부드럽게...",
  },
  {
    key: "enthusiastic",
    label: "활발한 유도",
    emoji: "😊",
    description: "명랑하고 긍정적인 톤",
    example: "함께라면 할 수 있습니다!",
  },
  {
    key: "urgent",
    label: "긴급한 클로징",
    emoji: "⚡",
    description: "긴박감과 행동 촉구",
    example: "지금 바로 결정하셔야 합니다",
  },
];
```

---

### 필터 9: 난이도 (DIFFICULTY)

**타입**: Radio Button (단일선택)
**기본값**: null (모두)
**표시**: 3개

```tsx
const DIFFICULTY_LEVELS = [
  {
    key: "beginner",
    label: "입문: 기초",
    emoji: "🟢",
    description: "단순하고 따라하기 쉬운 스크립트",
  },
  {
    key: "intermediate",
    label: "중급: 이의대응",
    emoji: "🟡",
    description: "고객 반박에 대한 대응 포함",
  },
  {
    key: "advanced",
    label: "고급: 복합",
    emoji: "🔴",
    description: "여러 심리학 기법을 종합한 시나리오",
  },
];
```

---

### 필터 10: 즐겨찾기 (FAVORITES)

**타입**: Toggle (보여주기/숨기기)
**기본값**: false
**표시**: 1개 체크박스

```tsx
<label className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
  <input
    type="checkbox"
    checked={showFavoritesOnly}
    onChange={(e) => setShowFavoritesOnly(e.target.checked)}
    className="w-4 h-4"
  />
  <div className="flex items-center gap-1">
    <span className="text-lg">⭐</span>
    <div>
      <div className="font-medium text-sm">저장된 플레이북만</div>
      <div className="text-xs text-gray-600">즐겨찾기한 항목만 표시</div>
    </div>
  </div>
</label>
```

---

## 필터 상호작용

### 상호작용 1: 필터 선택 → 결과 실시간 업데이트

```tsx
// 모든 필터 변경 시
useEffect(() => {
  fetchPlaybooks({
    segment: selectedSegment,
    product: selectedProduct,
    lenses: selectedLenses,
    pasona: selectedPasona,
    steps: selectedSteps,
    roi: roiRange,
    caseTypes: selectedCaseTypes,
    tone: selectedTone,
    difficulty: selectedDifficulty,
    favoritesOnly: showFavoritesOnly,
  });
}, [
  selectedSegment,
  selectedProduct,
  selectedLenses,
  selectedPasona,
  selectedSteps,
  roiRange,
  selectedCaseTypes,
  selectedTone,
  selectedDifficulty,
  showFavoritesOnly,
]);
```

### 상호작용 2: 선택된 필터 표시

```tsx
// 결과 영역 상단에 선택된 필터를 칩으로 표시
<div className="flex flex-wrap gap-2 mb-4">
  {selectedSegment !== "ALL" && (
    <Chip
      label={`Segment: ${selectedSegment}`}
      onRemove={() => setSelectedSegment("ALL")}
    />
  )}
  {selectedProduct !== "ALL" && (
    <Chip
      label={`Product: ${selectedProduct}`}
      onRemove={() => setSelectedProduct("ALL")}
    />
  )}
  {selectedLenses.map((lens) => (
    <Chip
      key={lens}
      label={`Lens: ${lens}`}
      onRemove={() =>
        setSelectedLenses(selectedLenses.filter((l) => l !== lens))
      }
    />
  ))}
  {/* 더 많은 필터... */}
</div>
```

### 상호작용 3: 필터 초기화

```tsx
const resetFilters = () => {
  setSelectedSegment("ALL");
  setSelectedProduct("ALL");
  setSelectedLenses([]);
  setSelectedPasona([]);
  setSelectedSteps([]);
  setRoiRange([0, 200]);
  setSelectedCaseTypes(["SUCCESS"]);
  setSelectedTone(null);
  setSelectedDifficulty(null);
  setShowFavoritesOnly(false);
};

// 버튼
<button
  onClick={resetFilters}
  className="w-full px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
>
  ↻ 초기화
</button>
```

### 상호작용 4: 필터 저장

```tsx
const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);

const saveCurrentFilters = () => {
  const name = prompt("이 필터 조합의 이름을 입력하세요:");
  if (name) {
    const saved: SavedFilter = {
      id: Date.now(),
      name,
      filters: {
        segment: selectedSegment,
        product: selectedProduct,
        lenses: selectedLenses,
        pasona: selectedPasona,
        steps: selectedSteps,
        roi: roiRange,
        caseTypes: selectedCaseTypes,
        tone: selectedTone,
        difficulty: selectedDifficulty,
        favoritesOnly: showFavoritesOnly,
      },
      createdAt: new Date(),
    };
    setSavedFilters([...savedFilters, saved]);
    // 로컬스토리지 또는 DB에 저장
    localStorage.setItem("playbook-filters", JSON.stringify([...savedFilters, saved]));
  }
};

// 저장된 필터 목록 표시
<div className="mt-4 space-y-2 border-t pt-4">
  <div className="text-xs font-semibold text-gray-600">저장된 필터</div>
  {savedFilters.map((saved) => (
    <button
      key={saved.id}
      onClick={() => applyFilters(saved.filters)}
      className="w-full text-left px-3 py-2 text-sm rounded-lg bg-gray-50 hover:bg-gray-100"
    >
      {saved.name}
    </button>
  ))}
</div>
```

### 상호작용 5: 필터 공유

```tsx
const shareFilters = () => {
  const params = new URLSearchParams();
  if (selectedSegment !== "ALL") params.append("segment", selectedSegment);
  if (selectedProduct !== "ALL") params.append("product", selectedProduct);
  if (selectedLenses.length > 0) params.append("lenses", selectedLenses.join(","));
  // ... 더 많은 필터

  const url = `${window.location.origin}/tools/playbook-viewer?${params.toString()}`;
  navigator.clipboard.writeText(url);
  toast.success("필터 URL이 복사되었습니다!");
};

// 버튼
<button
  onClick={shareFilters}
  className="w-full px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
>
  🔗 공유
</button>
```

---

## 응답성 (Responsive Design)

### Desktop (1200px+)
```
[필터 Sidebar (250px)] [결과 (calc(100% - 250px))]
```

### Tablet (768px - 1199px)
```
필터 패널을 드로어(Drawer)로 변경
버튼: [🔍 필터 열기]
```

### Mobile (< 768px)
```
필터 패널을 모달로 변경
선택된 필터는 칩으로 결과 위에 표시
```

---

## 성과 메트릭

### 예상 개선 효과

| 지표 | 현재 | 개선 후 | 증대 |
|------|------|--------|------|
| **필터 시간** | 15분 | 2분 | -87% |
| **필터 정확도** | 60% | 95% | +58% |
| **재선택 횟수** | 5회 | 1회 | -80% |
| **필터 저장 사용률** | 0% | 65% | +6500% |

---

**작성일**: 2026-06-02
**버전**: FILTER-DESIGN-1.0
