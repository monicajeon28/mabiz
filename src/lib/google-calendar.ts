import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

// ─── 재시도 헬퍼 (Exponential Backoff) ───────────────────────
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      // auth 오류는 재시도 불필요
      if (msg.includes('invalid_grant') || msg.includes('revoked')) throw err;
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
      }
    }
  }
  throw lastErr;
}

// ─── 환경변수 ────────────────────────────────────────────────
const CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI;

// 필수 환경변수 검증
if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
  throw new Error('Missing required Google Calendar configuration: GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, GOOGLE_CALENDAR_REDIRECT_URI');
}

/** AES-256 키 반환 — 미설정 또는 32자 미만이면 즉시 오류 */
function getEncryptKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY ?? '';
  if (key.length < 32) {
    throw new Error('ENCRYPTION_KEY 환경변수가 32자 이상이어야 합니다');
  }
  return Buffer.from(key.substring(0, 32));
}


// ─── 토큰 암호화/복호화 (AES-256-CBC) ───────────────────────
export function encryptToken(plain: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", getEncryptKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decryptToken(encrypted: string): string {
  const parts = encrypted.split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('decryptToken: 암호화된 토큰 형식이 올바르지 않습니다 (iv:ciphertext 형식 필요)');
  }
  const [ivHex, encHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const decipher = createDecipheriv("aes-256-cbc", getEncryptKey(), iv);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

// ─── HMAC-SHA256 state 서명/검증 (CSRF 방지) ─────────────────
const STATE_SECRET = process.env.GOOGLE_CALENDAR_STATE_SECRET ?? '';

export interface GoogleOAuthState {
  userId: string;
  ts: number;
}

export function signState(stateObj: GoogleOAuthState): string {
  const payload = JSON.stringify(stateObj);
  const sig = createHmac('sha256', STATE_SECRET).update(payload).digest('hex');
  return Buffer.from(JSON.stringify({ ...stateObj, sig })).toString('base64url');
}

export function verifyState(stateParam: string): GoogleOAuthState | null {
  try {
    const parsed = JSON.parse(Buffer.from(stateParam, 'base64url').toString()) as {
      userId?: string;
      ts?: number;
      sig?: string;
    };
    const { userId, ts, sig } = parsed;
    if (!userId || !ts || !sig) return null;
    const payload = JSON.stringify({ userId, ts });
    const expected = createHmac('sha256', STATE_SECRET).update(payload).digest('hex');
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expBuf)) return null;
    return { userId, ts };
  } catch {
    return null;
  }
}

// ─── OAuth URL 생성 ─────────────────────────────────────────
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ─── Authorization code → Token 교환 ────────────────────────
interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export async function exchangeCode(code: string): Promise<GoogleTokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  return res.json();
}

// ─── Refresh Token → 새 Access Token ────────────────────────
/** 갱신 실패 시 `error` 필드를 포함한 객체를 throw하므로 호출자가 분기 처리 가능 */
export async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    let errorCode: string | undefined;
    try {
      const body = await res.json() as { error?: string };
      errorCode = body.error;
    } catch {
      // JSON 파싱 실패 시 errorCode는 undefined 유지
    }
    const err = new Error(`Token refresh failed: ${errorCode ?? 'UNKNOWN'}`);
    (err as Error & { errorCode?: string }).errorCode = errorCode;
    throw err;
  }
  return res.json();
}

