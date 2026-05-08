import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireAdminUser } from '../_utils';
import { logger } from '@/lib/logger';
import { enqueueApisSync } from '@/lib/apis-sync-queue';
import { z } from 'zod';
import { createSuccessResponse, createErrorResponse, type ApiSuccessResponse, type ApiErrorResponse } from '@/types/api';

// Zod 스키마 정의로 Input Validation 강화
const GuestSchema = z.object({
  name: z.string().min(1, '이름은 필수입니다').max(100, '이름이 너무 깁니다'),
  phone: z.string().regex(/^01[0-9]{8,9}$/, '올바른 휴대폰 번호 형식이 아닙니다').optional().or(z.literal('')),
  passportNumber: z.string().regex(/^[A-Z0-9]{6,9}$/, '올바른 여권 번호 형식이 아닙니다').optional().or(z.literal('')),
  nationality: z.string().max(50).optional().or(z.literal('')),
  dateOfBirth: z.string().datetime().optional().or(z.literal('')),
  passportExpiryDate: z.string().datetime().optional().or(z.literal('')),
});

const GroupSchema = z.object({
  groupNumber: z.number().int().min(1).max(30),
  guests: z.array(GuestSchema).min(1, '각 그룹에 최소 1명의 탑승자가 필요합니다'),
});

const ManualRegisterSchema = z.object({
  userId: z.number().int().positive('유효한 사용자 ID가 필요합니다'),
  groups: z.array(GroupSchema).min(1, '최소 1개의 그룹이 필요합니다').max(30, '최대 30개 그룹까지 가능합니다'),
  remarks: z.string().max(500, '비고는 500자까지 입력 가능합니다').optional(),
});

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

interface ManualRegisterRequestBody {
  userId: number;
  groups: GroupPayload[];
  remarks?: string;
}

interface ManualRegisterResult {
  submissionId: number;
  token: string;
  guestsCount: number;
  tripId?: number;
  message: string;
}

const MAX_GROUPS = 30;

function generateToken() {
  return randomBytes(16).toString('hex');
}

