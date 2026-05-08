export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { syncApisSpreadsheet } from '@/lib/google-sheets';

/**
 * APIS 구글시트 및 드라이브 자동화 생성 API
 * POST /api/admin/apis/generate
 * 
 * 관리자 전용 API로, tripId를 받아서:
 * 1. 구글 드라이브 폴더 생성/확인
 * 2. 구글 시트 생성/확인
 * 3. 여권 PNR 데이터 동기화 (미제출 처리 포함)
 * 를 일괄 실행합니다.
 */
export async function POST(req: NextRequest) {
  try {
    // 관리자 권한 확인
    const { cookies } = await import('next/headers');
    const SESSION_COOKIE = 'cg.sid.v2';
    const sid = cookies().get(SESSION_COOKIE)?.value;

    if (!sid) {
      return NextResponse.json(
        { ok: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true },
        },
      },
    });

    if (!session?.User || session.User.role !== 'admin') {
      return NextResponse.json(
        { ok: false, message: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    // 요청 데이터 파싱
    const body = await req.json();
    const { tripId } = body;

    if (!tripId) {
      return NextResponse.json(
        { ok: false, message: 'tripId는 필수입니다.' },
        { status: 400 }
      );
    }

    // Trip 존재 확인
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        departureDate: true,
        shipName: true,
        googleFolderId: true,
        spreadsheetId: true,
      },
    });

    if (!trip) {
      return NextResponse.json(
        { ok: false, message: '여행을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // APIS 자동화 실행
    const result = await syncApisSpreadsheet(tripId);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: result.error || 'APIS 자동화 실행에 실패했습니다.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'APIS 구글시트 및 드라이브 자동화가 완료되었습니다.',
      data: {
        tripId,
        folderId: result.folderId,
        folderUrl: result.folderId
          ? `https://drive.google.com/drive/folders/${result.folderId}`
          : null,
        spreadsheetId: result.spreadsheetId,
        spreadsheetUrl: result.spreadsheetId
          ? `https://docs.google.com/spreadsheets/d/${result.spreadsheetId}`
          : null,
        rowCount: result.rowCount || 0,
      },
    });
  } catch (error: any) {
    console.error('[APIS Generate] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        message: error.message || 'APIS 자동화 실행 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
