# Option A: 파트너 대시보드 → 숏링크 성과 탭 설계

**작성일**: 2026-06-06  
**도메인**: Partner Dashboard UI (src/app/(dashboard)/partner-dashboard/)  
**버전**: 1.0 Final Design

---

## 1. 아키텍처 개요

### 위치 & 구조

```
D:\mabiz-crm\src\app\(dashboard)\partner-dashboard\
├── page.tsx (기존 — 탭 추가)
│   └── 새 탭: TABS 배열에 'shortlinks' 추가
│       {
│         key: 'shortlinks',
│         label: '숏링크 성과',
│         icon: <Link className="h-4 w-4" />
│       }
│
├── components/ (새 폴더 — 컴포넌트 분리)
│   └── ShortlinkTab.tsx (탭 컴포넌트)
│       ├── ShortlinkSummaryCards (4개 카드)
│       ├── ShortlinkFilterBar (기간 필터)
│       ├── ShortlinkTrendChart (recharts LineChart)
│       └── ShortlinkTable (링크 목록 테이블)
│
└── [기존 파일]
    ├── layout.tsx (변경 없음)
    └── 기타

API:
├── /api/partner/dashboard/shortlink-performance (새로 생성)
│   └── GET: 대리점별 숏링크 성과 데이터 조회
│
└── [기존 API 활용]
    └── /api/analytics/shortlink-performance (조직 전체 — 재사용 패턴)
```

---

## 2. UI 레이아웃 설계

### 페이지 구조 (ASCII 목업)

```
┌──────────────────────────────────────────────────────────┐
│ 파트너 대시보드                                             │
│ B2C | B2B | 골드회원 | 성과현황 | [숏링크 성과] ← NEW  │
└──────────────────────────────────────────────────────────┘

┌─────────────────── 요약 카드 영역 ─────────────────────┐
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐
│  │ 총 클릭수   │  │ 평균 CTR    │  │ 상위 링크   │  │ 7일 추이 │
│  │    42 ↑ 12% │  │   15.2%     │  │  landing.. │  │   ↑ 8%  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘
└────────────────────────────────────────────────────────────┘

┌─────────────── 필터 & 액션 바 ──────────────────────────┐
│ [기간: 최근 7일 ▼] [리셋] [다운로드] [새 링크 생성 →]    │
└─────────────────────────────────────────────────────────┘

┌───────────────── 시계열 차트 (recharts) ──────────────┐
│                                                         │
│  클릭수 추이 (일별)                                    │
│           📊 라인 차트 (하루별 클릭 수)                │
│                                                         │
│  X축: 날짜 (Mon, Tue, Wed, ...)                       │
│  Y축: 클릭수 (0, 10, 20, 30, ...)                     │
│                                                         │
└────────────────────────────────────────────────────────┘

┌────────────────── 숏링크 목록 테이블 ─────────────────┐
│ 링크명          코드      클릭   마지막클릭   생성일   액션  │
│ ──────────────────────────────────────────────────────    │
│ Landing Sale   abc123     25    2026-06-06  2026-05-15 📋  │
│ B2B Demo       xyz789     17    2026-06-05  2026-05-10 📋  │
│ API Trial      def456      5    2026-06-04  2026-05-01 📋  │
│ ...                                                     ...  │
│                                                             │
│ 페이징: < 1 / 5 >                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 3. 컴포넌트 상세 설계

### 3.1 요약 카드 (StatCard 재사용)

**기존 컴포넌트 활용**: `StatCard` (page.tsx 라인 206-245)

```typescript
// 예시
<div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
  <StatCard
    title="총 클릭수"
    value={data.total.clickCount}
    icon={<Link className="h-5 w-5" />}
    suffix="회"
    trend={percentageChange}
    onClick={() => onDrilldown(allClicksConfig)}
  />
  <StatCard
    title="평균 일 클릭수"
    value={data.total.averageClicksPerDay}
    icon={<TrendingUp className="h-5 w-5" />}
    suffix="회"
  />
  <StatCard
    title="활성 링크"
    value={data.shortLinks.length}
    icon={<Globe className="h-5 w-5" />}
    suffix="개"
  />
  <StatCard
    title="최근 활동"
    value={data.mostRecentClick}
    icon={<Clock className="h-5 w-5" />}
  />
