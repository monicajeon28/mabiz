# 마케팅 매출 관리 - 골드회원 탭 구현 작업지시서

**작업 기간**: 2026-06-23  
**우선순위**: P0  
**팀**: Team E (UI/Component)

---

## 🎯 목표

`/marketing/sales` 페이지에 **"👑 골드회원"** 탭 추가:
- 기존: "📊 매출 현황" 탭만 존재
- 추가: 탭 네비게이션 + GoldMemberTab 컴포넌트 
- API: GET `/api/partner/dashboard/gold?month=YYYY-MM` (이미 구현됨)

---

## 📋 구현 체크리스트

### P0-1: 탭 네비게이션 추가
**파일**: `D:\mabiz-crm\src\app\(dashboard)\marketing\sales\page.tsx`

- [ ] 상태 추가: `const [activeTab, setActiveTab] = useState<'overview' | 'gold'>('overview')`
- [ ] 탭 버튼 2개 렌더링:
  - "📊 매출 현황" (파란 밑줄 활성)
  - "👑 골드회원" (회색 비활성)
- [ ] 탭 버튼 스타일 규칙:
  - 크기: `px-6 py-3` (48px 이상 높이)
  - 호버: `text-gray-900` 전환
  - 활성: `border-blue-600 text-blue-600` (밑줄 + 파란색)
  - 비활성: `border-transparent text-gray-600`

### P0-2: GoldMemberTab 컴포넌트 생성
**파일**: `D:\mabiz-crm\src\app\(dashboard)\marketing\sales\GoldMemberTab.tsx` (신규)

**타입 정의:**
```typescript
interface GoldMemberData {
  ok: boolean;
  data?: {
    goldMemberCount: number;
    newInquiries: number;
    paymentRate: number;
    members: Array<{
      id: string;
      name: string;
      course: string;
      paidCount: number;
      totalCount: number;
      status: string;
    }>;
    recentConsultations: Array<{
      id: string;
      memberName: string;
      content: string;
      date: string;
    }>;
  };
  error?: string;
}
```

**구현 체크리스트:**
- [ ] API 호출: `GET /api/partner/dashboard/gold?month=YYYY-MM`
- [ ] 로딩 상태 (Loader2 스피너)
- [ ] 에러 처리 (AlertCircle 메시지)
- [ ] 4개 KPI 카드 렌더링:
  - 👑 골드회원 (현재 회원 수)
  - 🆕 신규 (이달 신규 상담)
  - 💳 납부율 (%)
  - 조직별 기타 메트릭 (옵션)
- [ ] 회원 목록 테이블 (최대 10명):
  - 열: 이름, 상품, 결제건수, 상태
  - 호버 효과
  - 모바일 스크롤 가능
- [ ] 50대 친화 UI:
  - 글자: 16px 이상
  - 버튼: 48px 이상
  - 대비도: 4.5:1 이상
  - 여백: 섹션 24px, 요소 16px

### P0-3: 컴포넌트 import & 페이지 통합
**파일**: `D:\mabiz-crm\src\app\(dashboard)\marketing\sales\page.tsx`

- [ ] Import 추가: `import { GoldMemberTab } from './GoldMemberTab'`
- [ ] 탭 전환 로직:
  ```typescript
  {activeTab === 'overview' && (
    <div className="space-y-6">
      {/* 기존 내용 */}
    </div>
  )}
  
  {activeTab === 'gold' && (
    <GoldMemberTab session={session} />
  )}
  ```

---

## 🔧 기술 스펙

### API 응답 형식
```json
{
  "ok": true,
  "data": {
    "goldMemberCount": 42,
    "newInquiries": 8,
    "paymentRate": 87.5,
    "members": [
      {
        "id": "gm_xxx",
        "name": "김철수",
        "course": "지중해크루즈",
        "paidCount": 3,
        "totalCount": 5,
        "status": "ACTIVE"
      }
    ],
    "recentConsultations": [
      {
        "id": "con_xxx",
        "memberName": "김철수",
        "content": "2월 일정 문의",
        "date": "2026-06-23"
      }
    ]
  }
}
```

### 환경 변수
- 추가 환경 변수 **없음** (기존 인증 체계 사용)

### 권한 검증
- `requirePartnerContext()`: 자동으로 AGENT/대리점장/관리자만 접근 가능
- 403 응답: "골드회원 데이터를 볼 권한이 없습니다"

---

## 🎨 UI 디자인 규칙 (Steve Jobs 기준)

