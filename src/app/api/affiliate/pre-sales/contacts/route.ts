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

    // PRE_SALES GmAffiliateProfile 목록 조회
    const preSalesProfiles = await prisma.gmAffiliateProfile.findMany({
      where: { type: 'PRE_SALES', status: { not: 'DELETED' } },
      select: { id: true, affiliateCode: true, displayName: true },
    });

    const affiliateCodes = preSalesProfiles
      .map((p) => p.affiliateCode)
      .filter((c): c is string => c !== null && c.length > 0);

    if (affiliateCodes.length === 0) {
      return NextResponse.json({ ok: true, items: [] });
    }

    // Contact.affiliateCode 기준 집계
    const contactGroups = await prisma.contact.groupBy({
      by: ['affiliateCode'],
      where: {
        affiliateCode: { in: affiliateCodes },
        deletedAt: null,
      },
      _count: { _all: true },
    });

    const countMap = new Map(
      contactGroups.map((g) => [g.affiliateCode, g._count._all])
    );

    const items = preSalesProfiles.map((p) => ({
      profileId: p.id,
      affiliateCode: p.affiliateCode,
      displayName: p.displayName,
      contactCount: p.affiliateCode ? (countMap.get(p.affiliateCode) ?? 0) : 0,
    }));

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    logger.error('[GET /api/affiliate/pre-sales/contacts]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
