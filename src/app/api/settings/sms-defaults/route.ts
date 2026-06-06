import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/rbac';

export async function GET() {
  const ctx = await getAuthContext().catch(() => null);
  if (!ctx?.userId) {
    return NextResponse.json({ ok: false, message: '인증이 필요합니다' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    senderPhone:    process.env.ALIGO_SENDER_PHONE    ?? '',
    arsNum:         process.env.ALIGO_ARS_NUM         ?? '',
    kakaoOpenChat:  process.env.KAKAO_OPEN_CHAT_URL   ?? '',
  });
}
