import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMabizSession } from "@/lib/auth";
import { exchangeCode, encryptToken, getGoogleEmail, verifyState } from "@/lib/google-calendar";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://mabizcruisedot.com";

// GET /api/auth/google-calendar/callback — Google이 리다이렉트하는 곳
export async function GET(req: NextRequest) {
  // 수정 1: 비로그인 차단 — 세션 없으면 즉시 거부
  const session = await getMabizSession();
  if (!session) {
    return NextResponse.redirect(`${APP_URL}/settings?calendar_error=unauthorized`);
  }

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

  // 수정 2: HMAC 서명 검증으로 state 위·변조 방지
  const stateData = verifyState(stateParam);
  if (!stateData) {
    return NextResponse.redirect(`${APP_URL}/settings?calendar_error=invalid_state`);
  }
  // 10분 만료 체크
  if (Date.now() - stateData.ts > 10 * 60 * 1000) {
    return NextResponse.redirect(`${APP_URL}/settings?calendar_error=state_expired`);
  }

  // 수정 3: IDOR 방지 — 세션 userId와 state userId 교차 검증
  if (session.userId !== stateData.userId) {
    return NextResponse.redirect(`${APP_URL}/settings?calendar_error=unauthorized`);
  }

  const userId = stateData.userId;

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
    // 수정 4: 민감 정보(토큰 등) 로그 노출 방지
    console.error("[Google Calendar Callback] Error:", err instanceof Error ? err.message : String(err));
    return NextResponse.redirect(`${APP_URL}/settings?calendar_error=token_exchange_failed`);
  }
}