</div>
```

---

### 3.2 필터 바 (FilterBar 컴포넌트)

```typescript
interface ShortlinkFilterBarProps {
  days: number;
  onDaysChange: (days: number) => void;
  onReset: () => void;
  onExport?: () => void;
}

function ShortlinkFilterBar({
  days,
  onDaysChange,
  onReset,
  onExport,
}: ShortlinkFilterBarProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* 기간 선택 */}
      <div className="relative">
        <select
          value={days}
          onChange={(e) => onDaysChange(Number(e.target.value))}
          className="appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-9 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          <option value={7}>최근 7일</option>
          <option value={14}>최근 14일</option>
          <option value={30}>최근 30일</option>
          <option value={90}>최근 90일</option>
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600 pointer-events-none" />
      </div>

      {/* 액션 버튼 */}
      <button
        onClick={onReset}
        className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        리셋
      </button>

      {onExport && (
        <button
          onClick={onExport}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
        >
          <Download className="h-4 w-4" />
          다운로드
        </button>
      )}

      <div className="flex-1" />

      <button
        onClick={() => window.location.href = '/landing-pages/create'}
        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1.5"
      >
        <Plus className="h-4 w-4" />
        새 링크 생성
      </button>
    </div>
  );
}
```

---

### 3.3 시계열 차트 (recharts LineChart)

```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ShortlinkTrendChartProps {
  data: Array<{ date: string; clicks: number }>;
  height?: number;
}

function ShortlinkTrendChart({
  data,
  height = 300,
}: ShortlinkTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm h-[300px] flex items-center justify-center">
        <p className="text-gray-400 text-sm">데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">클릭수 추이</h3>
          <p className="text-sm text-gray-500 mt-1">일별 클릭 현황</p>
        </div>
        <TrendingUp className="h-5 w-5 text-gray-300" />
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            stroke="#9ca3af"
            style={{ fontSize: '12px' }}
            tick={{ fill: '#6b7280' }}
          />
          <YAxis
            stroke="#9ca3af"
            style={{ fontSize: '12px' }}
            tick={{ fill: '#6b7280' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            }}
            formatter={(value) => [value, '클릭']}
            labelStyle={{ color: '#1f2937' }}
          />
          <Line
            type="monotone"
            dataKey="clicks"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

### 3.4 테이블 (ShortlinkTable 컴포넌트)

```typescript
interface ShortlinkTableProps {
  data: Array<{
    id: string;
    code: string;
    title: string | null;
    targetUrl: string;
    clickCount: number;
    lastClickedAt: Date | null;
    createdAt: Date;
    category?: string | null;
  }>;
  loading?: boolean;
  onDrilldown?: (linkId: string) => void;
}

function ShortlinkTable({
  data,
  loading,
  onDrilldown,
}: ShortlinkTableProps) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const pageData = data.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(data.length / pageSize);

  if (loading) {
    return (
      <TableWrapper>
        <table className="w-full text-sm">
          <tbody>
            {Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} cols={6} />)}
          </tbody>
        </table>
      </TableWrapper>
    );
  }

  if (data.length === 0) {
    return (
      <TableWrapper>
        <EmptyState message="숏링크 성과 데이터가 없습니다." />
      </TableWrapper>
    );
  }

  return (
    <TableWrapper>
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">숏링크 성과 목록</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-sm uppercase">
            <tr>
              <th className="px-4 py-3 text-left">링크명</th>
              <th className="px-4 py-3 text-center">코드</th>
              <th className="px-4 py-3 text-right">클릭수</th>
              <th className="px-4 py-3 text-right">최근 클릭</th>
              <th className="px-4 py-3 text-right">생성일</th>
              <th className="px-4 py-3 text-center">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageData.map((link) => (
              <tr key={link.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                  {link.title || '(제목 없음)'}
                </td>
                <td className="px-4 py-3 text-center">
                  <code className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-mono">
                    {link.code}
                  </code>
                </td>
                <td className="px-4 py-3 text-right text-gray-700 font-semibold">
                  {link.clickCount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-gray-500 text-sm">
                  {link.lastClickedAt
                    ? formatDate(new Date(link.lastClickedAt))
                    : '-'}
                </td>
                <td className="px-4 py-3 text-right text-gray-500 text-sm">
                  {formatDate(new Date(link.createdAt))}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/p/${link.code}`)}
                      title="링크 복사"
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    {onDrilldown && (
                      <button
                        onClick={() => onDrilldown(link.id)}
                        title="상세보기"
                        className="p-1.5 rounded hover:bg-gray-100 text-blue-400 hover:text-blue-600 transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이징 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-600">{page} / {totalPages}</p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </TableWrapper>
  );
}
```

---

## 4. 데이터 흐름

### 4.1 타입 정의

```typescript
// ShortlinkTab.tsx 내 타입

