import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { enforceRBAC } from '@/app/api/_middleware/enforce-rbac';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/compliance/deletion-requests
 * GDPR 데이터 삭제 요청 목록 조회 (GLOBAL_ADMIN 전용)
 *
 * Query params:
 * - status: PENDING_DELETION|SCHEDULED_FOR_DELETE|HARD_DELETED|RESTORED
 * - organizationId: 조직 필터
 * - page: 1-based (기본값: 1)
 * - limit: 1-100 (기본값: 20)
 */
export async function GET(req: NextRequest) {
  try {
    const rbacCheck = enforceRBAC(req, {
      allowedRoles: ['GLOBAL_ADMIN'],
      errorMessage: 'GLOBAL_ADMIN 권한이 필요합니다.',
    });
    if (rbacCheck !== true) return rbacCheck;

    const url = new URL(req.url);
    const status = url.searchParams.get('status') || undefined;
    const organizationId = url.searchParams.get('organizationId') || undefined;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '20', 10) || 20);
    const skip = (page - 1) * limit;

    const where = {
      ...(status ? { status } : {}),
      ...(organizationId ? { organizationId } : {}),
    };

    const [requests, total, statusSummary] = await Promise.all([
      prisma.dataDeletionRequest.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          contactId: true,
          organizationId: true,
          requestedBy: true,
          reason: true,
          requestedAt: true,
          scheduledDeleteAt: true,
          status: true,
          gracePeriodDays: true,
          cancelledAt: true,
          completedAt: true,
        },
      }),
      prisma.dataDeletionRequest.count({ where }),
      prisma.dataDeletionRequest.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    const statusCounts = Object.fromEntries(
      statusSummary.map((s) => [s.status, s._count.id])
    );

    logger.log('[GET /api/admin/compliance/deletion-requests]', { page, total, status, organizationId });

    return NextResponse.json({
      ok: true,
      requests,
      summary: {
        pending: statusCounts['PENDING_DELETION'] ?? 0,
        scheduled: statusCounts['SCHEDULED_FOR_DELETE'] ?? 0,
        completed: statusCounts['HARD_DELETED'] ?? 0,
        restored: statusCounts['RESTORED'] ?? 0,
      },
      pagination: { total, page, pageSize: limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error('[GET /api/admin/compliance/deletion-requests]', { err });
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
