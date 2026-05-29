import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/landing-pages/[id]/live-stats
 * 실시간 소셜 증명 데이터 (인증 불필요, 공개 페이지용)
 *
 * 반환:
 *   viewersNow        - 최근 10분 방문자 수
 *   recentRegistrants - 최근 등록자 5명 (익명화: 첫 글자 + ○○)
 *
 * 캐시: max-age=5 (5초)
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const [viewersNow, recentRegs] = await Promise.all([
      // 최근 10분 방문자 수
      prisma.crmLandingView.count({
        where: {
          landingPageId: id,
          viewedAt: { gte: tenMinutesAgo },
        },
      }),

      // 최근 등록자 5명 (이름만 조회)
      prisma.crmLandingRegistration.findMany({
        where: { landingPageId: id },
        select: { name: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    // 익명화: 첫 글자 + "○○"
    const recentRegistrants = recentRegs.map((r) => {
      const first = r.name.trim().charAt(0) || '?';
      return `${first}○○`;
    });

    return NextResponse.json(
      { viewersNow, recentRegistrants },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=5',
        },
      }
    );
  } catch {
    return NextResponse.json(
      { error: 'unavailable' },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }
}
