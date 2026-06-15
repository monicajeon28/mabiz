# Phase 8: Implementation Guide & Code Examples

**Version:** 1.0 | **Status:** Ready to Code

---

## Part 1: Database Helper Functions

### File: src/lib/contract-dashboard-queries.ts

\\\	ypescript
import prisma from './prisma';

// Executive Dashboard - All KPI metrics
export async function getExecutiveKPISummary(
  organizationId: string,
  dateRange: { start: Date; end: Date }
) {
  const contractIds = await prisma.contractInstance.findMany({
    where: { organizationId },
    select: { id: true },
  }).then(cs => cs.map(c => c.id));

  // 1. Status breakdown
  const statusBreakdown = await prisma.contractModificationRequest.groupBy({
    by: ['status'],
    where: {
      contractId: { in: contractIds },
      requestedAt: { gte: dateRange.start, lte: dateRange.end },
    },
    _count: true,
  });

  const totalRequests = statusBreakdown.reduce((sum, s) => sum + s._count, 0);
  const approved = statusBreakdown.find(s => s.status === 'APPROVED')?._count || 0;

  // 2. Auto-approval count
  const autoApproved = await prisma.contractModificationRequest.count({
    where: {
      contractId: { in: contractIds },
      approvedByUserId: 'SYSTEM',
      requestedAt: { gte: dateRange.start, lte: dateRange.end },
    },
  });

  // 3. Complexity analysis
  const complexityAgg = await prisma.contractModificationRequest.aggregate({
    where: {
      contractId: { in: contractIds },
      requestedAt: { gte: dateRange.start, lte: dateRange.end },
    },
    _avg: { complexityScore: true },
    _count: true,
  });

  // 4. Risk metrics
  const riskCount = await prisma.contractModificationRequest.count({
    where: {
      contractId: { in: contractIds },
      dealRiskFlag: true,
      requestedAt: { gte: dateRange.start, lte: dateRange.end },
    },
  });

  // 5. Family mentions
  const familyCount = await prisma.contractModificationRequest.count({
    where: {
      contractId: { in: contractIds },
      familyMentionDetected: true,
      requestedAt: { gte: dateRange.start, lte: dateRange.end },
    },
  });

  // 6. SLA compliance
  const resolvedRequests = await prisma.contractModificationRequest.findMany({
    where: {
      contractId: { in: contractIds },
      status: { in: ['APPROVED', 'REJECTED', 'COMPLETED'] },
      requestedAt: { gte: dateRange.start, lte: dateRange.end },
    },
    select: { requestedAt: true, completedAt: true },
  });

  const resolvedWithin24h = resolvedRequests.filter(r => {
    if (!r.completedAt) return false;
    const timeMs = r.completedAt.getTime() - r.requestedAt.getTime();
    return timeMs <= 24 * 60 * 60 * 1000;
  }).length;

  const avgResolutionMs = resolvedRequests.length > 0
    ? resolvedRequests.reduce((sum, r) => sum + (r.completedAt?.getTime() || 0) - r.requestedAt.getTime(), 0) / resolvedRequests.length
    : 0;

  return {
    totalRequests,
    approved,
    approvalRate: totalRequests > 0 ? (approved / totalRequests) * 100 : 0,
    autoApproved,
    autoApprovalRate: totalRequests > 0 ? (autoApproved / totalRequests) * 100 : 0,
    avgComplexity: complexityAgg._avg.complexityScore || 0,
    dealRiskCount: riskCount,
    dealRiskPercentage: totalRequests > 0 ? (riskCount / totalRequests) * 100 : 0,
    familyMentionCount: familyCount,
    familyMentionPercentage: totalRequests > 0 ? (familyCount / totalRequests) * 100 : 0,
    slaCompliance: resolvedRequests.length > 0 ? (resolvedWithin24h / resolvedRequests.length) * 100 : 0,
    avgResolutionTime: avgResolutionMs / 1000 / 60, // Convert to minutes
  };
}

