import { NextResponse } from 'next/server';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/campaigns/delta/stats
 * 시간대별 예상 발송 건수 반환 (ScheduleVisualizer용)
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (!ctx.userId) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    const orgId = resolveOrgId(ctx);

    const activeCount = await prisma.contact.count({
      where: {
        organizationId: orgId,
        optOutAt: null,
      },
    });

    // 시간대별 오픈율 가중치 (SMS 수신률 경험치)
    const hourWeights: Record<number, number> = {
      8:  0.55,
      9:  0.80,
      10: 0.90,
      11: 0.85,
      12: 0.70,
      13: 0.65,
      14: 0.75,
      15: 0.80,
      16: 0.75,
      17: 0.70,
      18: 0.65,
      19: 0.72,
      20: 0.68,
    };

    const estimatesByHour: Record<number, number> = {};
    for (const [hour, weight] of Object.entries(hourWeights)) {
      estimatesByHour[Number(hour)] = Math.round(activeCount * weight);
    }

    return NextResponse.json({ ok: true, estimatesByHour, totalContacts: activeCount });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
