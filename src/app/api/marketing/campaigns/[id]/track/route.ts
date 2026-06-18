import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

// ── GET /api/marketing/campaigns/[id]/track — 추적 데이터 조회 ─────────
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await context.params;

    const campaign = await prisma.crmMarketingCampaign.findFirst({
      where: {
        id,
        organizationId: ctx.organizationId ?? undefined,
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { ok: false, message: '캠페인을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const stats = {
      total: campaign.totalCount,
      sent: campaign.sentCount,
      opened: campaign.openCount,
      clicked: campaign.clickCount,
      registered: campaign.registeredCount,
    };

    const conversionRates = {
      sentRate: stats.total > 0 ? ((stats.sent / stats.total) * 100).toFixed(1) : '0',
      openRate: stats.sent > 0 ? ((stats.opened / stats.sent) * 100).toFixed(1) : '0',
      clickRate: stats.sent > 0 ? ((stats.clicked / stats.sent) * 100).toFixed(1) : '0',
      registrationRate: stats.clicked > 0 ? ((stats.registered / stats.clicked) * 100).toFixed(1) : '0',
    };

    return NextResponse.json({
      ok: true,
      campaign: {
        id: campaign.id,
        title: campaign.title,
        status: campaign.status,
        sendAt: campaign.sendAt,
        createdAt: campaign.createdAt,
      },
      stats,
      conversionRates,
    });
  } catch (err) {
    logger.error('[GET /api/marketing/campaigns/[id]/track]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// ── POST /api/marketing/campaigns/[id]/track — 추적 데이터 수집 ──
// 인증 없음: 이메일 수신자(CRM 세션 없음)가 오픈/클릭 시 호출되는 공개 엔드포인트.
// 인증 요구 시 openCount/clickCount/registeredCount가 프로덕션에서 영구 0이 되는 P0 버그.
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { ok: false, message: 'action은 필수입니다.' },
        { status: 400 }
      );
    }

    const fieldMap: Record<string, 'openCount' | 'clickCount' | 'registeredCount'> = {
      email_opened: 'openCount',
      link_clicked: 'clickCount',
      registered: 'registeredCount',
    };
    const field = fieldMap[action];
    if (!field) {
      return NextResponse.json({ ok: false, message: '지원하지 않는 액션입니다.' }, { status: 400 });
    }

    // id만으로 where 조건 — 수신자는 조직 소속이 아니므로 organizationId 필터 제거
    const result = await prisma.crmMarketingCampaign.updateMany({
      where: { id },
      data: { [field]: { increment: 1 } },
    });
    if (result.count === 0) {
      return NextResponse.json(
        { ok: false, message: '캠페인을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    logger.info('[POST /api/marketing/campaigns/[id]/track] Track event recorded', {
      campaignId: id,
      action,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[POST /api/marketing/campaigns/[id]/track]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
