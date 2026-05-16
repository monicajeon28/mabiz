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

    // 캠페인 조회
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

    // 메시지 추적 데이터 조회
    const messages = await prisma.crmMarketingMessage.findMany({
      where: { campaignId: id },
      select: {
        id: true,
        recipientId: true,
        emailSent: true,
        smsSent: true,
        emailOpenedAt: true,
        linkClickedAt: true,
        registeredAt: true,
        createdAt: true,
      },
    });

    // 통계 계산
    const stats = {
      total: messages.length,
      sent: messages.filter((m) => m.emailSent || m.smsSent).length,
      opened: messages.filter((m) => m.emailOpenedAt).length,
      clicked: messages.filter((m) => m.linkClickedAt).length,
      registered: messages.filter((m) => m.registeredAt).length,
    };

    // 전환율 계산
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
      messages,
    });
  } catch (err) {
    logger.error('[GET /api/marketing/campaigns/[id]/track]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// ── POST /api/marketing/campaigns/[id]/track — 추적 데이터 수집 (웹훅) ──
// 이메일 열람, 링크 클릭 등을 추적하는 엔드포인트
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { recipientId, action, timestamp } = body;

    if (!recipientId || !action) {
      return NextResponse.json(
        { ok: false, message: 'recipientId, action은 필수입니다.' },
        { status: 400 }
      );
    }

    // 메시지 조회
    const message = await prisma.crmMarketingMessage.findUnique({
      where: {
        campaignId_recipientId: {
          campaignId: id,
          recipientId,
        },
      },
    });

    if (!message) {
      return NextResponse.json(
        { ok: false, message: '메시지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 액션에 따라 추적 데이터 업데이트
    const data: Record<string, unknown> = {};

    switch (action) {
      case 'email_opened':
        data.emailOpenedAt = new Date(timestamp || new Date());
        break;
      case 'link_clicked':
        data.linkClickedAt = new Date(timestamp || new Date());
        break;
      case 'registered':
        data.registeredAt = new Date(timestamp || new Date());
        if (body.registrationId) {
          data.registrationId = body.registrationId;
        }
        break;
      default:
        return NextResponse.json(
          { ok: false, message: '지원하지 않는 액션입니다.' },
          { status: 400 }
        );
    }

    // 메시지 업데이트
    const updated = await prisma.crmMarketingMessage.update({
      where: { id: message.id },
      data,
    });

    logger.info('[POST /api/marketing/campaigns/[id]/track] Track event recorded', {
      campaignId: id,
      recipientId,
      action,
    });

    return NextResponse.json({ ok: true, message: updated });
  } catch (err) {
    logger.error('[POST /api/marketing/campaigns/[id]/track]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
