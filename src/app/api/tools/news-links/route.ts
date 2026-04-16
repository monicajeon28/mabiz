import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    await getAuthContext(); // 인증 확인
    const links = await prisma.newsShortLink.findMany({
      where:   { isActive: true },
      orderBy: { createdAt: 'desc' },
      take:    20,
      select:  { id: true, shortCode: true, title: true, url: true, createdAt: true },
    });
    return NextResponse.json({ ok: true, links });
  } catch (e) {
    logger.log('[NewsLinks] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
