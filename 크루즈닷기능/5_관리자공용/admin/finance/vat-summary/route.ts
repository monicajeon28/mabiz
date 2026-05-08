export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getVatSummaryData } from '@/lib/finance/vat-aggregation';

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true },
    });
    if (!['admin', 'superadmin'].includes(dbUser?.role ?? '')) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getUTCFullYear();

    if (isNaN(year) || year < 2020 || year > 2100) {
      return NextResponse.json(
        { ok: false, error: '잘못된 year 파라미터 (2020~2100 사이여야 합니다)' },
        { status: 400 },
      );
    }

    const data = await getVatSummaryData(year);

    logger.debug('[vat-summary] 부가세 분기 집계 완료', {
      year,
      totalSales: data.annual.totalSales,
      totalVat: data.annual.totalVat,
    });

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    logger.warn('[vat-summary] 오류 발생', { error: String(error) });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
