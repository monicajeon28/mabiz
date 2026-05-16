export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { sanitizeHtml } from '@/lib/html-sanitizer';

type Params = { params: Promise<{ id: string }> };

// ── GET /api/b2b-landing/[id] — 상세 조회 ──────────────────────
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await context.params;

    // 조직 격리: GLOBAL_ADMIN이 아니면 본인 조직만 조회
    const orgFilter =
      ctx.role === 'GLOBAL_ADMIN'
        ? {}
        : { organizationId: ctx.organizationId! };

    const page = await prisma.b2BLandingPage.findFirst({
      where: { id, ...orgFilter },
      include: {
        registrations: { orderBy: { createdAt: 'desc' }, take: 50 },
        comments:      { orderBy: { createdAt: 'desc' } },
        images:        { orderBy: { sortOrder: 'asc' }, include: { imageAsset: { select: { id: true, driveFileId: true, originalFileName: true, mimeType: true, width: true, height: true } } } },
      },
    });

    if (!page) return NextResponse.json({ ok: false, message: '페이지를 찾을 수 없습니다.' }, { status: 404 });

    return NextResponse.json({ ok: true, page });
  } catch (err) {
    logger.error('[GET /api/b2b-landing/[id]]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// ── PATCH /api/b2b-landing/[id] — 수정 ─────────────────────────
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role !== 'GLOBAL_ADMIN' && ctx.role !== 'OWNER') {
      return NextResponse.json({ ok: false, message: '수정 권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json();

    // 조직 격리
    const orgFilter =
      ctx.role === 'GLOBAL_ADMIN'
        ? {}
        : { organizationId: ctx.organizationId! };

    const existing = await prisma.b2BLandingPage.findFirst({ where: { id, ...orgFilter } });
    if (!existing) return NextResponse.json({ ok: false, message: '페이지를 찾을 수 없습니다.' }, { status: 404 });

    // slug 변경 시 중복 체크
    if (body.slug !== undefined && body.slug !== existing.slug) {
      const dup = await prisma.b2BLandingPage.findFirst({
        where: {
          slug: body.slug,
          organizationId: existing.organizationId,
          id: { not: id },
        },
      });
      if (dup) {
        return NextResponse.json({ ok: false, message: '이미 사용 중인 슬러그입니다.' }, { status: 409 });
      }
    }

    // htmlContent 소독
    const sanitizedContent =
      body.htmlContent !== undefined ? sanitizeHtml(body.htmlContent) : undefined;

    const data: Record<string, unknown> = {};
    // 단순 필드
    if (body.title            !== undefined) data.title            = body.title;
    if (body.slug             !== undefined) data.slug             = body.slug;
    if (sanitizedContent      !== undefined) data.htmlContent      = sanitizedContent;
    if (body.isActive         !== undefined) data.isActive         = body.isActive;
    if (body.formConfig       !== undefined) data.formConfig       = body.formConfig ?? null;
    if (body.buttonTitle      !== undefined) data.buttonTitle      = body.buttonTitle ?? null;
    if (body.groupId          !== undefined) data.groupId          = body.groupId ?? null;
    if (body.autoFunnelId     !== undefined) data.autoFunnelId     = body.autoFunnelId ?? null;
    if (body.paymentEnabled   !== undefined) data.paymentEnabled   = body.paymentEnabled;
    if (body.paymentType      !== undefined) data.paymentType      = body.paymentType ?? null;
    if (body.productName      !== undefined) data.productName      = body.productName ?? null;
    if (body.productPrice     !== undefined) data.productPrice     = body.productPrice ?? null;
    if (body.cycleDay         !== undefined) data.cycleDay         = body.cycleDay ?? null;
    if (body.expireDate       !== undefined) data.expireDate       = body.expireDate ? new Date(body.expireDate) : null;
    if (body.commentEnabled   !== undefined) data.commentEnabled   = body.commentEnabled;
    if (body.regEmailEnabled  !== undefined) data.regEmailEnabled  = body.regEmailEnabled;
    if (body.regEmailSubject  !== undefined) data.regEmailSubject  = body.regEmailSubject ?? null;
    if (body.regEmailContent  !== undefined) data.regEmailContent  = body.regEmailContent ?? null;
    if (body.exposureTitle    !== undefined) data.exposureTitle    = body.exposureTitle ?? null;
    if (body.exposureImage    !== undefined) data.exposureImage    = body.exposureImage ?? null;
    if (body.description      !== undefined) data.description      = body.description ?? null;
    if (body.footerText       !== undefined) data.footerText       = body.footerText ?? null;
    if (body.headerScript     !== undefined) data.headerScript     = body.headerScript ?? null;
    if (body.completionPageUrl !== undefined) data.completionPageUrl = body.completionPageUrl ?? null;
    if (body.partnerId        !== undefined) data.partnerId        = body.partnerId ?? null;
    if (body.category         !== undefined) data.category         = body.category ?? null;

    const page = await prisma.b2BLandingPage.update({
      where: { id },
      data,
    });

    return NextResponse.json({ ok: true, page });
  } catch (err) {
    logger.error('[PATCH /api/b2b-landing/[id]]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// ── DELETE /api/b2b-landing/[id] — 삭제 ─────────────────────────
export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role !== 'GLOBAL_ADMIN' && ctx.role !== 'OWNER') {
      return NextResponse.json({ ok: false, message: '삭제 권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await context.params;

    // GLOBAL_ADMIN은 조직 필터 없이, OWNER는 자기 조직만
    const orgFilter =
      ctx.role === 'GLOBAL_ADMIN'
        ? {}
        : { organizationId: ctx.organizationId! };

    const existing = await prisma.b2BLandingPage.findFirst({ where: { id, ...orgFilter } });
    if (!existing) return NextResponse.json({ ok: false, message: '페이지를 찾을 수 없습니다.' }, { status: 404 });

    // registrations, comments, images는 Prisma onDelete: Cascade로 자동 삭제
    await prisma.b2BLandingPage.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[DELETE /api/b2b-landing/[id]]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
