export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return NextResponse.json({ ok: false }, { status: 401 });

    const dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true },
    });
    if (!['admin', 'superadmin'].includes(dbUser?.role ?? '')) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const fortyFiveDaysAgo = new Date();
    fortyFiveDaysAgo.setUTCHours(0, 0, 0, 0);
    fortyFiveDaysAgo.setUTCDate(fortyFiveDaysAgo.getUTCDate() - 45);

    const [ledgers, summary, over45DaysCount] = await Promise.all([
      prisma.commissionLedger.groupBy({
        by: ['entryType'],
        where: { isSettled: false },
        _sum: { amount: true, withholdingAmount: true },
        _count: { id: true },
      }),
      prisma.commissionLedger.aggregate({
        where: { isSettled: false },
        _sum: { amount: true, withholdingAmount: true },
        _count: { id: true },
      }),
      prisma.commissionLedger.count({
        where: {
          isSettled: false,
          createdAt: { lt: fortyFiveDaysAgo },
        },
      }),
    ]);

    const totalGross = Number(summary._sum.amount ?? 0);
    const totalWithholding = Number(summary._sum.withholdingAmount ?? 0);

    const byType: Record<string, { gross: number; withholding: number; count: number }> = {};
    for (const row of ledgers) {
      const key = row.entryType ?? 'UNKNOWN';
      byType[key] = {
        gross: Number(row._sum.amount ?? 0),
        withholding: Number(row._sum.withholdingAmount ?? 0),
        count: row._count.id,
      };
    }

    return NextResponse.json({
      ok: true,
      summary: {
        totalGross,
        totalWithholding,
        totalNet: totalGross - totalWithholding,
        ledgerCount: summary._count.id,
      },
      byType,
      over45DaysCount,
    });
  } catch (error) {
    logger.warn('[finance/unsettled] 조회 실패', { error: String(error) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
