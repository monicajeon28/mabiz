# Menu #38 Phase 4 Track 2 - 콜 스크립트 메뉴 설계 명세
## CRM 시스템 통합 UI/UX 설계

**작성일**: 2026-05-19  
**담당**: Menu #38 Phase 4 Track 2 (콜 스크립트 메뉴 UI/UX)  
**예상 일정**: 4Track 병렬 진행 (Track 1 완료 후)  
**상태**: 🔄 설계 단계

---

## 📋 개요

### Track 2의 목표
```
영업 도구 → 콜 스크립트 (신규 메뉴)
  ├─ Healthcare 콜 스크립트 (15분)
  ├─ Rental 콜 스크립트 (15분)
  ├─ Product (신규 DB) 콜 스크립트 (15분)
  └─ Product (부재중 DB) 콜 스크립트 (15분)

+ 각 카테고리별 SMS 3일 시퀀스 통합 표시
+ 콜 플레이북과 자동 연동
+ 실시간 콜 피드백 대시보드
```

### 왜 Track 2가 필요한가?
| 현황 | 문제 | 해결 |
|------|------|------|
| 콜 스크립트 문서로만 존재 | 판매원이 찾기 어려움 | CRM 메뉴화 |
| SMS 시퀀스와 분리됨 | "이 스크립트 후에 어떤 문자?" 불명확 | 통합 뷰 제공 |
| 피드백 시스템 없음 | "이 스크립트 효과 있나?" 모름 | 실시간 피드백 대시보드 |
| 콜 플레이북만 있음 | 스크립트 vs 플레이북 중복/혼동 | 명확한 역할 구분 + 연동 |

---

## 🎨 UI/UX 설계

### 1️⃣ 메뉴 추가 (SidebarNav)

**위치**: 영업 도구 섹션에 신규 항목 추가

```tsx
// src/components/layout/SidebarNav.tsx (수정)
{
  label: "영업 도구",
  items: [
    { href: "/tools",                      icon: Wrench,     label: "영업 도구함" },
    { href: "/call-scripts",               icon: BookOpen,   label: "콜 스크립트" },  // 신규
    { href: "/playbook",                   icon: BookOpen,   label: "콜 플레이북" },
    { href: "/tools/profit-calculator",    icon: Calculator, label: "수익 계산기" },
  ],
},
```

---

### 2️⃣ 페이지 구조 (call-scripts/page.tsx)

```
/dashboard/call-scripts
├─ 헤더 (제목, 설명)
├─ 좌측 사이드바 (Category + Segment 선택기)
│  ├─ Category Selector
│  │  ├─ Healthcare
│  │  ├─ Rental
│  │  ├─ Product (신규 DB)
│  │  └─ Product (부재중 DB)
│  └─ Segment Selector (선택한 Category에 따라 표시)
│     └─ Healthcare: 신혼부부/자녀있는가정/시니어
│     └─ Rental: 초심자/가격민감/신중한구매자
│     └─ Product: 모든 고객 (Inactive DB의 경우 세그먼트 구분)
│
└─ 메인 콘텐츠 (3컬럼 레이아웃)
   ├─ 좌: 스크립트 단계별 네비게이션
   │  └─ Phase 1: 인사 + 신뢰감
   │  └─ Phase 2: 욕구 발굴
   │  └─ Phase 3: 패키지 설명
   │  └─ Phase 4: 가격 + 기대감
   │  └─ Phase 5: 클로징
   │
   ├─ 중: 스크립트 뷰어 (copy 버튼)
   │  ├─ 단계별 목표 표시
   │  ├─ 심리학 원리 배지
   │  ├─ PASONA Phase 맵핑
   │  ├─ 예상 시간
   │  └─ 복사 버튼 (체크 표시)
   │
   └─ 우: SMS 시퀀스 미리보기 + 피드백
      ├─ Day 0-3 SMS 미리보기 (축소)
      ├─ KPI 목표 표시
      ├─ 콜 후 피드백 폼 (간단)
      │  ├─ "효과 있었나?" (5점)
      │  ├─ "어려웠던 부분?" (선택)
      │  └─ "개선 의견?" (텍스트)
      └─ 최근 피드백 3개 표시
```

---

### 3️⃣ 컴포넌트 상세 설계

