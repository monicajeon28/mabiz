# Menu #25-26 마케팅 자동화/대시보드 P2 이슈 작업지시서

**작업일**: 2026-05-22  
**총 이슈**: 13개 P2  
**예상 기간**: Wave 1-3 (3시간)  
**우선순위**: 확장성(3) > 접근성(3) > UX(4) > 유지보수(2) > 성능(1)

---

## Step 1-2: 상황 분석

### 현재 상태
- P1 12개 완료 (Wave 1-3 커밋 3건: 1e79862, 9bc9190, 129ee55)
- marketing/page.tsx: 293줄 대시보드 (KPI카드+트렌드+퍼널+TOP5테이블)
- marketing/sales/page.tsx: 386줄 매출관리 (6개월그래프+랜딩별매출+결제내역)
- marketing/campaigns/page.tsx: 182줄 캠페인관리 (캠페인목록+삭제액션)

### 기존 P1 해결 사항
- 에러 처리: 네트워크 vs 서버 에러 구분 ✅
- 접근성: scope="col" 추가 ✅  
- 보안: CSRF 토큰 + 낙관적 업데이트 ✅
- UX: 스켈레톤 로딩화면 ✅

---

## P2 13개 이슈 분류

### Wave 1: 확장성 + 성능 (6개 이슈)
| # | 파일 | 렌즈 | 이슈 | 해결 방법 |
|---|------|------|------|---------|
| P2-1 | page.tsx | Scalability | TOP 5 제목이 항상 5개 표시 (1개일 수도 있음) | "상위 랜딩페이지"로 변경 |
| P2-2 | sales/page.tsx | Scalability | 결제내역 하드코딩 5행만 표시, 페이지네이션 없음 | 페이지네이션 UI 추가 (P3 구현) |
| P2-3 | sales/page.tsx | Performance | maskPhone 정규식이 매행 렌더링마다 실행 | formatAmount/formatDate/maskPhone 메모이제이션 |
| P2-4 | campaigns/page.tsx | Scalability | 캠페인 목록 페이지네이션 없음 (100+ 캠페인 대응 불가) | 페이지네이션 UI 추가 (P3 구현) |
| P2-5 | campaigns/page.tsx | Performance | getStatusBadge 함수 매렌더링마다 재생성 | useCallback 또는 const 이동 |
| P2-6 | page.tsx | Performance | KpiCard에 React.memo 없음 | React.memo로 감싸기 |

### Wave 2: 접근성 + UX (6개 이슈)
| # | 파일 | 렌즈 | 이슈 | 해결 방법 |
|---|------|------|------|---------|
| P2-7 | page.tsx | Accessibility | 트렌드 바 차트 높이가 접근성 레이블 없음 | 각 bar에 aria-label 추가 |
| P2-8 | page.tsx | Accessibility | 트렌드 날짜 MM-DD만 표시, 스크린리더용 전체 날짜 없음 | aria-label에 YYYY-MM-DD 포함 |
| P2-9 | page.tsx | UX | 에러 업데이트 시 role="alert" 없음 → 스크린리더 미공지 | role="alert" 추가 |
| P2-10 | sales/page.tsx | Accessibility | 바 차트에 aria-label 없음 | 각 bar에 aria-label="{월}: {금액}" 추가 |
| P2-11 | campaigns/page.tsx | Accessibility | 캠페인명 링크 focus:ring 없음 (키보드 네비 불명확) | focus:ring-2 focus:ring-offset-2 추가 |
| P2-12 | campaigns/page.tsx | UX | 삭제 confirm() 모달/alert() 알림 (구식 UX) | 추후 toast 알림으로 개선 (P3) |

### Wave 3: 유지보수 + 비즈니스 (1개 이슈)
| # | 파일 | 렌즈 | 이슈 | 해결 방법 |
|---|------|------|------|---------|
| P2-13 | sales/page.tsx | Maintainability | 포맷 함수(formatAmount/Date/Month) src/lib 없음 | src/lib/marketing-utils.ts 신규 파일 생성 |

---

## 상세 구현 지시사항

### Wave 1: 확장성 + 성능 (예상 30분)

