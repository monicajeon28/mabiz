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
      return NextResponse.json({ ok: false, message: '이 기능을 사용할 권한이 없어요.' }, { status: 403 });
    }

    const { id } = await context.params;

    const campaign = await prisma.crmMarketingCampaign.findFirst({
      where: {
        id: id || undefined, // || undefined: null/undefined/빈문자열 모두 방어 (?? 는 빈문자열을 통과시킴)
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

    // [API-CAMPAIGNS-009] GLOBAL_ADMIN cross-org 읽기 감사 로그
    if (ctx.role === 'GLOBAL_ADMIN') {
      logger.info('[GET campaign] GLOBAL_ADMIN cross-org read', {
        actorId: ctx.userId,
        campaignId: id,
        targetOrgId: campaign.organizationId,
      });
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
      return NextResponse.json({ ok: false, message: '이 기능을 사용할 권한이 없어요.' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json();

    // GLOBAL_ADMIN: ctx.organizationId가 null이므로 undefined로 평가되어 Prisma가 org 필터를 무시함.
    // 이는 의도적 설계: GLOBAL_ADMIN은 모든 조직의 캠페인을 수정할 수 있음 (운영 지원 목적)
    const existing = await prisma.crmMarketingCampaign.findFirst({
      where: {
        id: id || undefined, // || undefined: null/undefined/빈문자열 모두 방어 (?? 는 빈문자열을 통과시킴)
        organizationId: ctx.organizationId ?? undefined,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, message: '캠페인을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // API-PATCH-CHANNEL-CONSISTENCY-001: 채널 플래그 변경 시 채널 콘텐츠 유무 검증
    // sendEmail: true로 PATCH 시 emailSubject/emailBody가 body 또는 기존 DB에 있어야 함
    const effectiveSendEmail = body.sendEmail !== undefined ? body.sendEmail : existing.sendEmail;
    const effectiveSendSms   = body.sendSms !== undefined   ? body.sendSms   : existing.sendSms;
    const effectiveIncludeLanding = body.includeLanding !== undefined ? body.includeLanding : existing.includeLanding;

    if (effectiveSendEmail) {
      const subject = body.emailSubject ?? existing.emailSubject;
      const emailBody = body.emailBody ?? existing.emailBody;
      if (!subject?.trim() || !emailBody?.trim()) {
        return NextResponse.json(
          { ok: false, message: '이메일 선택 시 제목과 본문이 필요합니다.' },
          { status: 400 }
        );
      }
    }
    if (effectiveSendSms) {
      const smsBody = body.smsBody ?? existing.smsBody;
      if (!smsBody?.trim()) {
        return NextResponse.json(
          { ok: false, message: '문자 선택 시 본문이 필요합니다.' },
          { status: 400 }
        );
      }
    }
    if (effectiveIncludeLanding) {
      const landingUrl  = body.landingUrl  ?? existing.landingUrl;
      const landingText = body.landingLinkText ?? existing.landingLinkText;
      if (!landingUrl?.trim() || !landingText?.trim()) {
        return NextResponse.json(
          { ok: false, message: '랜딩 링크 선택 시 URL과 텍스트가 필요합니다.' },
          { status: 400 }
        );
      }
    }

    // [API-CAMPAIGNS-PATCH-IMMUTABLE-001] SENT/FAILED/CANCELLED/SENDING 상태 캠페인 콘텐츠 변경 차단
    // body.status 유무와 무관하게 모든 필드 변경을 막아 로그 불일치 및 데이터 조작 방지
    // (SENDING 포함: 발송 중 title 변경 시 ExecutionLog와 불일치 발생)
    if (!['DRAFT', 'PENDING'].includes(existing.status)) {
      return NextResponse.json(
        { ok: false, message: '이미 처리된 캠페인은 수정할 수 없습니다. (현재 상태: ' + existing.status + ')' },
        { status: 409 }
      );
    }

    const data: Prisma.CrmMarketingCampaignUpdateInput = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.sendEmail !== undefined) data.sendEmail = body.sendEmail;
    if (body.sendSms !== undefined) data.sendSms = body.sendSms;
    if (body.includeLanding !== undefined) data.includeLanding = body.includeLanding;
    // [API-CAMPAIGNS-PATCH-SENDAT-INVALID-DATE-001] Invalid Date 저장 방지
    if (body.sendAt !== undefined) {
      const parsed = new Date(body.sendAt);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ ok: false, message: '유효하지 않은 sendAt 날짜입니다.' }, { status: 400 });
      }
      data.sendAt = parsed;
    }
    if (body.repeatRule !== undefined) data.repeatRule = body.repeatRule || null;
    // [API-CAMPAIGNS-PATCH-CONTENT-FIELDS-001] 채널 콘텐츠 필드 — 검증만 하고 저장 안 하는 버그 수정
    if (body.emailSubject !== undefined) data.emailSubject = body.emailSubject || null;
    if (body.emailBody !== undefined) data.emailBody = body.emailBody || null;
    if (body.smsBody !== undefined) data.smsBody = body.smsBody || null;
    if (body.landingUrl !== undefined) data.landingUrl = body.landingUrl || null;
    if (body.landingLinkText !== undefined) data.landingLinkText = body.landingLinkText || null;

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
    // [API-CAMPAIGNS-DELETE-AGENT-001] 정책: AGENT는 캠페인을 생성할 수 있으나 삭제는 불가.
    // 삭제는 OWNER 또는 GLOBAL_ADMIN만 허용 (감사 추적 및 실수 방지 목적).
    // AGENT에게 자기 캠페인 삭제 권한을 부여하려면 아래 조건에 ctx.role === 'AGENT' && existing.createdById === ctx.userId를 추가할 것.
    if (ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, message: '삭제 권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await context.params;

    // GLOBAL_ADMIN: cross-org 삭제 허용 (line 106에서 GLOBAL_ADMIN 삭제 권한 명시적 부여됨)
    // ctx.organizationId가 null인 GLOBAL_ADMIN은 org 필터 없이 모든 조직의 캠페인 삭제 가능
    const existing = await prisma.crmMarketingCampaign.findFirst({
      where: {
        id: id || undefined, // || undefined: null/undefined/빈문자열 모두 방어 (?? 는 빈문자열을 통과시킴)
        organizationId: ctx.organizationId ?? undefined,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, message: '캠페인을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // [API-CAMPAIGNS-009] GLOBAL_ADMIN cross-org 삭제 감사 로그
    if (ctx.role === 'GLOBAL_ADMIN') {
      logger.info('[DELETE campaign] GLOBAL_ADMIN cross-org delete', {
        actorId: ctx.userId,
        campaignId: id,
        targetOrgId: existing.organizationId,
      });
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