#### A. Category Selector
```tsx
// src/app/(dashboard)/call-scripts/components/CategorySelector.tsx

interface CategorySelectorProps {
  selected: string;
  onSelect: (category: string) => void;
}

const CATEGORIES = [
  {
    id: "healthcare",
    name: "헬스케어",
    description: "건강관리 상품",
    color: "bg-blue-100 border-blue-300",
    icon: "🏥",
    segments: ["신혼부부", "자녀있는가정", "시니어"],
  },
  {
    id: "rental",
    name: "렌탈",
    description: "렌탈 서비스",
    color: "bg-green-100 border-green-300",
    icon: "🏠",
    segments: ["초심자", "가격민감", "신중한구매자"],
  },
  {
    id: "product_new_db",
    name: "상품 (신규 DB)",
    description: "신규/콜드 고객",
    color: "bg-orange-100 border-orange-300",
    icon: "📦",
    segments: ["모든 고객"],
  },
  {
    id: "product_inactive_db",
    name: "상품 (부재중 DB)",
    description: "기존/쉬던 고객",
    color: "bg-purple-100 border-purple-300",
    icon: "🔄",
    segments: ["모든 고객"],
  },
];

return (
  <div className="space-y-2">
    <h3 className="text-sm font-semibold text-gray-900">카테고리 선택</h3>
    <div className="grid grid-cols-2 gap-2">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className={cn(
            "p-3 rounded-lg border-2 text-left transition-all",
            selected === cat.id
              ? cat.color + " border-solid"
              : "bg-gray-50 border-gray-200 hover:border-gray-300"
          )}
        >
          <div className="text-lg">{cat.icon}</div>
          <div className="font-medium text-sm mt-1">{cat.name}</div>
          <div className="text-xs text-gray-600">{cat.description}</div>
        </button>
      ))}
    </div>
  </div>
);
```

#### B. Segment Selector
```tsx
// src/app/(dashboard)/call-scripts/components/SegmentSelector.tsx

interface SegmentSelectorProps {
  category: string;
  selected: string;
  onSelect: (segment: string) => void;
}

const SEGMENT_MAP: Record<string, string[]> = {
  "healthcare": ["신혼부부 (30-35세)", "자녀있는가정 (40-50세)", "시니어 (55세+)"],
  "rental": ["초심자", "가격민감군", "신중한구매자"],
  "product_new_db": ["모든 고객"],
  "product_inactive_db": ["모든 고객"],
};

return (
  <div className="space-y-2 mt-4">
    <h3 className="text-sm font-semibold text-gray-900">고객 세그먼트</h3>
    <div className="space-y-1">
      {SEGMENT_MAP[category]?.map((segment) => (
        <button
          key={segment}
          onClick={() => onSelect(segment)}
          className={cn(
            "w-full px-3 py-2 rounded-lg text-sm text-left transition-colors",
            selected === segment
              ? "bg-blue-500 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          )}
        >
          {segment}
        </button>
      ))}
    </div>
  </div>
);
```

#### C. Script Phase Navigator
```tsx
// src/app/(dashboard)/call-scripts/components/ScriptPhaseNav.tsx

interface Phase {
  id: string;
  name: string;
  time: string;
  icon: string;
}

const PHASES: Phase[] = [
  { id: "1", name: "인사 + 신뢰감", time: "0-2분", icon: "👋" },
  { id: "2", name: "욕구 발굴", time: "2-5분", icon: "💭" },
  { id: "3", name: "패키지 설명", time: "5-10분", icon: "🎁" },
  { id: "4", name: "가격 + 기대감", time: "10-13분", icon: "💰" },
  { id: "5", name: "클로징", time: "13-15분", icon: "🎯" },
];

return (
  <div className="space-y-1">
    {PHASES.map((phase) => (
      <button
        key={phase.id}
        onClick={() => onSelect(phase.id)}
        className={cn(
          "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors",
          selected === phase.id
            ? "bg-blue-500 text-white font-medium"
            : "text-gray-700 hover:bg-gray-100"
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{phase.icon}</span>
          <div className="flex-1">
            <div className="font-medium">{phase.name}</div>
            <div className="text-xs opacity-75">{phase.time}</div>
          </div>
        </div>
      </button>
    ))}
  </div>
);
```

