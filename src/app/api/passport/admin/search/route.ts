export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

const MAX_MATCHES = 20;

export async function GET(req: NextRequest) {
  try {
    const manager = await requireCrmManager();
    if (!manager) {
      return NextResponse.json({
        ok: false,
        message: '인증이 필요합니다. 다시 로그인해 주세요.',
        details: 'Admin authentication failed'
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const rawQuery = searchParams.get('q')?.trim() ?? '';
    const normalizedPhone = rawQuery.replace(/\D/g, '');

    const orConditions: Prisma.GmUserWhereInput[] = [];

    if (rawQuery) {
      orConditions.push(
        {
          name: {
            contains: rawQuery,
            mode: Prisma.QueryMode.insensitive,
          },
        } as Prisma.GmUserWhereInput,
        {
          email: {
            contains: rawQuery,
            mode: Prisma.QueryMode.insensitive,
          },
        } as Prisma.GmUserWhereInput,
        { phone: { contains: rawQuery } }
      );
    }

    if (normalizedPhone.length >= 3 && normalizedPhone !== rawQuery) {
      orConditions.push({ phone: { contains: normalizedPhone } });
    }

    const where = {
      role: { not: 'admin' },
      ...(orConditions.length ? { OR: orConditions } : {}),
    } as const;

    const matches = await prisma.gmUser.findMany({
      where,
      orderBy: rawQuery ? { name: 'asc' } : { createdAt: 'desc' },
      take: MAX_MATCHES,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        customerStatus: true,
        createdAt: true,
        tripCount: true,
        trips: {
          select: {
            id: true,
            productCode: true,
            cruiseName: true,
            departureDate: true,
            startDate: true,
            endDate: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        passportSubmissions: {
          select: {
            id: true,
            isSubmitted: true,
            updatedAt: true,
            submittedAt: true,
            tokenExpiresAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        passportRequestsSent: {
          select: {
            id: true,
            status: true,
            sentAt: true,
            messageChannel: true,
            admin: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { sentAt: 'desc' },
          take: 1,
        },
      },
    });

    return NextResponse.json({ ok: true, data: matches });
  } catch (error) {
    logger.error('[PassportRequest] GET /search error:', error as Record<string, unknown>);
    return NextResponse.json(
      { ok: false, message: '검색 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
