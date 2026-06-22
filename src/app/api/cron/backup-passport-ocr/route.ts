import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { backupPassportOCRToGoogleDrive } from '@/lib/passport-ocr-backup';
import { logger } from '@/lib/logger';

/**
 * M4-1 Cron: 매일 자정 미백업 OCR → Google Drive JSON 저장
 * - 실행 시간: 매일 00:00 UTC (한국시간 +9 → 09:00 KST)
 * - 타임아웃: 55초 (Vercel Function 기본 60초 - 5초 버퍼)
 * - 대상: GmPassportSubmissionGuest에서 OCR 데이터 있지만 PassportOCRBackupLog 없는 항목
 * - 병렬 처리: 100개씩 배치 (Promise.all)
 */

export const maxDuration = 55; // AbortSignal 타임아웃

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. 보안: MABIZ_BACKUP_CRON_SECRET 검증
    const secret = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (secret !== process.env.MABIZ_BACKUP_CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. 조직별 미백업 OCR 조회
    const organizations = await prisma.organization.findMany({
      select: { id: true },
    });

    const results = {
      totalProcessed: 0,
      totalFailed: 0,
      organizations: [] as Array<{
        organizationId: string;
        processed: number;
        failed: number;
        elapsedMs: number;
      }>,
    };

    // 3. 각 조직별 OCR 백업 (순차 또는 병렬 제한)
    for (const org of organizations) {
      const orgStartTime = Date.now();

      try {
        // 3.1: 미백업 OCR 데이터 조회
        // 조건: (ocrRawData 있음) AND (생성 후 1시간 이상)
        const unbackedUpPassports = await prisma.gmPassportSubmissionGuest.findMany({
          where: {
            // 1시간 이상 경과 (마지막 OCR 업데이트로부터)
            updatedAt: {
              lte: new Date(Date.now() - 60 * 60 * 1000), // 1시간 전
            },
          },
          select: {
            id: true,
            submissionId: true,
            passportNumber: true,
            ocrRawData: true, // JSON
            submission: {
              select: {
                tripId: true,
              },
            },
          },
          take: 100, // 배치 크기
        });

        // 필터링: ocrRawData가 있는 것만
        const validPassports = unbackedUpPassports.filter((p) => p.ocrRawData);

        // 3.2: 각 여권 OCR을 Google Drive에 백업 (병렬 Promise.all)
        const backupPromises = validPassports.map((passport) =>
          backupPassportOCRToGoogleDrive({
            organizationId: org.id,
            passportId: String(passport.id),
            tripId: String(passport.submission.tripId),
            passportNumber: passport.passportNumber || 'UNKNOWN',
            ocrData: (passport.ocrRawData || {}) as Record<string, unknown>,
          }).catch((err) => {
            logger.error(
              `[backup-passport-ocr] 백업 실패: org=${org.id}, passport=${passport.id}`,
              err
            );
            return null; // 에러는 로그하고 계속
          })
        );

        const backupResults = await Promise.all(backupPromises);

        // 3.3: 결과 집계
        const successCount = backupResults.filter((r) => r !== null).length;
        const failedCount = validPassports.length - successCount;

        results.totalProcessed += successCount;
        results.totalFailed += failedCount;
        results.organizations.push({
          organizationId: org.id,
          processed: successCount,
          failed: failedCount,
          elapsedMs: Date.now() - orgStartTime,
        });

        logger.info(
          `[backup-passport-ocr] 조직 완료: org=${org.id}, processed=${successCount}, failed=${failedCount}`
        );
      } catch (orgErr) {
        logger.error(
          `[backup-passport-ocr] 조직 처리 실패: org=${org.id}`,
          orgErr
        );
        // 한 조직 실패 → 다음 조직 계속
      }
    }

    // 4. 최종 결과 로깅
    const totalElapsedMs = Date.now() - startTime;
    logger.info('[backup-passport-ocr] Cron 완료', {
      totalProcessed: results.totalProcessed,
      totalFailed: results.totalFailed,
      organizations: results.organizations,
      totalElapsedMs,
    });

    return NextResponse.json({
      success: true,
      ...results,
      totalElapsedMs,
    });
  } catch (err) {
    logger.error('[backup-passport-ocr] Cron 실패', err);
    return NextResponse.json(
      { error: 'Backup failed', details: String(err) },
      { status: 500 }
    );
  }
}
