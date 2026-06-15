# Phase 8: File Structure & Quick Reference

**For rapid navigation during implementation**

---

## 📂 New Files to Create

### API Routes (Backend)

```
D:\mabiz-crm\src\app\api\contracts\modifications\dashboard\
├── executive\
│   └── route.ts (280 lines - see PHASE8-IMPLEMENTATION-GUIDE.md)
├── operational\
│   └── route.ts (320 lines - see PHASE8-IMPLEMENTATION-GUIDE.md)
├── drill-down\
│   └── route.ts (180 lines - see PHASE8-IMPLEMENTATION-GUIDE.md)
├── performance\
│   └── route.ts (TBD - Phase 8B)
├── comparison\
│   └── route.ts (TBD - Phase 8B)
├── export\
│   └── route.ts (TBD - Phase 8C)
├── alerts\
│   └── route.ts (TBD - Phase 8C)
└── health\
    └── route.ts (TBD - Phase 8C)
```

### React Components (Frontend)

```
D:\mabiz-crm\src\app\(dashboard)\contracts\dashboard\
├── page.tsx (Main router - see PHASE8-IMPLEMENTATION-GUIDE.md)
├── ExecutiveView.tsx (280 lines - see PHASE8-MODIFICATION-KPI-DASHBOARD.md)
├── OperationalView.tsx (TBD - Phase 8B)
├── PerformanceView.tsx (TBD - Phase 8B)
├── DetailedAnalytics.tsx (TBD - Phase 8B)
├── ComparisonChart.tsx (TBD - Phase 8B)
└── components\
    ├── KPICard.tsx (Simple metric display)
    ├── ChartComponents\
    │   ├── ComplexityDistributionChart.tsx (L2)
    │   ├── RiskHeatmap.tsx (L6)
    │   ├── FamilyInfluenceScore.tsx (L7)
    │   └── UrgencySLATracker.tsx (L10)
    ├── MetricDisplay.tsx
    └── FilterPanel.tsx
```

### Hooks (Data Fetching)

```
D:\mabiz-crm\src\lib\hooks\
├── useDashboardMetrics.ts (See PHASE8-IMPLEMENTATION-GUIDE.md)
├── useOperationalMetrics.ts (TBD)
└── usePerformanceMetrics.ts (TBD)
```

### Type Definitions

```
D:\mabiz-crm\src\lib\types\
└── contract-modification-dashboard.ts (See PHASE8-MODIFICATION-KPI-DASHBOARD.md)
```

### Database Migrations

```
D:\mabiz-crm\prisma\migrations\
└── [timestamp]_add_dashboard_indexes\
    └── migration.sql
    
Content:
```sql
-- Add composite index for dashboard aggregation
CREATE INDEX idx_modification_request_agg 
  ON "ContractModificationRequest" (
    "status", 
    "requestedAt", 
    "complexityScore", 
    "dealRiskFlag", 
    "familyMentionDetected"
  );

-- Add organizational rollup index
CREATE INDEX idx_modification_request_org_time
  ON "ContractModificationRequest" (
    "contractId",
    "requestedAt",
    "status"
  );
```

---

## 🔗 Existing Files (Reference)

### Prisma Schema
```
D:\mabiz-crm\prisma\schema.prisma
- Line 6105-6173: ContractModificationRequest model
- Line 6025-6076: ContractInstance model
```

### Contract Modification Library
```
D:\mabiz-crm\src\lib\
├── contract-modification-auto-approval.ts (Phase 6 - decision engine)
├── contract-modification-helpers.ts (Phase 5 - complexity scoring)
├── contract-modification-rules.ts (Phase 5 - validation rules)
├── contract-modification-emails.ts (Phase 5 - notification templates)
└── contract-modification-state-machine.ts (Phase 5 - status transitions)
```

### Contract UI Components
```
D:\mabiz-crm\src\app\(dashboard)\contracts\
├── page.tsx (Main contracts list)
├── ModificationRequestForm.tsx (Phase 7 - customer request form)
├── ModificationRequestList.tsx (Phase 7 - admin request list)
├── ModificationResponsePanel.tsx (Phase 7 - admin response panel)
├── layout.tsx
├── INTEGRATION-GUIDE.md (How to use Phase 7 components)
└── README-ModificationComponents.md (Component documentation)
```

### Existing Dashboard Structure
```
D:\mabiz-crm\src\app\(dashboard)\dashboard\
└── page.tsx (Main dashboard - extends for metrics)
```

---

## 📋 Quick Code Reference

### API Route Template (Executive Metrics)

```typescript
// File: src/app/api/contracts/modifications/dashboard/executive/route.ts
// Lines: ~280
// Copy from: PHASE8-IMPLEMENTATION-GUIDE.md

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMabizSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const period = req.nextUrl.searchParams.get("period") || "mtd";
    
    // Fetch requests
    const requests = await prisma.contractModificationRequest.findMany({
      where: {
        contract: { organizationId: session.organizationId },
        requestedAt: { gte: getPeriodStart(new Date(), period) }
      }
    });
    
    // Calculate metrics
    // ... (see full implementation in guide)
    
    return NextResponse.json(metrics);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}