### 타이포그래피
| 역할 | 크기 | 색상 | 예시 |
|------|------|------|------|
| 탭 레이블 | 16px | #1A1A1A | "👑 골드회원" |
| KPI 카드 라벨 | 14px | #666666 | "👑 골드회원" |
| KPI 카드 숫자 | 32px | #1A1A1A | "42명" |
| 테이블 헤더 | 14px | #666666 | "이름", "상품" |
| 테이블 데이터 | 16px | #1A1A1A | "김철수", "지중해크루즈" |

### 색상 체계
- 배경: #F9FAFB (gray-50)
- 카드: #FFFFFF (white)
- 보더: #E5E7EB (gray-200)
- 텍스트: #1A1A1A (gray-900)
- 강조: #2563EB (blue-600)

### 간격 규칙
```
섹션 (상하 24px 마진)
  ├─ 카드 그리드 (gap-4)
  │   └─ 카드 내부 (p-6)
  │       └─ 텍스트 간격 (mt-2, mb-1)
  │
  └─ 테이블 (overflow-x-auto)
      └─ 행 높이 40px (py-4)
      └─ 열 너비: 자동 정렬
```

### 반응형
| 화면 | 너비 | 레이아웃 |
|------|------|---------|
| Mobile | <640px | 1칼럼 카드, 가로 스크롤 테이블 |
| Tablet | 640-1024px | 2칼럼 카드 |
| Desktop | >1024px | 4칼럼 카드 |

---

## 🧪 테스트 시나리오

### Unit Test
```typescript
// GoldMemberTab.test.tsx
test('로딩 중 스피너 표시', () => {});
test('에러 시 경고 메시지 표시', () => {});
test('데이터 로드 시 4개 카드 + 테이블 표시', () => {});
test('월 변경 시 API 재호출', () => {});
```

### E2E Test
1. `/marketing/sales` 접속
2. "👑 골드회원" 탭 클릭
3. 로딩 스피너 → 4개 카드 + 회원 목록 표시
4. "📊 매출 현황" 탭 전환 (상태 유지 검증)
5. 월 선택 변경 → 골드회원 탭 데이터 자동 갱신

### 수동 테스트
- [ ] 탭 버튼 48px 이상? (마우스로 클릭 용이)
- [ ] 글자 16px 이상? (읽기 편함)
- [ ] 대비도 4.5:1? (명확함)
- [ ] 모바일 가로 스크롤 가능? (스크롤바 보임)
- [ ] 로딩 완료 후 즉시 데이터 표시? (0.2초 이내)
- [ ] 없는 데이터 시 안내 메시지? ("데이터가 없습니다")

---

## 📦 배포 체크리스트

### Before Commit
- [ ] `npx tsc --noEmit` → 0 에러
- [ ] ESLint 통과 (import 순서, 타입)
- [ ] 기존 테스트 통과 (npm test)
- [ ] 마크업 검증 (accessibility)

### Commit 메시지
```
feat(marketing): add GoldMember tab to sales dashboard

- Add tab navigation (매출 현황 / 골드회원)
- Create GoldMemberTab component with KPI cards
- Fetch data from GET /api/partner/dashboard/gold
- Display 4 KPI metrics + member list table
- 50-대 친화 UI (16px text, 48px buttons)
- Mobile-responsive layout
- Error handling + loading states

Co-Authored-By: Team E <noreply@anthropic.com>
```

---

## 🔗 참고 파일

- 페이지: `D:\mabiz-crm\src\app\(dashboard)\marketing\sales\page.tsx`
- API: `D:\mabiz-crm\src\app\api\partner\dashboard\gold\route.ts`
- 타입: `D:\mabiz-crm\src\types\marketing.ts` (필요 시 확장)
- 컴포넌트: `D:\mabiz-crm\src\components\marketing\KpiCard.tsx` (재사용)
- 유틸: `D:\mabiz-crm\src\lib\marketing-utils.ts` (formatAmount, formatDate)

---

## ⚡ 예상 소요시간

- P0-1 (탭 네비게이션): 15분
- P0-2 (컴포넌트 생성): 30분
- P0-3 (통합 + 테스트): 15분
- **총 소요시간: 60분**

---

## 📞 Q&A

**Q: 기존 overview 탭 내용을 어디로 옮기나?**  
A: `{activeTab === 'overview' && ( ... )}` 래퍼로 감싸면 됨 (기존 코드 전체 포함)

**Q: API 인증은?**  
A: `requirePartnerContext()` 자동 검증 (session 기반)

**Q: 월 선택 변경 시 골드회원 탭도 갱신되나?**  
A: 네. GoldMemberTab에서 `selectedMonth` prop으로 받아서 useEffect에서 재호출

**Q: 데이터 없으면?**  
A: "데이터가 없습니다" 메시지 표시 (no-data state)

---

**최종 검증**: TSC 0에러 + 1개 commit + 배포 준비 완료
