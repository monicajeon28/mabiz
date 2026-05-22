# Menu #25-26 마케팅 자동화/대시보드 P3 이슈 작업지시서

**작업일**: 2026-05-22  
**총 이슈**: 13개 P3  
**예상 기간**: Wave 1-4 (6시간)  
**우선순위**: 컴포넌트분리(9) > 테스트(3) > 비즈니스(1)

---

## Step 1-2: 분석 완료

P3_MARKETING_ANALYSIS.md 참고 - 13개 이슈 분류 완료

---

## Wave 1: 대시보드 컴포넌트 분리 (4개)

**목표**: page.tsx를 200줄 이하로 축소, 4개 컴포넌트 추출

### P3-1: KpiCard.tsx 신규 생성

**파일**: src/components/marketing/KpiCard.tsx (신규)

```typescript
import React from 'react';

interface KpiCardProps {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  delta?: number | null;
}

export const KpiCard = React.memo(function KpiCard({
  title,
  value,
  sub,
  icon,
  delta,
}: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-start gap-4">
      <div className="bg-navy-50 rounded-lg p-2 shrink-0">{icon}</div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-navy-900 mt-0.5">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        {delta != null && (
          <p
            className={`text-xs font-medium mt-1 ${
              delta >= 0 ? "text-green-600" : "text-red-500"
            }`}
          >
            {delta >= 0 ? "↑" : "↓"} 전월 대비 {Math.abs(delta)}%
          </p>
        )}
      </div>
    </div>
  );
});
```

**page.tsx 수정**:
```typescript
import { KpiCard } from '@/components/marketing/KpiCard';

// page.tsx에서 기존 KpiCard 함수 정의 삭제
```

---

### P3-2: TrendChart.tsx 신규 생성

**파일**: src/components/marketing/TrendChart.tsx (신규)

```typescript
import type { TrendDay } from '@/types/marketing';

interface TrendChartProps {
  trend: TrendDay[];
  loading: boolean;
}

export function TrendChart({ trend, loading }: TrendChartProps) {
  const maxCount = trend.reduce((m, d) => Math.max(m, d.count), 0) ?? 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-8">
      <h2 className="text-base font-semibold text-navy-900 mb-4">최근 7일 등록 추이</h2>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-6 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : trend.length ? (
        <div className="space-y-2">
          {trend.map((day) => (
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
        </div>
      ) : (
        <p className="text-sm text-gray-400">최근 7일 등록 데이터가 없습니다.</p>
      )}
    </div>
  );
}
```

---

### P3-3: FunnelChart.tsx 신규 생성

**파일**: src/components/marketing/FunnelChart.tsx (신규)

```typescript
import type { Summary } from '@/types/marketing';

interface FunnelChartProps {
  summary: Summary;
}

export function FunnelChart({ summary }: FunnelChartProps) {
  const steps = [
    { label: "방문", value: summary.totalViews, color: "bg-navy-600" },
    { label: "등록", value: summary.totalRegistrations, color: "bg-blue-500" },
    { label: "퍼널", value: summary.totalFunnelEntered, color: "bg-blue-400" },
    { label: "구매", value: summary.totalPurchased, color: "bg-green-500" },
  ];

  return (
    <div className="bg-white border rounded-xl p-5 mb-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">전환 퍼널</h2>
      <div className="flex items-end gap-2 h-24">
        {steps.map((step, i, arr) => {
          const max = arr[0].value || 1;
          const h = Math.max(4, Math.round(80 * step.value / max));
          const prev = i > 0 ? arr[i - 1].value : step.value;
          const rate = prev > 0 ? Math.round((step.value / prev) * 100) : 0;
          return (
            <div key={step.label} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-bold text-gray-700">
                {step.value.toLocaleString()}
              </span>
              <div className="w-full flex items-end justify-center">
                <div
                  className={`w-full ${step.color} rounded-t transition-all`}
                  style={{ height: `${h}px` }}
                />
              </div>
              <span className="text-xs text-gray-500">{step.label}</span>
              {i > 0 && (
                <span className="text-xs text-gray-400">{rate}%</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

### P3-4: TopPagesTable.tsx 신규 생성

**파일**: src/components/marketing/TopPagesTable.tsx (신규)

```typescript
import Link from 'next/link';
import type { TopPage } from '@/types/marketing';

interface TopPagesTableProps {
  topPages: TopPage[];
  loading: boolean;
}

function SkeletonLoadingRow() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
      ))}
    </div>
  );
}

