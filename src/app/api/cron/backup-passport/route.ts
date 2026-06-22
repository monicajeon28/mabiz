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
  downloadFileFromGoogleDrive,
  uploadOcrDataToGoogleDrive,
  refreshTripGoogleAccessToken,
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

    // M2-2: 여권 파일이 있는 경우 Google Drive 업로드 시도
    let successCount = 0;
    let failureCount = 0;

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
      include: {
        imageAsset: {
          select: {
            id: true,
            driveFileId: true,
            mimeType: true,
          },
        },
        // M2-2: submission 포함하여 trip 정보 조회
        submission: {
          select: {
            tripId: true,
          },
        },
      },
      orderBy: { submittedAt: 'asc' },
    });

    logger.info(
      `[Cron] Backup Passport - ${pendingGuests.length}개 게스트 발견`
    );

    // M2-2: Org 레벨 accessToken (fallback용)
    const orgAccessToken = process.env.GOOGLE_OAUTH_ACCESS_TOKEN || '';

    // M2-2: Trip별 토큰 캐시 (같은 Trip의 guests 처리 시 재사용)
    const tripTokenCache = new Map<number, string>();

    for (const guest of pendingGuests) {
      try {
        // M2-2: Trip 정보 조회
        const tripId = guest.submission?.tripId;
        if (!tripId) {
          logger.warn(
            `[Cron] Backup Passport - 게스트 ${guest.id} submission 또는 tripId 없음, 스킵`
          );
          failureCount++;
          continue;
        }

        // M2-2: Trip별 토큰 조회 (캐시 사용)
        let accessToken: string;
        if (tripTokenCache.has(tripId)) {
          accessToken = tripTokenCache.get(tripId)!;
        } else {
          try {
            const tokenInfo = await refreshTripGoogleAccessToken(
              tripId,
              undefined // organizationId 필요시 추가
            );
            accessToken = tokenInfo.accessToken;
            tripTokenCache.set(tripId, accessToken);
            logger.info(
              `[Cron] Backup Passport - Trip ${tripId} token refreshed (cached)`
            );
          } catch (tokenErr) {
            const tokenErrObj = tokenErr instanceof Error
              ? { message: tokenErr.message }
              : { error: String(tokenErr) };
            logger.warn(
              `[Cron] Backup Passport - Trip ${tripId} token refresh failed, using org fallback`,
              tokenErrObj
            );
            // Fallback: Org 레벨 토큰
            accessToken = orgAccessToken;
            if (!accessToken) {
              logger.error(
                `[Cron] Backup Passport - No accessToken for Trip ${tripId}, skipping guest ${guest.id}`
              );
              failureCount++;
              continue;
            }
            tripTokenCache.set(tripId, accessToken);
          }
        }

        // Phase 1C M1: imageAsset에서 WebP 파일 ID 조회
        if (!guest.imageAsset?.driveFileId) {
          logger.warn(`[Cron] Backup Passport - 게스트 ${guest.id} imageAsset 없음, 스킵`);
          failureCount++;
          continue;
        }

        // 파일명 생성
        const fileName = generateBackupFileName(
          guest.name || 'unknown',
          guest.passportNumber || 'unknown',
          guest.submittedAt || new Date()
        );

        // Phase 1C M1: 실제 WebP 파일을 Google Drive에서 다운로드
        logger.info(`[Cron] Backup Passport - WebP 다운로드 시작: ${guest.imageAsset.driveFileId}`);
        const webpBuffer = await downloadFileFromGoogleDrive(
          guest.imageAsset.driveFileId,
          accessToken
        );

        // 다운로드한 WebP를 백업 폴더에 업로드
        const result = await uploadPassportToGoogleDrive(
          webpBuffer,
          fileName,
          guest.name || 'unknown',
          guest.passportNumber || '',
          accessToken
        );

        if (result.success) {
          // Phase 1C M1: OCR JSON도 함께 백업 (있으면)
          let ocrFileId: string | null = null;
          if (guest.ocrRawData && typeof guest.ocrRawData === 'object') {
            try {
              const ocrFileName = fileName.replace('.webp', '_ocr.json');
              const ocrData = (guest.ocrRawData || {}) as Record<string, unknown>;
              ocrFileId = await uploadOcrDataToGoogleDrive(
                ocrData,
                ocrFileName,
                accessToken
              );
              logger.info(`[Cron] Backup Passport - OCR JSON 백업 성공: ${ocrFileId}`);
            } catch (ocrErr) {
              const err = ocrErr as Record<string, unknown>;
              logger.warn(`[Cron] Backup Passport - OCR JSON 백업 실패 (무시됨):`, err);
              // OCR JSON 백업 실패는 무시하고 계속
            }
          }

          // 성공: DB 업데이트
          await prisma.gmPassportSubmissionGuest.update({
            where: { id: guest.id },
            data: {
              googleDriveFileId: result.googleDriveFileId,
              googleDriveFileIdOcr: ocrFileId, // Phase 1C M1: OCR JSON 파일 ID 저장
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
            `[Cron] Backup Passport - 성공: ${guest.name} (fileId: ${result.googleDriveFileId}, ocrFileId: ${ocrFileId})`
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

    // 3. 1년 초과 파일 삭제 (Org 레벨 토큰 사용)
    let deletedCount = 0;
    try {
      if (orgAccessToken) {
        deletedCount = await deleteOldBackups(orgAccessToken, 365);
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