// Operational Dashboard - Queue with priority
export async function getOperationalQueueMetrics(
  organizationId: string,
  options?: { limit?: number; sortBy?: 'age' | 'complexity' | 'risk' }
) {
  const contractIds = await prisma.contractInstance.findMany({
    where: { organizationId },
    select: { id: true },
  }).then(cs => cs.map(c => c.id));

  const limit = options?.limit || 50;

  const pendingRequests = await prisma.contractModificationRequest.findMany({
    where: {
      contractId: { in: contractIds },
      status: 'REQUESTED',
    },
    select: {
      id: true,
      contractId: true,
      requestedByName: true,
      complexityScore: true,
      dealRiskFlag: true,
      familyMentionDetected: true,
      requestedAt: true,
      expiresAt: true,
      contract: {
        select: {
          contact: { select: { name: true } },
        },
      },
    },
    orderBy: {
      requestedAt: options?.sortBy === 'age' ? 'asc' : 'desc',
    },
    take: limit,
  });

  const enrichedQueue = pendingRequests.map((req) => {
    const ageMs = Date.now() - req.requestedAt.getTime();
    const expiryMs = req.expiresAt.getTime() - Date.now();

    const priority = calculatePriority({
      complexity: req.complexityScore,
      dealRisk: req.dealRiskFlag,
      familyMention: req.familyMentionDetected,
      ageHours: ageMs / 1000 / 60 / 60,
    });

    const slaStatus = ageMs / 1000 / 60 / 60 > 18 ? 'RED' : ageMs / 1000 / 60 / 60 > 12 ? 'YELLOW' : 'GREEN';

    return {
      id: req.id,
      contractId: req.contractId,
      customerName: req.contract?.contact?.name || req.requestedByName || 'Unknown',
      priority,
      complexity: req.complexityScore,
      dealRisk: req.dealRiskFlag,
      familyInvolved: req.familyMentionDetected,
      ageHours: Math.floor(ageMs / 1000 / 60 / 60),
      expiresIn: {
        days: Math.floor(expiryMs / 1000 / 60 / 60 / 24),
        hours: Math.floor((expiryMs / 1000 / 60 / 60) % 24),
      },
      slaStatus,
    };
  });

  return {
    queue: enrichedQueue,
    statistics: {
      total: enrichedQueue.length,
      highPriority: enrichedQueue.filter(r => r.priority === 'HIGH').length,
      mediumPriority: enrichedQueue.filter(r => r.priority === 'MEDIUM').length,
      lowPriority: enrichedQueue.filter(r => r.priority === 'LOW').length,
      avgAge: enrichedQueue.length > 0
        ? enrichedQueue.reduce((sum, r) => sum + r.ageHours, 0) / enrichedQueue.length
        : 0,
    },
  };
}

function calculatePriority(params: {
  complexity: number;
  dealRisk: boolean;
  familyMention: boolean;
  ageHours: number;
}): 'HIGH' | 'MEDIUM' | 'LOW' {
  let score = 0;
  if (params.dealRisk) score += 40;
  if (params.complexity > 70) score += 30;
  if (params.familyMention) score += 20;
  if (params.ageHours > 18) score += 20;
  return score >= 60 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW';
}

// Performance Dashboard - Agent metrics
export async function getPerformanceMetrics(
  organizationId: string,
  dateRange?: { start: Date; end: Date }
) {
  const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = dateRange?.end || new Date();

  const contractIds = await prisma.contractInstance.findMany({
    where: { organizationId },
    select: { id: true },
  }).then(cs => cs.map(c => c.id));

  const requests = await prisma.contractModificationRequest.findMany({
    where: {
      contractId: { in: contractIds },
      requestedAt: { gte: startDate, lte: endDate },
    },
    select: {
      id: true,
      status: true,
      requestedByUserId: true,
      complexityScore: true,
      requestedAt: true,
      completedAt: true,
      approvedByUserId: true,
    },
  });

  // Group by agent
  const byAgent = new Map<string, any>();

  for (const req of requests) {
    const agent = req.requestedByUserId || 'unknown';
    if (!byAgent.has(agent)) {
      byAgent.set(agent, { requests: 0, approved: 0, auto: 0, totalComplexity: 0, totalTime: 0, count: 0 });
    }
    const stats = byAgent.get(agent);
    stats.requests++;
    if (req.status === 'APPROVED') stats.approved++;
    if (req.approvedByUserId === 'SYSTEM') stats.auto++;
    stats.totalComplexity += req.complexityScore;
    if (req.completedAt) {
      stats.totalTime += req.completedAt.getTime() - req.requestedAt.getTime();
      stats.count++;
    }
  }

  const agentMetrics = Array.from(byAgent.entries()).map(([userId, stats]) => ({
    userId,
    requestsHandled: stats.requests,
    approvalRate: (stats.approved / stats.requests) * 100,
    autoApprovalRate: (stats.auto / stats.requests) * 100,
    avgComplexity: stats.totalComplexity / stats.requests,
    avgResolutionTime: stats.count > 0 ? stats.totalTime / stats.count / 1000 / 60 : 0,
  }));

  const totalMetrics = {
    totalRequests: requests.length,
    approvalRate: requests.length > 0 ? (requests.filter(r => r.status === 'APPROVED').length / requests.length) * 100 : 0,
    autoApprovalRate: requests.length > 0 ? (requests.filter(r => r.approvedByUserId === 'SYSTEM').length / requests.length) * 100 : 0,
    avgComplexity: requests.length > 0 ? requests.reduce((sum, r) => sum + r.complexityScore, 0) / requests.length : 0,
  };

  return { metrics: totalMetrics, agentMetrics };
}
\\\

