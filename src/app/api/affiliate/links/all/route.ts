export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: '관리자 전용입니다' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') ?? '').slice(0, 100);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20', 10));
    const skip = (page - 1) * limit;

    // Organization.externalAffiliateProfileId → GmAffiliateProfile → GmAffiliateLink
    const orgs = await prisma.organization.findMany({
      where: {
        externalAffiliateProfileId: { not: null },
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      },
      select: {
        id: true,
        name: true,
        externalAffiliateProfileId: true,
      },
      skip,
      take: limit,
      orderBy: { name: 'asc' },
    });

    const profileIds = orgs
      .map((o) => o.externalAffiliateProfileId)
      .filter((id): id is number => id !== null);

    const [profiles, links, total] = await Promise.all([
      profileIds.length > 0
        ? prisma.gmAffiliateProfile.findMany({
            where: { id: { in: profileIds } },
            select: { id: true, affiliateCode: true, status: true },
          })
        : Promise.resolve([]),
      profileIds.length > 0
        ? prisma.gmAffiliateLink.findMany({
            where: { managerId: { in: profileIds } },
            select: {
              id: true,
              managerId: true,
              code: true,
              campaignName: true,
              status: true,
              clickCount: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
      prisma.organization.count({
        where: {
          externalAffiliateProfileId: { not: null },
          ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
        },
      }),
    ]);

    const profileMap = new Map(profiles.map((p) => [p.id, p]));
    type LinkItem = (typeof links)[number];
    const linksByManager = links.reduce<Record<number, LinkItem[]>>((acc, l) => {
      if (l.managerId !== null) {
        if (!acc[l.managerId]) acc[l.managerId] = [];
        acc[l.managerId].push(l);
      }
      return acc;
    }, {});

    const result = orgs.map((org) => {
      const profileId = org.externalAffiliateProfileId;
      const profile = profileId ? profileMap.get(profileId) : null;
      const orgCampaigns = profileId ? (linksByManager[profileId] ?? []) : [];

      return {
        orgId: org.id,
        orgName: org.name,
        affiliateCode: profile?.affiliateCode ?? null,
        profileStatus: profile?.status ?? null,
        baseUrl: profile?.affiliateCode
          ? `https://cruisedot.co.kr/?ref=${profile.affiliateCode}`
          : null,
        campaigns: orgCampaigns.map((c) => ({
          id: c.id,
          code: c.code,
          campaignName: c.campaignName,
          isActive: c.status === 'ACTIVE',
          clickCount: c.clickCount,
        })),
      };
    });

    return NextResponse.json({
      ok: true,
      items: result,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    logger.error('[GET /api/affiliate/links/all]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