#### D. Script Viewer
```tsx
// src/app/(dashboard)/call-scripts/components/ScriptViewer.tsx

interface ScriptViewerProps {
  category: string;
  segment: string;
  phase: string;
  content: string;
  psychologyPrinciples: string[];
  pasonaPhase: string;
  estimatedTime: string;
}

return (
  <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
    {/* 헤더 */}
    <div className="border-b pb-4">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Phase {phase}</h2>
          <p className="text-sm text-gray-600 mt-1">예상 시간: {estimatedTime}</p>
        </div>
        <button
          onClick={() => copy(content)}
          className="px-3 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 flex items-center gap-2"
        >
          <Copy size={16} />
          {copied ? "복사됨!" : "복사"}
        </button>
      </div>

      {/* 배지 */}
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="px-2.5 py-1 bg-purple-100 text-purple-800 text-xs rounded-full font-medium">
          PASONA: {pasonaPhase}
        </span>
        {psychologyPrinciples.map((principle) => (
          <span key={principle} className="px-2.5 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
            {principle}
          </span>
        ))}
      </div>
    </div>

    {/* 스크립트 내용 */}
    <div className="prose prose-sm max-w-none">
      {/* Markdown 렌더링 */}
      <div className="whitespace-pre-wrap font-mono text-sm text-gray-800 bg-gray-50 p-4 rounded-lg">
        {content}
      </div>
    </div>

    {/* 심리학 분석 */}
    <div className="border-t pt-4">
      <h3 className="font-semibold text-sm text-gray-900 mb-2">심리학 분석</h3>
      <div className="space-y-2">
        {psychologyPrinciples.map((principle) => (
          <div key={principle} className="text-sm text-gray-700">
            <span className="font-medium">{principle}</span>
            <span className="text-gray-600 ml-2">→ 설득력 강화</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);
```

#### E. SMS Sequence Preview
```tsx
// src/app/(dashboard)/call-scripts/components/SMSSequencePreview.tsx

interface SMSDay {
  day: number;
  title: string;
  preview: string;
  icon: string;
  targetRate: number;
}

const SMS_SEQUENCE: SMSDay[] = [
  {
    day: 0,
    title: "Day 0: 기대감 형성",
    preview: "안녕하세요 모니카님! 아까 얘기 나눴던 프로그램...",
    icon: "🚀",
    targetRate: 80,
  },
  // ... Day 1, 2, 3
];

return (
  <div className="bg-white rounded-lg border border-gray-200 p-4">
    <h3 className="font-semibold text-gray-900 mb-3 text-sm">SMS 3일 시퀀스</h3>
    <div className="space-y-3">
      {SMS_SEQUENCE.map((day) => (
        <div key={day.day} className="border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{day.icon}</span>
            <div className="flex-1">
              <div className="font-medium text-sm">{day.title}</div>
              <div className="text-xs text-gray-600">목표 오픈: {day.targetRate}%</div>
            </div>
          </div>
          <p className="text-xs text-gray-700 line-clamp-2">{day.preview}</p>
        </div>
      ))}
    </div>
    <a
      href={`/docs/call-scripts/${category}/sms-sequence`}
      className="mt-3 block text-center px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg"
    >
      전체 보기 →
    </a>
  </div>
);
```

#### F. Call Feedback Form
```tsx
// src/app/(dashboard)/call-scripts/components/CallFeedback.tsx

interface CallFeedbackProps {
  category: string;
  scriptId: string;
}

return (
  <div className="bg-white rounded-lg border border-gray-200 p-4">
    <h3 className="font-semibold text-gray-900 mb-3 text-sm">콜 후 피드백</h3>

    <form className="space-y-3">
      {/* 1. 효과 평가 */}
      <div>
        <label className="block text-xs font-medium text-gray-900 mb-2">
          이 스크립트가 효과 있었나요? ⭐
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className="text-2xl hover:scale-110 transition-transform"
            >
              ⭐
            </button>
          ))}
        </div>
      </div>

      {/* 2. 어려웠던 부분 */}
      <div>
        <label className="block text-xs font-medium text-gray-900 mb-2">
          어려웠던 부분 (선택)
        </label>
        <div className="space-y-1">
          {["고객 반응이 좋지 않았어요", "복잡해서 놓친 부분이 있어요", "시간이 부족했어요", "기타"].map(
            (option) => (
              <label key={option} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="rounded" />
                <span>{option}</span>
              </label>
            )
          )}
        </div>
      </div>

      {/* 3. 개선 의견 */}
      <div>
        <label className="block text-xs font-medium text-gray-900 mb-2">
          개선 의견 (선택)
        </label>
        <textarea
          className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="자유롭게 의견을 작성해주세요..."
          rows={3}
        />
      </div>

      <button
        type="submit"
        className="w-full px-3 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
      >
        피드백 제출
      </button>
    </form>

    {/* 최근 피드백 요약 */}
    <div className="mt-4 pt-4 border-t">
      <h4 className="text-xs font-medium text-gray-900 mb-2">최근 피드백 요약</h4>
      <div className="space-y-2 text-xs text-gray-700">
        <div>평균 평가: <span className="font-semibold">4.5/5.0</span> (최근 10개)</div>
        <div>효과적: <span className="font-semibold">85%</span></div>
        <div>개선 필요: <span className="font-semibold">시간 단축 요청 (42%)</span></div>
      </div>
    </div>
  </div>
);
```

