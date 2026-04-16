import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  // Bearer 토큰 인증
  const auth   = req.headers.get('authorization') ?? '';
  const secret = process.env.MABIZ_NEWS_WEBHOOK_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json() as {
    action: 'create' | 'deactivate';
    shortCode: string;
    title?: string;
    url?: string;
  };

  if (!body.shortCode) return NextResponse.json({ ok: false, message: 'shortCode 필수' }, { status: 400 });

  if (body.action === 'create') {
    await prisma.newsShortLink.upsert({
      where:  { shortCode: body.shortCode },
      create: {
        shortCode: body.shortCode,
        title:     body.title ?? '크루즈닷 뉴스',
        url:       body.url ?? `https://www.cruisedot.co.kr/n/${body.shortCode}`,
        isActive:  true,
      },
      update: {
        title:    body.title ?? '크루즈닷 뉴스',
        url:      body.url ?? `https://www.cruisedot.co.kr/n/${body.shortCode}`,
        isActive: true,
        syncedAt: new Date(),
      },
    });
    logger.log('[NewsSync] 뉴스 추가됨', { shortCode: body.shortCode });
  } else if (body.action === 'deactivate') {
    await prisma.newsShortLink.updateMany({
      where: { shortCode: body.shortCode },
      data:  { isActive: false, syncedAt: new Date() },
    });
    logger.log('[NewsSync] 뉴스 비활성화됨', { shortCode: body.shortCode });
  }

  return NextResponse.json({ ok: true });
}
