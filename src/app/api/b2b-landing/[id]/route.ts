import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, resolveOrgIdOrNull, canDelete } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { sanitizeHtml } from "@/lib/html-sanitizer";

const PatchSchema = z.object({
  title:          z.string().min(1).max(200).optional(),
  htmlContent:    z.string().optional(),
  partnerId:      z.string().nullable().optional(),
  isActive:       z.boolean().optional(),
  groupId:        z.string().nullable().optional(),
  commentEnabled: z.boolean().optional(),
  autoFunnelId:   z.string().nullable().optional(),
  description:      z.string().nullable().optional(),
  headerScript:     z.string().nullable().optional(),
  exposureTitle:    z.string().nullable().optional(),
  exposureImage:    z.string().nullable().optional(),
  formConfig:       z.any().optional(),
}).strict();

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = resolveOrgIdOrNull(ctx);
    const { id } = await params;

    // 상세 조회 — 에디터/폼 등 모든 필드 필요
    const page = await prisma.b2BLandingPage.findFirst({
      where: { id, ...(orgId ? { organizationId: orgId } : {}) },
      include: {
        _count: { select: { registrations: true } },
        registrations: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: { id: true, name: true, phone: true, email: true, createdAt: true, funnelStarted: true },
        },
        images: {
          orderBy: { sortOrder: "asc" },
          include: { imageAsset: { select: { id: true, driveFileId: true, originalFileName: true, mimeType: true, width: true, height: true } } },
        },
      },
    });
    if (!page) return NextResponse.json({ ok: false, error: 'NOT_FOUND', message: '랜딩페이지를 찾을 수 없습니다.' }, { status: 404 });
    return NextResponse.json({ ok: true, data: page, page });
  } catch (err) {
    logger.error("[GET /api/b2b-landing/[id]]", { err });
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id } = await params;
    const body   = await req.json();

    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'INVALID_INPUT', message: "잘못된 요청 데이터", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const existing = await prisma.b2BLandingPage.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) return NextResponse.json({ ok: false, error: 'NOT_FOUND', message: '랜딩페이지를 찾을 수 없습니다.' }, { status: 404 });

    const {
      title, htmlContent, partnerId, isActive, groupId, commentEnabled, autoFunnelId,
      description, headerScript, exposureTitle, exposureImage, formConfig,
    } = parsed.data;

    const sanitizedContent = htmlContent !== undefined ? sanitizeHtml(htmlContent) : undefined;

    const page = await prisma.b2BLandingPage.update({
      where: { id },
      data: {
        ...(title             !== undefined ? { title }                                : {}),
        ...(sanitizedContent  !== undefined ? { htmlContent: sanitizedContent }         : {}),
        ...(partnerId         !== undefined ? { partnerId: partnerId ?? null }          : {}),
        ...(isActive          !== undefined ? { isActive }                              : {}),
        ...(groupId           !== undefined ? { groupId: groupId ?? null }              : {}),
        ...(commentEnabled    !== undefined ? { commentEnabled }                        : {}),
        ...(autoFunnelId      !== undefined ? { autoFunnelId: autoFunnelId ?? null }    : {}),
        ...(description       !== undefined ? { description: description ?? null }      : {}),
        ...(headerScript      !== undefined ? { headerScript: headerScript ?? null }    : {}),
        ...(exposureTitle     !== undefined ? { exposureTitle: exposureTitle ?? null }   : {}),
        ...(exposureImage     !== undefined ? { exposureImage: exposureImage ?? null }   : {}),
        ...(formConfig        !== undefined ? { formConfig: formConfig ?? null }        : {}),
      },
    });
    return NextResponse.json({ ok: true, data: page, page });
  } catch (err) {
    logger.error("[PATCH /api/b2b-landing/[id]]", { err });
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;

    if (!canDelete(ctx)) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN', message: "삭제 권한이 없습니다." }, { status: 403 });
    }

    const where = ctx.role === "GLOBAL_ADMIN"
      ? { id }
      : { id, organizationId: resolveOrgId(ctx) };

    const existing = await prisma.b2BLandingPage.findFirst({ where });
    if (!existing) return NextResponse.json({ ok: false, error: 'NOT_FOUND', message: "페이지를 찾을 수 없습니다." }, { status: 404 });

    await prisma.b2BLandingPage.delete({ where: { id } });
    return NextResponse.json({ ok: true, data: null, message: '삭제되었습니다.' });
  } catch (err) {
    logger.error("[DELETE /api/b2b-landing/[id]]", { err });
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
