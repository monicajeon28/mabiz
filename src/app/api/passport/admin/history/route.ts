export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

const MAX_LIMIT = 200;
const VALID_STATUS = new Set(['PENDING', 'SUCCESS', 'FAILED']);

function maskPhone(phone: string | null, role: string): string | null {
  if (!phone) return null;
  if (['GLOBAL_ADMIN', 'OWNER'].includes(role)) return phone;
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 11) return `${digits.slice(0, 3)}-****-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 2)}-****-${digits.slice(6)}`;
  return '***-****-****';
}

export async function GET(req: NextRequest) {
  try {
    const manager = await requireCrmManager();
    if (!manager) {
      return NextResponse.json({
        ok: false,
        message: '인증이 필요합니다. 다시 로그인해 주세요.',
      }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userIdParam = searchParams.get('userId');
    const statusParam = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limitParam = parseInt(searchParams.get('limit') ?? '50', 10);
    const take = Math.min(Math.max(limitParam || 50, 1), MAX_LIMIT);
    const skip = (page - 1) * take;

    // Prisma 타입 사용 + 기본 날짜 범위 (최근 30일)
    const where: Prisma.GmPassportRequestLogWhereInput = {
      sentAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    };

    if (userIdParam) {
      const userId = parseInt(userIdParam, 10);
      if (!Number.isNaN(userId)) where.userId = userId;
    }

    if (statusParam) {
      const normalizedStatus = statusParam.toUpperCase();
      if (VALID_STATUS.has(normalizedStatus)) where.status = normalizedStatus;
    }

    // OWNER는 자신이 발송한 로그만 조회
    if (manager.role === 'OWNER') {
      if (manager.id <= 0) {
        // mallUser 없는 비정상 세션 → 빈 결과 (전체 노출 차단)
        return NextResponse.json({ ok: true, data: [], meta: { page, limit: take, count: 0 } });
      }
      where.adminId = manager.id;
    }

    const logs = await prisma.gmPassportRequestLog.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      skip,
      take,
      include: {
        user: { select: { id: true, name: true, phone: true, email: true } },
      },
    });

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
      user: log.user ? {
        id: log.user.id,
        name: log.user.name,
        phone: maskPhone(log.user.phone, manager.role),
        email: log.user.email,
      } : null,
      admin: log.adminId ? { id: log.adminId } : null,
      template: log.templateId ? (templateMap.get(log.templateId) ?? null) : null,
      messageBody: log.messageBody,
      messageChannel: log.messageChannel,
      status: log.status,
      errorReason: log.errorReason,
      sentAt: log.sentAt.toISOString(),
    }));

    return NextResponse.json({ ok: true, data, meta: { page, limit: take, count: data.length } });
  } catch (error) {
    logger.error('[PassportRequest] GET /history error', {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, message: 'Failed to load passport request history.' },
      { status: 500 },
    );
  }
}