export function TopPagesTable({ topPages, loading }: TopPagesTableProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <h2 className="text-base font-semibold text-navy-900 mb-4">
        상위 랜딩페이지 {topPages.length ? `TOP ${topPages.length}` : ''}
      </h2>
      {loading ? (
        <SkeletonLoadingRow />
      ) : topPages.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs border-b border-gray-100">
                <th scope="col" className="text-left font-medium pb-2 pr-4">페이지명</th>
                <th scope="col" className="text-right font-medium pb-2 px-3">방문</th>
                <th scope="col" className="text-right font-medium pb-2 px-3">등록</th>
                <th scope="col" className="text-right font-medium pb-2 px-3">전환율</th>
                <th scope="col" className="text-right font-medium pb-2 pl-3"></th>
              </tr>
            </thead>
            <tbody>
              {topPages.map((page) => (
                <tr
                  key={page.id}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-3 pr-4 font-medium text-navy-900 max-w-[200px] truncate">
                    {page.title}
                  </td>
                  <td className="py-3 px-3 text-right text-gray-600">
                    {page.viewCount.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right text-gray-600">
                    {page.registrations.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span
                      className={`font-semibold ${
                        page.conversionRate >= 5
                          ? "text-green-600"
                          : page.conversionRate >= 2
                          ? "text-yellow-600"
                          : "text-gray-400"
                      }`}
                    >
                      {page.conversionRate}%
                    </span>
                  </td>
                  <td className="py-3 pl-3 text-right">
                    <Link
                      href={`/landing-pages/${page.id}`}
                      className="text-xs text-navy-600 hover:underline whitespace-nowrap"
                    >
                      상세보기
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-400">랜딩페이지 데이터가 없습니다.</p>
      )}
    </div>
  );
}
```

**page.tsx 수정**:
```typescript
import { TrendChart } from '@/components/marketing/TrendChart';
import { FunnelChart } from '@/components/marketing/FunnelChart';
import { TopPagesTable } from '@/components/marketing/TopPagesTable';
import { SkeletonCard } from '@/components/marketing/SkeletonCard';

// page.tsx 본문에서 해당 로직 제거, 컴포넌트 호출로 대체
```

---

## Wave 2: 매출 컴포넌트 분리 + 테스트 (4개)

### P3-8: SkeletonRow.tsx 신규 생성

**파일**: src/components/marketing/SkeletonRow.tsx

```typescript
interface SkeletonRowProps {
  cols: number;
}

export function SkeletonRow({ cols }: SkeletonRowProps) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}
```

---

### P3-9: StatusBadge.tsx 신규 생성

**파일**: src/components/marketing/StatusBadge.tsx

```typescript
interface StatusBadgeProps {
  status: string;
}

const STATUS_STYLES = {
  paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
  default: 'bg-gray-100 text-gray-500',
};

const STATUS_LABELS = {
  paid: '결제완료',
  cancelled: '환불',
  default: '대기중',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status as keyof typeof STATUS_STYLES] || STATUS_STYLES.default;
  const label = STATUS_LABELS[status as keyof typeof STATUS_LABELS] || STATUS_LABELS.default;

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}
```

---

### P3-10: SalesBarChart.tsx 신규 생성

**파일**: src/components/marketing/SalesBarChart.tsx

```typescript
import { formatAmount, formatMonth } from '@/lib/marketing-utils';
import type { MonthlyRow } from '@/types/marketing';

interface SalesBarChartProps {
  monthly: MonthlyRow[];
}

export function SalesBarChart({ monthly }: SalesBarChartProps) {
  const maxRevenue = Math.max(...monthly.map((m) => m.revenue), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4">최근 6개월 매출</h2>
      <div className="flex items-end gap-3 h-40">
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
      </div>
    </div>
  );
}
```

---

### P3-11: marketing-utils.test.ts 신규 생성

**파일**: src/lib/__tests__/marketing-utils.test.ts

```typescript
import { formatAmount, formatDate, formatMonth, maskPhone } from '../marketing-utils';

describe('marketing-utils', () => {
  describe('formatAmount', () => {
    it('should format number with commas and 원', () => {
      expect(formatAmount(1000)).toBe('1,000원');
      expect(formatAmount(1000000)).toBe('1,000,000원');
      expect(formatAmount(0)).toBe('0원');
    });
  });

  describe('formatDate', () => {
    it('should format ISO date to YYYY-MM-DD', () => {
      expect(formatDate('2026-05-22T10:00:00Z')).toBe('2026-05-22');
      expect(formatDate('2026-01-01T00:00:00Z')).toBe('2026-01-01');
    });

    it('should return "-" for null/undefined', () => {
      expect(formatDate(null)).toBe('-');
      expect(formatDate(undefined as any)).toBe('-');
    });

    it('should pad single digit month/day', () => {
      expect(formatDate('2026-05-05T00:00:00Z')).toBe('2026-05-05');
    });
  });

  describe('formatMonth', () => {
    it('should format YYYY-MM to YYYY.MM', () => {
      expect(formatMonth('2026-05')).toBe('2026.05');
      expect(formatMonth('2026-12')).toBe('2026.12');
    });
  });

  describe('maskPhone', () => {
    it('should mask Korean phone numbers', () => {
      expect(maskPhone('010-1234-5678')).toBe('010-****-5678');
      expect(maskPhone('02-123-4567')).toBe('02-****-4567');
    });

    it('should mask international phone numbers', () => {
      expect(maskPhone('+1-123-456-7890')).toBe('+1-****-7890');
      expect(maskPhone('+86-138-1234-5678')).toBe('+86-****-5678');
    });

    it('should return "-" for null/undefined/short numbers', () => {
      expect(maskPhone(null)).toBe('-');
      expect(maskPhone(undefined)).toBe('-');
      expect(maskPhone('123')).toBe('-');
    });

    it('should handle phone numbers without formatting', () => {
      expect(maskPhone('01012345678')).toBe('010-****-5678');
    });
  });
});
```

---

## Wave 3: 캠페인 개선 (2개)

### P3-12: CampaignRow.tsx 신규 생성

**파일**: src/components/marketing/CampaignRow.tsx

```typescript
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Campaign } from '@/types/marketing';

