import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAutomationLogsQuerySchema, PaginatedAutomationLogs } from '@/lib/schemas/automation-log-schema';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { checkAdminAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // RAG: checkAdminAuth() 패턴 적용 (lib/auth.ts)
    // AGI: IDOR 방지 — 클라이언트 조작 가능한 organizationId를 세션으로 검증
    const { isAdmin, user, error: authError } = await checkAdminAuth();
    if (!isAdmin || !user) {
      logger.warn('[AutomationLogs] 비인가 접근 시도', {
        errorType: authError,
        ip: request.headers.get('x-forwarded-for') ?? 'unknown',
      });
      return NextResponse.json(
        { ok: false, error: '관리자 인증이 필요합니다' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 20;
    const action = searchParams.get('action');
    const relatedType = searchParams.get('relatedType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    const query = getAutomationLogsQuerySchema.parse({
      organizationId,
      page,
      limit,
      action: action || undefined,
      relatedType: relatedType || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      search: search || undefined,
    });

    const skip = (query.page - 1) * query.limit;

    // Build where clause
    const where: Record<string, any> = {
      organizationId: query.organizationId,
    };

    if (query.action) {
      where.action = query.action;
    }

    if (query.relatedType) {
      where.relatedType = query.relatedType;
    }

    if (query.startDate) {
      where.createdAt = {
        ...where.createdAt,
        gte: new Date(query.startDate),
      };
    }

    if (query.endDate) {
      where.createdAt = {
        ...where.createdAt,
        lte: new Date(query.endDate),
      };
    }

    // Parallel count and fetch
    const [logs, total] = await Promise.all([
      prisma.automationLog.findMany({
        where,
        include: {
          User: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      prisma.automationLog.count({ where }),
    ]);

    const response: PaginatedAutomationLogs = {
      logs: logs.map((log) => ({
        ...log,
        createdByUser: log.User,
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        hasMore: skip + query.limit < total,
      },
    };

    return NextResponse.json({ ok: true, data: response });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Validation error in automation logs', {
        error: error.errors,
      });
      return NextResponse.json(
        { ok: false, error: 'Invalid request parameters' },
        { status: 400 }
      );
    }

    logger.error('Error fetching automation logs', { error });
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
