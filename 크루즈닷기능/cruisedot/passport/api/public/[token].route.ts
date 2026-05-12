export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { decodePassportToken } from '@/app/api/admin/passport-request/_utils';

interface RouteParams {
  params: {
    token: string;
  };
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    let token = params.token;
    if (!token || token.length < 10) {
      return NextResponse.json({ ok: false, error: '잘못된 토큰입니다.' }, { status: 400 });
    }

    // base62로 인코딩된 토큰인 경우 디코딩
    // 또는 기존 hex 형식 토큰인 경우 그대로 사용
    const originalToken = token;
    try {
      const decodedToken = decodePassportToken(token);
      if (decodedToken && decodedToken !== token) {
        console.log('[Passport] Token decoded:', { original: originalToken, decoded: decodedToken });
        token = decodedToken;
      } else {
        console.log('[Passport] Token not decoded (already hex or same):', { original: originalToken, decoded: decodedToken });
      }
    } catch (error) {
      // 디코딩 실패 시 원본 토큰 사용
      console.warn('[Passport] Token decode failed, using original:', error);
    }

    console.log('[Passport] Searching for token:', token, 'length:', token.length);

    // DB에서 토큰 조회 (32자 또는 48자 hex 형식)
    const submission = await prisma.passportSubmission.findUnique({
      where: { token },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            role: true,
            customerStatus: true,
          },
        },
        UserTrip: {
          select: {
            id: true,
            cruiseName: true,
            startDate: true,
            endDate: true,
            reservationCode: true,
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json({ ok: false, error: '토큰이 유효하지 않습니다.' }, { status: 404 });
    }

    const now = new Date();
    const isExpired = submission.tokenExpiresAt.getTime() < now.getTime();
    const extraData = submission.extraData && typeof submission.extraData === 'object' ? submission.extraData : {};
    const passportFiles = Array.isArray(extraData?.passportFiles) ? extraData.passportFiles : [];
    const storedGroups = Array.isArray(extraData?.groups) ? extraData.groups : [];

    // guests는 별도로 조회
    let guests: any[] = [];
    try {
      const guestsData = await prisma.passportSubmissionGuest.findMany({
        where: { submissionId: submission.id },
        orderBy: { groupNumber: 'asc' },
        select: {
          id: true,
          groupNumber: true,
          name: true,
          phone: true,
          passportNumber: true,
          nationality: true,
          dateOfBirth: true,
          passportExpiryDate: true,
        },
      });
      guests = guestsData;
    } catch (guestError) {
      // guests 테이블이 없거나 관계가 없을 경우 무시
      console.warn('[Passport] Guests 조회 실패 (무시됨):', guestError);
      guests = [];
    }

    return NextResponse.json({
      ok: true,
      submission: {
        id: submission.id,
        token: submission.token,
        expiresAt: submission.tokenExpiresAt.toISOString(),
        isExpired,
        isSubmitted: submission.isSubmitted,
        submittedAt: submission.submittedAt?.toISOString() ?? null,
        driveFolderUrl: submission.driveFolderUrl,
        extraData: {
          passportFiles,
          groups: storedGroups,
          remarks: extraData?.remarks ?? '',
        },
      },
      user: submission.User,
      trip: submission.UserTrip
        ? {
            id: submission.UserTrip.id,
            cruiseName: submission.UserTrip.cruiseName,
            startDate: submission.UserTrip.startDate?.toISOString() ?? null,
            endDate: submission.UserTrip.endDate?.toISOString() ?? null,
            reservationCode: submission.UserTrip.reservationCode,
          }
        : null,
      guests: guests.map((guest) => ({
        id: guest.id,
        groupNumber: guest.groupNumber,
        name: guest.name,
        phone: guest.phone,
        passportNumber: guest.passportNumber,
        nationality: guest.nationality,
        dateOfBirth: guest.dateOfBirth?.toISOString() ?? null,
        passportExpiryDate: guest.passportExpiryDate?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error('[Passport] GET /passport/:token error:', error);
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[Passport] Error details:', { errorMessage, errorStack });
    return NextResponse.json(
      { 
        ok: false, 
        error: '토큰 정보를 불러오지 못했습니다.',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      }, 
      { status: 500 }
    );
  }
}
