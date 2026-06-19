/**
 * Passport Phase 2-2: WebP 이미지 최적화 엔진
 *
 * 목표: JPEG/PNG → WebP 자동 변환 + 다중 해상도 생성
 * - 파일 크기: 5MB → 1MB (80% 축소)
 * - 품질 유지: 육안 구분 불가 수준
 * - 성능: < 2초 (타임아웃 3초)
 *
 * 기술 스택:
 * - Sharp (Node.js 이미지 처리)
 * - WebP 포맷 (75% 품질)
 * - 다중 해상도: Full(원본)/Thumb(400px)/Archive(150px)
 *
 * 사용 예시:
 * ```
 * const buffer = await req.arrayBuffer();
 * const result = await optimizePassportImage(Buffer.from(buffer));
 * // result.fullUrl, result.thumbUrl, result.savings%
 * ```
 */

import sharp from 'sharp';

// ============================================================================
// 1. 타입 정의
// ============================================================================

export interface ImageOptimizationResult {
  fullUrl: string; // 원본 해상도 WebP 파일명/경로
  thumbUrl: string; // 400px 썸네일 WebP 파일명/경로
  archiveUrl: string; // 150px 아카이브 크기 WebP (DB 저장용)

  // 원본 메타데이터
  originalSize: number; // 바이트
  originalFormat: string; // 'jpeg' | 'png' | 'webp'
  originalWidth: number;
  originalHeight: number;

  // 최적화 결과
  fullSize: number; // Full WebP 바이트
  thumbSize: number; // Thumb WebP 바이트
  archiveSize: number; // Archive WebP 바이트

  savings: number; // 절약률 (%)
  savingsBytes: number; // 절약한 바이트
  processingTimeMs: number; // 처리 시간
}

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  format?: string;
  width?: number;
  height?: number;
  size?: number;
}

// ============================================================================
// 2. 설정 상수
// ============================================================================

const CONFIG = {
  // 파일 크기 제한
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxResolution: 6000 * 6000, // 6000x6000 픽셀 (약 3MB 미리미터 해상도)

  // WebP 품질 설정 (75% 품질 유지하며 80% 크기 절감)
  quality: {
    full: 75, // 풀 해상도 품질 (원본 유지)
    thumb: 75, // 썸네일 품질
    archive: 70, // 아카이브 품질 (조금 낮음)
  },

  // 해상도 설정
  resolutions: {
    thumb: 400, // 썸네일: 400px (UI 미리보기)
    archive: 150, // 아카이브: 150px (DB 저장용 기본 이미지)
  },

  // 타임아웃
  timeoutMs: 3000, // 3초

  // 지원하는 입력 포맷
  supportedFormats: ['jpeg', 'jpg', 'png', 'webp'] as const,
};

// ============================================================================
// 3. 유틸리티 함수
// ============================================================================

/**
 * Promise에 타임아웃 래퍼 추가
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(
      () => reject(new Error(`${operationName} timeout (${timeoutMs}ms)`)),
      timeoutMs
    );

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        reject(err);
      });
  });
}

/**
 * 이미지 메타데이터 추출 (헤더만 읽음)
 */
async function getImageMetadata(buffer: Buffer): Promise<{
  format: string;
  width: number;
  height: number;
  hasAlpha: boolean;
}> {
  const metadata = await withTimeout(
    sharp(buffer).metadata(),
    CONFIG.timeoutMs,
    'Metadata extraction'
  );

  return {
    format: (metadata.format || 'unknown').toLowerCase(),
    width: metadata.width || 0,
    height: metadata.height || 0,
    hasAlpha: metadata.hasAlpha || false,
  };
}

/**
 * 이미지 검증 (파일 크기, 해상도, 포맷)
 */
export async function validateImage(buffer: Buffer): Promise<ImageValidationResult> {
  try {
    // 파일 크기 검증
    if (buffer.length > CONFIG.maxFileSize) {
      return {
        valid: false,
        error: `파일 크기 초과 (최대 10MB, 현재 ${(buffer.length / 1024 / 1024).toFixed(2)}MB)`,
        size: buffer.length,
      };
    }

    // 메타데이터 추출
    const metadata = await getImageMetadata(buffer);

    // 포맷 검증
    if (!CONFIG.supportedFormats.includes(metadata.format as typeof CONFIG.supportedFormats[number])) {
      return {
        valid: false,
        error: `지원하지 않는 형식 (${metadata.format}). JPEG, PNG, WebP만 가능`,
        format: metadata.format,
      };
    }

    // 해상도 검증
    const totalPixels = metadata.width * metadata.height;
    if (totalPixels > CONFIG.maxResolution) {
      return {
        valid: false,
        error: `해상도 초과 (최대 6000x6000, 현재 ${metadata.width}x${metadata.height})`,
        width: metadata.width,
        height: metadata.height,
      };
    }

    return {
      valid: true,
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      size: buffer.length,
    };
  } catch (error) {
    const err = error as Record<string, unknown>;
    return {
      valid: false,
      error: `검증 중 오류: ${(err.message as string) || '알 수 없는 오류'}`,
    };
  }
}

// ============================================================================
// 4. 이미지 최적화 엔진
// ============================================================================

/**
 * 단일 해상도 WebP 변환
 * @param buffer 입력 이미지 버퍼
 * @param resizeWidth 리사이징할 너비 (0이면 원본 유지)
 * @param quality WebP 품질 (0-100)
 */