```

### React Hook Template

```typescript
// File: src/lib/hooks/useDashboardMetrics.ts
// Lines: ~50
// Copy from: PHASE8-IMPLEMENTATION-GUIDE.md

import { useEffect, useState } from "react";

export function useDashboardMetrics(endpoint: string, params?: Record<string, string>) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const query = new URLSearchParams(params);
        const res = await fetch(
          `/api/contracts/modifications/dashboard/${endpoint}?${query}`
        );
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [endpoint, JSON.stringify(params)]);

  return { data, loading, error };
}
```

### Dashboard Page Template

```typescript
// File: src/app/(dashboard)/contracts/dashboard/page.tsx
// Lines: ~80
// Copy from: PHASE8-IMPLEMENTATION-GUIDE.md

"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExecutiveView } from "./ExecutiveView";
import { OperationalView } from "./OperationalView";
import { useDashboardMetrics } from "@/lib/hooks/useDashboardMetrics";

export default function DashboardPage() {
  const [mode, setMode] = useState<"executive" | "operational">("executive");
  const [period, setPeriod] = useState("mtd");

  const { data: metrics, loading } = useDashboardMetrics(mode, { period });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">계약 수정요청 대시보드</h1>
      
      <Tabs value={mode} onValueChange={(v) => setMode(v)}>
        <TabsList>
          <TabsTrigger value="executive">경영진</TabsTrigger>
          <TabsTrigger value="operational">운영</TabsTrigger>
        </TabsList>

        <TabsContent value="executive">
          {loading ? <div>로딩...</div> : <ExecutiveView metrics={metrics} />}
        </TabsContent>

        <TabsContent value="operational">
          {loading ? <div>로딩...</div> : <OperationalView metrics={metrics} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Component Template (ExecutiveView)

```typescript
// File: src/app/(dashboard)/contracts/dashboard/ExecutiveView.tsx
// Lines: ~150 (see PHASE8-MODIFICATION-KPI-DASHBOARD.md for full spec)

"use client";

import React from "react";
import { KPICard } from "./components/KPICard";
import { RequestCountTrendChart } from "./components/ChartComponents/RequestCountTrendChart";

export function ExecutiveView({ metrics, isLoading }) {
  if (isLoading) return <div>로딩 중...</div>;

  return (
    <div className="space-y-6">
      {/* 4 Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          label="총 수정 요청"
          value={metrics.summary.totalRequests}
          unit="건"
        />
        <KPICard
          label="승인율"
          value={metrics.summary.approvalRate}
          unit="%"
          color="green"
        />
        <KPICard
          label="거래 위험 노출"
          value={metrics.summary.dealRiskExposure}
          unit="%"
          color="red"
        />
        <KPICard
          label="평균 처리시간"
          value={metrics.summary.avgResolutionDaysToApproval}
          unit="일"
        />
      </div>

      {/* Trend Charts */}
      <div className="grid grid-cols-2 gap-4">
        <RequestCountTrendChart data={metrics.trends.requestCountByDay} />
        {/* More charts... */}
      </div>
    </div>
  );
}
```

---

## 🎯 Implementation Order (Phase 8A)

### Step 1: Setup (30 min)
```bash
# Create directories
mkdir -p src/app/api/contracts/modifications/dashboard/{executive,operational,drill-down}
mkdir -p src/app/(dashboard)/contracts/dashboard/{components/ChartComponents}
mkdir -p src/lib/hooks
```

### Step 2: Create API Routes (90 min)
1. Copy `executive/route.ts` from PHASE8-IMPLEMENTATION-GUIDE.md
2. Copy `operational/route.ts`
3. Copy `drill-down/route.ts`
4. Test each with: `curl http://localhost:3000/api/contracts/modifications/dashboard/executive?period=mtd`

### Step 3: Create React Hook (15 min)
1. Copy `useDashboardMetrics.ts` from PHASE8-IMPLEMENTATION-GUIDE.md
2. Test with: `import { useDashboardMetrics } from "@/lib/hooks/useDashboardMetrics"`

### Step 4: Create Dashboard Page (30 min)
1. Copy `contracts/dashboard/page.tsx` from PHASE8-IMPLEMENTATION-GUIDE.md
2. Navigate to: `http://localhost:3000/contracts/dashboard`

### Step 5: Create Components (120 min)
1. Create `KPICard.tsx` — Simple metric display component
2. Create `ExecutiveView.tsx` — Use template from main spec doc
3. Add chart components (Recharts wrappers)

### Step 6: Test & Deploy (60 min)
1. Run unit tests for queries
2. Run E2E tests for page rendering
3. Load test with sample data
4. Deploy to staging

---

## 🔍 Key Query Patterns

### Aggregate by Status
```typescript
const statusCounts = await prisma.contractModificationRequest.groupBy({
  by: ['status'],
  where: { contract: { organizationId } },
  _count: { id: true }
});
```

### Aggregate by Complexity
```typescript
const complexityDist = [
  { range: 'LOW', count: requests.filter(r => r.complexityScore < 40).length },
  { range: 'MEDIUM', count: requests.filter(r => r.complexityScore >= 40 && r.complexityScore < 70).length },
  { range: 'HIGH', count: requests.filter(r => r.complexityScore >= 70).length }
];
```

### Calculate Average Resolution Time
```typescript
const avgResolution = requests
  .filter(r => r.respondedAt && r.status === 'APPROVED')
  .reduce((sum, r) => sum + daysBetween(r.requestedAt, r.respondedAt!), 0) / count;
```

### Get Top Risks (Ordered)
```typescript
const topRisks = requests
  .filter(r => r.dealRiskFlag)
  .sort((a, b) => daysBetween(b.requestedAt, now) - daysBetween(a.requestedAt, now))
  .slice(0, 5);
```

---

## 📊 Database Index Commands

Add to Prisma migration file:

```sql
-- Performance indexes for dashboard queries
CREATE INDEX idx_cmr_status_requested_at 
  ON "ContractModificationRequest"("status", "requestedAt");

CREATE INDEX idx_cmr_complexity_deal_risk
  ON "ContractModificationRequest"("complexityScore", "dealRiskFlag");

CREATE INDEX idx_cmr_family_urgency
  ON "ContractModificationRequest"("familyMentionDetected", "expiresAt");

-- For efficient contract lookups
CREATE INDEX idx_cmr_contract_status
  ON "ContractModificationRequest"("contractId", "status");
```

---

## 🧪 Sample Test Data

```sql
-- Insert test data for dashboard testing
INSERT INTO "ContractModificationRequest" (
  id, "contractId", status, "complexityScore", "dealRiskFlag", 
  "familyMentionDetected", "requestedAt", "expiresAt", "responseMessage"
) VALUES
  ('cmr_001', 'contract_001', 'APPROVED', 25, false, false, NOW(), NOW() + INTERVAL 7 DAY, 'Approved'),
  ('cmr_002', 'contract_002', 'REQUESTED', 85, true, true, NOW() - INTERVAL 2 DAY, NOW() + INTERVAL 5 DAY, NULL),
  ('cmr_003', 'contract_003', 'ALTERNATIVE_PROPOSED', 55, true, false, NOW() - INTERVAL 4 DAY, NOW() + INTERVAL 3 DAY, 'Alternative proposed'),
  ('cmr_004', 'contract_004', 'EXPIRED', 70, false, true, NOW() - INTERVAL 10 DAY, NOW() - INTERVAL 3 DAY, NULL),
  ('cmr_005', 'contract_005', 'REJECTED', 40, false, false, NOW() - INTERVAL 1 DAY, NOW() + INTERVAL 6 DAY, 'Cannot approve');
```

---

## ✅ Phase 8A Completion Checklist

- [ ] All 3 API routes created & tested
- [ ] useDashboardMetrics hook working
- [ ] Dashboard page navigates to /contracts/dashboard
- [ ] ExecutiveView component renders without errors
- [ ] All 4 KPI cards display correctly
- [ ] Database indexes added
- [ ] Load test: < 2 seconds for 1000 requests
- [ ] No SQL errors in browser console
- [ ] Ready for Phase 8B

---

## 🚀 Next Steps

After Phase 8A completes:

1. **Phase 8B:** Add OperationalView, PerformanceView, drill-down, comparison
2. **Phase 8C:** Add alerts, export, auto-refresh, health monitoring
3. **Phase 9:** Psychology lens integration & predictions (future)

---

## 📞 Documentation Map

| Need | Document | Section |
|------|----------|---------|
| Big picture | PHASE8-SUMMARY.md | What Was Delivered |
| Full spec | PHASE8-MODIFICATION-KPI-DASHBOARD.md | System Architecture |
| Copy-paste code | PHASE8-IMPLEMENTATION-GUIDE.md | API Routes section |
| File structure | PHASE8-FILE-STRUCTURE.md | This document |
| Quick queries | PHASE8-FILE-STRUCTURE.md | Key Query Patterns |

---

**Ready to build? Start with PHASE8-IMPLEMENTATION-GUIDE.md Step 1! 🚀**
