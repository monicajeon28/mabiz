import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

const CRUISE_NEWS_URL = 'https://www.cruisedot.co.kr/api/public/news';

export async function POST(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // 마지막 동기화 시간 조회
  const state = await prisma.newsSyncState.upsert({
    where:  { id: 'global' },
    create: { id: 'global', lastSyncedAt: new Date(0) },
    update: {},
    select: { lastSyncedAt: true },
  });

  const since = state.lastSyncedAt.toISOString();

  try {
    const res = await fetch(`${CRUISE_NEWS_URL}?since=${encodeURIComponent(since)}`, {
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json() as { ok: boolean; news: Array<{ shortCode: string; title: string; url: string; isActive: boolean; updatedAt: string }> };
    if (!data.ok) throw new Error('API 응답 오류');

    let upserted = 0;
    for (const item of data.news) {
      await prisma.newsShortLink.upsert({
        where:  { shortCode: item.shortCode },
        create: { shortCode: item.shortCode, title: item.title, url: item.url, isActive: item.isActive },
        update: { title: item.title, url: item.url, isActive: item.isActive, syncedAt: new Date() },
      });
      upserted++;
    }

    // 동기화 시간 업데이트
    await prisma.newsSyncState.update({
      where: { id: 'global' },
      data:  { lastSyncedAt: new Date() },
    });

    logger.log('[NewsCron] 동기화 완료', { upserted, since });
    return NextResponse.json({ ok: true, upserted });
  } catch (e) {
    logger.log('[NewsCron] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
