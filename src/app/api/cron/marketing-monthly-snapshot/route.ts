export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { exportMonthlyToSheets } from '@/lib/marketing-sheets';
import type { MonthlyOrgRow } from '@/lib/marketing-sheets';

/**
 * POST /api/cron/marketing-monthly-snapshot
 * 매월 1일 UTC 00:30 (KST 09:30) 실행
 * 전월 매출 데이터를 Supabase + Google Sheets에 저장
 */
export async function POST(req: NextRequest) {
  // 인증
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.length < 16) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET 미설정' }, { status: 503 });
  }
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const tokenBuf = Buffer.from(token, 'utf8');
  const secretBuf = Buffer.from(cronSecret, 'utf8');
  if (
    tokenBuf.byteLength !== secretBuf.byteLength ||
    !timingSafeEqual(tokenBuf, secretBuf)
  ) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  try {
    // month 파라미터 (없으면 전월 자동 계산)
    const monthParam = req.nextUrl.searchParams.get('month') ?? '';
    const KST_OFFSET = 9 * 60 * 60 * 1000;
    const nowKST = new Date(Date.now() + KST_OFFSET);

    let selectedYear: number;
    let selectedMonth0: number;

    if (/^\d{4}-\d{2}$/.test(monthParam)) {
      const [y, m] = monthParam.split('-').map(Number);
      selectedYear = y;
      selectedMonth0 = m - 1;
    } else {
      // 기본: 전월 (cron은 1일에 실행되므로 전월 집계)
      selectedYear = nowKST.getUTCFullYear();
      selectedMonth0 = nowKST.getUTCMonth() - 1;
      if (selectedMonth0 < 0) {
        selectedYear -= 1;
        selectedMonth0 = 11;
      }
    }

    const selectedMonthKey = `${selectedYear}-${String(selectedMonth0 + 1).padStart(2, '0')}`;
    const thisMonthStart = new Date(Date.UTC(selectedYear, selectedMonth0, 1) - KST_OFFSET);
    const thisMonthEnd = new Date(Date.UTC(selectedYear, selectedMonth0 + 1, 1) - KST_OFFSET);

    logger.info('[cron/marketing-monthly-snapshot] 시작', { month: selectedMonthKey });

    // 1. 조직 목록 조회
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    // 2. 전체 + 조직별 매출 집계
    type RevRow = { organizationId: string; revenue: number | bigint; count: number | bigint };
    type RefRow = { organizationId: string; refund: number | bigint };

    const [revRows, refRows] = await Promise.all([
      prisma.$queryRaw<RevRow[]>`
        SELECT af."organizationId",
               COALESCE(SUM(CASE WHEN pp."status" = 'paid' THEN pp."amount" ELSE 0 END), 0)::float AS revenue,
               COUNT(CASE WHEN pp."status" = 'paid' THEN 1 END)::bigint AS count
        FROM "CrmPayAppPayment" pp
        INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
        WHERE pp."createdAt" >= ${thisMonthStart} AND pp."createdAt" < ${thisMonthEnd}
        GROUP BY af."organizationId"
      `,
      prisma.$queryRaw<RefRow[]>`
        SELECT af."organizationId" AS "organizationId",
               COALESCE(SUM(pp."amount"), 0)::float AS refund
        FROM "CrmPayAppPayment" pp
        INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
        WHERE pp."status" IN ('cancelled', 'refunded')
          AND pp."createdAt" >= ${thisMonthStart} AND pp."createdAt" < ${thisMonthEnd}
        GROUP BY af."organizationId"
      `,
    ]);

    const revMap = new Map(
      revRows.map(r => [
        r.organizationId,
        { revenue: Number(r.revenue), count: Number(r.count) },
      ])
    );
    const refMap = new Map(refRows.map(r => [r.organizationId, Number(r.refund)]));

    // 3. 조직별 스냅샷 rows 준비
    const orgRows: MonthlyOrgRow[] = orgs
      .map(org => {
        const rev = revMap.get(org.id)?.revenue ?? 0;
        const ref = refMap.get(org.id) ?? 0;
        return {
          month: selectedMonthKey,
          orgName: org.name ?? '이름없는 대리점',
          totalRevenue: rev,
          totalRefund: ref,
          netRevenue: rev - ref,
          paidCount: Number(revMap.get(org.id)?.count ?? 0),
        };
      })
      .filter(r => r.totalRevenue > 0 || r.paidCount > 0);

    // 4. 전체 합계 row
    const totalRev = orgRows.reduce((s, r) => s + r.totalRevenue, 0);
    const totalRef = orgRows.reduce((s, r) => s + r.totalRefund, 0);
    const totalCount = orgRows.reduce((s, r) => s + r.paidCount, 0);
    const totalRow: MonthlyOrgRow = {
      month: selectedMonthKey,
      orgName: '전체',
      totalRevenue: totalRev,
      totalRefund: totalRef,
      netRevenue: totalRev - totalRef,
      paidCount: totalCount,
    };
    const allRows = [totalRow, ...orgRows];

    // 5. Prisma upsert (MarketingMonthlySalesSnapshot)
    // organizationId null 처리: "전체" 행은 null, 조직 행은 해당 id
    let savedCount = 0;
    for (const row of allRows) {
      const orgId =
        row.orgName === '전체'
          ? null
          : (orgs.find(o => (o.name ?? '') === row.orgName)?.id ?? null);

      await prisma.marketingMonthlySalesSnapshot.upsert({
        where: {
          month_organizationId: {
            month: row.month,
            organizationId: orgId as string,
          },
        },
        create: {
          month: row.month,
          organizationId: orgId,
          orgName: row.orgName,
          totalRevenue: row.totalRevenue,
          totalRefund: row.totalRefund,
          netRevenue: row.netRevenue,
          paidCount: row.paidCount,
        },
        update: {
          orgName: row.orgName,
          totalRevenue: row.totalRevenue,
          totalRefund: row.totalRefund,
          netRevenue: row.netRevenue,
          paidCount: row.paidCount,
        },
      });
      savedCount++;
    }

    // 6. Google Sheets 백업 (실패해도 cron 성공 처리)
    let sheetsStatus = 'skipped';
    try {
      await exportMonthlyToSheets(allRows);
      sheetsStatus = 'success';
    } catch (sheetsErr) {
      sheetsStatus = `failed: ${sheetsErr instanceof Error ? sheetsErr.message : String(sheetsErr)}`;
      logger.warn('[cron/marketing-monthly-snapshot] Sheets 백업 실패 (무시)', { sheetsStatus });
    }

    const elapsed = Date.now() - startTime;
    logger.info('[cron/marketing-monthly-snapshot] 완료', {
      month: selectedMonthKey,
      savedCount,
      sheetsStatus,
      elapsed,
    });

    return NextResponse.json({
      ok: true,
      month: selectedMonthKey,
      savedCount,
      totalRevenue: totalRow.totalRevenue,
      orgCount: orgRows.length,
      sheetsStatus,
      elapsedMs: elapsed,
    });
  } catch (err) {
    logger.error('[cron/marketing-monthly-snapshot] 오류', {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}

// GET도 지원 (수동 트리거)
export async function GET(req: NextRequest) {
  return POST(req);
}
