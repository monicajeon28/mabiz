import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
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

    // GLOBAL_ADMIN: ctx.organizationId가 null이므로 undefined로 평가되어 Prisma가 org 필터를 무시함.
    // 이는 의도적 설계: GLOBAL_ADMIN은 모든 조직의 캠페인을 수정할 수 있음 (운영 지원 목적)
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

    const data: Prisma.CrmMarketingCampaignUpdateInput = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.sendEmail !== undefined) data.sendEmail = body.sendEmail;
    if (body.sendSms !== undefined) data.sendSms = body.sendSms;
    if (body.includeLanding !== undefined) data.includeLanding = body.includeLanding;
    if (body.sendAt !== undefined) data.sendAt = new Date(body.sendAt);
    if (body.repeatRule !== undefined) data.repeatRule = body.repeatRule || null;

    // [API-CAMPAIGNS-007] 이미 처리된 캠페인(SENT/FAILED/CANCELLED) 상태 역행 차단
    if (body.status !== undefined && !['DRAFT', 'PENDING'].includes(existing.status)) {
      return NextResponse.json(
        { ok: false, message: '이미 처리된 캠페인은 상태를 변경할 수 없습니다. (현재 상태: ' + existing.status + ')' },
        { status: 409 }
      );
    }

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

    // [API-CAMPAIGNS-008] GLOBAL_ADMIN cross-org 수정 감사 로그
    if (ctx.role === 'GLOBAL_ADMIN') {
      logger.info('[PATCH campaign] GLOBAL_ADMIN cross-org edit', {
        actorRole: ctx.role,
        actorId: ctx.userId,
        campaignId: id,
        targetOrgId: existing.organizationId,
      });
    }

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

    // GLOBAL_ADMIN: cross-org 삭제 허용 (line 106에서 GLOBAL_ADMIN 삭제 권한 명시적 부여됨)
    // ctx.organizationId가 null인 GLOBAL_ADMIN은 org 필터 없이 모든 조직의 캠페인 삭제 가능
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
