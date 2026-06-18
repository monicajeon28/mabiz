import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

// ── GET /api/marketing/campaigns/[id] — 캠페인 상세 조회 ──────────
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
        id: id ?? undefined,
        organizationId: ctx.organizationId ?? undefined,
      },
      include: {
        group: { select: { id: true, name: true } },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { ok: false, message: '캠페인을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, campaign });
  } catch (err) {
    logger.error('[GET /api/marketing/campaigns/[id]]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// ── PATCH /api/marketing/campaigns/[id] — 캠페인 수정 ──────────────
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json();

    const existing = await prisma.crmMarketingCampaign.findFirst({
      where: {
        id: id ?? undefined,
        organizationId: ctx.organizationId ?? undefined,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, message: '캠페인을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.sendEmail !== undefined) data.sendEmail = body.sendEmail;
    if (body.sendSms !== undefined) data.sendSms = body.sendSms;
    if (body.includeLanding !== undefined) data.includeLanding = body.includeLanding;
    if (body.sendAt !== undefined) data.sendAt = new Date(body.sendAt);
    if (body.repeatRule !== undefined) data.repeatRule = body.repeatRule || null;
    if (body.status !== undefined) {
      const PATCHABLE_STATUSES = ['DRAFT', 'PENDING'];
      if (!PATCHABLE_STATUSES.includes(body.status)) {
        return NextResponse.json(
          { ok: false, message: 'PATCH로 변경 가능한 상태는 DRAFT, PENDING만 허용됩니다.' },
          { status: 400 }
        );
      }
      data.status = body.status;
    }

    // findFirst에서 소유권 이미 검증 완료 — id만으로 update (@@unique 없는 복합 where는 Prisma P2025 오류)
    const campaign = await prisma.crmMarketingCampaign.update({
      where: { id },
      data,
      include: {
        group: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ ok: true, campaign });
  } catch (err) {
    logger.error('[PATCH /api/marketing/campaigns/[id]]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// ── DELETE /api/marketing/campaigns/[id] — 캠페인 삭제 ──────────────
export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, message: '삭제 권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await context.params;

    const existing = await prisma.crmMarketingCampaign.findFirst({
      where: {
        id: id ?? undefined,
        organizationId: ctx.organizationId ?? undefined,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, message: '캠페인을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 메시지는 onDelete: Cascade로 자동 삭제
    // findFirst에서 소유권 이미 검증 완료 — id만으로 delete (@@unique 없는 복합 where는 Prisma P2025 오류)
    await prisma.crmMarketingCampaign.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[DELETE /api/marketing/campaigns/[id]]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
