export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

const VIEW_SALT = process.env.LANDING_VIEW_SALT ?? 'crm-landing-view-2026';

/**
 * POST /api/landing-pages/[id]/view
 * 랜딩페이지 방문 시 viewCount +1 (공개 API, 인증 불필요)
 * IP 해시 기반 24시간 중복 방문 제거 (CrmLandingView 테이블 활용)
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;

    // IP 추출 및 해싱
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown';
    const ipHash = createHash('sha256').update(ip + VIEW_SALT).digest('hex');

    // 24시간 내 동일 IP 중복 체크
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await prisma.crmLandingView.findFirst({
      where: { landingPageId: id, ipHash, viewedAt: { gte: cutoff } },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // 새 방문: viewCount++ + CrmLandingView 기록
    await prisma.$transaction([
      prisma.crmLandingPage.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
        select: { id: true },
      }),
      prisma.crmLandingView.create({
        data: { landingPageId: id, ipHash },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[LandingView] viewCount 증가 실패', { err });
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
