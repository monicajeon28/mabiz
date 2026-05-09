import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { exchangeCode, encryptToken, getGoogleEmail } from "@/lib/google-calendar";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://mabizcruisedot.com";

// GET /api/auth/google-calendar/callback — Google이 리다이렉트하는 곳
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const error = searchParams.get("error");

  // Google에서 에러 반환
  if (error) {
    return NextResponse.redirect(`${APP_URL}/settings?calendar_error=${error}`);
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${APP_URL}/settings?calendar_error=missing_params`);
  }

  // state에서 userId 추출
  let userId: string;
  try {
    const state = JSON.parse(Buffer.from(stateParam, "base64url").toString());
    userId = state.userId;
    // 10분 이상 지난 state 거부
    if (Date.now() - state.ts > 10 * 60 * 1000) {
      return NextResponse.redirect(`${APP_URL}/settings?calendar_error=state_expired`);
    }
  } catch {
    return NextResponse.redirect(`${APP_URL}/settings?calendar_error=invalid_state`);
  }

  try {
    // code → token 교환
    const tokens = await exchangeCode(code);

    if (!tokens.refresh_token) {
      return NextResponse.redirect(`${APP_URL}/settings?calendar_error=no_refresh_token`);
    }

    // Google 이메일 가져오기
    const email = await getGoogleEmail(tokens.access_token);

    // 암호화 후 DB 저장 (upsert — 재연결 시 덮어쓰기)
    await prisma.googleCalendarToken.upsert({
      where: { userId },
      create: {
        userId,
        accessToken: encryptToken(tokens.access_token),
        refreshToken: encryptToken(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        calendarEmail: email,
      },
      update: {
        accessToken: encryptToken(tokens.access_token),
        refreshToken: encryptToken(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        calendarEmail: email,
      },
    });

    return NextResponse.redirect(`${APP_URL}/settings?calendar_connected=true`);
  } catch (err) {
    console.error("[Google Calendar Callback] Error:", err);
    return NextResponse.redirect(`${APP_URL}/settings?calendar_error=token_exchange_failed`);
  }
}
