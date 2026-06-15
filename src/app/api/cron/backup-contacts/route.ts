import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { backupContactsToDrive } from '@/lib/google-drive';
import { logger } from '@/lib/logger';

/**
 * GET /api/cron/backup-contacts
 *
 * Vercel Cron Job: 매일 자정 (UTC+9 기준 08:00 UTC)
 * 모든 조직의 Contact을 자동으로 Google Drive에 백업
 *
 * Cron 스케줄: vercel.json 참고
 * {
 *   "crons": [{
 *     "path": "/api/cron/backup-contacts",
 *     "schedule": "0 8 * * *"  // 매일 08:00 UTC (한국시간 17:00)
 *   }]
 * }
 */
export async function GET(req: NextRequest) {
  // Cron 인증 (Bearer Token)
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { ok: false, error: '인증 실패' },
      { status: 401 }
    );
  }

  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    organizations: [] as Array<{
      id: string;
      name: string;
      status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
      contactCount?: number;
      errorMessage?: string;
    }>,
  };

  try {
    // 모든 조직 조회
    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
      },
      where: {
        googleDriveAccessToken: { not: null },
      },
    });

    results.total = organizations.length;

    for (const org of organizations) {
      try {
        // 조직의 Google Drive 액세스 토큰 조회
        const orgFull = await prisma.organization.findUnique({
          where: { id: org.id },
          select: { googleDriveAccessToken: true },
        });

        // Google Drive 연동되지 않은 조직 스킵
        if (!orgFull?.googleDriveAccessToken) {
          results.skipped++;
          results.organizations.push({
            id: org.id,
            name: org.name,
            status: 'SKIPPED',
          });
          continue;
        }

        // Contact 조회
        const contacts = await prisma.contact.findMany({
          where: {
            organizationId: org.id,
            visibility: { in: ['SHARED', 'ADMIN_ONLY'] },
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            sourceId: true,
            visibility: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        // 백업 실행
        const result = await backupContactsToDrive(
          org.id,
          contacts as Array<{
            id: string;
            name: string;
            phone: string;
            email?: string | null;
            sourceId?: string | null;
            visibility?: string;
            createdAt: Date;
            updatedAt: Date;
          }>,
          orgFull.googleDriveAccessToken
        );

        // 백업 기록 저장
        await prisma.contactBackup.create({
          data: {
            organizationId: org.id,
            backupAt: result.backupAt,
            contactCount: result.count,
            driveSheetId: result.sheetId,
            backupType: 'AUTO',
            status: 'SUCCESS',
          },
        });

        results.success++;
        results.organizations.push({
          id: org.id,
          name: org.name,
          status: 'SUCCESS',
          contactCount: result.count,
        });

        logger.info(`[CRON] 백업 완료: ${org.name} (${result.count}명)`, {
          organizationId: org.id,
          sheetId: result.sheetId,
        });
      } catch (err) {
        results.failed++;
        const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류';

        results.organizations.push({
          id: org.id,
          name: org.name,
          status: 'FAILED',
          errorMessage,
        });

        // 실패 기록
        try {
          await prisma.contactBackup.create({
            data: {
              organizationId: org.id,
              backupAt: new Date(),
              contactCount: 0,
              backupType: 'AUTO',
              status: 'FAILED',
              errorMessage,
            },
          });
        } catch (logErr) {
          logger.error('[CRON] 백업 실패 기록 저장 실패', logErr);
        }

        logger.error(`[CRON] 백업 실패: ${org.name}`, err);
      }
    }

    return NextResponse.json({
      ok: true,
      message: '일일 자동 백업 완료',
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[GET /api/cron/backup-contacts]', err);

    return NextResponse.json(
      {
        ok: false,
        error: 'Cron 백업 실패',
        message: err instanceof Error ? err.message : '',
      },
      { status: 500 }
    );
  }
}
