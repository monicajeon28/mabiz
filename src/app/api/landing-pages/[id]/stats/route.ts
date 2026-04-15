export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/landing-pages/[id]/stats
 * 3단 퍼널 지표 조회 (내 조직 소유 랜딩만)
 *
 * 반환:
 *   viewCount      - 방문 수 (CrmLandingPage.viewCount)
 *   registered     - 등록 수
 *   funnelEntered  - 퍼널 진입 수 (funnelStarted=true)
 *   purchased      - 구매 전환 수 (phone 조인 + purchasedAt IS NOT NULL)
 *   rates:         - 각 단계 전환율 %
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id } = await params;

    // [보안] 소유권 검증 (IDOR 방지)
    const page = await prisma.crmLandingPage.findFirst({
      where:  { id, organizationId: orgId },
      select: { id: true, viewCount: true, title: true },
    });
    if (!page) {
      return NextResponse.json({ ok: false, message: '랜딩페이지를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 1단계: 등록 수 + 퍼널 진입 수 (단일 쿼리 groupBy)
    const regStats = await prisma.crmLandingRegistration.groupBy({
      by:     ['funnelStarted'],
      where:  { landingPageId: id },
      _count: { id: true },
    });

    const registered    = regStats.reduce((s, r) => s + r._count.id, 0);
    const funnelEntered = regStats.find(r => r.funnelStarted === true)?._count.id ?? 0;

    // 3단계: 구매 전환 수
    // CrmLandingRegistration.phone → Contact.phone (같은 조직) → purchasedAt IS NOT NULL
    const phones = await prisma.crmLandingRegistration.findMany({
      where:  { landingPageId: id },
      select: { phone: true },
    });
    const phoneList = phones.map(p => p.phone).filter(Boolean);

    let purchased = 0;
    if (phoneList.length > 0) {
      purchased = await prisma.contact.count({
        where: {
          organizationId: orgId,
          phone:          { in: phoneList },
          purchasedAt:    { not: null },
        },
      });
    }

    // 전환율 계산 (0 나누기 방지)
    const toRate = (num: number, den: number) =>
      den > 0 ? parseFloat((num / den * 100).toFixed(1)) : 0;

    const stats = {
      viewCount: page.viewCount,
      registered,
      funnelEntered,
      purchased,
      rates: {
        visitToRegister:  toRate(registered,    page.viewCount),
        registerToFunnel: toRate(funnelEntered, registered),
        funnelToPurchase: toRate(purchased,     funnelEntered),
        visitToPurchase:  toRate(purchased,      page.viewCount),
      },
    };

    logger.log('[LandingStats] 조회', { id, orgId, ...stats });

    return NextResponse.json({
      ok: true,
      stats,
      title: page.title,
      // 구매 전환은 phone 기반 조인으로 계산된 근사치 (참고용)
      note: { purchased: 'phone 기반 근사치 — 정확한 값은 결제 시스템 연동 후 확인' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('401') || msg.includes('Unauthorized')) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    logger.error('[LandingStats] 조회 실패', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