#### P2-1: TOP 5 제목 동적화 (page.tsx)
```typescript
// Before (line 229)
<h2 className="text-base font-semibold text-navy-900 mb-4">상위 랜딩페이지 TOP 5</h2>

// After: 동적 개수 표시
<h2 className="text-base font-semibold text-navy-900 mb-4">
  상위 랜딩페이지 {data?.topPages.length > 0 ? `TOP ${data.topPages.length}` : ''}
</h2>
```

#### P2-2/P2-4: 페이지네이션 UI 준비 (sales/page.tsx, campaigns/page.tsx)
```typescript
// RecentPaymentTable 아래에 추가 (placeholder - P3 구현)
{recent.length === 5 && (
  <div className="text-center py-4 text-gray-400 text-xs">
    더 많은 내역을 보려면 <button className="text-blue-600">더 보기</button>
  </div>
)}

// campaigns 테이블 아래에 추가 (placeholder - P3 구현)
{campaigns.length > 10 && (
  <div className="text-center py-4 text-gray-400 text-xs">
    페이지네이션 추가 예정
  </div>
)}
```

#### P2-3: 포맷 함수 메모이제이션 (sales/page.tsx)
```typescript
// 신규 파일: src/lib/marketing-utils.ts
export const formatAmount = (n: number): string => n.toLocaleString() + "원";

export const formatDate = (iso: string | null): string => {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const formatMonth = (ym: string): string => {
  const [y, m] = ym.split("-");
  return `${y}.${m}`;
};

export const maskPhone = (tel: string | null | undefined): string => {
  if (!tel) return '-';
  const digits = tel.replace(/[^0-9+]/g, '');
  if (digits.length < 4) return '-';

  if (tel.includes('+')) {
    const countryCode = tel.match(/^\+\d+/)?.[0] || '';
    const localDigits = digits.slice(countryCode.replace('+', '').length);
    return countryCode + '-****-' + localDigits.slice(-4);
  }

  return digits.substring(0, 3) + '-****-' + digits.slice(-4);
};

// sales/page.tsx에서 import 변경
import { formatAmount, formatDate, formatMonth, maskPhone } from '@/lib/marketing-utils';
```

#### P2-5: getStatusBadge useCallback 또는 상수 이동 (campaigns/page.tsx)
```typescript
// Option A: 상수로 이동 (권장 - 간단함)
const STATUS_BADGE_STYLES = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  SENDING: 'bg-blue-100 text-blue-800',
  SENT: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
};

// 컴포넌트 내에서
const getStatusBadge = (status: string) => STATUS_BADGE_STYLES[status as keyof typeof STATUS_BADGE_STYLES] || STATUS_BADGE_STYLES.PENDING;
```

#### P2-6: KpiCard React.memo (page.tsx)
```typescript
// Before
function KpiCard({ ... }) { ... }

// After
const KpiCard = React.memo(function KpiCard({ ... }) { ... });
```

---

### Wave 2: 접근성 + UX (예상 40분)

#### P2-7/P2-8: 트렌드 바 aria-label (page.tsx)
```typescript
// Lines 166-183 수정
{data.trend.map((day) => (
  <div key={day.date} className="flex items-center gap-2">
    <span className="text-xs text-gray-400 w-16 shrink-0">
      {day.date.slice(5)}
    </span>
    <div 
      className="flex-1 bg-gray-100 rounded h-6 relative"
      role="img"
      aria-label={`${day.date}: ${day.count}건`}
    >
      <div
        className="bg-navy-600 rounded h-6 transition-all"
        style={{
          width: `${maxCount > 0 ? (day.count / maxCount) * 100 : 0}%`,
        }}
        aria-hidden="true"
      />
    </div>
    <span className="text-xs font-medium w-6 text-right shrink-0">
      {day.count}
    </span>
  </div>
))}
```

#### P2-9: 에러 메시지 role="alert" (page.tsx)
```typescript
// Before (line 105-108)
{error && (
  <div className="text-center py-16">
    <p className="text-red-500 text-sm mb-3">{error}</p>

// After
{error && (
  <div className="text-center py-16" role="alert">
    <p className="text-red-500 text-sm mb-3">{error}</p>
```

