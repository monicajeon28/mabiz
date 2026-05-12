import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { uploadFileToDrive, findOrCreateFolder } from '@/lib/google-drive';
import { updatePassportLinkInApis } from '@/lib/google-sheets';
import { logger } from '@/lib/logger';
import { join } from 'path';
import { existsSync } from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/**
 * POST /api/customer/passport-upload
 * 고객이 여권 이미지만 업로드하는 API
 * reservationId를 쿼리 파라미터로 받음
 */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reservationId = searchParams.get('reservationId');
    const travelerId = searchParams.get('travelerId');

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
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationIdNum },
      select: { id: true },
    });

    if (!reservation) {
      return NextResponse.json(
        { ok: false, error: '예약을 찾을 수 없습니다.' },
        { status: 404 }
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
        { ok: false, error: '파일 크기는 10MB를 초과할 수 없습니다.' },
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

    // 통일된 여권 백업 폴더에 업로드
    // 통일된 여권 백업 폴더에 업로드
    const { getDriveFolderId } = await import('@/lib/config/drive-config');
    const passportFolderId = await getDriveFolderId('PASSPORTS');

    // Reservation별 하위 폴더 생성
    const reservationFolderName = `reservation_${reservationIdNum}`;
    const reservationFolderResult = await findOrCreateFolder(reservationFolderName, passportFolderId);

    if (!reservationFolderResult.ok || !reservationFolderResult.folderId) {
      return NextResponse.json(
        { ok: false, error: `폴더 생성 실패: ${reservationFolderResult.error}` },
        { status: 500 }
      );
    }

    // 파일명 생성 (travelerId가 있으면 포함)
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = travelerIdNum
      ? `passport_${reservationIdNum}_traveler${travelerIdNum}_${timestamp}.${fileExtension}`
      : `passport_${reservationIdNum}_${timestamp}.${fileExtension}`;

    // 파일 Buffer 변환
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 구글 드라이브에 업로드
    const uploadResult = await uploadFileToDrive({
      folderId: reservationFolderResult.folderId,
      fileName,
      mimeType: file.type,
      buffer,
      makePublic: false,
    });

    if (!uploadResult.ok || !uploadResult.url) {
      return NextResponse.json(
        { ok: false, error: `업로드 실패: ${uploadResult.error}` },
        { status: 500 }
      );
    }

    const fileUrl = uploadResult.url;

    // 로그 기록
    logger.info(`[Customer Passport Upload] 여권 이미지 저장 완료: reservationId=${reservationIdNum}, travelerId=${travelerIdNum}, fileId=${uploadResult.fileId}, url=${fileUrl}`);

    // travelerId가 있으면 Traveler.passportImage 필드 업데이트
    if (travelerIdNum) {
      try {
        await prisma.traveler.update({
          where: { id: travelerIdNum },
          data: { passportImage: fileUrl },
        });
        logger.info(`[Customer Passport Upload] Traveler.passportImage 업데이트 완료: travelerId=${travelerIdNum}`);
      } catch (travelerError) {
        logger.warn(`[Customer Passport Upload] Traveler.passportImage 업데이트 실패:`, travelerError);
        // 실패해도 계속 진행
      }
    }

    // APIS 스프레드시트에 여권 링크 자동 기록 (비동기, 실패해도 계속 진행)
    try {
      const apisResult = await updatePassportLinkInApis(reservationIdNum, fileUrl);
      if (apisResult.ok) {
        logger.info(`[Customer Passport Upload] APIS 스프레드시트에 여권 링크 기록 완료: reservationId=${reservationIdNum}`);
      } else {
        logger.warn(`[Customer Passport Upload] APIS 스프레드시트 링크 기록 실패: ${apisResult.error}`);
      }
    } catch (apisError) {
      // APIS 기록 실패해도 여권 업로드는 성공으로 처리
      logger.error(`[Customer Passport Upload] APIS 스프레드시트 링크 기록 중 오류:`, apisError);
    }

    return NextResponse.json({
      ok: true,
      message: '여권 이미지가 업로드되었습니다.',
      data: {
        imageUrl: fileUrl,
        reservationId: reservationIdNum,
      },
    });
  } catch (error: any) {
    console.error('[Customer Passport Upload] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || '여권 이미지 업로드에 실패했습니다.',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/customer/passport-upload?reservationId=xxx
 * 고객이 업로드한 여권 이미지 조회
 */
export async function GET(req: NextRequest) {
  try {
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

    // 예약 정보 조회
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationIdNum },
      select: {
        id: true,
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { ok: false, error: '예약을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 파일 시스템에서 해당 예약의 여권 이미지 찾기
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'passports');
    let imageUrl: string | null = null;

    if (existsSync(uploadDir)) {
      const { readdir } = await import('fs/promises');
      const files = await readdir(uploadDir);

      // reservationId로 시작하는 파일 찾기
      const matchingFile = files.find(file => file.startsWith(`passport_${reservationIdNum}_`));

      if (matchingFile) {
        imageUrl = `/uploads/passports/${matchingFile}`;
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        imageUrl,
        reservationId: reservationIdNum,
      },
    });
  } catch (error: any) {
    console.error('[Customer Passport Upload GET] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || '여권 이미지 조회에 실패했습니다.',
      },
      { status: 500 }
    );
  }
}