interface CampaignRowProps {
  campaign: Campaign;
  isEven: boolean;
  onDelete: (id: string) => void;
  statusBadgeClassName: string;
}

export function CampaignRow({
  campaign,
  isEven,
  onDelete,
  statusBadgeClassName,
}: CampaignRowProps) {
  const statusLabel = {
    PENDING: '대기',
    SENDING: '발송 중',
    SENT: '발송 완료',
    FAILED: '실패',
    CANCELLED: '취소',
  }[campaign.status] || '';

  return (
    <tr className={isEven ? 'bg-white' : 'bg-gray-50'}>
      <td className="px-6 py-4">
        <Link
          href={`/marketing/campaigns/${campaign.id}`}
          className="text-blue-600 hover:underline font-medium focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 rounded"
        >
          {campaign.title}
        </Link>
      </td>
      <td className="px-6 py-4 text-sm">{campaign.group.name}</td>
      <td className="px-6 py-4">
        <span className={`px-2 py-1 rounded text-xs font-medium ${statusBadgeClassName}`}>
          {statusLabel}
        </span>
      </td>
      <td className="px-6 py-4 text-sm text-gray-600">
        발송 {campaign.sentCount}/{campaign.totalCount} • 열람 {campaign.openedCount} •
        클릭 {campaign.clickedCount}
      </td>
      <td className="px-6 py-4 text-sm space-x-2">
        <Link href={`/marketing/campaigns/${campaign.id}`}>
          <Button variant="outline" size="sm">
            보기
          </Button>
        </Link>
        <button
          onClick={() => onDelete(campaign.id)}
          className="text-red-600 hover:text-red-700 text-sm"
          aria-label={`${campaign.title} 캠페인 삭제`}
        >
          삭제
        </button>
      </td>
    </tr>
  );
}
```

---

### P3-13: CSRF 토큰 에러 처리

**campaigns/page.tsx 수정**:

```typescript
useEffect(() => {
  fetch('/api/csrf-token')
    .then((r) => r.json())
    .then((d) => {
      if (d.ok) setCsrfToken(d.token);
      else {
        logger.warn('[CSRF token]', { message: d.message });
        // TODO (P3): toast 또는 사용자 알림 추가
      }
    })
    .catch((err) => {
      logger.error('[CSRF token fetch]', { err });
      // TODO (P3): 에러 토스트 추가 - "보안 토큰을 불러올 수 없습니다"
    });
}, []);
```

---

## Wave 4: 테스트 추가 (2개)

### P3-5: KpiCard.test.tsx 신규 생성

**파일**: src/components/marketing/__tests__/KpiCard.test.tsx

```typescript
import { render, screen } from '@testing-library/react';
import { KpiCard } from '../KpiCard';

