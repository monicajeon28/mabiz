import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

type Statement = {
  id: string;
  saleDate: string;
  externalOrderCode: string | null;
  saleAmount: number;
  commissionRate: number;
  confirmedAmount: number;
  status: string;
};

export async function GET() {
  try {
    const ctx = await getAuthContext();

    // 1. affiliateCode 조회
    const sale = await prisma.affiliateSale.findFirst({
      where: { affiliateUserId: ctx.userId },
      orderBy: { createdAt: 'desc' },
      select: { affiliateCode: true },
    });

    if (!sale?.affiliateCode) {
      return NextResponse.json({ ok: true, statements: [] });
    }

    // 2. 크루즈닷 internal API 호출
    const baseUrl = process.env.CRUISEDOT_BASE_URL;
    const secret  = process.env.CRUISEDOT_INTERNAL_SECRET;

    if (!baseUrl || !secret) {
      logger.log('[Statements] CRUISEDOT 환경변수 미설정');
      return NextResponse.json({ ok: true, statements: [] });
    }

    const res = await fetch(
      `${baseUrl}/api/internal/statements?affiliateCode=${encodeURIComponent(sale.affiliateCode)}`,
      {
        headers: { Authorization: `Bearer ${secret}` },
        next: { revalidate: 300 }, // 5분 캐시
      }
    );

    if (!res.ok) {
      logger.log('[Statements] 크루즈닷 응답 실패', { status: res.status });
      return NextResponse.json({ ok: true, statements: [] });
    }

    const data = await res.json() as { ok: boolean; statements: Statement[] };
    return NextResponse.json({ ok: true, statements: data.statements ?? [] });

  } catch (e) {
    logger.log('[Statements] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: true, sales: [] });
  }
}
