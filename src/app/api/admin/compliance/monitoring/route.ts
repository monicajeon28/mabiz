/**
 * GET /api/admin/compliance/monitoring
 *
 * 실시간 규정 준수 모니터링 대시보드
 * GLOBAL_ADMIN 전용
 *
 * 응답: {
 *   ok: true,
 *   summary: { totalActions, piiAccessCount, suspiciousActivities, failedActions },
 *   recentAnomalies: [...],
 *   complianceStatus: { gdpr, ccpa, internal },
 *   riskScore: 0-100,
 * }
 *
 * 2026-05-27 Compliance Monitor Agent
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { enforceRBAC } from '@/app/api/_middleware/enforce-rbac';
import { auditLogger } from '@/lib/compliance/audit-logger';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    // RBAC: GLOBAL_ADMIN 전용
    const rbacCheck = enforceRBAC(req, {
      allowedRoles: ['GLOBAL_ADMIN'],
      errorMessage: 'Compliance monitoring requires GLOBAL_ADMIN role',
    });
    if (rbacCheck !== true) return rbacCheck;

    const ctx = await getAuthContext();

    const url = new URL(req.url);
    const organizationId = url.searchParams.get('organizationId');
    const daysBack = parseInt(url.searchParams.get('daysBack') || '7', 10);

    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'organizationId is required' },
        { status: 400 }
      );
    }

    const timeRangeStart = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    // ════════════════════════════════════════════════════════════════
    // 1️⃣ 감시 요약 (Today's audit summary)
    // ════════════════════════════════════════════════════════════════
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalActionsToday,
      piiAccessCountToday,
      failedActionsToday,
      failedLoginAttemptsToday,
    ] = await Promise.all([
      prisma.auditLog.count({
        where: {
          organizationId,
          createdAt: { gte: today },
        },
      }),
      prisma.auditLog.count({
        where: {
          organizationId,
          piiFieldsAccessed: { isEmpty: false },
          createdAt: { gte: today },
        },
      }),
      prisma.auditLog.count({
        where: {
          organizationId,
          status: 'FAILED',
          createdAt: { gte: today },
        },
      }),
      prisma.auditLog.count({
        where: {
          organizationId,
          action: 'LOGIN',
          status: 'FAILED',
          createdAt: { gte: today },
        },
      }),
    ]);

    // ════════════════════════════════════════════════════════════════
    // 2️⃣ 이상 탐지 활동
    // ════════════════════════════════════════════════════════════════
    const recentAnomalies = await prisma.anomalyDetection.findMany({
      where: {
        organizationId,
        createdAt: { gte: timeRangeStart },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        anomalyType: true,
        severity: true,
        riskScore: true,
        status: true,
        details: true,
        createdAt: true,
      },
    });

    const suspiciousActivitiesCount = recentAnomalies.filter(
      a => a.status === 'PENDING'
    ).length;

    // ════════════════════════════════════════════════════════════════
    // 3️⃣ PII 접근 상위 5 사용자
    // ════════════════════════════════════════════════════════════════
    const topPiiAccessors = await prisma.auditLog.groupBy({
      by: ['userId'],
      where: {
        organizationId,
        piiFieldsAccessed: { isEmpty: false },
        createdAt: { gte: timeRangeStart },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: { id: 'desc' },
      },
      take: 5,
    });

    // ════════════════════════════════════════════════════════════════
    // 4️⃣ 규정 준수 체크리스트 상태
    // ════════════════════════════════════════════════════════════════
    const complianceChecklists = await prisma.complianceChecklist.findMany({
      where: { organizationId },
      select: {
        id: true,
        regulationType: true,
        completionRate: true,
        items: true,
      },
    });

    const complianceStatus: Record<string, { completionRate: number; items: unknown[] }> = {};
    for (const checklist of complianceChecklists) {
      const itemsData = typeof checklist.items === 'object' && checklist.items !== null && 'items' in checklist.items
        ? (checklist.items as { items: unknown[] }).items
        : [];
      complianceStatus[checklist.regulationType.toLowerCase()] = {
        completionRate: checklist.completionRate,
        items: itemsData || [],
      };
    }

    // ════════════════════════════════════════════════════════════════
    // 5️⃣ 위험도 점수 (Risk Score) 계산
    // ════════════════════════════════════════════════════════════════
    const riskFactors = {
      failedLoginAttempts: Math.min(failedLoginAttemptsToday * 10, 30),
      suspiciousActivities: Math.min(suspiciousActivitiesCount * 15, 40),
      failedAuditActions: Math.min(failedActionsToday * 5, 15),
      complianceGap: 100 - (Object.values(complianceStatus)[0]?.completionRate || 50),
    };

    const riskScore = Math.min(
      100,
      Object.values(riskFactors).reduce((a, b) => a + b, 0) / 4
    );

    // ════════════════════════════════════════════════════════════════
    // 6️⃣ 감시 로그 기록
    // ════════════════════════════════════════════════════════════════
    await auditLogger.record({
      organizationId,
      userId: ctx.userId,
      action: 'READ',
      resourceType: 'Document',
      purpose: 'Compliance',
      reasonDescription: 'Compliance Monitoring Dashboard Access',
      durationMs: Date.now() - startTime,
    });

    // ════════════════════════════════════════════════════════════════
    // 응답 구성
    // ════════════════════════════════════════════════════════════════
    return NextResponse.json({
      ok: true,
      summary: {
        totalActionsToday,
        piiAccessCountToday,
        suspiciousActivitiesCount,
        failedActionsToday,
        failedLoginAttemptsToday,
      },
      recentAnomalies,
      topPiiAccessors: topPiiAccessors.map(item => ({
        userId: item.userId,
        accessCount: item._count.id,
      })),
      complianceStatus,
      riskScore: Math.round(riskScore),
      riskFactors,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('❌ Compliance Monitoring Failed', { error });

    return NextResponse.json(
      {
        ok: false,
        error: '서버 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
