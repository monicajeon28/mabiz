export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { decodePassportToken } from '@/lib/passport-utils';
import { logger } from '@/lib/logger';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    let token = (await params).token;
    if (!token || token.length < 10 || token.length > 200) {
      return NextResponse.json({ ok: false, error: '잘못된 토큰입니다.' }, { status: 400 });
    }

    const originalToken = token;
    try {
      const decodedToken = decodePassportToken(token);
      if (decodedToken && decodedToken !== token) {
        // 토큰 앞 8자만 로그 (전체 토큰 노출 방지)
        logger.log('[Passport] Token decoded', { prefix: originalToken.substring(0, 8) + '...' });
        token = decodedToken;
      }
    } catch {
      logger.warn('[Passport] Token decode failed, using original');
    }

    // findUnique 사용 (token은 @unique 제약 — findFirst보다 의미론적으로 정확)
    const submission = await prisma.gmPassportSubmission.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            customerStatus: true,
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json({ ok: false, error: '토큰이 유효하지 않습니다.' }, { status: 404 });
    }

    // tripId가 있으면 별도 조회
    let trip: {
      id: number;
      cruiseName: string | null;
      startDate: string | null;
      endDate: string | null;
    } | null = null;

    if (submission.tripId) {
      const tripData = await prisma.gmTrip.findUnique({
        where: { id: submission.tripId },
        select: {
          id: true,
          cruiseName: true,
          startDate: true,
          endDate: true,
        },
      });
      if (tripData) {
        trip = {
          id: tripData.id,
          cruiseName: tripData.cruiseName,
          startDate: tripData.startDate?.toISOString() ?? null,
          endDate: tripData.endDate?.toISOString() ?? null,
        };
      }
    }

    const now = new Date();
    const isExpired = submission.tokenExpiresAt.getTime() < now.getTime();
    const extraData =
      submission.extraData && typeof submission.extraData === 'object'
        ? (submission.extraData as Record<string, unknown>)
        : {};
    const passportFiles = Array.isArray(extraData?.passportFiles) ? extraData.passportFiles : [];
    const storedGroups = Array.isArray(extraData?.groups) ? extraData.groups : [];

    // guests는 별도로 조회
    let guests: {
      id: number;
      groupNumber: number;
      name: string;
      phone: string | null;
      passportNumber: string | null;
      nationality: string | null;
      dateOfBirth: Date | null;
      passportExpiryDate: Date | null;
    }[] = [];
    try {
      const guestsData = await prisma.gmPassportSubmissionGuest.findMany({
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
      logger.warn('[Passport] Guests 조회 실패 (무시됨):', guestError as Record<string, unknown>);
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
          remarks: (extraData?.remarks as string) ?? '',
        },
      },
      user: submission.user,
      trip,
      guests: guests.map((guest) => ({
        id: guest.id,
        groupNumber: guest.groupNumber,
        name: guest.name,
        // 퍼블릭 API — 링크 유출 시 PII 노출 방지
        phone: guest.phone ? guest.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-****-$3') : null,
        passportNumber: guest.passportNumber
          ? guest.passportNumber.length >= 5
            ? `${guest.passportNumber.slice(0, 1)}****${guest.passportNumber.slice(-3)}`
            : '****'
          : null,
        nationality: guest.nationality,
        dateOfBirth: guest.dateOfBirth?.toISOString() ?? null,
        passportExpiryDate: guest.passportExpiryDate?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[Passport] GET /passport/:token error:', { err });
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('[Passport] Error details:', { errorMessage, errorStack });
    return NextResponse.json(
      {
        ok: false,
        error: '토큰 정보를 불러오지 못했습니다.',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
