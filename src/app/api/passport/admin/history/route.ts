export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

const MAX_LIMIT = 200;
const VALID_STATUS = new Set(['PENDING', 'SUCCESS', 'FAILED']);

export async function GET(req: NextRequest) {
  try {
    const manager = await requireCrmManager();
    if (!manager) {
      return NextResponse.json({
        ok: false,
        message: '인증이 필요합니다. 다시 로그인해 주세요.',
        details: 'Manager authentication failed',
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userIdParam = searchParams.get('userId');
    const statusParam = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limitParam = parseInt(searchParams.get('limit') ?? '50', 10);
    const take = Math.min(Math.max(limitParam || 50, 1), MAX_LIMIT);
    const skip = (page - 1) * take;

    const where: Record<string, unknown> = {};

    if (userIdParam) {
      const userId = parseInt(userIdParam, 10);
      if (!Number.isNaN(userId)) {
        where.userId = userId;
      }
    }

    if (statusParam) {
      const normalizedStatus = statusParam.toUpperCase();
      if (VALID_STATUS.has(normalizedStatus)) {
        where.status = normalizedStatus;
      }
    }

    const logs = await prisma.gmPassportRequestLog.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      skip,
      take,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        admin: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // templateId로 별도 조회 (relation 미정의)
    const templateIds = [...new Set(logs.map((l) => l.templateId).filter(Boolean))] as number[];
    const templates = templateIds.length > 0
      ? await prisma.gmPassportRequestTemplate.findMany({
          where: { id: { in: templateIds } },
          select: { id: true, title: true, isDefault: true },
        })
      : [];
    const templateMap = new Map(templates.map((t) => [t.id, t]));

    const data = logs.map((log) => ({
      id: log.id,
      user: log.user,
      admin: log.admin,
      template: log.templateId ? (templateMap.get(log.templateId) ?? null) : null,
      messageBody: log.messageBody,
      messageChannel: log.messageChannel,
      status: log.status,
      errorReason: log.errorReason,
      sentAt: log.sentAt.toISOString(),
    }));

    return NextResponse.json({
      ok: true,
      data,
      meta: {
        page,
        limit: take,
        count: data.length,
      },
    });
  } catch (error) {
    logger.error('[PassportRequest] GET /history error', { error });
    return NextResponse.json(
      { ok: false, message: 'Failed to load passport request history.' },
      { status: 500 },
    );
  }
}
