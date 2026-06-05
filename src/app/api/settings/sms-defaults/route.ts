import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    senderPhone:    process.env.ALIGO_SENDER_PHONE    ?? '',
    arsNum:         process.env.ALIGO_ARS_NUM         ?? '',
    kakaoOpenChat:  process.env.KAKAO_OPEN_CHAT_URL   ?? '',
  });
}
