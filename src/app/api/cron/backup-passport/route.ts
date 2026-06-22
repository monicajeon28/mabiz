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
  getOrCreateTripFolder,
  uploadTripPassportFilesToGoogleDrive,
  getDecryptedTripAccessToken,
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

    // M2-3: 배치 크기 설정 (메모리 안전: 20 × 1.5MB = 30MB)
    const BATCH_SIZE = 20;
    const batchTimes: number[] = [];

    // M2-3: 배치별 처리
    for (let batchIdx = 0; batchIdx < pendingGuests.length; batchIdx += BATCH_SIZE) {
      const batchStart = Date.now();
      const batch = pendingGuests.slice(batchIdx, Math.min(batchIdx + BATCH_SIZE, pendingGuests.length));

      logger.info(`[Cron] Backup Passport - Batch ${Math.floor(batchIdx / BATCH_SIZE) + 1} 시작: ${batch.length}개 게스트`);

      // Step 1: 토큰 조회 + 검증
      const batchGuestsWithTokens = await Promise.all(
        batch.map(async (guest) => {
          try {
            const tripId = guest.submission?.tripId;
            if (!tripId) {
              logger.warn(`[Cron] Backup Passport - 게스트 ${guest.id} tripId 없음, 스킵`);
              return { guest, accessToken: null, error: 'No tripId' };
            }

            // Trip별 토큰 조회 (캐시 사용) - M3-1: 복호화됨
            let accessToken: string;
            if (tripTokenCache.has(tripId)) {
              accessToken = tripTokenCache.get(tripId)!;
            } else {
              try {
                // M3-1: 복호화된 accessToken 또는 새로 발급 + 암호화
                accessToken = await getDecryptedTripAccessToken(tripId);
                tripTokenCache.set(tripId, accessToken);
              } catch (_tokenErr) {
                // P0-2: Fallback 제거 - Trip 토큰 필수화 (권한 격리)
                logger.error(`[Cron] Backup Passport - Trip ${tripId} token refresh failed, skipping guest ${guest.id}`);
                return { guest, accessToken: null, error: 'Trip token required' };
              }
            }

            // imageAsset 검증
            if (!guest.imageAsset?.driveFileId) {
              logger.warn(`[Cron] Backup Passport - 게스트 ${guest.id} imageAsset 없음, 스킵`);
              return { guest, accessToken: null, error: 'No imageAsset' };
            }

            return { guest, accessToken, error: null };
          } catch (err) {
            const error = err as Record<string, unknown>;
            logger.error(`[Cron] Backup Passport - 게스트 ${guest.id} 토큰 조회 실패:`, error);
            return { guest, accessToken: null, error: String(error.message || 'Unknown error') };
          }
        })
      );

      // Step 2: 동시 다운로드 (병렬화)
      const downloadedFiles = await Promise.all(
        batchGuestsWithTokens.map(async (item) => {
          if (!item.accessToken) {
            return { ...item, webpBuffer: null, downloadError: item.error };
          }

          try {
            const webpBuffer = await downloadFileFromGoogleDrive(
              item.guest.imageAsset!.driveFileId!,
              item.accessToken
            );
            return { ...item, webpBuffer, downloadError: null };
          } catch (err) {
            const error = err as Record<string, unknown>;
            logger.warn(`[Cron] Backup Passport - 게스트 ${item.guest.id} 다운로드 실패:`, error);
            return { ...item, webpBuffer: null, downloadError: String(error.message || 'Download failed') };
          }
        })
      );

      // Step 3: 동시 백업 업로드 (병렬화)
      const uploadedFiles = await Promise.allSettled(
        downloadedFiles.map(async (item) => {
          if (!item.webpBuffer || !item.accessToken) {
            return Promise.reject(new Error(item.downloadError || 'No webp buffer'));
          }

          const fileName = generateBackupFileName(
            item.guest.name || 'unknown',
            item.guest.passportNumber || 'unknown',
            item.guest.submittedAt || new Date()
          );

          const result = await uploadPassportToGoogleDrive(
            item.webpBuffer,
            fileName,
            item.guest.name || 'unknown',
            item.guest.passportNumber || '',
            item.accessToken
          );

          if (!result.success) {
            throw new Error('Upload failed');
          }

          // Phase 1C M1: OCR JSON도 함께 백업 (있으면)
          let ocrFileId: string | null = null;
          if (item.guest.ocrRawData && typeof item.guest.ocrRawData === 'object') {
            try {
              const ocrFileName = fileName.replace('.webp', '_ocr.json');
              const ocrData = (item.guest.ocrRawData || {}) as Record<string, unknown>;
              ocrFileId = await uploadOcrDataToGoogleDrive(
                ocrData,
                ocrFileName,
                item.accessToken
              );
            } catch (ocrErr) {
              const err = ocrErr as Record<string, unknown>;
              logger.warn(`[Cron] Backup Passport - OCR JSON 백업 실패 (무시됨):`, err);
            }
          }

          return {
            guestId: item.guest.id,
            imageFileId: result.googleDriveFileId,
            ocrFileId,
            backupAt: result.backupAt,
          };
        })
      );

      // Step 4: 배치 DB 업데이트 (성공한 것만 - allSettled로 모두 처리)
      await Promise.allSettled(
        uploadedFiles.map((result, _idx) => {
          if (result.status === 'fulfilled') {
            return prisma.gmPassportSubmissionGuest.update({
              where: { id: result.value.guestId },
              data: {
                googleDriveFileId: result.value.imageFileId,
                googleDriveFileIdOcr: result.value.ocrFileId,
                lastBackupAt: result.value.backupAt,
                backupStatus: 'success',
              },
            });
          }
          return Promise.reject(new Error('Upload failed'));
        })
      );

      // Step 5: BackupLog + 상태 업데이트 (모두)
      for (let i = 0; i < uploadedFiles.length; i++) {
        const uploadResult = uploadedFiles[i];
        const guestId = batchGuestsWithTokens[i].guest.id;

        if (uploadResult.status === 'fulfilled') {
          successCount++;
          try {
            await prisma.passportBackupLog.create({
              data: {
                guestId,
                googleDriveFileId: uploadResult.value.imageFileId,
                backupTime: uploadResult.value.backupAt,
                status: 'success',
                retryCount: 0,
              },
            });
            logger.info(`[Cron] Backup Passport - 성공: 게스트 ${guestId}`);
          } catch (logErr) {
            logger.error(`[Cron] Backup Passport - BackupLog 저장 실패 (게스트 ${guestId}):`, logErr);
          }
        } else {
          failureCount++;
          const error = uploadResult.reason as Record<string, unknown>;
          const errorMsg = String(error?.message || 'Unknown error');

          try {
            // 실패: DB 상태 업데이트
            await prisma.gmPassportSubmissionGuest.update({
              where: { id: guestId },
              data: {
                backupStatus: 'failed',
              },
            });

            // BackupLog 저장 (실패)
            await prisma.passportBackupLog.create({
              data: {
                guestId,
                status: 'failed',
                errorMessage: errorMsg,
                retryCount: 1,
              },
            });
            logger.warn(`[Cron] Backup Passport - 실패: 게스트 ${guestId} - ${errorMsg}`);
          } catch (logErr) {
            logger.error(`[Cron] Backup Passport - 실패 처리 중 오류 (게스트 ${guestId}):`, logErr);
          }
        }
      }

      const batchDuration = Date.now() - batchStart;
      batchTimes.push(batchDuration);
      logger.info(
        `[Cron] Backup Passport - Batch ${Math.floor(batchIdx / BATCH_SIZE) + 1} 완료: ${batchDuration}ms`
      );
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

    // M2-3: 성능 통계 계산
    const avgBatchTime = batchTimes.length > 0
      ? Math.round(batchTimes.reduce((a, b) => a + b, 0) / batchTimes.length)
      : 0;
    const minBatchTime = batchTimes.length > 0 ? Math.min(...batchTimes) : 0;
    const maxBatchTime = batchTimes.length > 0 ? Math.max(...batchTimes) : 0;

    // M2-3: Google Drive API 요청 예상치 계산
    const REQUESTS_PER_GUEST = 3; // download + upload + ocr upload (평균)
    const estimatedApiCalls = pendingGuests.length * REQUESTS_PER_GUEST;
    const API_RATE_LIMIT = 1000; // 1000 req/min
    const apiLimitExceeded = estimatedApiCalls > API_RATE_LIMIT;

    const stats = {
      total: pendingGuests.length,
      success: successCount,
      failure: failureCount,
      deleted: deletedCount,
      totalTimeMs: processingTimeMs,
      totalTimeS: (processingTimeMs / 1000).toFixed(1),
      batchCount: Math.ceil(pendingGuests.length / BATCH_SIZE),
      avgBatchTimeMs: avgBatchTime,
      minBatchTimeMs: minBatchTime,
      maxBatchTimeMs: maxBatchTime,
      estimatedApiCalls,
      apiLimitExceeded,
    };

    logger.info(
      `[Cron] Backup Passport - 완료:`,
      stats
    );

    return NextResponse.json({
      ok: true,
      message: `Passport backup completed: ${successCount} successful, ${failureCount} failed, ${deletedCount} deleted`,
      ...stats,
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