export async function POST(req: NextRequest) {
  try {
    // 1. 인증 검증
    const admin = await requireAdminUser();
    if (!admin) {
      return NextResponse.json(
        { ok: false, message: '인증이 필요합니다. 다시 로그인해 주세요.' },
        { status: 403 }
      );
    }

    // 2. JSON 파싱
    let rawBody;
    try {
      rawBody = await req.json();
    } catch (error) {
      logger.error('[ManualRegister] JSON parsing error:', error);
      return NextResponse.json(
        { ok: false, message: '잘못된 요청 형식입니다.' },
        { status: 400 }
      );
    }

    // 3. Zod 스키마 검증
    const validation = ManualRegisterSchema.safeParse(rawBody);
    if (!validation.success) {
      logger.warn('[ManualRegister] Validation error:', validation.error.issues);
      return NextResponse.json(
        {
          ok: false,
          message: '입력 데이터가 유효하지 않습니다.',
          errors: validation.error.issues.map(err => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    const body: ManualRegisterRequestBody = validation.data;

    const user = await prisma.user.findUnique({
      where: { id: body.userId },
      select: {
        id: true,
        name: true,
        phone: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, message: '고객 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // User의 최신 여행 정보 조회
    const latestTrip = await prisma.userTrip.findFirst({
      where: { userId: user.id },
      orderBy: { startDate: 'desc' },
      select: {
        id: true,
        cruiseName: true,
        startDate: true,
        endDate: true,
      },
    });

    const validGroups = body.groups
      .slice(0, MAX_GROUPS)
      .map((group) => ({
        groupNumber: Number(group.groupNumber),
        guests: Array.isArray(group.guests) ? group.guests : [],
      }))
      .filter((group) => group.groupNumber >= 1 && group.groupNumber <= MAX_GROUPS);

    if (validGroups.length === 0) {
      return NextResponse.json({ ok: false, message: '최소 한 개 이상의 그룹이 필요합니다.' }, { status: 400 });
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
      return NextResponse.json({ ok: false, message: '각 그룹에 최소 한 명 이상의 탑승자를 입력해주세요.' }, { status: 400 });
    }

    const purchaserName = user.name || '';
    const purchaserPhone = user.phone || '';

    // PassportSubmission 생성 및 Guest 등록
    const result = await prisma.$transaction(async (tx) => {
      // 기존 미제출 submission이 있으면 삭제
      const existingSubmission = await tx.passportSubmission.findFirst({
        where: { userId: user.id, isSubmitted: false },
        orderBy: { createdAt: 'desc' },
      });

      if (existingSubmission) {
        await tx.passportSubmissionGuest.deleteMany({ where: { submissionId: existingSubmission.id } });
        await tx.passportSubmission.delete({ where: { id: existingSubmission.id } });
      }

      // 새 submission 생성
      const token = generateToken();
      const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30일 후 만료

      const createData: any = {
        User: { connect: { id: user.id } },
        token,
        tokenExpiresAt,
        isSubmitted: true, // 수동 등록은 바로 제출 완료로 처리
        submittedAt: new Date(),
        driveFolderUrl: null,
        extraData: {
          groups: validGroups.map((group) => ({
            groupNumber: group.groupNumber,
            guests: group.guests,
          })),
          remarks: body.remarks ?? '',
          passportFiles: [],
          manuallyRegistered: true, // 수동 등록 표시
          registeredBy: admin.id,
          registeredAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      };

      if (latestTrip) {
        createData.UserTrip = { connect: { id: latestTrip.id } };
      }

      const submission = await tx.passportSubmission.create({
        data: createData,
      });

      // 동행자들을 등록하면서 잠재고객으로 자동 생성
      const createdGuests = [];
      for (const guest of guestRecords) {
        // 구매자와 동일한 정보인지 확인
        const isSameAsPurchaser =
          guest.name === purchaserName &&
          guest.phone &&
          guest.phone.replace(/[-.\s]/g, '') === purchaserPhone.replace(/[-.\s]/g, '');

        // 구매자와 다른 정보면 잠재고객으로 사용자 생성
        let guestUserId: number | null = null;
        if (!isSameAsPurchaser && guest.name && guest.phone) {
          const normalizedPhone = guest.phone.replace(/[-.\s]/g, '');
          const mobilePattern = /^01[0-9]{9}$/;

          if (mobilePattern.test(normalizedPhone)) {
            const existingUser = await tx.user.findFirst({
              where: {
                name: guest.name,
                phone: normalizedPhone,
              },
            });

            if (existingUser) {
              guestUserId = existingUser.id;
              // 여권 등록 = 구매 확정으로 간주하여 purchase_confirmed로 변경
              if (existingUser.customerStatus !== 'purchase_confirmed') {
                await tx.user.update({
                  where: { id: existingUser.id },
                  data: {
                    customerStatus: 'purchase_confirmed',
                  },
                });
              }
            } else {
              const apisInfo = {
                passportSubmissionId: submission.id,
                passportSubmissionGuestName: guest.name,
                passportNumber: guest.passportNumber,
                nationality: guest.nationality,
                dateOfBirth: guest.dateOfBirth?.toISOString(),
                passportExpiryDate: guest.passportExpiryDate?.toISOString(),
                manuallyRegistered: true,
                createdAt: new Date().toISOString(),
              };

              const now = new Date();
              // 여권 등록 = 구매 확정으로 간주하여 purchase_confirmed로 생성
              const newUser = await tx.user.create({
                data: {
                  name: guest.name,
                  phone: normalizedPhone,
                  password: '3800',
                  role: 'user',
                  customerStatus: 'purchase_confirmed',
                  onboarded: false,
                  loginCount: 0,
                  tripCount: 0,
                  totalTripCount: 0,
                  adminMemo: `수동 여권 등록으로 자동 생성 (PassportSubmission ID: ${submission.id})\nAPIS 정보: ${JSON.stringify(apisInfo, null, 2)}`,
                  updatedAt: now,
                },
              });
              guestUserId = newUser.id;
            }
          }
        }

        // PassportSubmissionGuest 생성
        const createdGuest = await tx.passportSubmissionGuest.create({
          data: {
            submissionId: submission.id,
            groupNumber: guest.groupNumber,
            name: guest.name,
            phone: guest.phone,
            passportNumber: guest.passportNumber,
            nationality: guest.nationality,
            dateOfBirth: guest.dateOfBirth,
            passportExpiryDate: guest.passportExpiryDate,
            ocrRawData: guest.passportNumber
              ? {
                name: guest.name,
                phone: guest.phone,
                passportNumber: guest.passportNumber,
                nationality: guest.nationality,
                dateOfBirth: guest.dateOfBirth?.toISOString(),
                passportExpiryDate: guest.passportExpiryDate?.toISOString(),
                manuallyRegistered: true,
                createdAt: new Date().toISOString(),
              }
              : null,
          },
        });
        createdGuests.push(createdGuest);
      }

      // PassportRequestLog 기록
      try {
        await tx.passportRequestLog.create({
          data: {
            userId: user.id,
            adminId: admin.id,
            templateId: null,
            messageBody: `수동 여권 등록 (관리자: ${admin.name})`,
            messageChannel: 'MANUAL_REGISTER',
            status: 'SUCCESS',
            errorReason: null,
            sentAt: new Date(),
          },
        });
      } catch (logError) {
        logger.warn('[ManualRegister] Failed to insert log:', logError);
      }

      return {
        submissionId: submission.id,
        token: submission.token,
        guestsCount: createdGuests.length,
        tripId: latestTrip?.id,
      };
    });

    // APIS 동기화 큐에 추가 (트랜잭션 완료 후)
    try {
      // 1. MASTER_SHEET: 사용자 정보 동기화
      await enqueueApisSync('MASTER_SHEET', body.userId, 5); // 5분 후 동기화
      logger.log(`[ManualRegister] APIS MASTER_SHEET 동기화 예약: userId=${body.userId}`);

      // 2. TRIP_SHEET: 여행 정보 동기화 (tripId가 있는 경우)
      if (result.tripId) {
        await enqueueApisSync('TRIP_SHEET', result.tripId, 5);
        logger.log(`[ManualRegister] APIS TRIP_SHEET 동기화 예약: tripId=${result.tripId}`);
      }
    } catch (syncError) {
      // 동기화 실패해도 여권 등록은 성공으로 처리 (로깅만)
      logger.error('[ManualRegister] APIS 동기화 큐 추가 실패:', syncError);
    }

    const successResult: ManualRegisterResult = {
      submissionId: result.submissionId,
      token: result.token,
      guestsCount: result.guestsCount,
      tripId: result.tripId,
      message: `${result.guestsCount}명의 여권 정보가 수동으로 등록되었습니다. APIS 동기화가 예약되었습니다.`,
    };

    return NextResponse.json<ApiSuccessResponse<ManualRegisterResult>>(
      createSuccessResponse(successResult)
    );
  } catch (error) {
    logger.error('[ManualRegister] POST error:', error);
    logger.error('[ManualRegister] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json<ApiErrorResponse>(
      createErrorResponse('수동 여권 등록 중 오류가 발생했습니다.'),
      { status: 500 }
    );
  }
}


