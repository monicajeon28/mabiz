/**
 * Google Service Account JSON을 .env 저장 형식에 관계없이 안전하게 파싱합니다.
 *
 * .env.local에서 자주 발생하는 문제:
 *  - 외부 따옴표 유지: "{\"type\":\"service_account\"...}"
 *  - Next.js dotenv가 외부 따옴표는 제거하지만 내부 \" 는 그대로 두는 경우
 *  - private_key 줄바꿈이 \\n 으로 이중 이스케이프된 경우
 */
export function parseServiceAccount(raw: string | undefined): Record<string, unknown> {
  if (!raw) throw new Error('GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY 환경변수 미설정');

  // 1차: 그대로 파싱 (이미 올바른 JSON)
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {}

  // 2차: 외부 따옴표 제거 + 내부 \" → " 언이스케이프
  try {
    const cleaned = raw
      .replace(/^["']|["']$/g, '')  // 외부 따옴표 제거
      .replace(/\\"/g, '"')          // \" → "
      .replace(/\\\\/g, '\\')        // \\ → \
      .replace(/\\n/g, '\n');        // \n → 실제 줄바꿈 (private_key용)
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {}

  throw new Error('GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY JSON 파싱 실패 — .env.local 형식을 확인하세요');
}
