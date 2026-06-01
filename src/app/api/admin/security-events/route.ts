import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import {
  logAuditEntry,
  checkAuditLogReadPermission,
} from '@/lib/audit-logger';

interface SecurityEventRow {
  id: number;
  type: string;
  severity: string;
  userId: string;
  organizationId?: string;
  description: string;
  details?: any;
  createdAt: Date;
}

/**
 * GET /api/admin/security-events
 * 보안 이벤트 조회 (GLOBAL_ADMIN 전용)
 *
 * Query params:
 * - type: UNAUTHORIZED_ACCESS|PERMISSION_DENIED|SUSPICIOUS_ACTIVITY|PRIVILEGE_ESCALATION (선택)
 * - severity: LOW|MEDIUM|HIGH|CRITICAL (선택)
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

    // 보안 이벤트 조회 권한 검증
    const permissionCheck = await checkAuditLogReadPermission(ctx);

    if (!permissionCheck.allowed) {
      await logAuditEntry({
        action: 'SELECT',
        table: 'SecurityEvent',
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        status: 'DENIED',
        reason: permissionCheck.reason,
        details: { endpoint: 'security-events' },
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
      table: 'SecurityEvent',
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      status: 'ALLOWED',
      details: { endpoint: 'security-events' },
      timestamp: new Date(),
    });

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const severity = searchParams.get('severity');
    const userId = searchParams.get('userId');
    const organizationId = searchParams.get('organizationId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '20') || 20);
    const offset = (page - 1) * limit;

    // 쿼리 조건 구성
    const whereConditions: Prisma.Sql[] = [];

    if (type) {
      whereConditions.push(Prisma.sql`"type" = ${type}`);
    }

    if (severity) {
      // 심각도 필터: 선택한 심각도 이상의 이벤트
      const severityLevels: Record<string, string[]> = {
        CRITICAL: ['CRITICAL'],
        HIGH: ['CRITICAL', 'HIGH'],
        MEDIUM: ['CRITICAL', 'HIGH', 'MEDIUM'],
        LOW: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
      };

      const levels = severityLevels[severity] || [severity];
      whereConditions.push(
        Prisma.sql`"severity" = ANY(${levels}::text[])`
      );
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
      prisma.$queryRaw<SecurityEventRow[]>(Prisma.sql`
        SELECT
          id,
          type,
          severity,
          "userId",
          "organizationId",
          description,
          details,
          "createdAt"
        FROM "SecurityEvent"
        ${whereClause}
        ORDER BY "createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      prisma.$queryRaw<[{ total: bigint }]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM "SecurityEvent"
        ${whereClause}
      `),
    ]);

    const total = Number(countRows[0]?.total ?? 0);
    const totalPages = Math.ceil(total / limit);
    const elapsed = Date.now() - startTime;

    logger.log('[GET /api/admin/security-events]', {
      total,
      page,
      elapsedMs: elapsed,
    });

    // 심각도별 통계
    const stats = await prisma.$queryRaw<
      { severity: string; count: bigint }[]
    >(Prisma.sql`
      SELECT severity, COUNT(*)::bigint AS count
      FROM "SecurityEvent"
      ${whereClause}
      GROUP BY severity
      ORDER BY CASE severity
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        WHEN 'LOW' THEN 4
      END
    `);

    return NextResponse.json({
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        type: r.type,
        severity: r.severity,
        userId: r.userId,
        organizationId: r.organizationId,
        description: r.description,
        details: r.details,
        createdAt: r.createdAt.toISOString(),
      })),
      pagination: {
        total,
        page,
        pageSize: limit,
        totalPages,
      },
      stats: Object.fromEntries(
        stats.map((s) => [s.severity, Number(s.count)])
      ),
      performance: {
        elapsedMs: elapsed,
      },
    });
  } catch (err) {
    logger.error('[GET /api/admin/security-events]', { err });
    return NextResponse.json(
      { ok: false, error: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
