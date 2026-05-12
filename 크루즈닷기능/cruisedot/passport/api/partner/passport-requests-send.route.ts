export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      message: '대리점장/판매원은 현재 복사 방식만 지원합니다. 새 여권 요청 화면에서 링크를 생성해 복사해 주세요.',
    },
    { status: 410 },
  );
}
