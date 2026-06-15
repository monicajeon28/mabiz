# Phase 8: Contract Modification KPI Dashboard - Technical Architecture

**Document Version:** 1.0  
**Last Updated:** 2026-06-15  
**Status:** Ready for Implementation  

---

## Executive Summary

Phase 8 implements a comprehensive KPI dashboard for the Contract Modification Request system, providing real-time visibility into request velocity, approval rates, complexity trends, and psychology lens effectiveness across 4 viewing modes.

---

## Part 1: Dashboard Architecture Overview

### 1.1 Four Viewing Modes

| Mode | Users | Purpose | Refresh |
|------|-------|---------|---------|
| Executive | CEO, CFO | High-level KPIs, trends, risk exposure | 5 min |
| Operational | Team Lead | Queue management, SLA, escalations | 2 min |
| Performance | Coach | Agent metrics, approval accuracy | 5 min |
| Drill-down | Analyst | Single request, mediation steps, audit | Real-time |

### 1.2 Grant Cardone Lenses → KPIs

**L2 (Complexity/Mediation)**
- Metric: Average Complexity Score (0-100)
- Metric: % HIGH complexity (>70)
- Dashboard: Complexity histogram, mediation heatmap

**L6 (Loss Aversion/Risk)**
- Metric: Deal Risk Flag %
- Metric: Risk Exposure ($/month)
- Metric: Recovery Rate %
- Dashboard: Risk heatmap, top-10 at-risk contracts

**L7 (Family Persuasion)**
- Metric: Family Mention Detection %
- Metric: Family Persuasion Score (0-100)
- Dashboard: Family influence radar, objection breakdown

**L10 (Urgency)**
- Metric: SLA Compliance (24h resolution %)
- Metric: Expiry Rate %
- Dashboard: SLA tracker, countdown, trends

---

## Part 2: Database Queries

### Executive KPI Summary

Query pattern:
1. Count requests by status
2. Calculate approval rate = APPROVED / TOTAL
3. Count auto-approvals (approvedByUserId = "SYSTEM")
4. Aggregate complexity (avg, distribution)
5. Count deal risk flags
6. Calculate SLA compliance = within24h / total

Index requirements:
- idx_modification_request_org_status
- idx_modification_request_complexity
- idx_modification_request_risk
- idx_modification_request_sla

### Operational Queue Query

Query pattern:
1. Get all REQUESTED status modifications
2. Calculate priority = dealRiskFlag(40) + complexity>70(30) + familyMention(20) + age>18h(20)
3. Calculate SLA status: GREEN(<12h), YELLOW(12-18h), RED(>18h)
4. Sort by priority DESC, age ASC

### Performance Dashboard Query

Query pattern:
1. Group by requestedByUserId (agents)
2. Count total, approved, rejected, auto-approved
3. Calculate approval rate, auto-approval rate
4. Average complexity, average resolution time
5. Generate trends by day/week/month

### SLA Calculation

SQL:
`sql
SELECT COUNT(*) as total,
  COUNT(CASE WHEN (completedAt - requestedAt) <= interval '24 hours' THEN 1 END) as within_24h,
  ROUND(100.0 * COUNT(CASE WHEN (completedAt - requestedAt) <= interval '24 hours' THEN 1 END) / COUNT(*), 2) as sla_percent
FROM "ContractModificationRequest"
WHERE organizationId = \ AND status IN ('APPROVED','REJECTED','COMPLETED')
`

---

## Part 3: API Endpoints

### Executive Dashboard
\\\
GET /api/contract-instances/modifications/dashboard/executive
Query: organizationId, dateRange (7d|30d|90d|custom), startDate?, endDate?
Returns: summary, trends, lensAnalysis
\\\

### Operational Dashboard
\\\
GET /api/contract-instances/modifications/dashboard/operational
Query: organizationId, sortBy (age|complexity|risk), filterPriority?, limit?
Returns: queue, statistics
\\\

### Performance Dashboard
\\\
GET /api/contract-instances/modifications/dashboard/performance
Query: organizationId, agentUserId?, dateRange (7d|30d|90d)
Returns: metrics, agentBreakdown, trends
\\\

### Drill-down Details
\\\
GET /api/contract-instances/modifications/dashboard/drill-down/:requestId
Returns: request, lensAnalysis, timeline
\\\

### Export
\\\
GET /api/contract-instances/modifications/dashboard/export
Query: organizationId, format (csv|xlsx|json), dateRange, metrics?
Returns: File download
\\\

---

## Part 4: Frontend Components

