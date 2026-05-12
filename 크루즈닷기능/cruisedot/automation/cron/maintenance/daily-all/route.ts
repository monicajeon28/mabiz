export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5분 타임아웃

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * 통합 Daily Cron Job
 * - Vercel Hobby 플랜 cron 제한(2개) 대응
 * - 모든 일일 작업을 하나의 cron으로 통합 실행
 */

async function runTask(name: string, fn: () => Promise<any>) {
  try {
    console.log(`[Cron] Starting: ${name}`);
    const result = await fn();
    console.log(`[Cron] Completed: ${name}`);
    return { name, success: true, result };
  } catch (error: any) {
    console.error(`[Cron] Failed: ${name}`, error);
    return { name, success: false, error: error.message };
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Vercel Cron 인증
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron] Daily All Tasks started');

    const results = [];

    // 1. Database Backup (가장 중요)
    try {
      const { manualRunDatabaseBackup } = await import('@/lib/scheduler/databaseBackup');
      results.push(await runTask('database-backup', manualRunDatabaseBackup));
    } catch (e: any) {
      results.push({ name: 'database-backup', success: false, error: e.message });
    }

    // 2. Drive Sync (계약서, 문서, 여행정보, 리드, 판매, 정산, 이미지)
    try {
      const { syncContracts, syncDocuments, syncLeads, syncSales, syncSettlements, syncAllActiveTripsApis } = await import('@/lib/drive-sync');
      const { syncImageCache } = await import('@/lib/image-cache-sync');
      const { processApisSyncQueue } = await import('@/lib/apis-sync-queue');

      results.push(await runTask('drive-sync', async () => {
        await processApisSyncQueue(10);
        await syncImageCache();
        await Promise.all([
          syncContracts({ cleanup: true, retentionDays: 30 }),
          syncDocuments({ cleanup: true, retentionDays: 30 }),
          syncLeads(),
          syncSales(),
          syncSettlements(),
          syncAllActiveTripsApis(),
        ]);
        return 'All synced';
      }));
    } catch (e: any) {
      results.push({ name: 'drive-sync', success: false, error: e.message });
    }

    // 3. Excel Backup (월별 어필리에이트 데이터)
    try {
      const { uploadAllExcels } = await import('@/lib/affiliate/excel-backup');
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const period = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
      results.push(await runTask('excel-backup', () => uploadAllExcels(period)));
    } catch (e: any) {
      results.push({ name: 'excel-backup', success: false, error: e.message });
    }

    // 4. Expire Trips (만료된 여행 - 기존 로직 완전 이식)
    results.push(await runTask('expire-trips', async () => {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const usersToLock = await prisma.user.findMany({
        where: {
          currentTripEndDate: { lt: oneDayAgo },
          password: '3800',
          isLocked: false,
        },
        select: { id: true, username: true, password: true },
      });

      for (const user of usersToLock) {
        // 사용자 잠금 업데이트
        await prisma.user.update({
          where: { id: user.id },
          data: {
            isLocked: true,
            lockedAt: new Date(),
            lockedReason: '여행 종료 1일 후 자동 잠금',
            password: '8300',
            currentTripEndDate: null,
            onboarded: false,
            loginCount: 0,
          },
        });

        // PasswordEvent 기록
        await prisma.passwordEvent.create({
          data: {
            userId: user.id,
            from: user.password || '3800',
            to: '8300',
            reason: '여행 종료 1일 후 자동 잠금',
          },
        });
      }

      return { lockedCount: usersToLock.length };
    }));

    // 5. Cleanup Messages (30일 이상 된 팀 메시지 삭제)
    results.push(await runTask('cleanup-messages', async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const messageTypes = ['team-dashboard', 'agent-manager', 'manager-agent', 'manager-manager'];

      const messagesToDelete = await prisma.adminMessage.findMany({
        where: {
          createdAt: { lt: thirtyDaysAgo },
          messageType: { in: messageTypes },
        },
        select: { id: true },
      });

      const messageIds = messagesToDelete.map(m => m.id);

      if (messageIds.length > 0) {
        await prisma.userMessageRead.deleteMany({
          where: { messageId: { in: messageIds } },
        });
        await prisma.adminMessage.deleteMany({
          where: { id: { in: messageIds } },
        });
      }

      return { deletedCount: messageIds.length };
    }));

    // 6. Payslip Sender (매월 1일만 실행)
    const now = new Date();
    if (now.getDate() === 1) {
      try {
        const { sendApprovedPayslips } = await import('@/lib/scheduler/payslipSender');
        results.push(await runTask('payslip-sender', sendApprovedPayslips));
      } catch (e: any) {
        results.push({ name: 'payslip-sender', success: false, error: e.message });
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Cron] Daily All Tasks completed in ${duration}ms`);

    return NextResponse.json({
      ok: true,
      message: 'Daily tasks completed',
      duration: `${duration}ms`,
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[Cron] Daily All Tasks error:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
