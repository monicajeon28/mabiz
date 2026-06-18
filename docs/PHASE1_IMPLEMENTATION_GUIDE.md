# Phase 1 구현 가이드 (초등학생 수준 지시서)

## 🎯 목표
이 문서를 따라가면 **구현자가 복사-붙여넣기만 해도 완성**되도록 함.

---

## 📁 Part A: API 2개 만들기

### A-1. `/api/marketing/sales/branch` 만들기 (대리점장용)

**파일명**: `D:\mabiz-crm\src\app\api\marketing\sales\branch\route.ts` (신규)

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMabizSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { maskPhone } from "@/lib/marketing-utils";
import type { OrgBreakdown, RecentRow, SalesSummary, LandingRow } from "@/types/marketing";

// [BRANCH-API-001] 대리점장(BRANCH_MANAGER) 전용 API
// 자신의 조직에 소속된 판매원들의 매출만 조회

interface AgentSalesRow {
  agentId: string;
  agentName: string;
  revenue: number;
  count: number;
}

function maskCustomerName(name: string | null | undefined): string {
  if (!name) return '-';
  if (name.length <= 1) return name;
  return name[0] + '*'.repeat(Math.min(name.length - 1, 3));
}

export async function GET(req: NextRequest) {
  try {
    // 1️⃣ 역할 확인
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    
    // [BRANCH-API-002] BRANCH_MANAGER만 허용
    if (ctx.role !== 'BRANCH_MANAGER') {
      return NextResponse.json({ ok: false, message: '접근 권한이 없습니다.' }, { status: 403 });
    }
    
    // [BRANCH-API-003] organizationId 필수
    if (!ctx.organizationId) {
      return NextResponse.json({ ok: false, message: '조직 정보가 없습니다.' }, { status: 403 });
    }

    const orgId = ctx.organizationId;

    // 2️⃣ 페이지네이션 파라미터
    const page  = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10)));
    const skip  = (page - 1) * limit;

    // 3️⃣ KST 시간대 설정
    const KST_OFFSET     = 9 * 60 * 60 * 1000;
    const nowUTC         = new Date();
    const nowKST         = new Date(nowUTC.getTime() + KST_OFFSET);
    const thisMonthStart = new Date(Date.UTC(nowKST.getUTCFullYear(), nowKST.getUTCMonth(), 1) - KST_OFFSET);
    const thisMonthEnd   = new Date(Date.UTC(nowKST.getUTCFullYear(), nowKST.getUTCMonth() + 1, 1) - KST_OFFSET);
    const sixMonthsAgo   = new Date(Date.UTC(nowKST.getUTCFullYear(), nowKST.getUTCMonth() - 5, 1) - KST_OFFSET);
    const now = nowKST;

    // 4️⃣ 전체 건수 조회 (페이지네이션)
    type CountRow = { total: number | bigint };
    const countRows: CountRow[] = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::int AS total
      FROM "CrmPayAppPayment" pp
      INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
      WHERE af."organizationId" = ${orgId}::uuid
        AND pp."createdAt" >= ${sixMonthsAgo}
    `;
    const totalCount = Number(countRows[0]?.total ?? 0);
    const totalPages = Math.ceil(totalCount / limit);

    // 5️⃣ 최근 결제 목록
    type RawPayment = {
      orderId: string;
      amount: number | bigint;
      status: string;
      customerName: string | null;
      customerPhone: string | null;
      landingPageId: string | null;
      paidAt: Date | null;
    };
    const rawPage: RawPayment[] = await prisma.$queryRaw<RawPayment[]>`
      SELECT pp."orderId", pp."amount", pp."status",
             pp."customerName", pp."customerPhone",
             pp."landingPageId", pp."paidAt"
      FROM "CrmPayAppPayment" pp
      INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
      WHERE af."organizationId" = ${orgId}::uuid
        AND pp."createdAt" >= ${sixMonthsAgo}
      ORDER BY pp."createdAt" DESC
      LIMIT ${limit} OFFSET ${skip}
    `;

    // 6️⃣ 월별 집계
    type RawMonthly = { month: Date; revenue: number | bigint; count: number | bigint };
    const rawMonthly: RawMonthly[] = await prisma.$queryRaw<RawMonthly[]>`
      SELECT DATE_TRUNC('month', pp."createdAt") AS month,
             SUM(pp."amount")::float AS revenue,
             COUNT(*)::int AS count
      FROM "CrmPayAppPayment" pp
      INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
      WHERE af."organizationId" = ${orgId}::uuid
        AND pp."status" = 'paid'
        AND pp."createdAt" >= ${sixMonthsAgo}
      GROUP BY 1
      ORDER BY 1
    `;

    const monthlyMap: Record<string, { revenue: number; count: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      monthlyMap[key] = { revenue: 0, count: 0 };
    }
    for (const row of rawMonthly) {
      const d   = row.month instanceof Date ? row.month : new Date(row.month);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      monthlyMap[key] = { revenue: Number(row.revenue), count: Number(row.count) };
    }
    const monthly = Object.entries(monthlyMap).map(([m, v]) => ({
      month:   m,
      revenue: v.revenue,
      count:   v.count,
    }));

    // 7️⃣ 이번 달 요약
    const monthKey    = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const thisMonth   = monthlyMap[monthKey] ?? { revenue: 0, count: 0 };

    type SumRow = { total: number | bigint | null };
    const refundRows: SumRow[] = await prisma.$queryRaw<SumRow[]>`
      SELECT SUM(pp."amount")::float AS total
      FROM "CrmPayAppPayment" pp
      INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
      WHERE af."organizationId" = ${orgId}::uuid
        AND pp."status" = 'cancelled'
        AND pp."createdAt" >= ${thisMonthStart}
        AND pp."createdAt" < ${thisMonthEnd}
    `;

    const totalRevenue = thisMonth.revenue;
    const totalRefund  = Number(refundRows[0]?.total ?? 0);
    const paidCount    = thisMonth.count;
    const summary = {
      totalRevenue,
      totalRefund,
      netRevenue: totalRevenue - totalRefund,
      paidCount,
      month: monthKey,
    };

    // 8️⃣ 랜딩페이지별 매출
    type RawByLanding = {
      landingPageId: string | null;
      revenue: number | bigint;
      count: number | bigint;
    };
    const rawByLanding: RawByLanding[] = await prisma.$queryRaw<RawByLanding[]>`
      SELECT pp."landingPageId",
             SUM(pp."amount")::float AS revenue,
             COUNT(*)::int AS count
      FROM "CrmPayAppPayment" pp
      INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
      WHERE af."organizationId" = ${orgId}::uuid
        AND pp."status" = 'paid'
        AND pp."createdAt" >= ${sixMonthsAgo}
      GROUP BY pp."landingPageId"
    `;

    const landingIds = rawByLanding
      .map((r) => r.landingPageId)
      .filter((id): id is string => !!id);
    const landingPages = landingIds.length > 0
      ? await prisma.crmLandingPage.findMany({
          where: { id: { in: landingIds }, organizationId: orgId },
          select: { id: true, title: true },
        })
      : [];
    const landingTitleMap: Record<string, string> = {};
    for (const lp of landingPages) landingTitleMap[lp.id] = lp.title;

    const byLanding = rawByLanding
      .map((r) => ({
        landingPageId:    r.landingPageId ?? null,
        landingPageTitle: r.landingPageId
          ? (landingTitleMap[r.landingPageId] ?? "알 수 없는 랜딩페이지")
          : "직접 유입",
        revenue: Number(r.revenue),
        count:   Number(r.count),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // 9️⃣ 최근 결제 (마스킹 적용)
    const recent = rawPage.map((p) => ({
      orderId:       p.orderId,
      amount:        Number(p.amount),
      status:        p.status,
      buyerName:     maskCustomerName(p.customerName),
      buyerTel:      (p.customerPhone ? maskPhone(p.customerPhone) : ''),
      paidAt:        p.paidAt
                       ? (p.paidAt instanceof Date ? p.paidAt : new Date(p.paidAt)).toISOString()
                       : null,
      landingPageId: p.landingPageId ?? null,
      masked:        !!p.customerPhone,
    }));

    // 🔟 판매원별 매출 집계 (신규)
    // [BRANCH-API-004] CrmAffiliateSale에 있는 agentId 기준으로 집계
    // agentId가 담당자 정보라고 가정 (실제로는 사용자 조회 필요할 수 있음)
    type AgentRevenueRow = {
      agentId: string;
      agentName: string;
      revenue: number | bigint;
      count: number | bigint;
    };
    const agentRevenueRows: AgentRevenueRow[] = await prisma.$queryRaw<AgentRevenueRow[]>`
      SELECT af."agentId",
             COALESCE(u."name", 'Unknown') AS "agentName",
             COALESCE(SUM(CASE WHEN pp."status" = 'paid' THEN pp."amount" ELSE 0 END), 0)::float AS revenue,
             COUNT(CASE WHEN pp."status" = 'paid' THEN 1 END)::int AS count
      FROM "CrmAffiliateSale" af
      LEFT JOIN "CrmPayAppPayment" pp ON pp."orderId" = af."orderId"
      LEFT JOIN "User" u ON u."id" = af."agentId"
      WHERE af."organizationId" = ${orgId}::uuid
        AND pp."createdAt" >= ${thisMonthStart}
        AND pp."createdAt" < ${thisMonthEnd}
      GROUP BY af."agentId", u."name"
      ORDER BY revenue DESC
    `;

    // [BRANCH-API-005] TOP 3 추출
    const topAgents = agentRevenueRows.slice(0, 3).map((row, idx) => ({
      rank: (idx + 1) as 1 | 2 | 3,
      agentName: row.agentName,
      revenue: Number(row.revenue),
    }));

    // [BRANCH-API-006] 전체 판매원 리스트
    const salesByAgent = agentRevenueRows.map((row) => ({
      agentId: row.agentId,
      agentName: row.agentName,
      revenue: Number(row.revenue),
      count: Number(row.count),
      conversionRate: paidCount > 0 ? ((Number(row.count) / paidCount) * 100).toFixed(1) + '%' : '0.0%',
    }));

    logger.log("[GET /api/marketing/sales/branch]", { orgId, page, totalCount });

    return NextResponse.json({
      ok: true,
      summary,
      monthly,
      byLanding,
      recent,
      salesByAgent,
      topAgents,
      isBranchManager: true,
      pagination: { page, limit, totalCount, totalPages },
    });
  } catch (err: unknown) {
    logger.error("[GET /api/marketing/sales/branch]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

**설명**:
- **1️⃣ ~ 3️⃣**: 권한 확인 + organizationId 필수
- **4️⃣ ~ 6️⃣**: 기존 API와 동일한 쿼리 패턴
- **7️⃣ ~ 9️⃣**: 이번 달 요약 + 월별 + 랜딩페이지별
- **🔟**: 판매원별 GROUP BY agentId (신규)

---

### A-2. `/api/marketing/sales/agent` 만들기 (판매원용)

**파일명**: `D:\mabiz-crm\src\app\api\marketing\sales\agent\route.ts` (신규)

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMabizSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { maskPhone, maskCustomerName } from "@/lib/marketing-utils";
import type { RecentRow, SalesSummary, LandingRow } from "@/types/marketing";

// [AGENT-API-001] 판매원(SALES_AGENT, FREE_SALES) 전용 API
// 자신이 만든 랜딩페이지의 매출만 조회

export async function GET(req: NextRequest) {
  try {
    // 1️⃣ 역할 확인
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    
    // [AGENT-API-002] SALES_AGENT, FREE_SALES만 허용
    if (ctx.role !== 'SALES_AGENT' && ctx.role !== 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const userId = ctx.userId;

    // 2️⃣ 페이지네이션 파라미터
    const page  = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10)));
    const skip  = (page - 1) * limit;

    // 3️⃣ KST 시간대 설정
    const KST_OFFSET     = 9 * 60 * 60 * 1000;
    const nowUTC         = new Date();
    const nowKST         = new Date(nowUTC.getTime() + KST_OFFSET);
    const thisMonthStart = new Date(Date.UTC(nowKST.getUTCFullYear(), nowKST.getUTCMonth(), 1) - KST_OFFSET);
    const thisMonthEnd   = new Date(Date.UTC(nowKST.getUTCFullYear(), nowKST.getUTCMonth() + 1, 1) - KST_OFFSET);
    const sixMonthsAgo   = new Date(Date.UTC(nowKST.getUTCFullYear(), nowKST.getUTCMonth() - 5, 1) - KST_OFFSET);
    const now = nowKST;

    // 4️⃣ 전체 건수 조회
    type CountRow = { total: number | bigint };
    const countRows: CountRow[] = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::int AS total
      FROM "CrmPayAppPayment" pp
      INNER JOIN "CrmLandingPage" lp ON lp."id" = pp."landingPageId"
      INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
      WHERE lp."createdByUserId" = ${userId}
        AND pp."createdAt" >= ${sixMonthsAgo}
    `;
    const totalCount = Number(countRows[0]?.total ?? 0);
    const totalPages = Math.ceil(totalCount / limit);

    // 5️⃣ 최근 결제 목록
    type RawPayment = {
      orderId: string;
      amount: number | bigint;
      status: string;
      customerName: string | null;
      customerPhone: string | null;
      landingPageId: string | null;
      paidAt: Date | null;
    };
    const rawPage: RawPayment[] = await prisma.$queryRaw<RawPayment[]>`
      SELECT pp."orderId", pp."amount", pp."status",
             pp."customerName", pp."customerPhone",
             pp."landingPageId", pp."paidAt"
      FROM "CrmPayAppPayment" pp
      INNER JOIN "CrmLandingPage" lp ON lp."id" = pp."landingPageId"
      INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
      WHERE lp."createdByUserId" = ${userId}
        AND pp."createdAt" >= ${sixMonthsAgo}
      ORDER BY pp."createdAt" DESC
      LIMIT ${limit} OFFSET ${skip}
    `;

    // 6️⃣ 월별 집계
    type RawMonthly = { month: Date; revenue: number | bigint; count: number | bigint };
    const rawMonthly: RawMonthly[] = await prisma.$queryRaw<RawMonthly[]>`
      SELECT DATE_TRUNC('month', pp."createdAt") AS month,
             SUM(pp."amount")::float AS revenue,
             COUNT(*)::int AS count
      FROM "CrmPayAppPayment" pp
      INNER JOIN "CrmLandingPage" lp ON lp."id" = pp."landingPageId"
      INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
      WHERE lp."createdByUserId" = ${userId}
        AND pp."status" = 'paid'
        AND pp."createdAt" >= ${sixMonthsAgo}
      GROUP BY 1
      ORDER BY 1
    `;

    const monthlyMap: Record<string, { revenue: number; count: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      monthlyMap[key] = { revenue: 0, count: 0 };
    }
    for (const row of rawMonthly) {
      const d   = row.month instanceof Date ? row.month : new Date(row.month);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      monthlyMap[key] = { revenue: Number(row.revenue), count: Number(row.count) };
    }
    const monthly = Object.entries(monthlyMap).map(([m, v]) => ({
      month:   m,
      revenue: v.revenue,
      count:   v.count,
    }));

    // 7️⃣ 이번 달 요약
    const monthKey    = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const thisMonth   = monthlyMap[monthKey] ?? { revenue: 0, count: 0 };

    type SumRow = { total: number | bigint | null };
    const refundRows: SumRow[] = await prisma.$queryRaw<SumRow[]>`
      SELECT SUM(pp."amount")::float AS total
      FROM "CrmPayAppPayment" pp
      INNER JOIN "CrmLandingPage" lp ON lp."id" = pp."landingPageId"
      INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
      WHERE lp."createdByUserId" = ${userId}
        AND pp."status" = 'cancelled'
        AND pp."createdAt" >= ${thisMonthStart}
        AND pp."createdAt" < ${thisMonthEnd}
    `;

    const totalRevenue = thisMonth.revenue;
    const totalRefund  = Number(refundRows[0]?.total ?? 0);
    const paidCount    = thisMonth.count;
    const summary = {
      totalRevenue,
      totalRefund,
      netRevenue: totalRevenue - totalRefund,
      paidCount,
      month: monthKey,
    };

    // 8️⃣ 내 랜딩페이지별 매출
    type RawByLanding = {
      landingPageId: string | null;
      landingPageTitle: string;
      revenue: number | bigint;
      count: number | bigint;
    };
    const rawByLanding: RawByLanding[] = await prisma.$queryRaw<RawByLanding[]>`
      SELECT lp."id" AS "landingPageId",
             lp."title" AS "landingPageTitle",
             SUM(pp."amount")::float AS revenue,
             COUNT(*)::int AS count
      FROM "CrmPayAppPayment" pp
      INNER JOIN "CrmLandingPage" lp ON lp."id" = pp."landingPageId"
      INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
      WHERE lp."createdByUserId" = ${userId}
        AND pp."status" = 'paid'
        AND pp."createdAt" >= ${sixMonthsAgo}
      GROUP BY lp."id", lp."title"
      ORDER BY revenue DESC
    `;

    const byLanding = rawByLanding.map((r) => ({
      landingPageId:    r.landingPageId ?? null,
      landingPageTitle: r.landingPageTitle ?? "알 수 없는 랜딩페이지",
      revenue: Number(r.revenue),
      count:   Number(r.count),
    }));

    // 9️⃣ 최고 매출 페이지 (신규)
    const topPage = byLanding.length > 0 ? byLanding[0] : null;

    // 🔟 내가 만든 랜딩페이지 총 개수 (신규)
    type PageCountRow = { total: number | bigint };
    const pageCountRows: PageCountRow[] = await prisma.$queryRaw<PageCountRow[]>`
      SELECT COUNT(DISTINCT "id")::int AS total
      FROM "CrmLandingPage"
      WHERE "createdByUserId" = ${userId}
    `;
    const totalPages_pages = Number(pageCountRows[0]?.total ?? 0);

    // 1️⃣1️⃣ 최근 결제 (마스킹 적용)
    const recent = rawPage.map((p) => ({
      orderId:       p.orderId,
      amount:        Number(p.amount),
      status:        p.status,
      buyerName:     maskCustomerName(p.customerName),
      buyerTel:      (p.customerPhone ? maskPhone(p.customerPhone) : ''),
      paidAt:        p.paidAt
                       ? (p.paidAt instanceof Date ? p.paidAt : new Date(p.paidAt)).toISOString()
                       : null,
      landingPageId: p.landingPageId ?? null,
      masked:        !!p.customerPhone,
    }));

    logger.log("[GET /api/marketing/sales/agent]", { userId, page, totalCount });

    return NextResponse.json({
      ok: true,
      summary,
      monthly,
      byLanding,
      recent,
      topPage,
      totalPages: totalPages_pages,
      isAgent: true,
      pagination: { page, limit, totalCount, totalPages },
    });
  } catch (err: unknown) {
    logger.error("[GET /api/marketing/sales/agent]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

---

## 📁 Part B: UI 페이지 2개 만들기

### B-1. 대리점장 대시보드 만들기

**파일명**: `D:\mabiz-crm\src\app\(dashboard)\marketing\sales\branch\page.tsx` (신규)

```typescript
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { RefreshCw, Lock, Building2, User } from "lucide-react";
import { logger } from "@/lib/logger";
import { formatAmount, formatDate } from "@/lib/marketing-utils";
import { KpiCard } from "@/components/marketing/KpiCard";
import { SalesBarChart } from "@/components/marketing/SalesBarChart";
import { SkeletonRow } from "@/components/marketing/SkeletonRow";
import { StatusBadge } from "@/components/marketing/StatusBadge";
import { cn } from "@/lib/utils";
import type { RecentRow, SalesSummary } from "@/types/marketing";

// 판매원별 테이블
function AgentSalesTable({ 
  agents, 
  loading 
}: { 
  agents: Array<{
    agentId: string;
    agentName: string;
    revenue: number;
    count: number;
    conversionRate: string;
  }>;
  loading: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="text-left px-6 py-3 text-base font-medium text-gray-600">판매원명</th>
            <th scope="col" className="text-right px-6 py-3 text-base font-medium text-gray-600">이번 달 매출</th>
            <th scope="col" className="text-right px-6 py-3 text-base font-medium text-gray-600">건수</th>
            <th scope="col" className="text-right px-6 py-3 text-base font-medium text-gray-600">전환율</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading && (
            <>
              <SkeletonRow cols={4} />
              <SkeletonRow cols={4} />
              <SkeletonRow cols={4} />
            </>
          )}
          {!loading && agents.length === 0 && (
            <tr>
              <td colSpan={4} className="text-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <User className="w-10 h-10 text-gray-300" />
                  <p className="text-base font-medium text-gray-500">판매원 실적이 없어요</p>
                </div>
              </td>
            </tr>
          )}
          {!loading && agents.map((agent) => (
            <tr key={agent.agentId} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 text-base font-medium text-gray-900">{agent.agentName}</td>
              <td className="px-6 py-4 text-right text-base font-semibold text-gray-900">
                {formatAmount(agent.revenue)}
              </td>
              <td className="px-6 py-4 text-right text-base text-gray-600">{agent.count}건</td>
              <td className="px-6 py-4 text-right text-base text-green-700">{agent.conversionRate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 상위 3명 리더보드
function TopAgentsCards({
  topAgents,
  loading
}: {
  topAgents: Array<{
    rank: 1 | 2 | 3;
    agentName: string;
    revenue: number;
  }>;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white rounded-xl border p-4">
            <div className="h-6 w-24 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  const badges = ['🥇', '🥈', '🥉'];
  const bgColors = ['bg-yellow-50', 'bg-gray-50', 'bg-orange-50'];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {topAgents.map((agent) => (
        <div 
          key={agent.rank}
          className={cn(
            "rounded-xl border p-6 text-center",
            bgColors[agent.rank - 1]
          )}
        >
          <p className="text-3xl mb-2">{badges[agent.rank - 1]}</p>
          <p className="text-base font-bold text-gray-900">{agent.rank}위</p>
          <p className="text-base font-medium text-gray-700 mt-2">{agent.agentName}</p>
          <p className="text-xl font-bold text-gray-900 mt-3">{formatAmount(agent.revenue)}</p>
        </div>
      ))}
    </div>
  );
}

// 최근 결제 테이블 (기존 재사용 패턴)
function RecentPaymentTable({ recent, loading }: { recent: RecentRow[], loading: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="text-left px-4 py-3 text-base font-medium text-gray-600">주문번호</th>
            <th scope="col" className="text-left px-4 py-3 text-base font-medium text-gray-600">구매자</th>
            <th scope="col" className="text-right px-4 py-3 text-base font-medium text-gray-600">금액</th>
            <th scope="col" className="text-center px-4 py-3 text-base font-medium text-gray-600">상태</th>
            <th scope="col" className="text-left px-4 py-3 text-base font-medium text-gray-600">결제일</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading && (
            <>
              <SkeletonRow cols={5} />
              <SkeletonRow cols={5} />
            </>
          )}
          {!loading && recent.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center py-12">
                <p className="text-base text-gray-500">최근 결제 내역이 없어요</p>
              </td>
            </tr>
          )}
          {!loading && recent.map((row) => (
            <tr key={row.orderId} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-4 text-gray-500 font-mono text-base">{row.orderId}</td>
              <td className="px-4 py-4 text-base text-gray-700">{row.buyerName}</td>
              <td className="px-4 py-4 text-right text-base font-semibold text-gray-900">
                {formatAmount(row.amount)}
              </td>
              <td className="px-4 py-4 text-center">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-4 py-4 text-base text-gray-600">{formatDate(row.paidAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 메인 페이지
export default function BranchSalesPage() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [page, setPage] = useState(1);
  const refreshCtrlRef = useRef<AbortController | null>(null);

  const load = useCallback((pageNum: number = 1, signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    setPage(pageNum);
    fetch(`/api/marketing/sales/branch?page=${pageNum}&limit=20`, { signal })
      .then((res) => {
        if (res.status === 403) {
          setForbidden(true);
          setLoading(false);
          return null;
        }
        return res.json();
      })
      .then((json) => {
        if (!json) return;
        if (json.ok) {
          setData(json);
        } else {
          setError("데이터를 불러오지 못했습니다.");
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        logger.error('[BranchSalesPage] fetch error', { err });
        setError("네트워크 오류가 발생했습니다.");
      })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(1, controller.signal);
    return () => controller.abort();
  }, [load]);

  if (forbidden) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Lock className="w-16 h-16 text-gray-300" />
          <h1 className="text-xl font-bold text-gray-700">접근 권한이 없습니다</h1>
          <p className="text-base text-gray-500">대리점장만 이용할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  const summary: SalesSummary | undefined = data?.summary;
  const monthly = data?.monthly ?? [];
  const byLanding = data?.byLanding ?? [];
  const recent = data?.recent ?? [];
  const salesByAgent = data?.salesByAgent ?? [];
  const topAgents = data?.topAgents ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 leading-relaxed">
      {/* 제목 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">우리 조직 판매 성과</h1>
          {summary && (
            <p className="text-base text-gray-600 mt-1">이번 달 판매원 실적 현황입니다</p>
          )}
        </div>
        <button
          onClick={() => {
            refreshCtrlRef.current?.abort();
            refreshCtrlRef.current = new AbortController();
            load(page, refreshCtrlRef.current.signal);
          }}
          disabled={loading}
          className="p-3 min-w-[48px] min-h-[48px] hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw className={cn("w-5 h-5 text-gray-500", loading && "animate-spin")} />
        </button>
      </div>

      {/* KPI 카드 */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border p-5 bg-white">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-3" />
              <div className="h-7 w-32 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard label="이번 달 매출" value={formatAmount(summary.totalRevenue)} color="bg-white border-gray-200" />
          <KpiCard label="결제 건수" value={`${summary.paidCount}건`} color="bg-blue-50 border-blue-100" />
          <KpiCard label="순매출" value={formatAmount(summary.netRevenue)} color="bg-green-50 border-green-100" />
        </div>
      ) : null}

      {/* 월별 그래프 */}
      {!loading && monthly.length > 0 && <SalesBarChart monthly={monthly} />}

      {/* 판매원별 매출 */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">판매원별 매출</h2>
        </div>
        <AgentSalesTable agents={salesByAgent} loading={loading} />
      </div>

      {/* 상위 3명 */}
      {!loading && topAgents.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">🏆 TOP 3 판매원</h2>
          <TopAgentsCards topAgents={topAgents} loading={loading} />
        </div>
      )}

      {/* 랜딩페이지별 매출 */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">랜딩페이지별 매출</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="text-left px-6 py-3 text-base font-medium text-gray-600">페이지</th>
                <th scope="col" className="text-right px-6 py-3 text-base font-medium text-gray-600">매출</th>
                <th scope="col" className="text-right px-6 py-3 text-base font-medium text-gray-600">건수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <>
                  <SkeletonRow cols={3} />
                  <SkeletonRow cols={3} />
                </>
              )}
              {!loading && byLanding.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center py-10">
                    <p className="text-base text-gray-500">랜딩페이지 매출이 없어요</p>
                  </td>
                </tr>
              )}
              {!loading && byLanding.map((row: any) => (
                <tr key={row.landingPageId || row.landingPageTitle} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-base text-gray-900">{row.landingPageTitle}</td>
                  <td className="px-6 py-4 text-right text-base font-semibold text-gray-900">
                    {formatAmount(row.revenue)}
                  </td>
                  <td className="px-6 py-4 text-right text-base text-gray-600">{row.count}건</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 최근 결제 */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">최근 결제 내역</h2>
        </div>
        <RecentPaymentTable recent={recent} loading={loading} />
      </div>
    </div>
  );
}
```

---

### B-2. 판매원 대시보드 만들기

**파일명**: `D:\mabiz-crm\src\app\(dashboard)\marketing\sales\agent\page.tsx` (신규)

```typescript
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { RefreshCw, Lock, TrendingUp, FileText } from "lucide-react";
import { logger } from "@/lib/logger";
import { formatAmount, formatDate, formatMonth } from "@/lib/marketing-utils";
import { KpiCard } from "@/components/marketing/KpiCard";
import { SalesBarChart } from "@/components/marketing/SalesBarChart";
import { SkeletonRow } from "@/components/marketing/SkeletonRow";
import { StatusBadge } from "@/components/marketing/StatusBadge";
import { cn } from "@/lib/utils";
import type { RecentRow, SalesSummary } from "@/types/marketing";

// 최근 결제 카드 (간단한 버전)
function RecentPaymentCard({ recent, loading }: { recent: RecentRow[], loading: boolean }) {
  return (
    <div className="p-4 space-y-2">
      {loading && (
        <>
          {[0, 1, 2].map((i) => (
            <div key={i} className="border rounded-xl p-3 bg-white">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </>
      )}
      {!loading && recent.length === 0 && (
        <div className="text-center py-10">
          <p className="text-base text-gray-500">최근 결제 내역이 없어요</p>
        </div>
      )}
      {!loading && recent.map((row) => (
        <div key={row.orderId} className="border rounded-xl p-3 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-base font-medium">{row.buyerName}</span>
            <span className="text-base font-bold">{formatAmount(row.amount)}</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{formatDate(row.paidAt)}</p>
        </div>
      ))}
    </div>
  );
}

// 성과 하이라이트
function HighlightCards({
  topPage,
  totalPages,
  loading
}: {
  topPage: { landingPageTitle: string; revenue: number } | null;
  totalPages: number;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="bg-white rounded-xl border p-6">
            <div className="h-6 w-24 bg-gray-200 rounded animate-pulse mb-3" />
            <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* 최고 매출 페이지 */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <p className="text-base font-medium text-gray-600">최고 매출 페이지</p>
        </div>
        {topPage ? (
          <>
            <p className="text-xl font-bold text-gray-900 mb-2">{topPage.landingPageTitle}</p>
            <p className="text-2xl font-bold text-blue-600">{formatAmount(topPage.revenue)}</p>
            <p className="text-sm text-gray-500 mt-2">이번 달 최고 성과</p>
          </>
        ) : (
          <p className="text-base text-gray-500">아직 매출이 없어요</p>
        )}
      </div>

      {/* 운영 중인 페이지 */}
      <div className="bg-green-50 rounded-xl border border-green-200 p-6">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-5 h-5 text-green-600" />
          <p className="text-base font-medium text-gray-600">운영 중인 페이지</p>
        </div>
        <p className="text-3xl font-bold text-green-600 mb-2">{totalPages}개</p>
        <p className="text-sm text-gray-500">총 만든 페이지</p>
      </div>
    </div>
  );
}

// 메인 페이지
export default function AgentSalesPage() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [page, setPage] = useState(1);
  const refreshCtrlRef = useRef<AbortController | null>(null);

  const load = useCallback((pageNum: number = 1, signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    setPage(pageNum);
    fetch(`/api/marketing/sales/agent?page=${pageNum}&limit=20`, { signal })
      .then((res) => {
        if (res.status === 403) {
          setForbidden(true);
          setLoading(false);
          return null;
        }
        return res.json();
      })
      .then((json) => {
        if (!json) return;
        if (json.ok) {
          setData(json);
        } else {
          setError("데이터를 불러오지 못했습니다.");
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        logger.error('[AgentSalesPage] fetch error', { err });
        setError("네트워크 오류가 발생했습니다.");
      })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(1, controller.signal);
    return () => controller.abort();
  }, [load]);

  if (forbidden) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Lock className="w-16 h-16 text-gray-300" />
          <h1 className="text-xl font-bold text-gray-700">접근 권한이 없습니다</h1>
          <p className="text-base text-gray-500">판매원만 이용할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  const summary: SalesSummary | undefined = data?.summary;
  const monthly = data?.monthly ?? [];
  const byLanding = data?.byLanding ?? [];
  const recent = data?.recent ?? [];
  const topPage = data?.topPage ?? null;
  const totalPages = data?.totalPages ?? 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 leading-relaxed">
      {/* 제목 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">내 판매 성과</h1>
          {summary && (
            <p className="text-base text-gray-600 mt-1">{formatMonth(summary.month)} 기준입니다</p>
          )}
        </div>
        <button
          onClick={() => {
            refreshCtrlRef.current?.abort();
            refreshCtrlRef.current = new AbortController();
            load(page, refreshCtrlRef.current.signal);
          }}
          disabled={loading}
          className="p-3 min-w-[48px] min-h-[48px] hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw className={cn("w-5 h-5 text-gray-500", loading && "animate-spin")} />
        </button>
      </div>

      {/* KPI 카드 (간단함) */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border p-5 bg-white">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-3" />
              <div className="h-7 w-32 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KpiCard label="이번 달 매출" value={formatAmount(summary.totalRevenue)} color="bg-white border-gray-200" />
          <KpiCard label="순매출" value={formatAmount(summary.netRevenue)} color="bg-green-50 border-green-100" />
        </div>
      ) : null}

      {/* 성과 하이라이트 */}
      <HighlightCards topPage={topPage} totalPages={totalPages} loading={loading} />

      {/* 월별 그래프 */}
      {!loading && monthly.length > 0 && <SalesBarChart monthly={monthly} />}

      {/* 내 페이지별 매출 */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">페이지별 매출</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="text-left px-6 py-3 text-base font-medium text-gray-600">페이지명</th>
                <th scope="col" className="text-right px-6 py-3 text-base font-medium text-gray-600">매출</th>
                <th scope="col" className="text-right px-6 py-3 text-base font-medium text-gray-600">건수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <>
                  <SkeletonRow cols={3} />
                  <SkeletonRow cols={3} />
                </>
              )}
              {!loading && byLanding.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center py-10">
                    <p className="text-base text-gray-500">아직 매출이 없어요</p>
                  </td>
                </tr>
              )}
              {!loading && byLanding.map((row: any) => (
                <tr key={row.landingPageId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-base text-gray-900">{row.landingPageTitle}</td>
                  <td className="px-6 py-4 text-right text-base font-semibold text-gray-900">
                    {formatAmount(row.revenue)}
                  </td>
                  <td className="px-6 py-4 text-right text-base text-gray-600">{row.count}건</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 최근 결제 (카드 형태, 모바일 친화) */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">최근 결제 내역</h2>
        </div>
        <RecentPaymentCard recent={recent} loading={loading} />
      </div>
    </div>
  );
}
```

---

## ✅ 구현 체크리스트

### API 구현
- [ ] `/api/marketing/sales/branch/route.ts` 완성
  - 역할 검증 (BRANCH_MANAGER)
  - organizationId 필터
  - 판매원별 GROUP BY
  - TOP 3 추출
- [ ] `/api/marketing/sales/agent/route.ts` 완성
  - 역할 검증 (SALES_AGENT / FREE_SALES)
  - userId 필터
  - topPage 추출
  - totalPages 카운트

### UI 구현
- [ ] `src/app/(dashboard)/marketing/sales/branch/page.tsx` 완성
  - 판매원 테이블
  - TOP 3 카드
  - 랜딩페이지별 테이블
- [ ] `src/app/(dashboard)/marketing/sales/agent/page.tsx` 완성
  - 성과 하이라이트 카드
  - 페이지별 매출 테이블
  - 최근 결제 카드

### 검증
- [ ] `npx tsc --noEmit` 0 에러
- [ ] 관리자: /dashboard/marketing/sales ✅
- [ ] 대리점장: /dashboard/marketing/sales/branch ✅
- [ ] 판매원: /dashboard/marketing/sales/agent ✅
- [ ] 모바일 반응형 확인
- [ ] 모든 데이터 필터링 정확성 확인

---

**작성일**: 2026-06-18
**예상 구현 시간**: 3-4시간 (API 2시간 + UI 1.5시간 + 테스트 0.5시간)