describe('KpiCard', () => {
  it('should render title and value', () => {
    render(
      <KpiCard
        title="테스트 KPI"
        value="1,000"
        icon={<div>📊</div>}
      />
    );
    expect(screen.getByText('테스트 KPI')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument();
  });

  it('should render sub text when provided', () => {
    render(
      <KpiCard
        title="매출"
        value="1000000"
        sub="10% 증가"
        icon={<div>💰</div>}
      />
    );
    expect(screen.getByText('10% 증가')).toBeInTheDocument();
  });

  it('should show delta indicator', () => {
    const { rerender } = render(
      <KpiCard
        title="테스트"
        value="100"
        delta={15}
        icon={<div>📈</div>}
      />
    );
    expect(screen.getByText(/전월 대비 15%/)).toBeInTheDocument();
    expect(screen.getByText('↑')).toBeInTheDocument();

    rerender(
      <KpiCard
        title="테스트"
        value="100"
        delta={-10}
        icon={<div>📈</div>}
      />
    );
    expect(screen.getByText(/전월 대비 10%/)).toBeInTheDocument();
    expect(screen.getByText('↓')).toBeInTheDocument();
  });

  it('should format numeric values with toLocaleString', () => {
    render(
      <KpiCard
        title="방문수"
        value={1234567}
        icon={<div>👥</div>}
      />
    );
    expect(screen.getByText('1,234,567')).toBeInTheDocument();
  });

  it('should not render delta when delta is null', () => {
    render(
      <KpiCard
        title="테스트"
        value="100"
        delta={null}
        icon={<div>📊</div>}
      />
    );
    expect(screen.queryByText(/전월 대비/)).not.toBeInTheDocument();
  });
});
```

---

### P3-7: 자동 새로고침 기능 (비즈니스 의사결정 필요)

**현재**: 수동 새로고침만 가능 (RefreshCw 버튼)

**옵션 A**: 30초 자동 새로고침 (권장 아님 - 과도한 API 호출)
**옵션 B**: 탭 변경 시 새로고침 (권장 - visibility API 사용)
**옵션 C**: 설정에서 사용자 선택 (권장 - 유연함)

---

## 구현 순서

```
Wave 1 (4개 컴포넌트)
├─ P3-1: KpiCard.tsx (15분)
├─ P3-2: TrendChart.tsx (15분)
├─ P3-3: FunnelChart.tsx (15분)
└─ P3-4: TopPagesTable.tsx (20분)
  → page.tsx import 통합 (10분)
  → 커밋: "refactor(marketing): Dashboard 컴포넌트 분리 (Wave 1)"

Wave 2 (4개 컴포넌트 + 테스트)
├─ P3-8: SkeletonRow.tsx (5분)
├─ P3-9: StatusBadge.tsx (10분)
├─ P3-10: SalesBarChart.tsx (15분)
├─ P3-11: marketing-utils.test.ts (30분)
  → sales/page.tsx import 통합 (10분)
  → 커밋: "refactor(marketing): Sales 컴포넌트 분리 + 테스트 (Wave 2)"

Wave 3 (2개 개선)
├─ P3-12: CampaignRow.tsx (15분)
├─ P3-13: CSRF 에러 처리 (5분)
  → campaigns/page.tsx 통합 (5분)
  → 커밋: "refactor(marketing): Campaign 컴포넌트 + 에러처리 (Wave 3)"

Wave 4 (1개 테스트 + 의사결정)
├─ P3-5: KpiCard.test.tsx (30분)
└─ P3-7: 자동 새로고침 (의사결정 필요)
  → 커밋: "test(marketing): KpiCard 단위 테스트 (Wave 4)"
```

---

## 검증 체크리스트

### Wave 1 후
- [ ] page.tsx 200줄 이하로 축소
- [ ] 4개 컴포넌트 파일 생성
- [ ] import 경로 오류 없음
- [ ] npm run build 성공 (예정)

### Wave 2 후
- [ ] sales/page.tsx 300줄 이하로 축소
- [ ] 4개 컴포넌트 파일 생성
- [ ] marketing-utils.test.ts 실행 성공
- [ ] 테스트 커버리지 60% 이상

### Wave 3 후
- [ ] campaigns/page.tsx CampaignRow 분리
- [ ] CSRF 에러 처리 로직 추가
- [ ] 모든 파일 TypeScript 검증 통과

### Wave 4 후
- [ ] KpiCard.test.tsx 모든 케이스 통과
- [ ] 테스트 러너 성공
- [ ] 자동 새로고침 의사결정 (추후 구현)

---

## 참고

**P2 적용 패턴 재사용**
- React.memo (성능)
- aria-label (접근성)
- 오류 처리

**신규 패턴**
- 컴포넌트 분리 (재사용성)
- 타입 인터페이스 명시 (타입 안전)
- 테스트 작성 (품질)
