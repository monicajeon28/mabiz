export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/b2b-landing/[id]/stats
 * B2B 랜딩페이지 5단 퍼널 지표 조회
 *
 * 반환:
 *   viewCount        - 방문 수 (B2BLandingPage.viewCount)
 *   registered       - 신청 수
 *   funnelEntered    - 퍼널 진입 수 (funnelStarted=true)
 *   visitToRegister  - 방문→신청 전환율 %
 *   registerToFunnel - 신청→퍼널 전환율 %
 */
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json({ ok: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const { id } = await context.params;
    const orgId = session.organizationId;

    // [보안] 소유권 검증 (org isolation)
    const page = await prisma.b2BLandingPage.findFirst({
      where: { id, ...(orgId ? { organizationId: orgId } : {}) },
      select: { id: true, viewCount: true, title: true },
    });

    if (!page) {
      return NextResponse.json({ ok: false, message: 'B2B 랜딩페이지를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 등록 수 + 퍼널 진입 수 — 단일 groupBy 쿼리
    const regStats = await prisma.b2BLandingRegistration.groupBy({
      by: ['funnelStarted'],
      where: { landingPageId: id },
      _count: { id: true },
    });

    const registered = regStats.reduce((sum, r) => sum + r._count.id, 0);
    const funnelEntered = regStats.find(r => r.funnelStarted === true)?._count.id ?? 0;

    // 전환율 계산 (0 나누기 방지)
    const toRate = (num: number, den: number) =>
      den > 0 ? parseFloat((num / den * 100).toFixed(1)) : 0;

    const stats = {
      viewCount: page.viewCount,
      registered,
      funnelEntered,
      visitToRegister: toRate(registered, page.viewCount),
      registerToFunnel: toRate(funnelEntered, registered),
    };

    return NextResponse.json({ ok: true, stats });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('401') || msg.includes('Unauthorized')) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    return NextResponse.json({ ok: false, message: '통계 조회 실패' }, { status: 500 });
  }
}
