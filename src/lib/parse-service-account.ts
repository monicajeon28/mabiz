/**
 * Google Service Account 자격증명을 .env 저장 형식에 관계없이 안전하게 구성합니다.
 *
 * 1순위: GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY (전체 JSON) — 여러 이스케이프 형태 시도
 * 2순위(폴백): 개별 환경변수 조합
 *   - GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   - GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 *
 * .env.local의 _KEY 가 {\"type\":...} 처럼 이중 이스케이프 + private_key 내부에
 * 백슬래시+실제개행이 섞여 JSON.parse 가 불가능한 경우가 있다. 이때는 전체 JSON을
 * 복구하려 애쓰지 말고, 깨끗하게 분리 저장된 개별 환경변수로 폴백한다.
 */
type ServiceAccountCreds = { client_email?: string; private_key?: string } & Record<string, unknown>;

/** 개별 환경변수로 자격증명 구성 (폴백) */
function buildFromSeparateEnv(): ServiceAccountCreds | null {
  const email =
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL ??
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey =
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY ??
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) return null;

  return {
    client_email: email,
    private_key: rawKey.replace(/\\n/g, '\n'), // \n 리터럴 → 실제 줄바꿈
  };
}

export function parseServiceAccount(raw: string | undefined): Record<string, unknown> {
  // ── 1순위: 전체 JSON blob 파싱 ─────────────────────────────────────────
  if (raw) {
    const unquoted = raw.replace(/^["']|["']$/g, '');        // 외부 따옴표 제거
    const unescaped = unquoted.replace(/\\"/g, '"');         // \" → "

    for (const candidate of [raw, unquoted, unescaped]) {
      try {
        const obj = JSON.parse(candidate) as ServiceAccountCreds;
        if (typeof obj.private_key === 'string') {
          obj.private_key = obj.private_key.replace(/\\n/g, '\n');
        }
        if (obj.client_email && obj.private_key) return obj;
      } catch {
        // 다음 후보 시도
      }
    }
  }

  // ── 2순위: 개별 환경변수 폴백 (JSON blob이 깨진 경우) ──────────────────
  const fallback = buildFromSeparateEnv();
  if (fallback) return fallback;

  throw new Error(
    'Google 서비스 계정 자격증명 파싱 실패 — GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY 또는 ' +
    'GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL/PRIVATE_KEY 환경변수를 확인하세요',
  );
}
