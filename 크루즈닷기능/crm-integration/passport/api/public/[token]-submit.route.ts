export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: {
    token: string;
  };
}

interface GuestPayload {
  name: string;
  phone?: string;
  passportNumber?: string;
  nationality?: string;
  dateOfBirth?: string;
  passportExpiryDate?: string;
}

interface GroupPayload {
  groupNumber: number;
  guests: GuestPayload[];
}

interface SubmitPayload {
  groups: GroupPayload[];
  remarks?: string;
}

const MAX_GROUPS = 30;

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const token = params.token;
    if (!token || token.length < 10) {
      return NextResponse.json({ ok: false, error: '잘못된 토큰입니다.' }, { status: 400 });
    }

    const body = (await req.json()) as SubmitPayload;
    if (!body || !Array.isArray(body.groups)) {
      return NextResponse.json({ ok: false, error: '제출할 그룹 정보가 필요합니다.' }, { status: 400 });
    }

    const submission = await prisma.passportSubmission.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!submission) {
      return NextResponse.json({ ok: false, error: '토큰이 유효하지 않습니다.' }, { status: 404 });
    }

    if (submission.tokenExpiresAt.getTime() < Date.now()) {
      return NextResponse.json({ ok: false, error: '제출 가능 시간이 만료되었습니다.' }, { status: 410 });
    }

    const validGroups = body.groups
      .slice(0, MAX_GROUPS)
      .map((group) => ({
        groupNumber: Number(group.groupNumber),
        guests: Array.isArray(group.guests) ? group.guests : [],
      }))
      .filter((group) => group.groupNumber >= 1 && group.groupNumber <= MAX_GROUPS);

    if (validGroups.length === 0) {
      return NextResponse.json({ ok: false, error: '최소 한 개 이상의 그룹이 필요합니다.' }, { status: 400 });
    }

    const guestRecords = validGroups.flatMap((group) => {
      return group.guests
        .map((guest) => ({
          groupNumber: group.groupNumber,
          name: guest.name?.trim() ?? '',
          phone: guest.phone?.trim() || null,
          passportNumber: guest.passportNumber?.trim() || null,
          nationality: guest.nationality?.trim() || null,
          dateOfBirth: guest.dateOfBirth ? new Date(guest.dateOfBirth) : null,
          passportExpiryDate: guest.passportExpiryDate ? new Date(guest.passportExpiryDate) : null,
        }))
        .filter((guest) => guest.name.length > 0);
    });

    if (guestRecords.length === 0) {
      return NextResponse.json({ ok: false, error: '각 그룹에 최소 한 명 이상의 탑승자를 입력해주세요.' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // 1. 기존 게스트 정보 삭제
      await tx.passportSubmissionGuest.deleteMany({ where: { submissionId: submission.id } });

      // 2. 새 게스트 정보 저장
      const createdGuests = await tx.passportSubmissionGuest.createMany({
        data: guestRecords.map((guest) => ({
          submissionId: submission.id,
          groupNumber: guest.groupNumber,
          name: guest.name,
          phone: guest.phone,
          passportNumber: guest.passportNumber,
          nationality: guest.nationality,
          dateOfBirth: guest.dateOfBirth,
          passportExpiryDate: guest.passportExpiryDate,
        })),
      });

      // 3. Submission 상태 업데이트
      await tx.passportSubmission.update({
        where: { id: submission.id },
        data: {
          isSubmitted: true,
          submittedAt: new Date(),
          extraData: {
            ...(submission.extraData ?? {}),
            groups: validGroups.map((group) => ({
              groupNumber: group.groupNumber,
              guests: group.guests,
            })),
            remarks: body.remarks ?? '',
          },
        },
      });

      // 4. User Creation & Traveler Sync (V4 Upgrade)
      // 여행 정보가 있는 경우에만 수행
      if (submission.UserTrip) {
        const tripId = submission.UserTrip.id;
        const reservation = await tx.reservation.findFirst({
          where: { tripId: tripId, mainUserId: submission.userId }
        });

        if (reservation) {
          for (const guest of guestRecords) {
            let userId: number | null = null;

            // 4-1. 자동 사용자 생성 (전화번호가 있는 경우)
            if (guest.phone) {
              let user = await tx.user.findFirst({ where: { phone: guest.phone } });
              if (!user) {
                // 새 사용자 생성 (비밀번호 3800)
                user = await tx.user.create({
                  data: {
                    name: guest.name,
                    phone: guest.phone,
                    password: '3800', // Fixed password as per requirement
                    role: 'user',
                    onboarded: false,
                  }
                });
              }
              userId = user.id;
            }

            // 4-2. Traveler 레코드 동기화
            // 이름이나 여권번호로 기존 Traveler 찾기 시도
            let traveler = await tx.traveler.findFirst({
              where: {
                reservationId: reservation.id,
                OR: [
                  { passportNo: guest.passportNumber },
                  { korName: guest.name },
                  { engSurname: guest.name } // 영문 이름일 수도 있음
                ]
              }
            });

            const travelerData = {
              reservationId: reservation.id,
              roomNumber: guest.groupNumber, // Group Number
              korName: guest.name, // 일단 이름 필드에 저장 (한글/영문 구분 로직은 복잡하므로)
              passportNo: guest.passportNumber,
              nationality: guest.nationality,
              birthDate: guest.dateOfBirth ? guest.dateOfBirth.toISOString().split('T')[0] : null,
              expiryDate: guest.passportExpiryDate ? guest.passportExpiryDate.toISOString().split('T')[0] : null,
              userId: userId, // 연결된 유저 ID
            };

            if (traveler) {
              await tx.traveler.update({
                where: { id: traveler.id },
                data: travelerData
              });
            } else {
              await tx.traveler.create({
                data: travelerData
              });
            }
          }
        }
      }

      // 5. 로그 업데이트
      const latestLog = await tx.passportRequestLog.findFirst({
        where: { userId: submission.userId },
        orderBy: { sentAt: 'desc' },
      });
      if (latestLog) {
        await tx.passportRequestLog.update({
          where: { id: latestLog.id },
          data: {
            status: 'SUCCESS',
            errorReason: null,
          },
        });
      }
    });

    // 6. APIS Sync Enqueue (Transaction 밖에서 실행)
    if (submission.UserTrip) {
      // Import dynamically to avoid circular dependency issues if any, though here it's fine
      const { enqueueApisSync } = await import('@/lib/apis-sync-queue');
      await enqueueApisSync('TRIP_SHEET', submission.UserTrip.id);
    }

    return NextResponse.json({ ok: true, message: '여권 정보가 제출되었습니다.' });
  } catch (error) {
    console.error('[Passport] POST /passport/:token/submit error:', error);
    return NextResponse.json({ ok: false, error: '제출 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
