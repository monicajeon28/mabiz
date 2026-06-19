export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  uploadPassportToGoogleDrive,
  deleteOldBackups,
  generateBackupFileName,
} from '@/lib/passport-google-drive-backup';

/**
 * Cron: 매일 01:00 UTC (한국 시간 10:00 AM)
 *
 * 로직:
 * 1. 24시간 내 업로드된 여권 게스트 조회
 * 2. googleDriveFileId 없는 게스트 파일 업로드
 * 3. 1년 초과 파일 삭제
 * 4. BackupLog 저장
 * 5. 성공/실패 로그
 *
 * GET /api/cron/backup-passport
 * 또는
 * POST /api/cron/backup-passport (Vercel Cron Job)
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    // Cron 보안: Authorization 헤더 확인
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ ok: false, error: 'CRON_SECRET 미설정' }, { status: 503 });
    }
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const tokenBuf = Buffer.from(token, 'utf8');
    const secretBuf = Buffer.from(cronSecret, 'utf8');
    if (tokenBuf.byteLength !== secretBuf.byteLength || !timingSafeEqual(tokenBuf, secretBuf)) {
      logger.warn('[Cron] Backup Passport - Unauthorized access attempt');
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.info('[Cron] Backup Passport - 시작');

    // 1. 24시간 내 업로드된 여권 게스트 조회 (googleDriveFileId 없는 것)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const pendingGuests = await prisma.gmPassportSubmissionGuest.findMany({
      where: {
        submittedAt: {
          gte: oneDayAgo, // 24시간 내
        },
        backupStatus: 'pending', // pending 상태
        passportNumber: {
          not: null, // 여권번호가 있는 것만
        },
      },
      select: {
        id: true,
        name: true,
        passportNumber: true,
        submittedAt: true,
        submissionId: true,
      },
      orderBy: { submittedAt: 'asc' },
    });

    logger.info(
      `[Cron] Backup Passport - ${pendingGuests.length}개 게스트 발견`
    );

    // 2. 여권 파일이 있는 경우 Google Drive 업로드 시도
    let successCount = 0;
    let failureCount = 0;

    for (const guest of pendingGuests) {
      try {
        // 조직 Google OAuth 토큰 조회
        // ⚠️ 임시: 현재 Passport는 조직 단위 Google Drive 백업을 지원하지 않으므로
        // 나중에 환경변수 또는 조직별 설정에서 가져올 예정
        const accessToken = process.env.GOOGLE_OAUTH_ACCESS_TOKEN || '';

        if (!accessToken) {
          throw new Error('GOOGLE_OAUTH_ACCESS_TOKEN not set');
        }

        // 파일명 생성
        const fileName = generateBackupFileName(
          guest.name || 'unknown',
          guest.passportNumber || 'unknown',
          guest.submittedAt || new Date()
        );

        // ⚠️ 실제 구현: 여권 파일 Buffer를 DB에서 조회하거나, GCS/Drive에서 다운로드해야 함
        // 현재는 메타데이터만 저장 가능 (파일 버퍼는 별도 구조 필요)
        // TODO: 실제 WebP 파일 버퍼를 Document 또는 별도 테이블에서 조회

        // 더미 버퍼로 테스트 (실제 구현 시 제거)
        const dummyBuffer = Buffer.from('dummy passport image');

        const result = await uploadPassportToGoogleDrive(
          dummyBuffer,
          fileName,
          guest.name || 'unknown',
          guest.passportNumber || '',
          accessToken
        );

        if (result.success) {
          // 성공: DB 업데이트
          await prisma.gmPassportSubmissionGuest.update({
            where: { id: guest.id },
            data: {
              googleDriveFileId: result.googleDriveFileId,
              lastBackupAt: result.backupAt,
              backupStatus: 'success',
            },
          });

          // BackupLog 저장
          await prisma.passportBackupLog.create({
            data: {
              guestId: guest.id,
              googleDriveFileId: result.googleDriveFileId,
              backupTime: result.backupAt,
              status: 'success',
              retryCount: 0,
            },
          });

          successCount++;
          logger.info(
            `[Cron] Backup Passport - 성공: ${guest.name} (fileId: ${result.googleDriveFileId})`
          );
        } else {
          // 실패: DB 업데이트
          await prisma.gmPassportSubmissionGuest.update({
            where: { id: guest.id },
            data: {
              backupStatus: 'failed',
            },
          });

          // BackupLog 저장 (실패)
          await prisma.passportBackupLog.create({
            data: {
              guestId: guest.id,
              status: 'failed',
              errorMessage: 'Google Drive upload failed',
              retryCount: 1,
            },
          });

          failureCount++;
          logger.warn(
            `[Cron] Backup Passport - 실패: ${guest.name}`
          );
        }
      } catch (err) {
        failureCount++;
        const error = err as Record<string, unknown>;
        logger.error(
          `[Cron] Backup Passport - 게스트 ${guest.id} 처리 실패:`,
          error
        );

        // BackupLog 저장 (에러)
        try {
          await prisma.passportBackupLog.create({
            data: {
              guestId: guest.id,
              status: 'failed',
              errorMessage: String(error.message || 'Unknown error'),
              retryCount: 1,
            },
          });
        } catch (logErr) {
          logger.error('[Cron] Backup Passport - BackupLog 저장 실패', logErr);
        }
      }
    }

    // 3. 1년 초과 파일 삭제
    let deletedCount = 0;
    try {
      const accessToken = process.env.GOOGLE_OAUTH_ACCESS_TOKEN || '';
      if (accessToken) {
        deletedCount = await deleteOldBackups(accessToken, 365);
      }
    } catch (err) {
      logger.warn('[Cron] Backup Passport - Old backups cleanup failed', { error: err instanceof Error ? err.message : String(err) });
    }

    const processingTimeMs = Date.now() - startTime;

    logger.info(
      `[Cron] Backup Passport - 완료: ${successCount} 성공, ${failureCount} 실패, ${deletedCount} 삭제 (${processingTimeMs}ms)`
    );

    return NextResponse.json({
      ok: true,
      message: `Passport backup completed: ${successCount} successful, ${failureCount} failed, ${deletedCount} deleted`,
      successCount,
      failureCount,
      deletedCount,
      processingTimeMs,
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[Cron] Backup Passport - Fatal error', err);

    return NextResponse.json(
      {
        ok: false,
        error: String(err.message || 'Unknown error'),
      },
      { status: 500 }
    );
  }
}

/**
 * GET도 지원 (수동 트리거용)
 */
export async function GET(req: NextRequest) {
  return POST(req);
}
