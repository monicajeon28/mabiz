export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { findOrCreateFolder, getDriveClient } from '@/lib/drive-client';
import { getMabizSession } from '@/lib/auth';
import { decodePassportToken } from '@/lib/passport-utils';
import { logger } from '@/lib/logger';
import {
  optimizePassportImage,
  validateImage,
  getOptimizedFullBuffer,
  getOptimizedThumbBuffer,
  getOptimizedArchiveBuffer,
  type PassportImageMetadata,
} from '@/lib/image-optimization';
import { Readable } from 'stream';

/**
 * 인증 해석: 세션(로그인) 또는 여권 토큰(SMS 링크로 들어온 비로그인 고객).
 * 토큰이 유효(미만료)하면 그 submission 소유자(userId)로 권한 부여.
 * @returns 권한 userId, 또는 null(인증 실패)
 */
async function resolvePassportActor(req: NextRequest, token: string | null): Promise<number | null> {
  if (token && token.length >= 10) {
    let decoded = token;
    try { const d = decodePassportToken(token); if (d) decoded = d; } catch { /* 원본 사용 */ }
    const sub = await prisma.gmPassportSubmission.findFirst({
      where: { token: decoded, tokenExpiresAt: { gt: new Date() } },
      select: { userId: true },
    });
    if (sub) return sub.userId;
  }
  const session = await getMabizSession();
  if (session?.userId) return Number(session.userId);
  return null;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// 여권 백업 Drive 폴더 ID (환경변수)
const PASSPORT_DRIVE_FOLDER_ID = process.env.PASSPORT_DRIVE_FOLDER_ID || '';

/**
 * Google Drive에 WebP 파일 업로드 (최적화된 이미지)
 * @param buffer 이미지 버퍼
 * @param fileName 파일명 (예: passport_full_1234567890.webp)
 * @param parentFolderId Drive 폴더 ID
 * @returns 파일 ID와 공유 URL
 */
async function uploadToGoogleDrive(
  buffer: Buffer,
  fileName: string,
  parentFolderId: string
): Promise<{ fileId: string; webViewLink: string }> {
  const drive = await getDriveClient();

  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [parentFolderId],
      mimeType: 'image/webp',
    },
    media: {
      mimeType: 'image/webp',
      body: readable,
    },
    fields: 'id,webViewLink',
  });

  return {
    fileId: response.data.id || '',
    webViewLink: response.data.webViewLink || `https://drive.google.com/file/d/${response.data.id}/view`,
  };
}

