export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { findOrCreateFolder } from '@/lib/drive-client';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// 여권 백업 Drive 폴더 ID (환경변수)
const PASSPORT_DRIVE_FOLDER_ID = process.env.PASSPORT_DRIVE_FOLDER_ID || '';

/**
 * POST /api/passport/customer/upload
 * 고객이 여권 이미지를 업로드하는 API
 * Customer API — 세션 기반 인증 (getMabizSession)
 */
export async function POST(req: NextRequest) {
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

    // 권한 확인: 예약 소유자만 업로드 가능
    if (reservation.mainUserId !== Number(session.userId)) {
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

    if (!PASSPORT_DRIVE_FOLDER_ID) {
      return NextResponse.json(
        { ok: false, error: 'PASSPORT_DRIVE_FOLDER_ID가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // Reservation별 하위 폴더 생성
    const reservationFolderName = `reservation_${reservationIdNum}`;
    let reservationFolderId: string;
    try {
      reservationFolderId = await findOrCreateFolder(reservationFolderName, PASSPORT_DRIVE_FOLDER_ID);
    } catch (folderError) {
      return NextResponse.json(
        { ok: false, error: `폴더 생성 실패: ${(folderError as Error).message}` },
        { status: 500 }
      );
    }

    // 파일명 생성
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = travelerIdNum
      ? `passport_${reservationIdNum}_traveler${travelerIdNum}_${timestamp}.${fileExtension}`
      : `passport_${reservationIdNum}_${timestamp}.${fileExtension}`;

    // 파일 Buffer 변환 후 Google Drive 업로드
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Drive API를 통해 직접 업로드
    const { getDriveClient } = await import('@/lib/drive-client');
    const drive = await getDriveClient();

    const { Readable } = await import('stream');
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);

    const driveResponse = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [reservationFolderId],
        mimeType: file.type,
      },
      media: {
        mimeType: file.type,
        body: readable,
      },
      fields: 'id,webViewLink',
    });

    const fileId = driveResponse.data.id;
    const fileUrl = driveResponse.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

    logger.info(`[Customer Passport Upload] 여권 이미지 저장 완료: reservationId=${reservationIdNum}, travelerId=${travelerIdNum}, fileId=${fileId}, url=${fileUrl}`);

    // travelerId가 있으면 Traveler.passportImage 필드 업데이트
    if (travelerIdNum) {
      try {
        await prisma.gmTraveler.update({
          where: { id: travelerIdNum },
          data: { passportImage: fileUrl },
        });
        logger.info(`[Customer Passport Upload] Traveler.passportImage 업데이트 완료: travelerId=${travelerIdNum}`);
      } catch (travelerError) {
        logger.warn('[Customer Passport Upload] Traveler.passportImage 업데이트 실패:', travelerError as Record<string, unknown>);
      }
    }

    return NextResponse.json({
      ok: true,
      message: '여권 이미지가 업로드되었습니다.',
      data: {
        imageUrl: fileUrl,
        reservationId: reservationIdNum,
      },
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[Customer Passport Upload] Error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: String(err.message || '여권 이미지 업로드에 실패했습니다.'),
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
    logger.error('[Customer Passport Upload GET] Error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: String(err.message || '여권 이미지 조회에 실패했습니다.'),
      },
      { status: 500 }
    );
  }
}
