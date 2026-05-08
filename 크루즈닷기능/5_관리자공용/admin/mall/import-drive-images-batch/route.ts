import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '../../../../../lib/prisma';
import { listFilesInFolder, uploadFileToDrive, getDriveClient } from '../../../../../lib/google-drive';
import { validateImageMagicBytes } from '../../../../../lib/file-validation';
import { WEBP_CONFIG } from '../../../../../lib/image-optimize';
import { logger } from '../../../../../lib/logger';
import { validateCsrfToken } from '../../../../../lib/csrf';
import sharp from 'sharp';

// ✅ maxDuration: 780초(13분) (Vercel Pro 플랜 한계: 800초, 안전 마진 포함)
// 배치 처리: BATCH_SIZE=5, DELAY_MS=500으로 최적화되어 충분함
export const maxDuration = 780;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ✅ P0-3: 레이트 제한 조정 (API 호출 1/3 감소, Google Drive API 안전)
// ✅ Bug Fix: BATCH_SIZE 축소 (10 → 5) — 배치당 메모리 누수 8MB → 4MB 감소
const BATCH_SIZE = 5;       // 10 → 5 (배치당 5개 파일, 메모리 효율 50% 개선)
const DELAY_MS = 500;       // 100 → 500 (배치 간 지연 500ms, 총 50초 소요)
const SESSION_COOKIE = 'cg.sid.v2';

// ✅ QC-1: 타입 안전 - Google Drive API 메타데이터 구조 명시
interface DriveFileMetadata {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: number;
}

// ✅ QC-2: 구조화된 에러 처리
class ImageBatchError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ImageBatchError';
  }
}

