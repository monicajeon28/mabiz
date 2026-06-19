export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { checkRateLimitAsync } from '@/lib/rate-limit';
import { writeTravelerWithAudit, TravelerNotFound } from '@/lib/apis-traveler-write';
import { normalizeDateOnlyString } from '@/lib/passport-date';
import { normalizePassportNo, isPassportDupViolation } from '@/lib/passport-match';
import { decodePassportToken } from '@/lib/passport-utils';
import { preparePassportForDb } from '@/lib/passport-db-helpers';

interface TravelerInput {
  id?: number;
  isSubmitLater?: boolean;
  korName?: string;
  engSurname?: string;
  engGivenName?: string;
  passportNo?: string;
  residentNum?: string;
  nationality?: string;
  dateOfBirth?: string;
  passportExpiryDate?: string;
  roomNumber?: number;
  phone?: string;
}

/**
 * 정상 제출 traveler → writeTravelerWithAudit changes 매핑.
 * EDITABLE_FIELDS 화이트리스트 키만 사용. 날짜는 KST yyyy-MM-dd String SSoT.
 */
function buildChanges(td: TravelerInput) {
  return {
    korName: td.korName as string,
    engSurname: td.engSurname || null,
    engGivenName: td.engGivenName || null,
    passportNo: normalizePassportNo(td.passportNo), // 공백제거+대문자 — 매칭 키 통일
    residentNum: td.residentNum || null,
    nationality: td.nationality || null,
    birthDate: normalizeDateOnlyString(td.dateOfBirth),
    expiryDate: normalizeDateOnlyString(td.passportExpiryDate),
    roomNumber: (td.roomNumber as number) || 0,
  };
}

/**
 * 관리자 표시(submission-guests)와 실제(GmTraveler) SSoT 정합용 best-effort 동기화.
 * - passportNo 기준으로만 매칭 (이름 매칭 금지 — 동명이인 PII 교차오염 방지)
 * - GmTraveler가 SSoT, Guest는 표시 미러. 실패해도 고객 제출은 성공시킨다(호출부 try/catch).
 */
async function syncSubmissionGuestsBestEffort(
  reservation: { mainUserId: number | null; tripId: number | null },
  travelers: TravelerInput[],
  actorUserId: number | null,
): Promise<void> {
  if (!reservation.mainUserId || !reservation.tripId) return;
  const submission = await prisma.gmPassportSubmission.findUnique({
    where: { userId_tripId: { userId: reservation.mainUserId, tripId: reservation.tripId } },
    select: { id: true },
  });
  if (!submission) return;

  const seenGuestPassports = new Set<string>();
  for (const td of travelers) {
    if (td.isSubmitLater) continue;
    if (!td.korName) continue;
    const passportNo = normalizePassportNo(td.passportNo);
    if (!passportNo) continue;
    // 동일 페이로드 내 같은 여권번호 중복 입력 → 한 번만 반영 (덮어쓰기 유실 방지)
    if (seenGuestPassports.has(passportNo)) continue;
    seenGuestPassports.add(passportNo);

    const birth = normalizeDateOnlyString(td.dateOfBirth);
    const expiry = normalizeDateOnlyString(td.passportExpiryDate);

    // 여권번호 AES-256 암호화
    const passportData = preparePassportForDb(passportNo);
    const guestData = {
      name: td.korName,
      phone: td.phone || null,
      passportNumber: passportData.passportNumber, // 암호화됨
      passportIV: passportData.passportIV, // 초기화벡터
      nationality: td.nationality || null,
      dateOfBirth: birth ? new Date(birth) : null,
      passportExpiryDate: expiry ? new Date(expiry) : null,
      submittedBy: actorUserId,
      source: 'public_submit',
      submittedAt: new Date(),
    };
    const existing = await prisma.gmPassportSubmissionGuest.findFirst({
      where: { submissionId: submission.id, passportNumber: passportNo },
      select: { id: true },
    });
    if (existing) {
      await prisma.gmPassportSubmissionGuest.updateMany({ where: { id: existing.id, submissionId: submission.id }, data: guestData });
    } else {
      try {
        await prisma.gmPassportSubmissionGuest.create({
          data: { submissionId: submission.id, groupNumber: (td.roomNumber as number) || 1, ...guestData },
        });
      } catch (e) {
        // 동시 생성 충돌(부분 UNIQUE) → 재조회 update 폴백
        if (isPassportDupViolation(e)) {
          const dup = await prisma.gmPassportSubmissionGuest.findFirst({
            where: { submissionId: submission.id, passportNumber: passportNo },
            select: { id: true },
          });
          if (dup) await prisma.gmPassportSubmissionGuest.updateMany({ where: { id: dup.id, submissionId: submission.id }, data: guestData });
        } else {
          throw e;
        }
      }
    }
  }
}