### Component Tree
- DashboardLayout (page.tsx)
  - SidebarNav (ModeSelector, DateRangePicker)
  - ViewContainer
    - ExecutiveView (4 KPI cards + trends)
    - OperationalView (Queue table + stats)
    - PerformanceView (Agent metrics + trends)
    - DrillDownView (Request details + mediation)

### Key Components
1. ExecutiveView - Summary KPIs, trend chart, lens analysis
2. OperationalView - Queue with priority/age/complexity/risk/SLA
3. PerformanceView - Agent table with approval rate, complexity, speed
4. DrillDownView - Mediation steps (L2 SPIN), lens details, audit trail
5. MetricCard - Single KPI (name, value, target, status indicator)
6. TrendChart - Line/area chart
7. PriorityBadge - HIGH/MEDIUM/LOW color
8. SLAIndicator - GREEN/YELLOW/RED status

### TypeScript Types
`	ypescript
interface DashboardMetrics {
  totalRequests: number;
  approvalRate: number;
  autoApprovalRate: number;
  avgComplexity: number;
  slaCompliance: number;
  dealRiskExposure: number;
}

interface QueueItem {
  id: string;
  priority: 'HIGH'|'MEDIUM'|'LOW';
  ageHours: number;
  complexity: number;
  dealRisk: boolean;
  slaStatus: 'GREEN'|'YELLOW'|'RED';
}

interface LensMetrics {
  L2: { complexity: number; highCount: number };
  L6: { riskCount: number; recoveryRate: number };
  L7: { familyCount: number; persuasionScore: number };
  L10: { slaCompliance: number; expiryRate: number };
}
`

---

## Part 5: Implementation Roadmap

### Phase 8A: Foundation (1-2 weeks)
- Create 3 API routes (executive, operational, drill-down)
- Run SQL indexes
- Build ExecutiveView + OperationalView components
- Create dashboard page layout
- Performance test: < 2s load time

Files:
- src/app/api/contract-instances/modifications/dashboard/executive/route.ts
- src/app/api/contract-instances/modifications/dashboard/operational/route.ts
- src/app/api/contract-instances/modifications/dashboard/drill-down/[requestId]/route.ts
- src/app/(dashboard)/contracts/dashboard/ExecutiveView.tsx
- src/app/(dashboard)/contracts/dashboard/OperationalView.tsx
- src/app/(dashboard)/contracts/dashboard/page.tsx
- src/lib/contract-dashboard-queries.ts

### Phase 8B: Advanced Analytics (1-2 weeks)
- PerformanceView + DrillDownView components
- Add filtering/sorting to operational queue
- Auto-refresh mechanism (2-min operational, 5-min executive)
- Lens analysis visualizations
- SLA status indicators

Files:
- src/app/(dashboard)/contracts/dashboard/PerformanceView.tsx
- src/app/(dashboard)/contracts/dashboard/DrillDownView.tsx
- src/app/(dashboard)/contracts/dashboard/MediationStepsPanel.tsx
- src/lib/contract-dashboard-hooks.ts

### Phase 8C: Automation (1 week)
- Export to CSV/Excel
- Alert configuration (Slack/Email)
- Caching strategy (Redis)
- Health monitoring
- Performance tuning

Files:
- src/app/api/contract-instances/modifications/dashboard/export/route.ts
- src/app/api/contract-instances/modifications/dashboard/alerts/route.ts
- src/lib/dashboard-cache.ts

---

## Part 6: Success Criteria & KPI Targets

### Performance Targets
| Metric | Target | Status |
|--------|--------|--------|
| Auto-Approval Rate | 70% | ⏳ |
| Overall Approval Rate | 82% | ⏳ |
| SLA Compliance (24h) | 94% | ⏳ |
| Avg Complexity | 45/100 | ⏳ |
| Dashboard Load | < 2s | ⏳ |

### Lens Integration Validation
- ✅ L2: Complexity score aggregation + mediation tracking
- ✅ L6: Deal risk flag + exposure calculation
- ✅ L7: Family mention detection + persuasion metrics
- ✅ L10: SLA compliance + expiry countdown

---

## Implementation Notes

- All queries optimized with indexes for < 500ms response
- Auto-refresh intervals: Operational 2min, Executive 5min, Performance 5min
- Cache strategy: Redis with 5-min TTL for executive, 2-min for operational
- Drill-down queries real-time (no caching, < 200ms target)
- Export queued job for large datasets (async processing)
- Support 100+ concurrent dashboard users

---

**Document Version:** 1.0 | Last Updated: 2026-06-15
