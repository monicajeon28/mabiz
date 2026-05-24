export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/cron/daily-report
 *
 * 어제의 활동 통계를 수집합니다:
 * - 저장된 콜 기록 개수
 * - 백업 성공/실패
 * - 활동이 많은 고객 TOP 5
 *
 * 나중에 이 데이터를 이메일, Slack 등으로 전송 가능
 */
export async function GET(req: Request) {
  try {
    const cronSecret = req.headers.get('x-vercel-cron-secret');
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ ok: false, message: '인증 실패' }, { status: 401 });
    }

    logger.log('[CRON] daily-report 시작');

    // 어제의 시작과 끝
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    // 1. 어제 저장된 콜 기록 통계
    const callLogsYesterday = await prisma.callLog.count({
      where: {
        createdAt: { gte: yesterday, lt: today },
      },
    });

    // 2. 어제 백업 통계
    const backupStatsYesterday = await prisma.backupJob.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: yesterday, lt: today },
      },
      _count: true,
    });

    const backupSuccess = backupStatsYesterday.find(s => s.status === 'SUCCESS')?._count ?? 0;
    const backupFailure = backupStatsYesterday.find(s => s.status === 'FAILED')?._count ?? 0;
    const backupPending = backupStatsYesterday.find(s => s.status === 'PENDING')?._count ?? 0;

    // 3. 활동이 많은 고객 TOP 5 (어제)
    const topCustomers = await prisma.callLog.groupBy({
      by: ['contactId'],
      where: {
        createdAt: { gte: yesterday, lt: today },
      },
      _count: true,
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    // 고객 정보 함께 조회
    const topCustomerDetails = await Promise.all(
      topCustomers.map(async (tc) => {
        const contact = await prisma.contact.findUnique({
          where: { id: tc.contactId },
          select: { id: true, name: true, phone: true },
        });
        return {
          contactId: tc.contactId,
          contactName: contact?.name ?? '(미상)',
          callCount: tc._count,
        };
      })
    );

    // 4. 전체 통계
    const totalCallLogs = await prisma.callLog.count();
    const totalBackupSuccess = await prisma.backupJob.count({
      where: { status: 'SUCCESS' },
    });
    const totalBackupFailure = await prisma.backupJob.count({
      where: { status: 'FAILED' },
    });

    const report = {
      date: yesterday.toISOString().split('T')[0],
      callLogs: {
        yesterday: callLogsYesterday,
        total: totalCallLogs,
      },
      backup: {
        yesterday: {
          success: backupSuccess,
          failure: backupFailure,
          pending: backupPending,
          total: backupSuccess + backupFailure + backupPending,
          successRate: backupSuccess + backupFailure > 0
            ? `${((backupSuccess / (backupSuccess + backupFailure)) * 100).toFixed(2)}%`
            : 'N/A',
        },
        allTime: {
          success: totalBackupSuccess,
          failure: totalBackupFailure,
        },
      },
      topCustomers: topCustomerDetails,
      timestamp: new Date().toISOString(),
    };

    logger.log('[CRON] daily-report 완료', {
      date: report.date,
      callLogs: report.callLogs.yesterday,
      backupSuccess: backupSuccess,
      backupFailure: backupFailure,
    });

    return NextResponse.json(report);
  } catch (err) {
    logger.error('[CRON] daily-report 에러', { err });
    return NextResponse.json(
      { ok: false, message: '일일 보고서 생성 실패' },
      { status: 500 }
    );
  }
}