---

## 📊 데이터베이스 스키마

### CallScriptFeedback 테이블 (신규)

```sql
CREATE TABLE CallScriptFeedback (
  id VARCHAR(36) PRIMARY KEY,
  organizationId VARCHAR(36) NOT NULL,
  userId VARCHAR(36) NOT NULL,
  category VARCHAR(50) NOT NULL,
  scriptPhase INTEGER,
  segment VARCHAR(100),
  
  -- 피드백 데이터
  effectiveness INTEGER, -- 1-5 점수
  difficulties TEXT, -- JSON: ["difficulty1", "difficulty2"]
  improvements TEXT, -- 자유 텍스트
  callDuration INTEGER, -- 통화 시간 (초)
  callOutcome VARCHAR(50), -- interested, not_interested, not_reached
  
  -- 메타데이터
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (organizationId) REFERENCES Organization(id),
  FOREIGN KEY (userId) REFERENCES User(id),
  INDEX idx_category_date (category, createdAt DESC),
  INDEX idx_userId_date (userId, createdAt DESC)
);
```

### CallScriptAnalytics 뷰 (신규)

```sql
CREATE VIEW CallScriptAnalytics AS
SELECT 
  category,
  scriptPhase,
  segment,
  COUNT(*) as totalFeedback,
  AVG(effectiveness) as avgEffectiveness,
  COUNT(CASE WHEN effectiveness >= 4 THEN 1 END) * 100.0 / COUNT(*) as satisfactionRate,
  COUNT(CASE WHEN callOutcome = 'interested' THEN 1 END) * 100.0 / COUNT(*) as conversionRate,
  AVG(callDuration) as avgCallDuration,
  JSON_OBJECT(
    'difficulty1', COUNT(CASE WHEN difficulties LIKE '%difficulty1%' THEN 1 END),
    'difficulty2', COUNT(CASE WHEN difficulties LIKE '%difficulty2%' THEN 1 END)
  ) as difficultyBreakdown,
  MAX(updatedAt) as lastUpdated
FROM CallScriptFeedback
GROUP BY category, scriptPhase, segment;
```

---

## 🔗 API 엔드포인트

### 1. GET /api/call-scripts/categories
**목적**: 모든 카테고리 + 세그먼트 조회
```json
{
  "ok": true,
  "categories": [
    {
      "id": "healthcare",
      "name": "헬스케어",
      "segments": ["신혼부부 (30-35세)", "자녀있는가정 (40-50세)", "시니어 (55세+)"],
      "scriptCount": 15,
      "avgFeedbackScore": 4.6
    }
  ]
}
```

### 2. GET /api/call-scripts/[category]/[segment]/[phase]
**목적**: 특정 카테고리 + 세그먼트 + Phase 스크립트 조회
```json
{
  "ok": true,
  "script": {
    "id": "script_123",
    "category": "healthcare",
    "segment": "신혼부부 (30-35세)",
    "phase": "1",
    "phaseName": "인사 + 신뢰감",
    "estimatedTime": "0-2분",
    "content": "안녕하세요! 크루즈 건강관리팀의 모니카입니다...",
    "psychologyPrinciples": ["Social Proof", "Authority"],
    "pasonaPhase": "Problem",
    "tips": ["전문성 강조", "고개 끄덕임 유도"]
  }
}
```

### 3. POST /api/call-scripts/[category]/feedback
**목적**: 콜 스크립트 사용 피드백 저장
```json
{
  "category": "healthcare",
  "scriptPhase": 1,
  "segment": "신혼부부 (30-35세)",
  "effectiveness": 5,
  "difficulties": ["고객 반응이 좋지 않았어요"],
  "improvements": "더 공감하는 톤으로 시작하면 좋을 것 같아요",
  "callDuration": 720,
  "callOutcome": "interested"
}
```

