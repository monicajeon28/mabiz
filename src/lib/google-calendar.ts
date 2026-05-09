import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import prisma from "@/lib/prisma";

// ─── 환경변수 ────────────────────────────────────────────────
const CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET!;
const REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI!;

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
  const [ivHex, encHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = createDecipheriv("aes-256-cbc", getEncryptKey(), iv);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
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
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
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
    const refreshed = await refreshAccessToken(decryptedRefresh);

    await prisma.googleCalendarToken.update({
      where: { userId },
      data: {
        accessToken: encryptToken(refreshed.access_token),
        expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      },
    });

    return refreshed.access_token;
  } catch {
    // refresh 실패 시 토큰 삭제 (재로그인 필요)
    await prisma.googleCalendarToken.delete({ where: { userId } });
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

  const data = await res.json();
  return { success: true, eventId: data.id };
}
