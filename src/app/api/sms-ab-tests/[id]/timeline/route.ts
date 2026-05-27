/**
 * GET /api/sms-ab-tests/[id]/timeline
 * A/B 테스트 일별 추이 데이터
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { chiSquareTest } from '@/lib/stats/chi-square';
import type { ABTestTimelineResponse, TimelineEntryDTO } from '@/lib/types/ab-test';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getMabizSession();
    if (!session?.organizationId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    const test = await prisma.smsABTest.findUnique({
      where: { id },
    });

    if (!test || test.organizationId !== session.organizationId) {
      return NextResponse.json({ ok: false, error: 'Not Found' }, { status: 404 });
    }

    // 테스트 시작부터 오늘까지의 일별 SmsLog raw query
    const timeline = await prisma.$queryRaw<any[]>`
      SELECT
        CAST("sentAt" AT TIME ZONE 'Asia/Seoul' AS DATE) as date,
        "abTestGroup",
        COUNT(*) as sent,
        COUNT(CASE WHEN "openedAt" IS NOT NULL THEN 1 END) as opened,
        COUNT(CASE WHEN "clickedAt" IS NOT NULL THEN 1 END) as clicked,
        COUNT(CASE WHEN "convertedAt" IS NOT NULL THEN 1 END) as converted
      FROM "CrmSmsLog"
      WHERE "organizationId" = ${session.organizationId}
        AND "abTestId" = ${id}
        AND "sentAt" >= ${test.startedAt}
      GROUP BY date, "abTestGroup"
      ORDER BY date ASC
    `;

    // 날짜별로 그룹화
    const byDate = new Map<string, any>();

    for (const row of timeline) {
      const dateStr = row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date);

      if (!byDate.has(dateStr)) {
        byDate.set(dateStr, {
          date: dateStr,
          groupA: { sent: 0, opened: 0, clicked: 0, converted: 0, rate: 0 },
          groupB: { sent: 0, opened: 0, clicked: 0, converted: 0, rate: 0 },
        });
      }

      const entry = byDate.get(dateStr)!;
      const group = row.abTestGroup === 'A' ? 'groupA' : 'groupB';

      entry[group].sent = Number(row.sent) || 0;
      entry[group].opened = Number(row.opened) || 0;
      entry[group].clicked = Number(row.clicked) || 0;
      entry[group].converted = Number(row.converted) || 0;
      entry[group].rate = entry[group].sent > 0 ? entry[group].converted / entry[group].sent : 0;
    }

    // 결과 조합
    const result: TimelineEntryDTO[] = Array.from(byDate.values()).map((entry, index) => {
      const stats = chiSquareTest(
        { success: entry.groupA.converted, total: entry.groupA.sent || 1 },
        { success: entry.groupB.converted, total: entry.groupB.sent || 1 },
        test.pValueThreshold
      );

      return {
        date: entry.date,
        day: index + 1,
        groupA: entry.groupA,
        groupB: entry.groupB,
        statistics: {
          pValue: stats.pValue,
          isSignificant: stats.isSignificant,
        },
        recommendation: stats.isSignificant
          ? `Day ${index + 1}: 통계적 우위 감지 (p=${stats.pValue.toFixed(3)})`
          : undefined,
      };
    });

    return NextResponse.json({ data: result } as ABTestTimelineResponse);
  } catch (error) {
    logger.error('[sms-ab-tests/[id]/timeline] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { ok: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
