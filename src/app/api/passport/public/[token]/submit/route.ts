export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { hashPassword } from '@/lib/password';
import { normalizePassportNo, isPassportDupViolation } from '@/lib/passport-match';
import { preparePassportForDb } from '@/lib/passport-db-helpers';

// ── 관리자 SMS 알림 (fire-and-forget) ──────────────────────────────────────
/**
 * 여권 제출 완료 시 관리자에게 SMS 알림 발송.
 * - 반환값 없음: 실패해도 제출 결과에 영향 없음
 * - Vercel 함수 타임아웃 고려: 최대 7초 후 abort
 */
async function notifyAdminPassportSubmitted(params: {
  guestName: string;
  departureDate: string | null;
}): Promise<void> {
  const adminPhone = process.env.ADMIN_NOTIFY_PHONE;
  const apiKey = process.env.ALIGO_API_KEY;
  const userId = process.env.ALIGO_USER_ID;
  const senderPhone = process.env.ALIGO_SENDER_PHONE;

  if (!adminPhone || !apiKey || !userId || !senderPhone) {
    // 환경변수 미설정 시 조용히 스킵 (배포 초기 환경 안전 처리)
    return;
  }

  const departurePart = params.departureDate ? ` (${params.departureDate})` : '';
  const message = `[여권제출] ${params.guestName}님이 여권을 제출했습니다.${departurePart}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000); // 7초 타임아웃

  try {
    const formData = new URLSearchParams({
      key: apiKey,
      user_id: userId,
      sender: senderPhone,
      receiver: adminPhone,
      msg: message,
      msg_type: 'SMS',
    });

    const res = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
      signal: controller.signal,
    });

    if (!res.ok) {
      logger.warn('[PassportSubmit] 관리자 알림 HTTP 오류:', { status: res.status });
      return;
    }

    const data = (await res.json()) as { result_code?: number | string; message?: string };
    if (Number(data.result_code) !== 1) {
      logger.warn('[PassportSubmit] 관리자 알림 Aligo 오류:', { message: data.message });
    }
  } catch (err) {
    // abort 포함한 모든 오류 — 제출 흐름과 완전 분리
    logger.warn('[PassportSubmit] 관리자 알림 발송 실패 (무시됨):', {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    clearTimeout(timeoutId);
  }
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const token = (await params).token;
    if (!token || token.length < 10 || token.length > 200) {
      return NextResponse.json({ ok: false, error: '잘못된 토큰입니다.' }, { status: 400 });
    }

    const body = (await req.json()) as SubmitPayload;
    if (!body || !Array.isArray(body.groups)) {
      return NextResponse.json({ ok: false, error: '제출할 그룹 정보가 필요합니다.' }, { status: 400 });
    }

    const submission = await prisma.gmPassportSubmission.findFirst({
      where: { token },
      include: {
        user: true,
        trip: { select: { startDate: true, cruiseName: true } },
      },
    });

    if (!submission) {
      return NextResponse.json({ ok: false, error: '토큰이 유효하지 않습니다.' }, { status: 404 });
    }

    if (submission.tokenExpiresAt.getTime() < Date.now()) {
      return NextResponse.json({ ok: false, error: '제출 가능 시간이 만료되었습니다.' }, { status: 410 });
    }

    // 재제출 방지 — 이미 제출된 경우 차단 (관리자 승인 없이 덮어쓰기 금지)
    if (submission.isSubmitted) {
      return NextResponse.json(
        { ok: false, error: '이미 제출된 정보입니다. 수정이 필요하시면 담당자에게 문의하세요.' },
        { status: 409 }
      );
    }

    const MAX_GUESTS_PER_GROUP = 50;
    const MAX_TOTAL_GUESTS = 300;
    const MAX_REMARKS_LENGTH = 500;

    const validGroups = body.groups
      .slice(0, MAX_GROUPS)
      .map((group) => ({
        groupNumber: Number(group.groupNumber),
        guests: Array.isArray(group.guests) ? group.guests.slice(0, MAX_GUESTS_PER_GROUP) : [],
      }))
      .filter((group) => group.groupNumber >= 1 && group.groupNumber <= MAX_GROUPS);

    if (validGroups.length === 0) {
      return NextResponse.json({ ok: false, error: '최소 한 개 이상의 그룹이 필요합니다.' }, { status: 400 });
    }

    // ISO 8601 날짜 형식(YYYY-MM-DD)만 허용 — Invalid Date DB 저장 방지
    function parseDate(input: string | undefined): Date | null {
      if (!input) return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
      const d = new Date(input + 'T00:00:00.000Z');
      return isNaN(d.getTime()) ? null : d;
    }

    const guestRecords = validGroups.flatMap((group) => {
      return group.guests
        .map((guest) => ({
          groupNumber: group.groupNumber,
          name: (guest.name?.trim() ?? '').substring(0, 100),
          phone: guest.phone?.trim() || null,
          passportNumber: normalizePassportNo(guest.passportNumber)?.substring(0, 20) || null,
          nationality: guest.nationality?.trim().substring(0, 50) || null,
          dateOfBirth: parseDate(guest.dateOfBirth),
          passportExpiryDate: parseDate(guest.passportExpiryDate),
        }))
        .filter((guest) => guest.name.length > 0);
    });

    if (guestRecords.length === 0) {
      return NextResponse.json(
        { ok: false, error: '각 그룹에 최소 한 명 이상의 탑승자를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (guestRecords.length > MAX_TOTAL_GUESTS) {
      return NextResponse.json(
        { ok: false, error: `탑승자 수가 허용 한도(${MAX_TOTAL_GUESTS}명)를 초과했습니다.` },
        { status: 400 }
      );
    }

    // bcrypt는 CPU 집약적 — 트랜잭션 밖에서 미리 해시 계산 (DB 커넥션 점유 방지)
    const phoneHashMap = new Map<string, string>();
    for (const guest of guestRecords) {
      if (guest.phone && !phoneHashMap.has(guest.phone)) {
        const randomPw = randomBytes(16).toString('hex');
        phoneHashMap.set(guest.phone, await hashPassword(randomPw));
      }
    }

    await prisma.$transaction(async (tx) => {
      // TOCTOU 방지 — 트랜잭션 안에서 isSubmitted 재확인 (행 잠금)
      const locked = await tx.gmPassportSubmission.findUnique({
        where: { id: submission.id },
        select: { isSubmitted: true },
      });
      if (locked?.isSubmitted) {
        throw Object.assign(new Error('ALREADY_SUBMITTED'), { code: 'ALREADY_SUBMITTED' });
      }

      // 1·2. 게스트 정보 점진 동기화 (전량삭제 제거 — '먼저 낸 사람' 보존)
      //   passportNo 기준 upsert. 없으면 append. 이름 매칭 금지(동명이인 교차오염 방지).
      for (const guest of guestRecords) {
        // 여권번호 AES-256 암호화 (passportIV 포함)
        const passportData = preparePassportForDb(guest.passportNumber);

        const guestRow = {
          groupNumber: guest.groupNumber,
          name: guest.name,
          phone: guest.phone,
          passportNumber: passportData.passportNumber, // 암호화됨
          passportIV: passportData.passportIV, // 초기화벡터
          nationality: guest.nationality,
          dateOfBirth: guest.dateOfBirth,
          passportExpiryDate: guest.passportExpiryDate,
          // 감사: 서버측 도출값 (토큰 소유자)
          submittedBy: submission.userId,
          source: 'token_submit',
          submittedAt: new Date(),
        };
        const existingGuest = guest.passportNumber
          ? await tx.gmPassportSubmissionGuest.findFirst({
              where: { submissionId: submission.id, passportNumber: guest.passportNumber },
              select: { id: true },
            })
          : null;
        if (existingGuest) {
          await tx.gmPassportSubmissionGuest.update({ where: { id: existingGuest.id }, data: guestRow });
        } else {
          await tx.gmPassportSubmissionGuest.create({ data: { submissionId: submission.id, ...guestRow } });
        }
      }

      // 3. Submission 상태 업데이트
      await tx.gmPassportSubmission.update({
        where: { id: submission.id },
        data: {
          isSubmitted: true,
          submittedAt: new Date(),
          extraData: {
            ...((submission.extraData as Record<string, unknown>) ?? {}),
            groups: validGroups.map((group) => ({
              groupNumber: group.groupNumber,
              guests: group.guests,
            })),
            remarks: (body.remarks ?? '').substring(0, MAX_REMARKS_LENGTH),
          } as unknown as Prisma.InputJsonValue,
        },
      });

      // 4. User Creation & Traveler Sync (V4 Upgrade)
      // 여행 정보가 있는 경우에만 수행
      if (submission.tripId) {
        const tripId = submission.tripId;
        const reservation = await tx.gmReservation.findFirst({
          where: { tripId: tripId, mainUserId: submission.userId },
        });

        if (reservation) {
          for (const guest of guestRecords) {
            let userId: number | null = null;

            // 4-1. 자동 사용자 생성 (전화번호가 있는 경우)
            if (guest.phone) {
              let user = await tx.gmUser.findFirst({ where: { phone: guest.phone } });
              if (!user) {
                // 트랜잭션 밖에서 미리 계산된 해시 사용 (bcrypt 트랜잭션 내 실행 방지)
                const hashedPw = phoneHashMap.get(guest.phone) ?? randomBytes(16).toString('hex');
                user = await tx.gmUser.create({
                  data: {
                    name: guest.name,
                    phone: guest.phone,
                    password: hashedPw,
                    role: 'user',
                    onboarded: false,
                  },
                });
              }
              userId = user.id;
            }

            // 4-2. Traveler 레코드 동기화
            // passportNo 기준으로만 매칭 (이름 매칭 금지 — 동명이인 PII 교차오염 방지).
            // passportNo 없으면 신규 생성(추후제출). updatedBy로 최근수정자 추적.
            const traveler = guest.passportNumber
              ? await tx.gmTraveler.findFirst({
                  where: { reservationId: reservation.id, passportNo: guest.passportNumber },
                })
              : null;

            const travelerData = {
              reservationId: reservation.id,
              roomNumber: guest.groupNumber, // Group Number
              korName: guest.name, // 레거시 payload는 name 한 칸 (eng 분리 없음)
              passportNo: guest.passportNumber,
              nationality: guest.nationality,
              birthDate: guest.dateOfBirth ? guest.dateOfBirth.toISOString().split('T')[0] : null,
              expiryDate: guest.passportExpiryDate
                ? guest.passportExpiryDate.toISOString().split('T')[0]
                : null,
              userId: userId, // 연결된 유저 ID
              updatedBy: submission.userId, // 최근수정자 = 토큰 소유자
            };

            if (traveler) {
              await tx.gmTraveler.update({
                where: { id: traveler.id },
                data: travelerData,
              });
            } else {
              await tx.gmTraveler.create({
                data: travelerData,
              });
            }
          }
        }
      }

      // 5. 로그 업데이트
      const latestLog = await tx.gmPassportRequestLog.findFirst({
        where: { userId: submission.userId },
        orderBy: { sentAt: 'desc' },
      });
      if (latestLog) {
        await tx.gmPassportRequestLog.update({
          where: { id: latestLog.id },
          data: {
            status: 'SUCCESS',
            errorReason: null,
          },
        });
      }
    });

    // ── 관리자 알림 (fire-and-forget: 실패해도 제출 성공에 영향 없음) ──────
    // void 캐스팅으로 floating Promise 경고 억제 (await 의도적 생략)
    void notifyAdminPassportSubmitted({
      guestName: submission.user.name ?? '고객',
      departureDate: submission.trip?.startDate
        ? submission.trip.startDate.toISOString().split('T')[0]
        : null,
    });

    return NextResponse.json({ ok: true, message: '여권 정보가 제출되었습니다.' });
  } catch (error) {
    // TOCTOU: 동시 제출 충돌
    if (error instanceof Error && (error as Error & { code?: string }).code === 'ALREADY_SUBMITTED') {
      return NextResponse.json({ ok: false, error: '이미 제출된 정보입니다. 수정이 필요하시면 담당자에게 문의하세요.' }, { status: 409 });
    }
    // 동시 제출로 같은 여권번호 부분 UNIQUE 충돌 → 일반 500 대신 친절한 409
    if (isPassportDupViolation(error)) {
      return NextResponse.json({ ok: false, error: '이미 제출된 정보입니다. 수정이 필요하시면 담당자에게 문의하세요.' }, { status: 409 });
    }
    const err = error as Record<string, unknown>;
    logger.error('[Passport] POST /passport/:token/submit error:', { err });
    return NextResponse.json({ ok: false, error: '제출 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