async function convertToWebP(
  buffer: Buffer,
  resizeWidth: number,
  quality: number
): Promise<Buffer> {
  let pipeline = sharp(buffer);

  // 리사이징 (resizeWidth > 0일 때만)
  if (resizeWidth > 0) {
    pipeline = pipeline.resize(resizeWidth, resizeWidth, {
      fit: 'cover', // 비율 유지하며 정사각형으로 잘라냄
      position: 'center',
      withoutEnlargement: true, // 원본보다 커지지 않음
    });
  }

  // WebP 변환
  return withTimeout(
    pipeline.webp({ quality }).toBuffer(),
    CONFIG.timeoutMs,
    `WebP conversion (${resizeWidth}px, q=${quality})`
  );
}

/**
 * 메인 최적화 함수
 * - Full (원본 해상도)
 * - Thumb (400px, UI 미리보기)
 * - Archive (150px, DB 저장)
 */
export async function optimizePassportImage(
  inputBuffer: Buffer,
  fileNamePrefix: string = 'passport'
): Promise<ImageOptimizationResult> {
  const startTime = Date.now();

  try {
    // 1. 검증
    const validation = await validateImage(inputBuffer);
    if (!validation.valid) {
      throw new Error(validation.error || '알 수 없는 검증 오류');
    }

    const originalSize = inputBuffer.length;
    const originalFormat = validation.format || 'unknown';
    const originalWidth = validation.width || 0;
    const originalHeight = validation.height || 0;

    // 2. 병렬 처리: Full + Thumb + Archive
    const [fullBuffer, thumbBuffer, archiveBuffer] = await Promise.all([
      // Full: 원본 해상도 유지
      convertToWebP(inputBuffer, 0, CONFIG.quality.full),

      // Thumb: 400px 리사이징
      convertToWebP(inputBuffer, CONFIG.resolutions.thumb, CONFIG.quality.thumb),

      // Archive: 150px 리사이징
      convertToWebP(inputBuffer, CONFIG.resolutions.archive, CONFIG.quality.archive),
    ]);

    const fullSize = fullBuffer.length;
    const thumbSize = thumbBuffer.length;
    const archiveSize = archiveBuffer.length;

    // 3. 파일명 생성 (데이터베이스에 저장할 메타데이터)
    const timestamp = Date.now();
    const fullUrl = `${fileNamePrefix}_full_${timestamp}.webp`;
    const thumbUrl = `${fileNamePrefix}_thumb_${timestamp}.webp`;
    const archiveUrl = `${fileNamePrefix}_archive_${timestamp}.webp`;

    // 4. 통계 계산
    const savingsBytes = originalSize - fullSize; // Full 기준 절약
    const savings = Math.round((savingsBytes / originalSize) * 100);
    const processingTimeMs = Date.now() - startTime;

    // 5. 결과 반환
    return {
      fullUrl,
      thumbUrl,
      archiveUrl,

      originalSize,
      originalFormat,
      originalWidth,
      originalHeight,

      fullSize,
      thumbSize,
      archiveSize,

      savings,
      savingsBytes,
      processingTimeMs,
    };
  } catch (error) {
    const err = error as Record<string, unknown>;
    throw new Error(
      `이미지 최적화 실패: ${(err.message as string) || '알 수 없는 오류'}`
    );
  }
}

/**
 * 배치 최적화 (여러 이미지 동시 처리)
 * @param buffers 입력 이미지 버퍼 배열
 * @param maxConcurrent 동시 처리 수 (기본값: 3)
 */
export async function optimizePassportImagesBatch(
  buffers: Buffer[],
  maxConcurrent: number = 3
): Promise<ImageOptimizationResult[]> {
  const results: ImageOptimizationResult[] = [];

  // 동시 처리 수 제한 (서버 리소스 보호)
  for (let i = 0; i < buffers.length; i += maxConcurrent) {
    const batch = buffers.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map((buf, idx) =>
        optimizePassportImage(buf, `passport_${i + idx}`)
      )
    );
    results.push(...batchResults);
  }

  return results;
}

// ============================================================================
// 5. 버퍼 반환 함수 (Google Drive 업로드용)
// ============================================================================

/**
 * Full 해상도 WebP 버퍼 반환
 */
export async function getOptimizedFullBuffer(inputBuffer: Buffer): Promise<Buffer> {
  return convertToWebP(inputBuffer, 0, CONFIG.quality.full);
}

/**
 * Thumb 해상도 WebP 버퍼 반환
 */
export async function getOptimizedThumbBuffer(inputBuffer: Buffer): Promise<Buffer> {
  return convertToWebP(inputBuffer, CONFIG.resolutions.thumb, CONFIG.quality.thumb);
}

/**
 * Archive 해상도 WebP 버퍼 반환
 */
export async function getOptimizedArchiveBuffer(inputBuffer: Buffer): Promise<Buffer> {
  return convertToWebP(inputBuffer, CONFIG.resolutions.archive, CONFIG.quality.archive);
}

// ============================================================================
// 6. 메타데이터 저장 타입 (Prisma passportImage 필드)
// ============================================================================

export interface PassportImageMetadata {
  fullUrl: string; // Google Drive Full 파일 ID
  thumbUrl: string; // Google Drive Thumb 파일 ID
  archiveUrl: string; // Google Drive Archive 파일 ID

  originalSize: number;
  originalFormat: string;
  originalWidth: number;
  originalHeight: number;

  fullSize: number;
  savings: number; // 절약률 %
  processedAt: string; // ISO timestamp
}
