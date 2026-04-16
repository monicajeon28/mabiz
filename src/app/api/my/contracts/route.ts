import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const ctx = await getAuthContext();

    // OWNER만 접근 가능
    if (ctx.role !== 'OWNER') {
      return NextResponse.json({ ok: true, contracts: [] });
    }

    // 1. affiliateCode 조회
    const sale = await prisma.affiliateSale.findFirst({
      where: { affiliateUserId: ctx.userId },
      orderBy: { createdAt: 'desc' },
      select: { affiliateCode: true },
    });

    if (!sale?.affiliateCode) {
      return NextResponse.json({ ok: true, contracts: [] });
    }

    // 2. 크루즈닷 internal API 호출
    const baseUrl = process.env.CRUISEDOT_BASE_URL;
    const secret  = process.env.CRUISEDOT_INTERNAL_SECRET;

    if (!baseUrl || !secret) {
      logger.log('[Contracts] CRUISEDOT 환경변수 미설정');
      return NextResponse.json({ ok: true, contracts: [] });
    }

    const res = await fetch(
      `${baseUrl}/api/internal/contracts?affiliateCode=${encodeURIComponent(sale.affiliateCode)}`,
      {
        headers: { Authorization: `Bearer ${secret}` },
        next: { revalidate: 300 }, // 5분 캐시
      }
    );

    if (!res.ok) {
      logger.log('[Contracts] 크루즈닷 응답 실패', { status: res.status });
      return NextResponse.json({ ok: true, contracts: [] });
    }

    const data = await res.json() as { ok: boolean; contracts: unknown[] };
    return NextResponse.json({ ok: true, contracts: data.contracts ?? [] });

  } catch (e) {
    logger.log('[Contracts] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: true, contracts: [] });
  }
}