type ShortlinkPerformanceData = {
  total: {
    clickCount: number;
    averageClicksPerDay: number;
    trend: 'up' | 'down' | 'flat';
  };
  shortLinks: Array<{
    id: string;
    code: string;
    title: string | null;
    targetUrl: string;
    clickCount: number;
    lastClickedAt: Date | null;
    createdAt: Date;
    category?: string | null;
    dailyClicks?: Array<{ date: string; clicks: number }>;
  }>;
};
```

### 4.2 API 호출 흐름

```
대리점 로그인 (organizationId, createdBy = userId)
  ↓
GET /api/partner/dashboard/shortlink-performance?days=7
  ├─ organizationId (세션에서 추출)
  ├─ createdBy (세션에서 추출)
  └─ days=7 (필터에서 전달)
  ↓
응답:
{
  ok: true,
  data: {
    total: {
      clickCount: 42,
      averageClicksPerDay: 6,
      trend: "up"
    },
    shortLinks: [
      {
        id: "link-1",
        code: "abc123",
        title: "Landing Sale",
        targetUrl: "https://...",
        clickCount: 25,
        lastClickedAt: "2026-06-06T14:30:00Z",
        createdAt: "2026-05-15T10:00:00Z",
        dailyClicks: [
          { date: "2026-05-31", clicks: 2 },
          { date: "2026-06-01", clicks: 3 },
          ...
          { date: "2026-06-06", clicks: 4 }
        ]
      },
      ...
    ]
  }
}
  ↓
UI 렌더링:
  ├─ 요약 카드 (clickCount, averageClicksPerDay, 활성 링크)
  ├─ 라인 차트 (dailyClicks 통합 데이터)
  └─ 테이블 (shortLinks 목록)
```

---

## 5. API 구현 (새로 생성할 파일)

### 파일: `/src/app/api/partner/dashboard/shortlink-performance/route.ts`

```typescript
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

