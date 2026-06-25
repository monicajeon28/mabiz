import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

/**
 * POST /api/affiliate/my-link/create-campaign
 * OWNER 전용 — 캠페인별 GmAffiliateLink 신규 생성
 *
 * Body: { campaignName: string, utmSource?: string, utmMedium?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();

    if (ctx.role !== 'OWNER') {
      return NextResponse.json(
        { ok: false, error: '지사장만 캠페인 링크를 생성할 수 있습니다' },
        { status: 403 }
      );
    }

    const body = (await req.json()) as {
      campaignName?: string;
      utmSource?: string;
      utmMedium?: string;
    };

    if (!body.campaignName?.trim()) {
      return NextResponse.json({ ok: false, error: '캠페인 이름은 필수입니다' }, { status: 400 });
    }
    if (body.campaignName.length > 50) {
      return NextResponse.json(
        { ok: false, error: '캠페인 이름은 50자 이하여야 합니다' },
        { status: 400 }
      );
    }

    // Organization → externalAffiliateProfileId 조회
    if (!ctx.organizationId) {
      return NextResponse.json({ ok: false, error: '조직 정보가 없습니다' }, { status: 400 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { externalAffiliateProfileId: true },
    });

    if (!org?.externalAffiliateProfileId) {
      return NextResponse.json(
        { ok: false, error: '어필리에이트 프로필이 없습니다' },
        { status: 404 }
      );
    }

    const profileId = org.externalAffiliateProfileId;

    // 고유 코드 생성 (최대 5회 시도)
    let code = '';
    for (let i = 0; i < 5; i++) {
      const candidate = nanoid(8);
      const existing = await prisma.gmAffiliateLink.findFirst({
        where: { code: candidate },
        select: { id: true },
      });
      if (!existing) {
        code = candidate;
        break;
      }
    }
    if (!code) {
      return NextResponse.json(
        { ok: false, error: '링크 코드 생성 실패. 다시 시도해주세요.' },
        { status: 500 }
      );
    }

    const link = await prisma.gmAffiliateLink.create({
      data: {
        code,
        campaignName: body.campaignName.trim(),
        utmSource: body.utmSource ?? 'crm',
        utmMedium: body.utmMedium ?? 'link',
        managerId: profileId,
        issuedById: profileId,
        clickCount: 0,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        code: true,
        campaignName: true,
        clickCount: true,
        createdAt: true,
      },
    });

    const cruisedotBase = process.env.CRUISEDOT_BASE_URL ?? 'https://cruisedot.co.kr';

    return NextResponse.json({
      ok: true,
      link: {
        id: link.id,
        code: link.code,
        campaignName: link.campaignName,
        clicks: link.clickCount,
        createdAt: link.createdAt.toISOString(),
        linkUrl: `${cruisedotBase}/?ref=${code}`,
      },
    });
  } catch (e) {
    logger.error('[POST /api/affiliate/my-link/create-campaign]', { err: e });
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('UNAUTHORIZED')) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