#### P2-10: 바 차트 aria-label (sales/page.tsx) 
```typescript
// BarChart 컴포넌트 내 (lines 85-100)
{monthly.map((row) => {
  const heightPct = Math.max((row.revenue / maxRevenue) * 100, 2);
  return (
    <div key={row.month} className="flex-1 flex flex-col items-center gap-1">
      <span className="text-[10px] text-gray-400 truncate w-full text-center">
        {row.revenue > 0 ? formatAmount(row.revenue) : ""}
      </span>
      <div
        className="w-full rounded-t-md bg-blue-500 transition-all"
        style={{ height: `${heightPct}%` }}
        title={`${row.month}: ${formatAmount(row.revenue)} (${row.count}건)`}
        role="img"
        aria-label={`${row.month}: ${formatAmount(row.revenue)}, ${row.count}건`}
      />
      <span className="text-xs text-gray-500 mt-1">{formatMonth(row.month)}</span>
    </div>
  );
})}
```

#### P2-11: 캠페인명 링크 focus ring (campaigns/page.tsx)
```typescript
// Line 144 수정
<Link 
  href={`/marketing/campaigns/${campaign.id}`} 
  className="text-blue-600 hover:underline font-medium focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 rounded"
>
  {campaign.title}
</Link>
```

#### P2-12: 삭제 confirm/alert 문제점 문서화 (추후 P3)
```typescript
// 현재 코드 주석 추가 (확인용)
// TODO (P3): confirm() → Modal dialog 변경, alert() → Toast notification 변경
const handleDelete = async (id: string) => {
  if (!confirm('이 캠페인을 삭제하시겠습니까?')) return; // P3에서 Modal로 변경
  // ...
  // P3에서 alert() 대신 toast 사용
};
```

---

### Wave 3: 유지보수 (예상 20분)

#### P2-13: marketing-utils.ts 신규 생성
- **파일**: src/lib/marketing-utils.ts (신규)
- **내용**: formatAmount, formatDate, formatMonth, maskPhone 
- **변경 파일**: sales/page.tsx (import 경로 변경, 로컬 함수 삭제)

---

## 구현 순서 (Phase 3-4)

```
Wave 1 (6개)
├─ P2-1: TOP 5 동적화 (2분)
├─ P2-2/4: 페이지네이션 placeholder (5분)
├─ P2-3: marketing-utils.ts 신규 + import (15분)
├─ P2-5: getStatusBadge useCallback (3분)
└─ P2-6: KpiCard React.memo (2분)
  → 커밋: "refactor(marketing): P2-1~6 확장성+성능 개선"

Wave 2 (6개)
├─ P2-7/8: 트렌드 바 aria-label (10분)
├─ P2-9: 에러 role="alert" (2분)
├─ P2-10: 바 차트 aria-label (5분)
├─ P2-11: 캠페인명 focus ring (2분)
└─ P2-12: 주석 추가 (1분)
  → 커밋: "refactor(marketing): P2-7~12 접근성+UX 개선"

Wave 3 (1개)
└─ P2-13: 유지보수 (marketing-utils.ts)
  → 커밋: "refactor(marketing): P2-13 포맷함수 유틸화"
```

---

## 검증 체크리스트

### Wave 1
- [ ] 대시보드 1개 랜딩페이지일 때 제목 정상 표시
- [ ] sales/campaigns 테이블 아래 "더 보기" 버튼 표시
- [ ] 포맷함수 import 오류 없음
- [ ] getStatusBadge 리렌더링 횟수 감소 (DevTools 확인)
- [ ] KpiCard memo 적용 확인

### Wave 2
- [ ] 트렌드 차트 각 bar에 aria-label 존재
- [ ] 에러 발생 시 스크린리더 "alert" 역할 인식
- [ ] 바 차트 각 bar에 aria-label="{월}: {금액}"
- [ ] 캠페인명 링크 Tab 키로 focus ring 보임
- [ ] 주석 "TODO (P3)" 추가 확인

### Wave 3
- [ ] src/lib/marketing-utils.ts 파일 생성
- [ ] sales/page.tsx 에서 4개 함수 import (로컬 정의 삭제)
- [ ] npm run build 성공
- [ ] TypeScript 에러 0개

---

## 참고

**P1 해결 패턴 재사용**
- 에러 처리: network vs server 구분 (이미 적용됨)
- 접근성: scope="col" + aria-label + role (이번 확대)
- 성능: React.memo + useCallback 패턴

**P3 이후 작업**
- P2-2/4: 실제 페이지네이션 로직
- P2-12: Modal + Toast 컴포넌트
- P3 13개: 컴포넌트 추출, 타입강화, 테스트
