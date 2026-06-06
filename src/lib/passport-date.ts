/**
 * 여권 날짜 공용 헬퍼 (Phase 3 — T3/T4)
 *
 * APIS/여권 도메인의 날짜 SSoT는 "KST yyyy-MM-dd 문자열"이다.
 *  - GmTraveler.birthDate/expiryDate    : String (yyyy-MM-dd) — SSoT
 *  - GmPassportSubmissionGuest.dateOfBirth/passportExpiryDate : DateTime(UTC자정 저장) — 표시 시 KST 변환
 *
 * ⚠️ 이중보정 금지: DateTime은 UTC자정으로 저장하고, 읽을 때만 +9h(KST) 보정한다.
 *    한쪽만 KST자정으로 저장하면 만료일이 하루 당겨져 유효 여권을 '만료'로 오탐한다.
 */

/**
 * UTC DateTime → KST yyyy-MM-dd 문자열. (DateTime 컬럼 표시용)
 * submission-guests/route.ts의 기존 toKstDateString 로직과 동일.
 */
export function toKstDateString(dt: Date | null | undefined): string | null {
  if (!dt) return null;
  // UTC 기준 ms → KST(+9h) 오프셋 적용
  const kstMs = dt.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * "yyyy-MM-dd…" 문자열을 검증해 date-only "yyyy-MM-dd"로 정규화한다.
 * 날짜 전용 문자열은 타임존 연산이 필요 없으므로 앞 10자만 취한다(이중보정 방지).
 *
 * 형식 불일치(빈값/'Invalid'/'2030/01/15' 등)나 비현실적 월·일은 null을 반환해,
 * 잘못된 값이 GmTraveler의 String 날짜 컬럼에 유입돼 APIS 엑셀이 깨지는 것을 차단한다.
 */
export function normalizeDateOnlyString(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // 달력 유효성: 2025-02-30 / 2025-06-31 같은 존재하지 않는 날짜 차단(round-trip 비교)
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return null;
  }
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * KST 기준 오늘 yyyy-MM-dd. (만료 게이트 비교 기준)
 */
export function kstTodayDateString(now: Date = new Date()): string {
  return toKstDateString(now) as string;
}