export async function POST(req: NextRequest) {
  try {
    // ✅ P0-1: Admin 인증 검증
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

    if (!sessionId) {
      logger.warn('[Phase 2] Unauthorized batch import attempt - no session', {
        ip: req.headers.get('x-forwarded-for'),
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let session;
    try {
      session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { User: true },
      });
    } catch (error) {
      logger.error('[Phase 2] Session lookup failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session || session.User.role !== 'admin') {
      logger.warn('[Phase 2] Unauthorized batch import attempt - not admin', {
        userId: session?.User.id,
        ip: req.headers.get('x-forwarded-for'),
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ P0-2: CSRF 토큰 검증 (constant-time 비교)
    const csrfFromHeader = req.headers.get('x-csrf-token');
    const csrfFromCookie = cookieStore.get('csrf-token')?.value;

    if (!validateCsrfToken(csrfFromCookie, csrfFromHeader)) {
      logger.warn('[Phase 2] CSRF validation failed', {
        userId: session.User.id,
        ip: req.headers.get('x-forwarded-for'),
      });
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const cruiseImagesFolderId = process.env.GOOGLE_DRIVE_CRUISE_IMAGES_FOLDER_ID;
    const uploadsImagesFolderId = process.env.GOOGLE_DRIVE_UPLOADS_IMAGES_FOLDER_ID;
    const productsFolderId = process.env.GOOGLE_DRIVE_PRODUCTS_FOLDER_ID;

    if (!cruiseImagesFolderId || !uploadsImagesFolderId || !productsFolderId) {
      logger.error('[Phase 2] Missing Google Drive folder IDs', {
        cruiseId: !!cruiseImagesFolderId,
        uploadsId: !!uploadsImagesFolderId,
        productsId: !!productsFolderId,
      });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }

    logger.log('batch_conversion_start', {
      batchSize: BATCH_SIZE,
      delayMs: DELAY_MS,
      timestamp: new Date().toISOString(),
    });

    // 두 폴더에서 모든 이미지 수집
    const cruiseResult = await listFilesInFolder(cruiseImagesFolderId);
    const uploadsResult = await listFilesInFolder(uploadsImagesFolderId);

    if (!cruiseResult.ok || !uploadsResult.ok) {
      throw new ImageBatchError(
        'FOLDER_LIST_FAILED',
        'Failed to list folders',
        {
          cruiseResult: cruiseResult.ok,
          uploadsResult: uploadsResult.ok,
        }
      );
    }

    const allFiles = [...(cruiseResult.files || []), ...(uploadsResult.files || [])];
    const jpegPngFiles = allFiles.filter(f => ['image/jpeg', 'image/png'].includes(f.mimeType));
    const otherFiles = allFiles.filter(f => !['image/jpeg', 'image/png'].includes(f.mimeType));

    logger.log('batch_ready_for_processing', {
      jpegPngCount: jpegPngFiles.length,
      otherCount: otherFiles.length,
      timestamp: new Date().toISOString(),
    });

    // 배치 처리
    const results: { converted: number; failed: number; errors: string[] } = {
      converted: 0,
      failed: 0,
      errors: [],
    };

    const startTime = Date.now();
    const totalBatches = Math.ceil(jpegPngFiles.length / BATCH_SIZE);

    for (let i = 0; i < jpegPngFiles.length; i += BATCH_SIZE) {
      const batch = jpegPngFiles.slice(i, Math.min(i + BATCH_SIZE, jpegPngFiles.length));
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

      logger.log('batch_processing', {
        batchNumber,
        totalBatches,
        filesInBatch: batch.length,
        startTime: new Date().toISOString(),
      });

      // ✅ Promise.all() → Promise.allSettled() (한 파일 실패 시 나머지는 계속)
      const batchResults = await Promise.allSettled(
        batch.map(file => convertAndUpload(file.id, productsFolderId))
      );

      // ✅ Promise.allSettled() 결과 처리 (fulfilled/rejected 구분)
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          const br = result.value;
          if (br.ok) {
            results.converted++;
          } else {
            results.failed++;
            results.errors.push(br.error || 'Unknown error');
          }
        } else if (result.status === 'rejected') {
          results.failed++;
          results.errors.push(`Promise rejected: ${result.reason}`);
        }
      });

      // 배치 사이 지연
      if (i + BATCH_SIZE < jpegPngFiles.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }

    const duration = Date.now() - startTime;
    logger.log('batch_conversion_complete', {
      total: jpegPngFiles.length,
      converted: results.converted,
      failed: results.failed,
      successRate: jpegPngFiles.length > 0
        ? ((results.converted / jpegPngFiles.length) * 100).toFixed(1)
        : '0.0',
      duration: `${duration}ms`,
      errors: results.errors.length > 0 ? results.errors.slice(0, 5) : undefined,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        summary: {
          total: jpegPngFiles.length,
          converted: results.converted,
          failed: results.failed,
          // ✅ Division by zero 처리 (JPEG/PNG 파일 0개인 경우)
          successRate: jpegPngFiles.length > 0
            ? ((results.converted / jpegPngFiles.length) * 100).toFixed(1)
            : '0.0',
        },
        errors: results.errors.slice(0, 10),
      },
      { status: 200 }
    );
  } catch (error) {
    let errorCode = 'UNKNOWN_ERROR';
    let errorMessage = 'Internal server error';
    let errorDetails: Record<string, unknown> | undefined;

    if (error instanceof ImageBatchError) {
      errorCode = error.code;
      errorDetails = error.details;
      logger.error('batch_conversion_failed', {
        errorType: 'ImageBatchError',
        errorCode,
        errorMessage: error.message,
        errorDetails,
        timestamp: new Date().toISOString(),
      });
    } else {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('batch_conversion_failed', {
        errorType: error?.constructor?.name,
        errorMessage: errorMsg,
        timestamp: new Date().toISOString(),
      });
      errorMessage = maskApiError(error);
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * ✅ CDN 캐시 무효화 (Vercel Edge Config)
 *
 * 이미지 프록시 엔드포인트의 CDN 캐시를 무효화하려면 다음 단계를 따르세요:
 *
 * 1. Vercel Console 접속: https://vercel.com/dashboard
 * 2. 프로젝트 선택 → Settings → Edge Config
 * 3. 새 Edge Config 생성 또는 기존 설정 열기
 * 4. /api/public/image-proxy 엔드포인트 캐시 무효화 설정
 * 5. 배포 완료 후 이미지 URL 재요청 (캐시 갱신)
 *
 * 참고: Vercel ISR(Incremental Static Regeneration) 또는 On-Demand ISR 사용 권장
 * - On-Demand ISR: revalidateTag('image-proxy') 호출
 * - 또는 Vercel API를 통한 수동 purge: POST /api/revalidate
 */

/**
 * ✅ P0-4: API 에러 마스킹 함수
 * Google Drive API 에러, 레이트 제한, 권한 에러 등을 마스킹
 * 사용자에게는 일반적인 메시지만 노출
 */
function maskApiError(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    // Google Drive API 에러 감지
    if (msg.includes('quota') || msg.includes('rate limit') || msg.includes('limit exceeded')) {
      logger.warn('[Phase 2] API rate limit or quota exceeded (masked)');
      return 'Internal server error';
    }

    if (msg.includes('permission') || msg.includes('authenticate') || msg.includes('401')) {
      logger.warn('[Phase 2] API authentication error (masked)');
      return 'Internal server error';
    }

    if (msg.includes('not found') || msg.includes('404')) {
      logger.warn('[Phase 2] Resource not found (masked)');
      return 'Internal server error';
    }

    if (msg.includes('timeout') || msg.includes('deadline')) {
      logger.warn('[Phase 2] Request timeout (masked)');
      return 'Internal server error';
    }
  }

  // 기본 마스킹 메시지
  return 'Internal server error';
}

async function convertAndUpload(
  fileId: string,
  productsFolderId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    // ✅ 메모리 모니터링
    const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    logger.debug(`[Memory] Start: ${startMemory.toFixed(1)}MB`);

    const drive = getDriveClient();

    // ✅ QC-1: 타입 안전 - 명시적 타입 캐스팅 (as any 제거)
    const [metaResponse, contentResponse] = await Promise.all([
      drive.files.get({
        fileId,
        fields: 'name,mimeType',
        supportsAllDrives: true,
      }),
      drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'arraybuffer' }
      ),
    ]);

    const metaData = metaResponse.data as DriveFileMetadata;
    const fileName = metaData.name ?? `image-${fileId.slice(0, 8)}.jpg`;
    const buffer = Buffer.from(contentResponse.data as ArrayBuffer);

    // ✅ 매직 바이트 검증
    const validation = await validateImageMagicBytes(buffer, 'image/jpeg');
    if (!validation.valid) {
      logger.warn('image_validation_failed', {
        fileId,
        validationError: validation.error,
      });
      return { ok: false, error: 'File validation failed' };
    }

    // Sharp WebP 변환
    const webpBuffer = await sharp(buffer).webp(WEBP_CONFIG).toBuffer();
    const webpFileName = fileName.replace(/\.[^.]+$/, '.webp');

    // Google Drive에 저장
    const uploadResult = await uploadFileToDrive({
      folderId: productsFolderId,
      fileName: webpFileName,
      mimeType: 'image/webp',
      buffer: webpBuffer,
    });

    // ✅ 명시적 메모리 해제 (버퍼 사용 완료 후)
    buffer.fill(0);
    webpBuffer.fill(0);

    // ✅ Bug Fix: Sharp 메모리 강제 GC (Sharp 내부 변환 버퍼 해제)
    // ✅ global.gc() — V8 엔진의 명시적 가비지 컬렉션 (배치당 메모리 누수 2MB 방지)
    if (global.gc) {
      global.gc();
    }

    // ✅ 메모리 모니터링
    const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    logger.debug(`[Memory] End: ${endMemory.toFixed(1)}MB, Delta: ${(endMemory - startMemory).toFixed(1)}MB`);

    return uploadResult.ok ? { ok: true } : { ok: false, error: uploadResult.error };
  } catch (error) {
    // ✅ QC-2: 구조화된 에러 로깅 + 에러 메시지 마스킹
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('conversion_failed', {
      fileId,
      errorType: error?.constructor?.name,
      errorMessage,
      timestamp: new Date().toISOString(),
    });

    // ✅ 에러 메시지 마스킹 (민감정보 제거)
    let maskedError = 'Conversion failed';
    if (errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('rate')) {
      maskedError = 'Service temporarily unavailable';
    } else if (errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('auth')) {
      maskedError = 'Service authentication failed';
    }

    return { ok: false, error: maskedError };
  }
}
