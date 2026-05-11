export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { enqueueDLQ } from '@/lib/mabiz-dlq';

export async function POST(req: Request) {
  // Bearer 토큰 인증 (타이밍 공격 방지)
  const secret = process.env.MABIZ_NEWS_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('[NewsSync] MABIZ_NEWS_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const auth  = req.headers.get('authorization') ?? '';
  const token = auth.replace('Bearer ', '');

  if (
    token.length !== secret.length ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json() as {
    action: 'create' | 'deactivate';
    shortCode: string;
    title?: string;
    url?: string;
    eventId?: string;
  };

  if (!body.shortCode) return NextResponse.json({ ok: false, message: 'shortCode 필수' }, { status: 400 });

  if (body.eventId) {
    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
      where: { eventId: body.eventId },
      select: { eventId: true },
    });
    if (alreadyProcessed) {
      logger.log('[NewsSync] 중복 이벤트 무시', { eventId: body.eventId });
      return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  try {
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
  } catch (err) {
    logger.error('[NewsSync] DB 처리 실패', { action: body.action, shortCode: body.shortCode, err });
    await enqueueDLQ('news-sync', body, err instanceof Error ? err.message : String(err)).catch(() => {});
    return NextResponse.json({ ok: false, message: 'DB 처리 중 오류가 발생했습니다' }, { status: 500 });
  }

  if (body.eventId) {
    await prisma.processedWebhookEvent.create({
      data: { eventId: body.eventId, webhookType: 'news-sync' },
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
