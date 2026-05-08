export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireAdminUser } from '../_utils';

const MAX_MATCHES = 20;

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return NextResponse.json({ 
        ok: false, 
        message: '인증이 필요합니다. 다시 로그인해 주세요.',
        details: 'Admin authentication failed'
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const rawQuery = searchParams.get('q')?.trim() ?? '';
    const normalizedPhone = rawQuery.replace(/\D/g, '');

    const orConditions: Prisma.UserWhereInput[] = [];

    if (rawQuery) {
      orConditions.push(
        {
          name: {
            contains: rawQuery,
            mode: Prisma.QueryMode.insensitive,
          },
        } as Prisma.UserWhereInput,
        {
          email: {
            contains: rawQuery,
            mode: Prisma.QueryMode.insensitive,
          },
        } as Prisma.UserWhereInput,
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

    const matches = await prisma.user.findMany({
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
      },
    });

    return NextResponse.json({ ok: true, data: matches });
  } catch (error) {
    console.error('[PassportRequest] GET /search error:', error);
    return NextResponse.json(
      { ok: false, message: '검색 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
