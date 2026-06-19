/**
 * 여권번호 암호화 DB 헬퍼 함수
 * - 저장 시: encryptPassport() → DB에 암호화 데이터 + IV 저장
 * - 조회 시: decryptPassport() → 평문 반환 또는 마스킹 반환
 * - Prisma 작업할 때 사용
 */

import { encryptPassport, decryptPassport, maskPassport } from './passport-encryption';

/**
 * 여권번호를 암호화해서 저장할 형식으로 변환
 * @param passportNumber - 평문 여권번호
 * @returns DB 저장용 객체 { passportNumber: 암호화, passportIV: IV }
 */
export function preparePassportForDb(passportNumber: string | null | undefined): {
  passportNumber: string | null;
  passportIV: string | null;
} {
  if (!passportNumber) {
    return { passportNumber: null, passportIV: null };
  }

  const { encryptedData, iv } = encryptPassport(passportNumber);
  return {
    passportNumber: encryptedData,
    passportIV: iv,
  };
}

/**
 * DB에서 조회한 암호화된 여권번호를 복호화
 * @param encryptedPassport - DB의 passportNumber 필드 (암호화)
 * @param iv - DB의 passportIV 필드 (초기화벡터)
 * @returns 평문 여권번호 또는 null
 */
export function decryptPassportFromDb(
  encryptedPassport: string | null | undefined,
  iv: string | null | undefined
): string | null {
  if (!encryptedPassport || !iv) {
    return null;
  }

  try {
    return decryptPassport(encryptedPassport, iv);
  } catch (error) {
    console.error('여권번호 복호화 실패:', error);
    return null;
  }
}

/**
 * DB에서 조회한 암호화된 여권번호를 마스킹하여 반환
 * 예: "M12345678" → "****5678"
 * @param encryptedPassport - DB의 passportNumber 필드 (암호화)
 * @param iv - DB의 passportIV 필드 (초기화벡터)
 * @returns 마스킹된 여권번호 또는 "****"
 */
export function maskPassportFromDb(
  encryptedPassport: string | null | undefined,
  iv: string | null | undefined
): string {
  const plaintext = decryptPassportFromDb(encryptedPassport, iv);
  if (!plaintext) {
    return '****';
  }
  return maskPassport(plaintext);
}

/**
 * Prisma SELECT 타입 헬퍼 (암호화된 여권정보만 선택)
 * 사용: SELECT를 자동으로 생성하기 위한 타입 힌트
 *
 * 예시:
 * ```ts
 * const guest = await prisma.gmPassportSubmissionGuest.findFirst({
 *   where: { submissionId },
 *   select: passportSelectFields,
 * });
 * const plaintext = decryptPassportFromDb(guest.passportNumber, guest.passportIV);
 * ```
 */
export const passportSelectFields = {
  passportNumber: true,
  passportIV: true,
};

/**
 * Prisma WHERE 클로저 헬퍼
 * 암호화된 여권번호로 검색할 수 없으므로,
 * 검색 전에 평문으로 암호화한 후 비교
 *
 * ⚠️ 주의: 암호화는 IV가 다르면 결과가 다르므로,
 * 정확한 검색이 필요하면 다른 필드(이름/생년월일)로 검색 후
 * 복호화해서 여권번호 매칭
 *
 * @param passportNumber - 검색할 평문 여권번호
 * @returns 암호화된 형태로 비교 가능한 객체 (현재는 사용 불가)
 */
export function createPassportWhereClause(passportNumber: string): string {
  // IV가 매번 다르므로 DB WHERE 사용 불가
  // 대신: 다른 필드로 먼저 필터링 후, 애플리케이션에서 복호화해서 검증
  throw new Error(
    '암호화된 여권번호로는 DB WHERE 검색이 불가능합니다. ' +
      '이름/생년월일로 먼저 필터링 후 애플리케이션에서 복호화해서 매칭하세요.'
  );
}

/**
 * 마이그레이션용: 평문 여권번호를 암호화하여 업데이트
 * 대량 데이터 변환 시 사용
 *
 * @param plainPassportNumber - 평문 여권번호
 * @returns { passportNumber, passportIV }
 */
export function migrateToEncryptedPassport(plainPassportNumber: string): {
  passportNumber: string;
  passportIV: string;
} {
  const { encryptedData, iv } = encryptPassport(plainPassportNumber);
  return {
    passportNumber: encryptedData,
    passportIV: iv,
  };
}
