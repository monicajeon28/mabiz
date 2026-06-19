import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/cron/monthly-report
 * 매월 1일 자동 실행 (Vercel Cron)
 * Schedule: 0 1 1 * * (매월 1일 1시)
 *
 * CommissionLedger 데이터를 집계해서 MonthlySettlement 생성
 */
export async function POST(req: NextRequest) {
  try {
    // Vercel Cron 요청 검증
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken) {
      logger.warn('[Cron] 월간리포트 - CRON_SECRET 미설정');
      return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 503 });
    }
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const tokenBuf = Buffer.from(token, 'utf8');
    const expectedBuf = Buffer.from(expectedToken, 'utf8');
    if (tokenBuf.byteLength !== expectedBuf.byteLength || !timingSafeEqual(tokenBuf, expectedBuf)) {
      logger.warn('[Cron] 월간리포트 - 비인가 요청');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const previousMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const previousYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    const periodStart = new Date(previousYear, previousMonth, 1);
    const periodEnd = new Date(previousYear, previousMonth + 1, 1);

    logger.log('[Cron] 월간리포트 생성 시작', {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString()
    });

    // 모든 Organization에 대해 월간 정산 생성 (테넌트 격리 P0-SEC-001)
    const organizations = await prisma.organization.findMany();

    const results = [];

    for (const org of organizations) {
      // CommissionLedger 집계 (이전 월, 테넌트별)
      const commissions = await prisma.commissionLedger.findMany({
        where: {
          organizationId: org.id,
          createdAt: {
            gte: periodStart,
            lt: periodEnd
          }
        },
        select: { amount: true, isSettled: true }
      });

      const totalAmount = commissions.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
      const settledAmount = commissions
        .filter((c: any) => c.isSettled)
        .reduce((sum: number, c: any) => sum + (c.amount || 0), 0);

      // MonthlySettlement 생성/업데이트 (테넌트별)
      const existing = await prisma.monthlySettlement.findFirst({
        where: {
          organizationId: org.id,
          periodStart,
          periodEnd
        }
      });

      const summary = {
        totalCommission: totalAmount,
        settledCommission: settledAmount,
        unsettledCommission: totalAmount - settledAmount,
        commissionCount: commissions.length,
        generatedAt: now.toISOString()
      };

      let settlement;
      if (existing) {
        settlement = await prisma.monthlySettlement.update({
          where: { id: existing.id },
          data: {
            summary,
            updatedAt: now
          }
        });
      } else {
        settlement = await prisma.monthlySettlement.create({
          data: {
            organizationId: org.id,
            periodStart,
            periodEnd,
            status: 'DRAFT',
            summary,
            notes: `Auto-generated monthly settlement: ${commissions.length} ledger entries`,
            updatedAt: now
          }
        });
      }

      results.push({
        organizationId: org.id,
        organizationName: org.name,
        settlementId: settlement.id,
        totalAmount,
        settledAmount,
        status: settlement.status
      });

      logger.log('[Cron] 월간리포트 생성 완료 (조직별)', {
        organizationId: org.id,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        totalAmount,
        settlementId: settlement.id
      });
    }

    return NextResponse.json({
      ok: true,
      processingTime: `${organizations.length} organizations`,
      settlements: results
    });
  } catch (err) {
    logger.error('[Cron] 월간리포트 예상 밖의 에러', {
      error: err instanceof Error ? err.message : String(err)
    });

    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
