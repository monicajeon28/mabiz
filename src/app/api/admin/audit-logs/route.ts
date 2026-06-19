import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import {
  logAuditEntry,
  checkAuditLogReadPermission,
} from '@/lib/audit-logger';

interface AuditLogRow {
  id: number;
  action: string;
  table: string;
  recordId?: string;
  userId: string;
  organizationId?: string;
  status: string;
  reason?: string;
  details?: any;
  createdAt: Date;
}

/**
 * GET /api/admin/audit-logs
 * 감시 로그 조회 (GLOBAL_ADMIN 전용)
 *
 * Query params:
 * - action: SELECT|INSERT|UPDATE|DELETE (선택)
 * - status: ALLOWED|DENIED (선택)
 * - userId: 사용자 ID (선택)
 * - organizationId: 조직 ID (선택)
 * - startDate: YYYY-MM-DD (선택)
 * - endDate: YYYY-MM-DD (선택)
 * - page: 1-based (기본값: 1)
 * - limit: 1-100 (기본값: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) {
      return NextResponse.json(
        { ok: false, error: 'UNAUTHENTICATED' },
        { status: 401 }
      );
    }

    // 감사 로그 조회 권한 검증
    const permissionCheck = await checkAuditLogReadPermission(ctx);

    if (!permissionCheck.allowed) {
      await logAuditEntry({
        action: 'SELECT',
        table: 'AuditLog',
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        status: 'DENIED',
        reason: permissionCheck.reason,
        details: { endpoint: 'audit-logs' },
        timestamp: new Date(),
      });

      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // 성공적인 접근 로깅
    await logAuditEntry({
      action: 'SELECT',
      table: 'AuditLog',
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      status: 'ALLOWED',
      details: { endpoint: 'audit-logs' },
      timestamp: new Date(),
    });

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    const organizationId = searchParams.get('organizationId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '20', 10) || 20);
    const offset = (page - 1) * limit;

    // 쿼리 조건 구성
    const whereConditions: Prisma.Sql[] = [];

    if (action) {
      whereConditions.push(Prisma.sql`"action" = ${action}`);
    }

    if (status) {
      whereConditions.push(Prisma.sql`"status" = ${status}`);
    }

    if (userId) {
      whereConditions.push(Prisma.sql`"userId" = ${userId}`);
    }

    if (organizationId) {
      whereConditions.push(Prisma.sql`"organizationId" = ${organizationId}`);
    }

    if (startDate) {
      const startDateTime = new Date(`${startDate}T00:00:00Z`);
      whereConditions.push(Prisma.sql`"createdAt" >= ${startDateTime}`);
    }

    if (endDate) {
      const endDateTime = new Date(`${endDate}T23:59:59Z`);
      whereConditions.push(Prisma.sql`"createdAt" <= ${endDateTime}`);
    }

    const whereClause =
      whereConditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(whereConditions, ' AND ')}`
        : Prisma.empty;

    const startTime = Date.now();

    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<AuditLogRow[]>(Prisma.sql`
        SELECT
          id,
          action,
          table,
          "recordId",
          "userId",
          "organizationId",
          status,
          reason,
          details,
          "createdAt"
        FROM "AuditLog"
        ${whereClause}
        ORDER BY "createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      prisma.$queryRaw<[{ total: bigint }]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM "AuditLog"
        ${whereClause}
      `),
    ]);

    const total = Number(countRows[0]?.total ?? 0);
    const totalPages = Math.ceil(total / limit);
    const elapsed = Date.now() - startTime;

    logger.log('[GET /api/admin/audit-logs]', {
      total,
      page,
      elapsedMs: elapsed,
    });

    return NextResponse.json({
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        action: r.action,
        table: r.table,
        recordId: r.recordId,
        userId: r.userId,
        organizationId: r.organizationId,
        status: r.status,
        reason: r.reason,
        details: r.details,
        createdAt: r.createdAt.toISOString(),
      })),
      pagination: {
        total,
        page,
        pageSize: limit,
        totalPages,
      },
      performance: {
        elapsedMs: elapsed,
      },
    });
  } catch (err) {
    logger.error('[GET /api/admin/audit-logs]', { err });
    return NextResponse.json(
      { ok: false, error: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