### 4. GET /api/call-scripts/[category]/analytics
**목적**: 카테고리별 피드백 분석 조회
```json
{
  "ok": true,
  "analytics": {
    "category": "healthcare",
    "totalFeedback": 245,
    "avgEffectiveness": 4.6,
    "satisfactionRate": 84.5,
    "conversionRate": 52.3,
    "avgCallDuration": 745,
    "bySegment": {
      "신혼부부 (30-35세)": {
        "feedback": 85,
        "avgEffectiveness": 4.7,
        "conversionRate": 55.2
      }
    }
  }
}
```

---

## 📱 모바일 대응

```tsx
// 모바일에서는 3컬럼 → 1컬럼 탭 기반 전환
// md: 이상에서 3컬럼 표시
// md: 미만에서는 탭으로 전환

<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  {/* 좌: 모바일에서는 탭 1 */}
  <aside className="md:col-span-1 border-r">
    <CategorySelector />
    <SegmentSelector />
    <ScriptPhaseNav />
  </aside>

  {/* 중: 모바일에서는 탭 2 */}
  <main className="md:col-span-1">
    <ScriptViewer />
  </main>

  {/* 우: 모바일에서는 탭 3 */}
  <aside className="md:col-span-1">
    <SMSSequencePreview />
    <CallFeedback />
  </aside>
</div>
```

---

## 🚀 구현 순서 (8단계)

| 단계 | 작업 | 담당 | 예상 시간 |
|------|------|------|----------|
| 1 | SidebarNav 메뉴 추가 | Frontend Agent | 15분 |
| 2 | 페이지 레이아웃 + 기본 컴포넌트 | Frontend Agent | 45분 |
| 3 | CategorySelector + SegmentSelector | Frontend Agent | 30분 |
| 4 | ScriptPhaseNav + ScriptViewer | Frontend Agent | 1시간 |
| 5 | SMSSequencePreview + CallFeedback 폼 | Frontend Agent | 45분 |
| 6 | API 엔드포인트 (4개) | Backend Agent | 1.5시간 |
| 7 | DB 마이그레이션 + 스키마 | DB Agent | 30분 |
| 8 | 통합 테스트 + 배포 | QA Agent | 1시간 |
| **합계** | Track 2 전체 | 4 에이전트 병렬 | **6-7시간** |

---

## 🎯 Track 2 완료 기준

✅ **Frontend 완료**
- [ ] SidebarNav에 "콜 스크립트" 메뉴 추가
- [ ] /call-scripts 페이지 렌더링
- [ ] CategorySelector 작동 (4개 카테고리 전환)
- [ ] SegmentSelector 작동 (카테고리별 세그먼트 표시)
- [ ] ScriptPhaseNav 작동 (5개 phase 네비게이션)
- [ ] ScriptViewer 작동 (복사 버튼 포함)
- [ ] SMSSequencePreview 표시
- [ ] CallFeedback 폼 작동
- [ ] 모바일 반응형 확인

✅ **Backend 완료**
- [ ] GET /api/call-scripts/categories
- [ ] GET /api/call-scripts/[category]/[segment]/[phase]
- [ ] POST /api/call-scripts/[category]/feedback
- [ ] GET /api/call-scripts/[category]/analytics

✅ **Database 완료**
- [ ] CallScriptFeedback 테이블 생성
- [ ] CallScriptAnalytics 뷰 생성
- [ ] ExecutionLog와의 자동 연동

✅ **테스트 완료**
- [ ] 4개 카테고리 각각 테스트
- [ ] 세그먼트별 스크립트 표시 확인
- [ ] 피드백 저장 및 조회 확인
- [ ] SMS 미리보기 표시 확인
- [ ] 분석 대시보드 KPI 정확도 확인

---

## 🔗 Track 2 vs Track 3/4 연결점

| Track | 역할 | Track 2와의 관계 |
|-------|------|-----------------|
| **Track 2** | 콜 스크립트 메뉴 UI/UX | **Primary**: 콜 스크립트 표시, 피드백 수집 |
| **Track 3** | API + SMS 자동화 | **Dependent**: Track 2 API 받음, SMS 발송 자동화 |
| **Track 4** | Salesbot 연동 | **Dependent**: Track 2 스크립트 데이터 받음 |

---

**작성자**: Menu #38 Phase 4 Track 2 설계자  
**버전**: 1.0  
**상태**: 📋 설계 명세 완료 → 구현 준비 완료
