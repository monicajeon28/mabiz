import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

// 클라이언트가 인증 후 이 API를 호출 → 서버가 cron secret으로 news-sync 호출
export async function POST() {
  try {
    await getAuthContext(); // 로그인 확인
    const secret = process.env.CRON_SECRET;
    if (!secret) return NextResponse.json({ ok: false }, { status: 500 });

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/cron/news-sync`,
      { method: 'POST', headers: { Authorization: `Bearer ${secret}` } }
    );
    const d = await res.json() as { ok: boolean; upserted?: number };
    logger.log('[NewsSyncTrigger] 완료', { upserted: d.upserted ?? 0 });
    return NextResponse.json(d);
  } catch (e) {
    logger.log('[NewsSyncTrigger] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