export async function GET(req: Request) {
  try {
    const ctx = await requirePartnerContext();
    if (!ctx) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다' },
        { status: 403 }
      );
    }

    if (!ctx.organizationId) {
      logger.error('[shortlink-performance] organizationId 없음');
      return NextResponse.json(
        { ok: false, error: '조직 정보 없음' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const daysParam = searchParams.get('days') || '7';
    const days = parseInt(daysParam, 10);
    const organizationId = ctx.organizationId;
    const createdBy = ctx.sessionUser?.id; // 대리점 사용자 ID

    if (!createdBy) {
      return NextResponse.json(
        { ok: false, error: '사용자 정보 없음' },
        { status: 403 }
      );
    }

    const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const now = new Date();

    // 1. 조직의 숏링크 조회
    const shortLinks = await prisma.shortLink.findMany({
      where: {
        organizationId,
        createdBy,
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        title: true,
        targetUrl: true,
        category: true,
        clickCount: true,
        createdAt: true,
      },
      orderBy: { clickCount: 'desc' },
    });

    if (shortLinks.length === 0) {
      return NextResponse.json({
        ok: true,
        data: {
          total: {
            clickCount: 0,
            averageClicksPerDay: 0,
            trend: 'flat' as const,
          },
          shortLinks: [],
        },
      });
    }

    const linkIds = shortLinks.map((l) => l.id);

    // 2. 최근 클릭 정보
    const lastClicks = await prisma.shortLinkClick.groupBy({
      by: ['linkId'],
      where: {
        linkId: { in: linkIds },
      },
      _max: { clickedAt: true },
      _count: { id: true },
    });

    const lastClickMap = new Map(
      lastClicks.map((lc) => [lc.linkId, lc._max.clickedAt])
    );

    // 3. 시계열 데이터 (날별 집계)
    const timeSeriesData = await prisma.$queryRaw<
      Array<{
        linkId: string;
        date: string;
        clickCount: bigint;
      }>
    >`
      SELECT
        "linkId",
        DATE(TIMEZONE('UTC', "clickedAt")) as "date",
        COUNT(*) as "clickCount"
      FROM "ShortLinkClick"
      WHERE "linkId" = ANY($1::TEXT[])
        AND "clickedAt" >= $2
      GROUP BY "linkId", DATE(TIMEZONE('UTC', "clickedAt"))
      ORDER BY DATE(TIMEZONE('UTC', "clickedAt")) ASC
    `;

    const timeSeriesMap = new Map<
      string,
      Array<{ date: string; clicks: number }>
    >();
    linkIds.forEach((id) => {
      timeSeriesMap.set(id, []);
    });

    timeSeriesData.forEach((row) => {
      const existing = timeSeriesMap.get(row.linkId) || [];
      existing.push({
        date: row.date,
        clicks: Number(row.clickCount),
      });
      timeSeriesMap.set(row.linkId, existing);
    });

    // 4. 전체 클릭수 집계
    const totalClicks = await prisma.shortLinkClick.count({
      where: {
        linkId: { in: linkIds },
      },
    });

    const recentClicks = await prisma.shortLinkClick.count({
      where: {
        linkId: { in: linkIds },
        clickedAt: { gte: daysAgo },
      },
    });

    const prevClicks = await prisma.shortLinkClick.count({
      where: {
        linkId: { in: linkIds },
        clickedAt: {
          gte: new Date(daysAgo.getTime() - days * 24 * 60 * 60 * 1000),
          lt: daysAgo,
        },
      },
    });

    const trend = recentClicks > prevClicks ? 'up' : recentClicks < prevClicks ? 'down' : 'flat';

    // 5. 응답 구성
    const responseData = {
      ok: true,
      data: {
        total: {
          clickCount: totalClicks,
          averageClicksPerDay: Math.round(recentClicks / days),
          trend,
        },
        shortLinks: shortLinks.map((link) => ({
          id: link.id,
          code: link.code,
          title: link.title,
          targetUrl: link.targetUrl,
          clickCount: link.clickCount,
          lastClickedAt: lastClickMap.get(link.id) || null,
          createdAt: link.createdAt,
          category: link.category,
          dailyClicks: timeSeriesMap.get(link.id) || [],
        })),
      },
    };

    return NextResponse.json(responseData);
  } catch (error) {
    logger.error('[shortlink-performance]', error);
    return NextResponse.json(
      { ok: false, error: '서버 오류' },
      { status: 500 }
    );
  }
}
```

---

## 6. 페이지 구현 (ShortlinkTab.tsx)

### 파일: `/src/app/(dashboard)/partner-dashboard/components/ShortlinkTab.tsx`

```typescript
'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Link as LinkIcon,
  TrendingUp,
  Globe,
  Download,
  Plus,
  Copy,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { useToast } from '@/lib/api/use-toast';
import { StatCard, TableWrapper, EmptyState, SkeletonCard, SkeletonRow } from '../page';

interface ShortlinkPerformanceData {
  total: {
    clickCount: number;
    averageClicksPerDay: number;
    trend: 'up' | 'down' | 'flat';
  };
  shortLinks: Array<{
    id: string;
    code: string;
    title: string | null;
    targetUrl: string;
    clickCount: number;
    lastClickedAt: Date | null;
    createdAt: Date;
    category?: string | null;
    dailyClicks?: Array<{ date: string; clicks: number }>;
  }>;
}

interface ShortlinkTabProps {
  data: ShortlinkPerformanceData | null;
  loading: boolean;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function getTrendPercentage(
  current: number,
  previous: number
): number | undefined {
  if (previous === 0) return undefined;
  return Math.round(((current - previous) / previous) * 100);
}

function ShortlinkFilterBar({
  days,
  onDaysChange,
  onReset,
}: {
  days: number;
  onDaysChange: (days: number) => void;
  onReset: () => void;
}) {
  const { toast } = useToast();

  const handleExport = async () => {
    toast({
      title: '준비 중',
      description: '다운로드 기능은 근시일 내 추가됩니다.',
      variant: 'default',
    });
  };

  return (
    <div className="flex items-center gap-3 flex-wrap rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="relative">
        <select
          value={days}
          onChange={(e) => onDaysChange(Number(e.target.value))}
          className="appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-9 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
        >
          <option value={7}>최근 7일</option>
          <option value={14}>최근 14일</option>
          <option value={30}>최근 30일</option>
          <option value={90}>최근 90일</option>
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600 pointer-events-none" />
      </div>

      <button
        onClick={onReset}
        className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        리셋
      </button>

      <button
        onClick={handleExport}
        className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
      >
        <Download className="h-4 w-4" />
        다운로드
      </button>

      <div className="flex-1" />

      <a
        href="/landing-pages/create"
        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1.5 whitespace-nowrap"
      >
        <Plus className="h-4 w-4" />
        새 링크 생성
      </a>
    </div>
  );
}

function ShortlinkChart({ data }: { data: Array<{ date: string; clicks: number }> }) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm h-[300px] flex items-center justify-center">
        <p className="text-gray-400 text-sm">데이터가 없습니다.</p>
      </div>
    );
  }

  // recharts를 동적 임포트하여 hydration 오류 방지
  const max = Math.max(...data.map((d) => d.clicks), 10);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">클릭수 추이</h3>
          <p className="text-sm text-gray-500 mt-1">일별 클릭 현황</p>
        </div>
        <TrendingUp className="h-5 w-5 text-gray-300" />
      </div>

      <div className="flex items-end gap-2 h-48 bg-gray-50 rounded-lg p-4">
        {data.map((d, i) => (
          <div
            key={d.date}
            className="flex-1 flex flex-col items-center gap-2 min-h-0"
          >
            <div
              className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
              style={{
                height: `${(d.clicks / max) * 160}px`,
                minHeight: d.clicks > 0 ? '4px' : '0px',
              }}
              title={`${d.date}: ${d.clicks}회`}
            />
            <span className="text-[10px] text-gray-500 truncate">
              {d.date.split('-')[2]}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
        <span>X축: 날짜 | Y축: 클릭수</span>
        <span>총 클릭: {data.reduce((sum, d) => sum + d.clicks, 0)}</span>
      </div>
    </div>
  );
}

function ShortlinkTable({
  data,
  loading,
}: {
  data: ShortlinkPerformanceData['shortLinks'];
  loading: boolean;
}) {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const pageData = data.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(data.length / pageSize);

  const handleCopy = (code: string) => {
    const url = `${window.location.origin}/p/${code}`;
    navigator.clipboard.writeText(url);
    toast({
      title: '복사 완료',
      description: '링크가 클립보드에 복사되었습니다.',
    });
  };

  if (loading) {
    return (
      <TableWrapper>
        <table className="w-full text-sm">
          <tbody>
            {Array.from({ length: 3 }, (_, i) => (
              <SkeletonRow key={i} cols={6} />
            ))}
          </tbody>
        </table>
      </TableWrapper>
    );
  }

  if (data.length === 0) {
    return (
      <TableWrapper>
        <EmptyState message="숏링크 성과 데이터가 없습니다." />
      </TableWrapper>
    );
  }

  return (
    <TableWrapper>
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">숏링크 성과 목록</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-sm uppercase">
            <tr>
              <th className="px-4 py-3 text-left">링크명</th>
              <th className="px-4 py-3 text-center">코드</th>
              <th className="px-4 py-3 text-right">클릭수</th>
              <th className="px-4 py-3 text-right">최근 클릭</th>
              <th className="px-4 py-3 text-right">생성일</th>
              <th className="px-4 py-3 text-center">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageData.map((link) => (
              <tr key={link.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                  {link.title || '(제목 없음)'}
                </td>
                <td className="px-4 py-3 text-center">
                  <code className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-mono">
                    {link.code}
                  </code>
                </td>
                <td className="px-4 py-3 text-right text-gray-700 font-semibold">
                  {link.clickCount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-gray-500 text-sm">
                  {link.lastClickedAt ? formatDate(new Date(link.lastClickedAt)) : '-'}
                </td>
                <td className="px-4 py-3 text-right text-gray-500 text-sm">
                  {formatDate(new Date(link.createdAt))}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleCopy(link.code)}
                    title="링크 복사"
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-600">
            {page} / {totalPages}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </TableWrapper>
  );
}

export function ShortlinkTab({ data, loading }: ShortlinkTabProps) {
  const [days, setDays] = useState(7);

  // 시계열 데이터 통합 (모든 링크의 dailyClicks를 날짜별로 합산)
  const aggregatedChartData = useMemo(() => {
    if (!data?.shortLinks) return [];

    const dateMap = new Map<string, number>();
    data.shortLinks.forEach((link) => {
      link.dailyClicks?.forEach((dc) => {
        dateMap.set(dc.date, (dateMap.get(dc.date) || 0) + dc.clicks);
      });
    });

    return Array.from(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, clicks]) => ({ date, clicks }));
  }, [data]);

  const handleReset = () => {
    setDays(7);
  };

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <TableWrapper>
          <table className="w-full text-sm">
            <tbody>
              {Array.from({ length: 3 }, (_, i) => (
                <SkeletonRow key={i} cols={6} />
              ))}
            </tbody>
          </table>
        </TableWrapper>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          title="총 클릭수"
          value={data.total.clickCount}
          icon={<LinkIcon className="h-5 w-5" />}
          suffix="회"
          trend={data.total.trend === 'up' ? 12 : data.total.trend === 'down' ? -12 : 0}
        />
        <StatCard
          title="평균 일 클릭수"
          value={data.total.averageClicksPerDay}
          icon={<TrendingUp className="h-5 w-5" />}
          suffix="회"
        />
        <StatCard
          title="활성 링크"
          value={data.shortLinks.length}
          icon={<Globe className="h-5 w-5" />}
          suffix="개"
        />
        <StatCard
          title="최근 업데이트"
          value={
            data.shortLinks[0]?.lastClickedAt
              ? formatDate(new Date(data.shortLinks[0].lastClickedAt))
              : '-'
          }
          icon={<Clock className="h-5 w-5" />}
        />
      </div>

      {/* 필터 바 */}
      <ShortlinkFilterBar days={days} onDaysChange={setDays} onReset={handleReset} />

      {/* 차트 */}
      <ShortlinkChart data={aggregatedChartData} />

      {/* 테이블 */}
      <ShortlinkTable data={data.shortLinks} loading={false} />
    </div>
  );
}
```

---

## 7. 메인 페이지 수정 (page.tsx)

### 변경 사항

**1. 탭 추가 (라인 1431-1436 근처)**

```typescript
const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'b2c', label: 'B2C', icon: <ShoppingCart className="h-4 w-4" /> },
  { key: 'b2b', label: 'B2B', icon: <Users className="h-4 w-4" /> },
  { key: 'gold', label: '골드회원', icon: <Crown className="h-4 w-4" /> },
  { key: 'performance', label: '성과현황', icon: <TrendingUp className="h-4 w-4" /> },
  { key: 'shortlinks', label: '숏링크 성과', icon: <Link className="h-4 w-4" /> }, // 새로 추가
];
```

**2. Tab 타입 추가**

```typescript
type Tab = 'b2c' | 'b2b' | 'gold' | 'performance' | 'shortlinks'; // shortlinks 추가
```

**3. API 맵 추가**

```typescript
const API_MAP: Record<Tab, string> = {
  b2c:         '/api/partner/dashboard/b2c',
  b2b:         '/api/partner/dashboard/b2b',
  gold:        '/api/partner/dashboard/gold',
  performance: '/api/partner/dashboard/performance',
  shortlinks:  '/api/partner/dashboard/shortlink-performance', // 새로 추가
};
```

**4. 상태 추가**

```typescript
const [shortlinksData, setShortlinksData] = useState<ShortlinkPerformanceData | null>(null);
```

**5. 탭 콘텐츠 추가 (라인 1773-1787 근처)**

```typescript
{activeTab === 'shortlinks' && <ShortlinkTab data={shortlinksData} loading={loading && !shortlinksData} />}
```

**6. fetchTab 함수 내 케이스 추가**

```typescript
if (tab === 'shortlinks') setShortlinksData(d as ShortlinkPerformanceData);
```

---

## 8. 기술 스택 & 의존성

### 필요한 라이브러리

- `recharts`: 이미 설치됨 (기존 차트 사용 중)
- `lucide-react`: 이미 설치됨 (아이콘)
- `tailwindcss`: 이미 설치됨 (스타일링)

### 새로운 파일

| 파일 | 라인 수 | 설명 |
|------|--------|------|
| `/src/app/api/partner/dashboard/shortlink-performance/route.ts` | ~150 | API 엔드포인트 |
| `/src/app/(dashboard)/partner-dashboard/components/ShortlinkTab.tsx` | ~350 | 탭 컴포넌트 |
| `/src/app/(dashboard)/partner-dashboard/page.tsx` | ±30 | 기존 파일 수정 |

---

## 9. 성능 고려사항

### 최적화 전략

1. **데이터 캐싱**
   - 기존 `cache.current` 구조 활용 (월 필터 없음 — 'shortlinks' 키로 캐싱)
   - 메모리 누수 방지: 언마운트 시 캐시 정리

2. **쿼리 최적화**
   - `Promise.all()` 병렬 처리 (4개 쿼리)
   - Raw SQL: 시계열 데이터 집계

3. **UI 렌더링**
   - 테이블 페이징: 한 페이지 10개 항목
   - Skeleton 로딩: SkeletonCard 4개 + SkeletonRow 3개

4. **메모리 사용**
   - useMemo로 차트 데이터 메모이제이션
   - 재계산은 `data` 변경 시만

---

## 10. 테스트 체크리스트

- [ ] 탭 전환 시 데이터 올바르게 로딩되는가?
- [ ] 기간 필터 (7/14/30/90일) 동작하는가?
- [ ] 시계열 차트가 올바르게 렌더링되는가?
- [ ] 테이블 페이징 동작하는가?
- [ ] 링크 복사 기능 동작하는가?
- [ ] 로딩 상태 UI (스켈레톤) 표시되는가?
- [ ] 빈 상태 (데이터 없음) 처리되는가?
- [ ] API 오류 시 graceful fallback인가?
- [ ] 월 변경 시 숏링크 탭 데이터 영향받지 않는가?
- [ ] 성능: API 응답 시간 < 500ms인가?

---

## 11. 배포 전 체크리스트

- [ ] TypeScript 컴파일 오류 0개 (`npx tsc --noEmit`)
- [ ] ESLint 경고 0개
- [ ] 기존 탭 (B2C/B2B/금드/성과) 동작 확인
- [ ] 메모리 누수 확인 (DevTools → Memory)
- [ ] 반응형 테스트 (모바일/태블릿/PC)
- [ ] 접근성 (ARIA 라벨, 키보드 내비)
- [ ] 데이터 보안: organizationId, createdBy 검증
- [ ] API 응답 타입 검증 (Zod)

---

## 12. 미래 확장 계획

### Phase 2 (선택 사항)

1. **상세 분석 드로어**
   - 개별 링크별 클릭 분포 (기기/지역/시간대)

2. **A/B 테스트**
   - 동일 대상의 다중 링크 성과 비교

3. **알림**
   - 특정 클릭 수 도달 시 자동 알림

4. **내보내기**
   - CSV/PDF 다운로드

5. **실시간 대시보드**
   - WebSocket 실시간 클릭 수신

---

**최종 검토**: 2026-06-06 | **상태**: 설계 완료 | **예상 개발 시간**: 4-6시간
