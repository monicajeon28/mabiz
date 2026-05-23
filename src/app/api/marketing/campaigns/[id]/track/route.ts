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
        organizationId: ctx.organizationId!,
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
      messages: [],
    });
  } catch (err) {
    logger.error('[GET /api/marketing/campaigns/[id]/track]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// ── POST /api/marketing/campaigns/[id]/track — 추적 데이터 수집 ──
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { action, timestamp } = body;

    if (!action) {
      return NextResponse.json(
        { ok: false, message: 'action은 필수입니다.' },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {};
    switch (action) {
      case 'email_opened':
        data.openCount = { increment: 1 };
        break;
      case 'link_clicked':
        data.clickCount = { increment: 1 };
        break;
      case 'registered':
        data.registeredCount = { increment: 1 };
        break;
      default:
        return NextResponse.json(
          { ok: false, message: '지원하지 않는 액션입니다.' },
          { status: 400 }
        );
    }

    await prisma.crmMarketingCampaign.update({
      where: { id },
      data,
    });

    logger.info('[POST /api/marketing/campaigns/[id]/track] Track event recorded', {
      campaignId: id,
      action,
      timestamp,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[POST /api/marketing/campaigns/[id]/track]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