/**
 * POST /api/passport/public/submit
 * 고객이 입력한 여권 정보를 저장합니다. (예약ID 기반, 인증 없음 — 점진 조립)
 *
 * 점진 조립 원칙:
 *  - 매칭 3단: (1) 화면이 들고 있는 traveler.id → (2) (reservationId,passportNo) 기존행 → (3) 신규
 *  - passportNo 없으면 절대 이름으로 합치지 않음(동명이인 PII 교차오염 방지) → 신규/추후제출
 *  - 갱신은 writeTravelerWithAudit로 version+1·updatedBy(최근수정자)·감사로그 기록
 *  - 동시 생성 중복은 (reservationId,passportNo) 부분 UNIQUE가 DB레벨 차단 → 충돌 시 재조회 update 폴백
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const { allowed } = await checkRateLimitAsync(`passport-submit:${ip}`, 15, 60_000);
  if (!allowed) {
    return NextResponse.json({ ok: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { token, reservationId, travelers } = body as { token?: string; reservationId?: number; travelers?: TravelerInput[] };

    if (!reservationId || !travelers || !Array.isArray(travelers)) {
      return NextResponse.json(
        { ok: false, message: 'reservationId와 travelers 배열은 필수입니다.' },
        { status: 400 }
      );
    }

    // 예약 존재 확인
    const reservation = await prisma.gmReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      return NextResponse.json(
        { ok: false, message: '예약을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // ── 본인확인 토큰 검증 (SEC: 인증 없는 PII 쓰기 차단) ─────────────────
    // 예약ID는 순번이라 추측 가능 → 토큰으로 예약 소유자 본인임을 서버에서 확인.
    if (!token || token.length < 10) {
      return NextResponse.json({ ok: false, message: '본인확인 정보가 필요합니다.' }, { status: 401 });
    }
    let decodedToken = token;
    try {
      const d = decodePassportToken(token);
      if (d) decodedToken = d;
    } catch { /* 원본 토큰 사용 */ }
    const submission = await prisma.gmPassportSubmission.findFirst({
      where: { token: decodedToken },
      select: { id: true, userId: true, tripId: true, tokenExpiresAt: true },
    });
    const tokenValid =
      !!submission &&
      submission.tokenExpiresAt.getTime() >= Date.now() &&
      submission.userId === reservation.mainUserId &&
      (submission.tripId == null || submission.tripId === reservation.tripId);
    if (!tokenValid) {
      logger.warn('[Passport Submit] 토큰 검증 실패', { reservationId });
      return NextResponse.json({ ok: false, message: '본인확인에 실패했습니다. 링크를 다시 확인해 주세요.' }, { status: 403 });
    }

    // 인원 수 상한 — 조작된 대량 요청으로 인한 쿼리 폭증/자원 고갈 방지 (UI 상한 10명)
    if (travelers.length > 50) {
      return NextResponse.json({ ok: false, message: '인원 수가 허용 범위를 초과했습니다.' }, { status: 400 });
    }

    // ── 소유권 사전 검증 (IDOR 방지) — id 있는 traveler를 1회 일괄 조회(N+1 제거) ──
    const submittedIds = travelers.map((t) => t.id).filter((x): x is number => typeof x === 'number');
    const owned = submittedIds.length
      ? await prisma.gmTraveler.findMany({
          where: { id: { in: submittedIds }, reservationId },
          select: { id: true },
        })
      : [];
    const ownedSet = new Set(owned.map((r) => r.id));
    const travelerOwnershipErrors: number[] = submittedIds.filter((id) => !ownedSet.has(id));
    if (travelerOwnershipErrors.length > 0) {
      logger.warn('[Passport Submit] 잘못된 traveler ID (소유권 위반)', { ids: travelerOwnershipErrors, reservationId });
    }

    // 최근 수정자 = 고객 본인(예약 대표자). audit.userId/updatedBy는 FK 없는 Int? 라 안전.
    const actorUserId = reservation.mainUserId ?? null;
    const results: Array<{ id: number }> = [];
    // 동일 페이로드 내 같은 여권번호 중복 입력 추적 (덮어쓰기 유실 방지)
    const seenPassports = new Set<string>();

    for (let index = 0; index < travelers.length; index++) {
      const td = travelers[index];
      const ownershipBlocked = !!td.id && travelerOwnershipErrors.includes(td.id);

      // 대표자(첫 번째)의 연락처를 User 테이블에 업데이트 (기존 동작 유지)
      if (index === 0 && td.phone && reservation.mainUserId) {
        try {
          await prisma.gmUser.update({
            where: { id: reservation.mainUserId },
            data: { phone: td.phone },
          });
        } catch (userUpdateError) {
          logger.error('[Passport Submit] User 업데이트 실패:', userUpdateError as Record<string, unknown>);
        }
      }

      // ── 추후 제출: 이름만 갱신, 여권정보 건너뜀 ──────────────────────────
      if (td.isSubmitLater) {
        if (td.id) {
          if (ownershipBlocked) continue;
          try {
            const updated = await writeTravelerWithAudit({
              travelerId: td.id,
              changes: {
                korName: td.korName || '',
                engSurname: td.engSurname || null,
                engGivenName: td.engGivenName || null,
              },
              userId: actorUserId,
              action: 'PASSPORT_SUBMIT_LATER',
            });
            if (updated) results.push({ id: updated.id });
          } catch (e) {
            if (!(e instanceof TravelerNotFound)) throw e;
          }
        } else {
          const newTraveler = await prisma.gmTraveler.create({
            data: {
              reservationId,
              korName: td.korName || '',
              engSurname: td.engSurname || null,
              engGivenName: td.engGivenName || null,
              roomNumber: (td.roomNumber as number) || 0,
              updatedBy: actorUserId,
            },
          });
          results.push({ id: newTraveler.id });
        }
        continue;
      }

      // ── 정상 제출: 필수 정보 검사 ───────────────────────────────────────
      if (!td.korName || !td.passportNo) continue;
      if (ownershipBlocked) continue;

      const changes = buildChanges(td);

      // 동일 페이로드 내 중복 여권번호 → 첫 건만 반영 (둘째가 첫째를 덮어써 유실되는 것 방지)
      if (changes.passportNo) {
        if (seenPassports.has(changes.passportNo)) continue;
        seenPassports.add(changes.passportNo);
      }

      // 3단 매칭으로 대상 traveler 결정
      let targetId: number | null = null;
      if (td.id) {
        targetId = td.id; // 1순위: 화면이 들고 있는 칸
      } else if (changes.passportNo) {
        // 2순위: (reservationId, passportNo) 기존행 — 본인 칸 재제출
        const existing = await prisma.gmTraveler.findFirst({
          where: { reservationId, passportNo: changes.passportNo },
          select: { id: true },
        });
        if (existing) targetId = existing.id;
      }

      if (targetId) {
        try {
          const updated = await writeTravelerWithAudit({
            travelerId: targetId,
            changes,
            userId: actorUserId,
            action: 'PASSPORT_SUBMIT',
          });
          if (updated) results.push({ id: updated.id });
        } catch (e) {
          // 경합으로 대상이 사라짐 → 신규 생성 폴백
          if (e instanceof TravelerNotFound) {
            const created = await prisma.gmTraveler.create({
              data: { reservationId, ...changes, updatedBy: actorUserId },
            });
            results.push({ id: created.id });
          } else {
            throw e;
          }
        }
      } else {
        // 3순위: 신규 생성 — 동시 생성 중복은 부분 UNIQUE가 DB레벨 차단
        try {
          const created = await prisma.gmTraveler.create({
            data: { reservationId, ...changes, updatedBy: actorUserId },
          });
          results.push({ id: created.id });
        } catch (e) {
          // 다른 요청이 같은 (reservationId,passportNo)를 먼저 만든 경우 → 재조회 update 폴백
          if (isPassportDupViolation(e) && changes.passportNo) {
            const existing = await prisma.gmTraveler.findFirst({
              where: { reservationId, passportNo: changes.passportNo },
              select: { id: true },
            });
            if (existing) {
              const updated = await writeTravelerWithAudit({
                travelerId: existing.id,
                changes,
                userId: actorUserId,
                action: 'PASSPORT_SUBMIT',
              });
              if (updated) results.push({ id: updated.id });
            } else {
              throw e;
            }
          } else {
            throw e;
          }
        }
      }
    }

    // Reservation의 passportStatus 업데이트 (진행 중으로 변경)
    await prisma.gmReservation.update({
      where: { id: reservationId },
      data: {
        passportStatus: reservation.passportStatus === '도움요청' ? '도움요청' : '진행중',
      },
    });

    // 제출 완료 표시 — 관리자 화면(submission-guests 등 isSubmitted 필터)에 노출되도록.
    // public/submit엔 재제출 잠금이 없으므로 true 설정해도 점진 재제출은 계속 가능.
    try {
      await prisma.gmPassportSubmission.update({
        where: { id: submission.id },
        data: { isSubmitted: true, submittedAt: new Date() },
      });
    } catch (subErr) {
      logger.warn('[Passport Submit] submission 상태 갱신 실패 (무시됨):', subErr as Record<string, unknown>);
    }

    // 관리자 표시 SSoT 동기화 (best-effort — 실패해도 고객 제출은 성공)
    try {
      await syncSubmissionGuestsBestEffort(reservation, travelers, actorUserId);
    } catch (guestSyncError) {
      logger.warn('[Passport Submit] Guest 동기화 실패 (무시됨):', guestSyncError as Record<string, unknown>);
    }

    return NextResponse.json({
      ok: true,
      message: '여권 정보가 성공적으로 저장되었습니다.',
      reservationId,
      updatedCount: results.length,
    });
  } catch (error) {
    logger.error('[Passport Submit] Error:', { err: error });
    return NextResponse.json(
      { ok: false, message: '여권 정보 저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}