/**
 * POST /api/passport/customer/upload
 * 고객이 여권 이미지를 업로드하는 API
 *
 * Phase 2-2 개선사항:
 * - JPEG/PNG → WebP 자동 변환 (80% 크기 절감)
 * - 다중 해상도 생성: Full(원본)/Thumb(400px)/Archive(150px)
 * - 최적화 통계 반환 (절약률, 처리 시간)
 * - 성능: < 2초
 *
 * Customer API — 세션 기반 인증 (getMabizSession)
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const reservationId = searchParams.get('reservationId');
    const travelerId = searchParams.get('travelerId');

    // 세션 또는 토큰 인증 (SMS 링크 비로그인 고객 지원)
    const actorUserId = await resolvePassportActor(req, token);
    if (actorUserId == null) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    if (!reservationId) {
      return NextResponse.json(
        { ok: false, error: 'reservationId가 필요합니다.' },
        { status: 400 }
      );
    }

    const reservationIdNum = parseInt(reservationId);
    if (isNaN(reservationIdNum)) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 reservationId입니다.' },
        { status: 400 }
      );
    }

    const travelerIdNum = travelerId ? parseInt(travelerId) : null;

    // 예약 존재 확인
    const reservation = await prisma.gmReservation.findUnique({
      where: { id: reservationIdNum },
      select: { id: true, mainUserId: true },
    });

    if (!reservation) {
      return NextResponse.json(
        { ok: false, error: '예약을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 권한 확인: 예약 소유자(세션 또는 토큰 소유자)만 업로드 가능
    if (reservation.mainUserId !== actorUserId) {
      return NextResponse.json(
        { ok: false, error: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    // FormData에서 이미지 파일 받기
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { ok: false, error: '이미지 파일이 없습니다.' },
        { status: 400 }
      );
    }

    // 파일 크기 확인
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          ok: false,
          error: `파일 크기는 10MB를 초과할 수 없습니다. (현재 ${(file.size / 1024 / 1024).toFixed(2)}MB)`,
        },
        { status: 400 }
      );
    }

    // 파일 타입 검증
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { ok: false, error: '지원하지 않는 이미지 형식입니다. (JPEG, PNG, WebP만 가능)' },
        { status: 400 }
      );
    }

    if (!PASSPORT_DRIVE_FOLDER_ID) {
      return NextResponse.json(
        { ok: false, error: 'PASSPORT_DRIVE_FOLDER_ID가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // 1. 파일 Buffer 변환
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 2. 이미지 검증 (크기, 해상도, 포맷)
    const validation = await validateImage(buffer);
    if (!validation.valid) {
      return NextResponse.json(
        { ok: false, error: validation.error || '이미지 검증 실패' },
        { status: 400 }
      );
    }

    // 3. WebP 최적화 + 다중 해상도 생성
    const filePrefix = `passport_${reservationIdNum}_${travelerIdNum || 'main'}`;
    const optimizationResult = await optimizePassportImage(buffer, filePrefix);

    logger.info(
      `[Customer Passport Upload] 이미지 최적화 완료: ${optimizationResult.originalSize}B → ${optimizationResult.fullSize}B (${optimizationResult.savings}% 절감, ${optimizationResult.processingTimeMs}ms)`
    );

    // 4. Reservation별 하위 폴더 생성
    const reservationFolderName = `reservation_${reservationIdNum}`;
    let reservationFolderId: string;
    try {
      reservationFolderId = await findOrCreateFolder(reservationFolderName, PASSPORT_DRIVE_FOLDER_ID);
    } catch (folderError) {
      logger.error('[Customer Passport Upload] 폴더 생성 실패:', folderError as Record<string, unknown>);
      return NextResponse.json(
        { ok: false, error: '폴더 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 5. WebP 버퍼 생성 (최적화 결과에서 가져오기)
    const [fullBuffer, thumbBuffer, archiveBuffer] = await Promise.all([
      getOptimizedFullBuffer(buffer),
      getOptimizedThumbBuffer(buffer),
      getOptimizedArchiveBuffer(buffer),
    ]);

    // 6. Google Drive에 3개 파일 병렬 업로드
    const uploadPromises = Promise.all([
      uploadToGoogleDrive(fullBuffer, optimizationResult.fullUrl, reservationFolderId),
      uploadToGoogleDrive(thumbBuffer, optimizationResult.thumbUrl, reservationFolderId),
      uploadToGoogleDrive(archiveBuffer, optimizationResult.archiveUrl, reservationFolderId),
    ]);

    let uploadResults;
    try {
      uploadResults = await uploadPromises;
    } catch (uploadError) {
      logger.error('[Customer Passport Upload] Drive 업로드 실패:', uploadError as Record<string, unknown>);
      return NextResponse.json(
        { ok: false, error: 'Google Drive 업로드에 실패했습니다.' },
        { status: 500 }
      );
    }

    const [fullUpload, thumbUpload, archiveUpload] = uploadResults;

    // 7. 메타데이터 생성
    const imageMetadata: PassportImageMetadata = {
      fullUrl: fullUpload.fileId,
      thumbUrl: thumbUpload.fileId,
      archiveUrl: archiveUpload.fileId,

      originalSize: optimizationResult.originalSize,
      originalFormat: optimizationResult.originalFormat,
      originalWidth: optimizationResult.originalWidth,
      originalHeight: optimizationResult.originalHeight,

      fullSize: optimizationResult.fullSize,
      savings: optimizationResult.savings,
      processedAt: new Date().toISOString(),
    };

    logger.info(
      `[Customer Passport Upload] Google Drive 업로드 완료: fullId=${fullUpload.fileId}, thumbId=${thumbUpload.fileId}, archiveId=${archiveUpload.fileId}`
    );

    // 8. travelerId가 있으면 Traveler.passportImage 필드 업데이트
    if (travelerIdNum) {
      try {
        await prisma.gmTraveler.update({
          where: { id: travelerIdNum },
          data: {
            passportImage: fullUpload.webViewLink,
            // 추가: passportImageMetadata JSON 저장 (스키마 변경 시)
            // passportImageMetadata: imageMetadata,
          },
        });
        logger.info(
          `[Customer Passport Upload] Traveler.passportImage 업데이트 완료: travelerId=${travelerIdNum}`
        );
      } catch (travelerError) {
        logger.warn(
          '[Customer Passport Upload] Traveler.passportImage 업데이트 실패:',
          travelerError as Record<string, unknown>
        );
      }
    }

    const totalTime = Date.now() - startTime;

    return NextResponse.json({
      ok: true,
      message: '여권 이미지가 최적화되어 업로드되었습니다.',
      data: {
        // 공유 링크 (사용자용)
        imageUrl: fullUpload.webViewLink,
        thumbUrl: thumbUpload.webViewLink,

        // 메타데이터
        metadata: imageMetadata,

        // 최적화 통계
        stats: {
          originalSize: `${(optimizationResult.originalSize / 1024).toFixed(1)} KB`,
          fullSize: `${(optimizationResult.fullSize / 1024).toFixed(1)} KB`,
          thumbSize: `${(optimizationResult.thumbSize / 1024).toFixed(1)} KB`,
          archiveSize: `${(optimizationResult.archiveSize / 1024).toFixed(1)} KB`,
          savings: `${optimizationResult.savings}%`,
          savingsBytes: `${(optimizationResult.savingsBytes / 1024).toFixed(1)} KB`,
          originalDimensions: `${optimizationResult.originalWidth}x${optimizationResult.originalHeight}`,
        },

        // 성능
        processingTimeMs: optimizationResult.processingTimeMs,
        totalTimeMs: totalTime,

        // 예약 정보
        reservationId: reservationIdNum,
        travelerId: travelerIdNum,
      },
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[Customer Passport Upload] Error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: '여권 이미지 업로드에 실패했습니다.',
        details: (err.message as string) || '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/passport/customer/upload?reservationId=xxx
 * 고객이 업로드한 여권 이미지 조회
 * Customer API — 세션 기반 인증 (getMabizSession)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session?.userId) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const reservationId = searchParams.get('reservationId');

    if (!reservationId) {
      return NextResponse.json(
        { ok: false, error: 'reservationId가 필요합니다.' },
        { status: 400 }
      );
    }

    const reservationIdNum = parseInt(reservationId);
    if (isNaN(reservationIdNum)) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 reservationId입니다.' },
        { status: 400 }
      );
    }

    // 예약 존재 및 권한 확인
    const reservation = await prisma.gmReservation.findUnique({
      where: { id: reservationIdNum },
      select: { id: true, mainUserId: true },
    });

    if (!reservation) {
      return NextResponse.json(
        { ok: false, error: '예약을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (reservation.mainUserId !== Number(session.userId)) {
      return NextResponse.json(
        { ok: false, error: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    // Traveler에서 passportImage가 있는 것들 조회
    const travelers = await prisma.gmTraveler.findMany({
      where: {
        reservationId: reservationIdNum,
        passportImage: { not: null },
      },
      select: {
        id: true,
        korName: true,
        passportImage: true,
      },
    });

    const imageUrl = travelers.length > 0 ? travelers[0].passportImage : null;

    return NextResponse.json({
      ok: true,
      data: {
        imageUrl,
        reservationId: reservationIdNum,
        travelers: travelers.map(t => ({
          id: t.id,
          korName: t.korName,
          passportImage: t.passportImage,
        })),
      },
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[Customer Passport Upload GET] Error:', { err });
    return NextResponse.json(
      {
        ok: false,
        error: '여권 이미지 조회에 실패했습니다.',
      },
      { status: 500 }
    );
  }
}
