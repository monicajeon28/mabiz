export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

const CRITICAL_THRESHOLD = 10;

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

    const [countResult, amountResult] = await Promise.all([
      prisma.payment.count({
        where: {
          status: 'completed',
          saleId: null,
          paidAt: { not: null },
        },
      }),
      prisma.payment.aggregate({
        where: {
          status: 'completed',
          saleId: null,
          paidAt: { not: null },
        },
        _sum: { amount: true },
      }),
    ]);

    const count = countResult;
    const amount = Number(amountResult._sum.amount ?? 0);
    const riskLevel: 'OK' | 'CRITICAL' = count >= CRITICAL_THRESHOLD ? 'CRITICAL' : 'OK';

    return NextResponse.json({
      ok: true,
      unlinkedPayments: { count, amount, riskLevel },
    });
  } catch (error) {
    logger.warn('[finance/audit] 조회 실패', { error: String(error) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