// ─── 유효한 Access Token 가져오기 (자동 갱신) ─────────────────
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const token = await prisma.googleCalendarToken.findUnique({ where: { userId } });
  if (!token) return null;

  const now = new Date();
  // 만료 5분 전이면 갱신
  if (token.expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return decryptToken(token.accessToken);
  }

  try {
    const decryptedRefresh = decryptToken(token.refreshToken);
    const refreshed = await retryWithBackoff(() => refreshAccessToken(decryptedRefresh));

    await prisma.googleCalendarToken.update({
      where: { userId },
      data: {
        accessToken: encryptToken(refreshed.access_token),
        expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      },
    });

    return refreshed.access_token;
  } catch (err: unknown) {
    const errorCode = (err as Error & { errorCode?: string }).errorCode;
    const isRevoked =
      errorCode === 'invalid_grant' ||
      (typeof errorCode === 'string' && errorCode.toLowerCase().includes('revoked'));

    if (isRevoked) {
      // 진짜 만료/폐기 → 토큰 삭제 후 재로그인 유도
      await prisma.googleCalendarToken.delete({ where: { userId } });
    } else {
      // 네트워크/타임아웃 등 일시적 오류 → 토큰 유지, 로그만 기록
      console.error('[google-calendar] refreshAccessToken 일시적 오류 (토큰 유지):', err);
    }
    return null;
  }
}

// ─── Google 이메일 가져오기 ──────────────────────────────────
export async function getGoogleEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.email ?? null;
}

// ─── 캘린더에 일정 추가 ─────────────────────────────────────
interface CalendarEvent {
  summary: string;      // 제목
  description?: string; // 설명
  startTime: Date;      // 시작 시간
  endTime?: Date;       // 종료 시간 (없으면 시작+30분)
}

export async function addCalendarEvent(userId: string, event: CalendarEvent): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    return { success: false, error: "GOOGLE_NOT_CONNECTED" };
  }

  const endTime = event.endTime ?? new Date(event.startTime.getTime() + 30 * 60 * 1000);

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description ?? "",
        start: { dateTime: event.startTime.toISOString(), timeZone: "Asia/Seoul" },
        end: { dateTime: endTime.toISOString(), timeZone: "Asia/Seoul" },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 30 },
            { method: "popup", minutes: 10 },
          ],
        },
      }),
    }
  );

  if (!res.ok) {
    // Google API 에러 원문 노출 금지 (access_token 등 민감정보 포함 가능)
    await res.text(); // body 소비
    return { success: false, error: 'CALENDAR_API_ERROR' };
  }

  const data = await res.json() as { id: string };

  // 생성된 이벤트 ID를 DB에 저장
  // TODO: googleCalendarEvent 모델 추가 필요
  // await prisma.googleCalendarEvent.create({
  //   data: {
  //     userId,
  //     googleEventId: data.id,
  //     summary: event.summary,
  //     description: event.description ?? null,
  //     startTime: event.startTime,
  //     endTime,
  //   },
  // });

  return { success: true, eventId: data.id };
}

/** Google Calendar 이벤트 수정 */
export async function updateCalendarEvent(
  userId: string,
  googleEventId: string,
  updates: Partial<CalendarEvent>
): Promise<{ success: boolean; error?: string }> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return { success: false, error: 'GOOGLE_NOT_CONNECTED' };

  const startTime = updates.startTime ?? new Date();
  const endTime = updates.endTime ?? new Date(startTime.getTime() + 30 * 60 * 1000);

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...(updates.summary && { summary: updates.summary }),
        ...(updates.description !== undefined && { description: updates.description }),
        start: { dateTime: startTime.toISOString(), timeZone: 'Asia/Seoul' },
        end: { dateTime: endTime.toISOString(), timeZone: 'Asia/Seoul' },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    logger.error('[updateCalendarEvent] Google API 오류', { err });
    return { success: false, error: err };
  }

  return { success: true };
}

/** Google Calendar 이벤트 삭제 */
export async function deleteCalendarEvent(
  userId: string,
  googleEventId: string
): Promise<{ success: boolean; error?: string }> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return { success: false, error: 'GOOGLE_NOT_CONNECTED' };

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  // 410 Gone = 이미 삭제됨 → DB만 정리
  if (!res.ok && res.status !== 410) {
    const err = await res.text();
    logger.error('[deleteCalendarEvent] Google API 오류', { err });
    return { success: false, error: err };
  }

  return { success: true };
}
