import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

// ── GET /api/marketing/campaigns — 캠페인 목록 조회 ────────────────
export async function GET(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const url = new URL(req.url);
    const organizationId = ctx.organizationId!;

    const campaigns = await prisma.crmMarketingCampaign.findMany({
      where: { organizationId },
      include: {
        group: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ ok: true, campaigns });
  } catch (err) {
    logger.error('[GET /api/marketing/campaigns]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// ── POST /api/marketing/campaigns — 캠페인 생성 ────────────────────
export async function POST(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      groupId,
      title,
      sendEmail,
      sendSms,
      includeLanding,
      sendAt,
      repeatRule,
    } = body;

    if (!groupId || !title || !sendAt) {
      return NextResponse.json(
        { ok: false, message: 'groupId, title, sendAt는 필수입니다.' },
        { status: 400 }
      );
    }

    // 그룹이 본 조직에 속하는지 확인
    const group = await prisma.contactGroup.findFirst({
      where: {
        id: groupId,
        organizationId: ctx.organizationId!,
      },
    });

    if (!group) {
      return NextResponse.json(
        { ok: false, message: '그룹을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 그룹 멤버 수 조회
    const memberCount = await prisma.contactGroupMember.count({
      where: { groupId },
    });

    const campaign = await prisma.crmMarketingCampaign.create({
      data: {
        organizationId: ctx.organizationId!,
        groupId,
        title,
        sendEmail: sendEmail ?? false,
        sendSms: sendSms ?? true,
        includeLanding: includeLanding ?? true,
        sendAt: new Date(sendAt),
        repeatRule: repeatRule || null,
        totalCount: memberCount,
      },
      include: {
        group: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ ok: true, campaign }, { status: 201 });
  } catch (err) {
    logger.error('[POST /api/marketing/campaigns]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
