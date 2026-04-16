import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const ctx = await getAuthContext();

    // 1. affiliateCode 조회 (AffiliateSale에서 최근 것)
    const sale = await prisma.affiliateSale.findFirst({
      where: { affiliateUserId: ctx.userId },
      orderBy: { createdAt: 'desc' },
      select: { affiliateCode: true },
    });

    if (!sale?.affiliateCode) {
      return NextResponse.json({ ok: true, payslips: [] });
    }

    // 2. 크루즈닷 internal API 호출
    const baseUrl = process.env.CRUISEDOT_BASE_URL ?? 'https://www.cruisedot.co.kr';
    const secret  = process.env.CRUISEDOT_INTERNAL_SECRET;

    if (!secret) {
      logger.log('[PayslipSummary] CRUISEDOT_INTERNAL_SECRET 미설정');
      return NextResponse.json({ ok: true, payslips: [] });
    }

    const res = await fetch(
      `${baseUrl}/api/internal/payslip-summary?affiliateCode=${encodeURIComponent(sale.affiliateCode)}`,
      {
        headers: { Authorization: `Bearer ${secret}` },
        next: { revalidate: 300 }, // 5분 캐시
      }
    );

    if (!res.ok) {
      logger.log('[PayslipSummary] 크루즈닷 응답 실패', { status: res.status });
      return NextResponse.json({ ok: true, payslips: [] });
    }

    const data = await res.json() as { ok: boolean; payslips: unknown[] };
    return NextResponse.json({ ok: true, payslips: data.payslips ?? [] });

  } catch (e) {
    logger.log('[PayslipSummary] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: true, payslips: [] }); // 실패해도 my-sales 깨지면 안 됨
  }
}
