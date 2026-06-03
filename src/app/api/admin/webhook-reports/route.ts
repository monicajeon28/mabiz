import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { generateWeeklyReport, generateMonthlyReport } from '@/lib/webhook-performance-report';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (session.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: 'Forbidden: GLOBAL_ADMIN 권한이 필요합니다.' }, { status: 403 });
    }

    const url = new URL(req.url);
    const reportType = url.searchParams.get('type') || 'weekly';
    const dateParam = url.searchParams.get('date');
    const orgIdParam = url.searchParams.get('organizationId') ?? '';

    let report: any;

    if (reportType === 'weekly') {
      const weekEndDate = dateParam ? new Date(dateParam) : undefined;
      report = await generateWeeklyReport(orgIdParam, weekEndDate);
    } else if (reportType === 'monthly') {
      let month: { year: number; month: number } | undefined;

      if (dateParam) {
        const date = new Date(dateParam);
        month = { year: date.getFullYear(), month: date.getMonth() };
      }

      report = await generateMonthlyReport(orgIdParam, month);
    } else {
      return NextResponse.json({ ok: false, error: 'Invalid report type' }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      data: report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Admin/WebhookReports] Error', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { ok: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
