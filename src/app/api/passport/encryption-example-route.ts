/**
 * ⚠️ 이 파일은 예제입니다. 실제 API에 적용하려면 이 코드를 참고하세요.
 *
 * 여권번호 암호화를 적용한 API 라우트 예제
 * - 저장: encryptPassport() 사용
 * - 조회: decryptPassport() 사용
 * - 마스킹: maskPassport() 사용
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  preparePassportForDb,
  decryptPassportFromDb,
  maskPassportFromDb,
} from '@/lib/passport-db-helpers';

/**
 * 예제 1: 여권번호를 암호화해서 저장
 *
 * POST /api/passport/[token]/submit
 */
export async function exampleSaveEncryptedPassport() {
  const submissionId = 123;
  const plainPassportNumber = 'M12345678';
  const guestName = '김철수';

  // 평문 여권번호를 암호화된 형태로 변환
  const passportData = preparePassportForDb(plainPassportNumber);

  // DB에 저장
  const guest = await prisma.gmPassportSubmissionGuest.create({
    data: {
      submissionId,
      groupNumber: 1,
      name: guestName,
      passportNumber: passportData.passportNumber, // 암호화됨
      passportIV: passportData.passportIV, // 초기화벡터
    },
  });

  return guest;
}

/**
 * 예제 2: 암호화된 여권번호 조회 및 복호화
 *
 * GET /api/passport/guests/[guestId]
 */
export async function exampleRetrieveDecryptedPassport(guestId: number) {
  const guest = await prisma.gmPassportSubmissionGuest.findUnique({
    where: { id: guestId },
    select: {
      id: true,
      name: true,
      passportNumber: true, // 암호화됨
      passportIV: true,
      dateOfBirth: true,
    },
  });

  if (!guest) {
    return null;
  }

  // 암호화된 여권번호를 평문으로 복호화
  const plainPassport = decryptPassportFromDb(guest.passportNumber, guest.passportIV);

  return {
    id: guest.id,
    name: guest.name,
    passportNumber: plainPassport, // 평문 (민감 데이터)
    dateOfBirth: guest.dateOfBirth,
  };
}

/**
 * 예제 3: 여권번호 마스킹 (UI 표시용)
 *
 * 마스킹 결과: "M12345678" → "****5678"
 * 이 데이터는 기본 목록 표시나 미리보기에 안전
 */
export async function exampleRetrieveMaskedPassport(guestId: number) {
  const guest = await prisma.gmPassportSubmissionGuest.findUnique({
    where: { id: guestId },
    select: {
      id: true,
      name: true,
      passportNumber: true, // 암호화됨
      passportIV: true,
      dateOfBirth: true,
    },
  });

  if (!guest) {
    return null;
  }

  // 암호화된 여권번호를 마스킹하여 반환
  const maskedPassport = maskPassportFromDb(guest.passportNumber, guest.passportIV);

  return {
    id: guest.id,
    name: guest.name,
    passportNumber: maskedPassport, // 마스킹됨 (안전)
    dateOfBirth: guest.dateOfBirth,
  };
}

/**
 * 예제 4: 여권번호 업데이트 (재제출)
 *
 * PATCH /api/passport/guests/[guestId]
 */
export async function exampleUpdatePassport(
  guestId: number,
  newPlainPassportNumber: string
) {
  const passportData = preparePassportForDb(newPlainPassportNumber);

  const updatedGuest = await prisma.gmPassportSubmissionGuest.update({
    where: { id: guestId },
    data: {
      passportNumber: passportData.passportNumber, // 새 암호화 데이터
      passportIV: passportData.passportIV, // 새 IV
    },
  });

  return updatedGuest;
}

/**
 * 예제 5: 여권번호 검색
 *
 * ⚠️ 주의: 암호화된 필드로는 DB WHERE 검색이 불가능합니다!
 *
 * 대신: 이름/생년월일로 먼저 필터링 후,
 * 애플리케이션 레벨에서 복호화해서 매칭해야 합니다.
 */
export async function exampleSearchByPassportNumber(
  submissionId: number,
  plainPassportNumber: string
) {
  // 방법 1: 이름/생년월일로 먼저 필터링 (예)
  const candidates = await prisma.gmPassportSubmissionGuest.findMany({
    where: {
      submissionId,
      // passportNumber는 여기서 사용 불가 (암호화됨)
    },
    select: {
      id: true,
      name: true,
      passportNumber: true,
      passportIV: true,
      dateOfBirth: true,
    },
  });

  // 방법 2: 애플리케이션에서 복호화해서 매칭
  const matchedGuest = candidates.find((guest) => {
    const decrypted = decryptPassportFromDb(guest.passportNumber, guest.passportIV);
    return decrypted === plainPassportNumber;
  });

  return matchedGuest || null;
}

/**
 * 예제 6: 여권번호가 있는 모든 게스트 조회
 *
 * GET /api/passport/submission/[submissionId]/guests
 */
export async function exampleListGuestsWithPassport(submissionId: number) {
  const guests = await prisma.gmPassportSubmissionGuest.findMany({
    where: {
      submissionId,
      passportNumber: { not: null }, // 여권번호 있는 것만
    },
    select: {
      id: true,
      name: true,
      passportNumber: true, // 암호화됨
      passportIV: true,
      dateOfBirth: true,
      submittedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // 모든 여권번호를 마스킹해서 반환 (UI용)
  return guests.map((guest) => ({
    id: guest.id,
    name: guest.name,
    passportNumber: maskPassportFromDb(guest.passportNumber, guest.passportIV),
    dateOfBirth: guest.dateOfBirth,
    submittedAt: guest.submittedAt,
  }));
}

/**
 * 예제 7: 여권번호 삭제
 *
 * DELETE /api/passport/guests/[guestId]
 */
export async function exampleDeletePassport(guestId: number) {
  const deleted = await prisma.gmPassportSubmissionGuest.update({
    where: { id: guestId },
    data: {
      passportNumber: null,
      passportIV: null,
    },
  });

  return deleted;
}

/**
 * 실제 API 라우트에서의 적용:
 *
 * 1. 저장할 때:
 *    ```ts
 *    const { passportNumber, passportIV } = preparePassportForDb(plainPassport);
 *    await prisma.model.create({
 *      data: { passportNumber, passportIV, ... }
 *    });
 *    ```
 *
 * 2. 조회할 때 (복호화):
 *    ```ts
 *    const record = await prisma.model.findUnique(...);
 *    const plainPassport = decryptPassportFromDb(
 *      record.passportNumber,
 *      record.passportIV
 *    );
 *    ```
 *
 * 3. 조회할 때 (마스킹):
 *    ```ts
 *    const record = await prisma.model.findUnique(...);
 *    const masked = maskPassportFromDb(
 *      record.passportNumber,
 *      record.passportIV
 *    );
 *    ```
 */
