import { NextResponse } from "next/server";
import { getMabizSession } from "@/lib/auth";
import { getAuthUrl, signState } from "@/lib/google-calendar";

// GET /api/auth/google-calendar — Google OAuth 로그인 시작
export async function GET() {
  const session = await getMabizSession();
  if (!session) {
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  }

  // state에 userId 넣어서 callback에서 식별 (HMAC 서명 포함)
  const state = signState({ userId: session.userId, ts: Date.now() });

  const authUrl = getAuthUrl(state);
  return NextResponse.redirect(authUrl);
}
