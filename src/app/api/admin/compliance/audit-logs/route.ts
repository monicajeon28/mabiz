/**
 * GET /api/admin/compliance/audit-logs
 *
 * 감시 로그 조회 (필터링 가능)
 * GLOBAL_ADMIN 전용
 *
 * Query Parameters:
 * - organizationId: 대상 조직
 * - userId: 필터링 사용자
 * - action: 필터링 액션 (READ, WRITE, DELETE, EXPORT, LOGIN)
 * - resourceType: 필터링 리소스 타입
 * - status: 필터링 상태 (SUCCESS, FAILED, DENIED)
 * - startDate: 시작 날짜 (YYYY-MM-DD)
 * - endDate: 종료 날짜 (YYYY-MM-DD)
 * - limit: 결과 수 (기본값: 100, 최대값: 1000)
 * - offset: 페이지 오프셋
 *
 * 응답: {
 *   ok: true,
 *   logs: [...],
 *   total: 123,
 *   page: 1,
 * }
 *
 * 2026-05-27 Compliance Monitor Agent
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { enforceRBAC } from '@/app/api/_middleware/enforce-rbac';
import { auditLogger, type AuditAction } from '@/lib/compliance/audit-logger';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    // RBAC: GLOBAL_ADMIN 전용
    const rbacCheck = enforceRBAC(req, {
      allowedRoles: ['GLOBAL_ADMIN'],
      errorMessage: 'Audit log access requires GLOBAL_ADMIN role',
    });
    if (rbacCheck !== true) return rbacCheck;

    const ctx = await getAuthContext();

    const url = new URL(req.url);
    const organizationId = url.searchParams.get('organizationId');
    const userId = url.searchParams.get('userId');
    const action = url.searchParams.get('action') as AuditAction | null;
    const resourceType = url.searchParams.get('resourceType');
    const status = url.searchParams.get('status');
    const startDateStr = url.searchParams.get('startDate');
    const endDateStr = url.searchParams.get('endDate');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 1000);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'organizationId is required' },
        { status: 400 }
      );
    }

    // ════════════════════════════════════════════════════════════════
    // 필터 조건 구성
    // ════════════════════════════════════════════════════════════════
    const where: any = {
      organizationId,
    };

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (resourceType) where.resourceType = resourceType;
    if (status) where.status = status;

    if (startDateStr || endDateStr) {
      where.createdAt = {};
      if (startDateStr) {
        where.createdAt.gte = new Date(startDateStr);
      }
      if (endDateStr) {
        const endDate = new Date(endDateStr);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    // ════════════════════════════════════════════════════════════════
    // 총 개수 및 로그 조회 (병렬)
    // ════════════════════════════════════════════════════════════════
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          action: true,
          resourceType: true,
          resourceId: true,
          userId: true,
          ipAddress: true,
          status: true,
          piiFieldsAccessed: true,
          purpose: true,
          durationMs: true,
          createdAt: true,
          errorMessage: true,
        },
      }),
    ]);

    // ════════════════════════════════════════════════════════════════
    // 감시 로그 기록 (관리자가 감시 로그를 조회함)
    // ════════════════════════════════════════════════════════════════
    await auditLogger.record({
      organizationId,
      userId: ctx.userId,
      action: 'READ',
      resourceType: 'Document',
      piiFieldsAccessed: ['auditLog'],
      purpose: 'Compliance',
      reasonDescription: `Audit log query: ${Object.entries(where).length} filters`,
      durationMs: Date.now() - startTime,
    });

    // ════════════════════════════════════════════════════════════════
    // 응답 구성
    // ════════════════════════════════════════════════════════════════
    const page = Math.floor(offset / limit) + 1;

    return NextResponse.json({
      ok: true,
      logs,
      total,
      page,
      pageSize: limit,
      hasMore: offset + limit < total,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('❌ Audit Log Query Failed', { error });

    return NextResponse.json(
      {
        ok: false,
        error: '서버 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
