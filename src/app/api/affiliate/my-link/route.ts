import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/affiliate/my-link
 * OWNER / FREE_SALES 전용 — 본인 어필리에이트 링크 + 수당 요약 조회
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();

    // AGENT / GLOBAL_ADMIN 차단
    if (ctx.role === 'AGENT' || ctx.role === 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: '접근 권한이 없습니다' }, { status: 403 });
    }

    let affiliateProfileId: number | null = null;

    if (ctx.role === 'OWNER' && ctx.organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { externalAffiliateProfileId: true },
      });
      affiliateProfileId = org?.externalAffiliateProfileId ?? null;
    } else if (ctx.role === 'FREE_SALES') {
      // mallUser 세션에서 직접 affiliateProfileId 추출
      if (ctx.mallUser?.affiliateProfileId) {
        affiliateProfileId = ctx.mallUser.affiliateProfileId;
      } else if (ctx.userId) {
        // fallback: GmAffiliateProfile → userId 조회
        // GmUser.crmUserId 관계는 없으므로 GmAffiliateProfile을 직접 조회
        // FREE_SALES는 mallUser 세션이 있어야 하나 방어 코드로 처리
        affiliateProfileId = null;
      }
    }

    if (!affiliateProfileId) {
      return NextResponse.json(
        { ok: false, error: '어필리에이트 프로필이 없습니다. 관리자에게 문의하세요.' },
        { status: 404 }
      );
    }

    const profile = await prisma.gmAffiliateProfile.findUnique({
      where: { id: affiliateProfileId },
      select: {
        id: true,
        affiliateCode: true,
        displayName: true,
        status: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ ok: false, error: '프로필을 찾을 수 없습니다' }, { status: 404 });
    }

    // 캠페인 링크 목록 (managerId = profile.id)
    const affiliateLinks = await prisma.gmAffiliateLink.findMany({
      where: { managerId: affiliateProfileId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        code: true,
        campaignName: true,
        clickCount: true,
        createdAt: true,
      },
    });

    // 수당 집계 (CRM AffiliateSale — affiliateCode 기준)
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));

    const [totalCommission, monthlySales] = await Promise.all([
      prisma.affiliateSale.aggregate({
        where: {
          affiliateCode: profile.affiliateCode,
          status: { not: 'CANCELLED' },
        },
        _sum: { commissionAmount: true },
      }),
      prisma.affiliateSale.aggregate({
        where: {
          affiliateCode: profile.affiliateCode,
          createdAt: { gte: monthStart },
          status: { not: 'CANCELLED' },
        },
        _sum: { saleAmount: true },
      }),
    ]);

    const cruisedotBase = process.env.CRUISEDOT_BASE_URL ?? 'https://cruisedot.co.kr';

    return NextResponse.json({
      ok: true,
      data: {
        affiliateCode: profile.affiliateCode,
        linkUrl: `${cruisedotBase}/?ref=${profile.affiliateCode}`,
        links: affiliateLinks.map(l => ({
          id: l.id,
          code: l.code,
          campaignName: l.campaignName ?? undefined,
          clicks: l.clickCount,
          createdAt: l.createdAt.toISOString(),
        })),
        totalCommission: totalCommission._sum.commissionAmount ?? 0,
        monthlySales: monthlySales._sum.saleAmount ?? 0,
      },
    });
  } catch (e) {
    logger.error('[GET /api/affiliate/my-link]', { err: e });
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('UNAUTHORIZED')) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
