/**
 * 여권 매칭/중복 공용 유틸 (Phase 3 검토 수정 — 서버 전용, 경량)
 * 모든 여권 저장 경로가 동일한 매칭 키·중복 감지를 쓰도록 단일화한다.
 */

/**
 * 여권번호 정규화: 모든 공백 제거 + 대문자.
 * OCR(passport-ocr)과 동일 규칙으로 통일해, 공백/대소문자 변형이 다른 키로
 * 취급되어 같은 사람이 중복 행으로 갈라지는 것을 막는다.
 * 비어있으면 null.
 */
export function normalizePassportNo(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).replace(/\s+/g, '').toUpperCase();
  return s.length > 0 ? s : null;
}

/**
 * (reservationId, passportNo) 부분 UNIQUE 위반 감지 — Prisma/pg/raw 인덱스 모두 대응.
 * raw 부분 인덱스 위반은 P2002가 아닌 Postgres 23505로 올 수 있어 다중 신호로 판별.
 */
export function isPassportDupViolation(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const anyE = e as Record<string, unknown>;
  const code = String(anyE.code ?? '');
  const msg = String((anyE.message as string) ?? '');
  return (
    code === 'P2002' || // Prisma known unique violation
    code === '23505' || // Postgres unique_violation (raw 부분 인덱스)
    msg.includes('23505') ||
    msg.includes('Traveler_reservation_passport_partial_uq') ||
    msg.includes('guest_submission_passport_partial_uq') ||
    msg.toLowerCase().includes('unique constraint')
  );
}