---

## Part 2: API Route Templates

### Executive Dashboard Route

File: src/app/api/contract-instances/modifications/dashboard/executive/route.ts

\\\	ypescript
import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { getExecutiveKPISummary } from '@/lib/contract-dashboard-queries';

export async function GET(req: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const dateRange = req.nextUrl.searchParams.get('dateRange') || '30d';
    let start = new Date();
    let end = new Date();

    if (dateRange === '7d') start.setDate(start.getDate() - 7);
    else if (dateRange === '90d') start.setDate(start.getDate() - 90);
    else start.setDate(start.getDate() - 30);

    const metrics = await getExecutiveKPISummary(session.organizationId, { start, end });

    return NextResponse.json({
      success: true,
      data: { summary: metrics },
      meta: { generatedAt: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[EXECUTIVE_DASHBOARD]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
\\\

---

## Part 3: React Component Template

### ExecutiveView Component

File: src/app/(dashboard)/contracts/dashboard/ExecutiveView.tsx

\\\	ypescript
'use client';

import { useEffect, useState } from 'react';

interface ExecutiveMetrics {
  totalRequests: number;
  approvalRate: number;
  autoApprovalRate: number;
  avgComplexity: number;
  slaCompliance: number;
  dealRiskExposure: number;
}

export function ExecutiveView({ organizationId }: { organizationId: string }) {
  const [metrics, setMetrics] = useState<ExecutiveMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch(
        \/api/contract-instances/modifications/dashboard/executive?organizationId=\\
      );
      const data = await res.json();
      setMetrics(data.data.summary);
      setLoading(false);
    };
    fetchData();
  }, [organizationId]);

  if (loading) return <div className="animate-pulse h-32 bg-gray-200 rounded" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Approval Rate" value={\\%\} target="82%" />
        <MetricCard label="Auto-Approval" value={\\%\} target="70%" />
        <MetricCard label="Avg Complexity" value={\\\} target="<50" />
        <MetricCard label="SLA Compliance" value={\\%\} target="94%" />
      </div>
    </div>
  );
}

function MetricCard({ label, value, target }: any) {
  return (
    <div className="bg-white border rounded p-4">
      <p className="text-gray-600 text-sm">{label}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
      <p className="text-gray-400 text-xs mt-1">Target: {target}</p>
    </div>
  );
}
\\\

---

## Part 4: SQL Indexes

Run these in your PostgreSQL database:

\\\sql
CREATE INDEX IF NOT EXISTS idx_modification_request_org_status
ON "ContractModificationRequest" (status, "contractId", "requestedAt")
WHERE status IN ('REQUESTED', 'APPROVED', 'REJECTED');

CREATE INDEX IF NOT EXISTS idx_modification_request_complexity
ON "ContractModificationRequest" ("complexityScore", "requestedAt")
WHERE "complexityScore" > 0;

CREATE INDEX IF NOT EXISTS idx_modification_request_risk
ON "ContractModificationRequest" ("dealRiskFlag", "requestedAt")
WHERE "dealRiskFlag" = true;

CREATE INDEX IF NOT EXISTS idx_modification_request_sla
ON "ContractModificationRequest" ("requestedAt", "completedAt", "status")
WHERE status IN ('APPROVED', 'REJECTED', 'COMPLETED');
\\\

---

## Part 5: TypeScript Definitions

File: src/lib/types/contract-dashboard.ts

\\\	ypescript
export interface DashboardMetrics {
  totalRequests: number;
  approved: number;
  rejected: number;
  approvalRate: number;
  autoApprovalRate: number;
  avgComplexity: number;
  slaCompliance: number;
  dealRiskExposure: number;
}

export interface QueueItem {
  id: string;
  customerName: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  ageHours: number;
  complexity: number;
  dealRisk: boolean;
  slaStatus: 'GREEN' | 'YELLOW' | 'RED';
}

export interface LensMetrics {
  L2: { complexity: number; highCount: number };
  L6: { riskCount: number; percentage: number };
  L7: { familyCount: number; percentage: number };
  L10: { slaCompliance: number; expiryRate: number };
}
\\\

---

## Next Steps

1. **Phase 8A (Week 1-2)**
   - Copy 3 API route templates
   - Run SQL indexes
   - Build ExecutiveView + OperationalView
   - Test < 2s load time

2. **Phase 8B (Week 3-4)**
   - Add PerformanceView
   - Add DrillDownView
   - Implement auto-refresh
   - Add visualizations

3. **Phase 8C (Week 5)**
   - Export functionality
   - Alert system
   - Caching
   - Performance tuning

**Status:** Ready for implementation  
**Team:** 2-3 backend engineers + 2-3 frontend engineers recommended
