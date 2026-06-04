import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, canDelete } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { sanitizeHtml } from "@/lib/html-sanitizer";
import { sanitizeHeaderScript } from "@/lib/sanitize-header-script";
import { handleB2BError } from "@/lib/b2b/response-handler";

const PatchSchema = z.object({
  title:             z.string().min(1).max(200).optional(),
  htmlContent:       z.string().optional(),
  partnerId:         z.string().nullable().optional(),
  isActive:          z.boolean().optional(),
  groupId:           z.string().nullable().optional(),
  commentEnabled:    z.boolean().optional(),
  autoFunnelId:      z.string().nullable().optional(),
  description:       z.string().nullable().optional(),
  headerScript:      z.string().nullable().optional(),
  exposureTitle:     z.string().nullable().optional(),
  exposureImage:     z.string().nullable().optional(),
  formConfig:        z.record(z.string(), z.unknown()).nullable().optional(),
  // 에디터 모드 + 폼 설정
  editorMode:        z.enum(['html', 'image']).optional(),
  infoCollection:    z.boolean().optional(),
  buttonTitle:       z.string().nullable().optional(),
  completionPageUrl: z.string().nullable().optional(),
  footerText:        z.string().nullable().optional(),
  // 결제 설정
  paymentEnabled:    z.boolean().optional(),
  paymentType:       z.string().nullable().optional(),
  productName:       z.string().nullable().optional(),
  productPrice:      z.number().int().nullable().optional(),
  cycleDay:          z.number().int().nullable().optional(),
  expireDate:        z.string().nullable().optional(),
  // 댓글 설정 (commentConfig는 스키마 컬럼 없음 — formConfig에 저장용으로 허용)
  commentConfig:     z.record(z.string(), z.unknown()).nullable().optional(),
  // 이메일 자동발송 설정
  regEmailEnabled:   z.boolean().optional(),
  regEmailSubject:   z.string().nullable().optional(),
  regEmailContent:   z.string().nullable().optional(),
}).strict();

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    // 상세 조회 — 조직 소유권 필터 필수
    const page = await prisma.b2BLandingPage.findFirst({
      where: { id, organizationId: orgId },
      include: {
        _count: { select: { registrations: true } },
        registrations: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: { id: true, name: true, phone: true, email: true, createdAt: true, funnelStarted: true },
        },
      },
    });
    if (!page) return NextResponse.json({ ok: false, error: 'NOT_FOUND', message: '랜딩페이지를 찾을 수 없습니다.' }, { status: 404 });

    // 이미지 별도 조회 (B2BLandingPage에 images relation 없음)
    const rawImages = await prisma.b2BLandingPageImage.findMany({
      where: { landingPageId: id },
      orderBy: { sortOrder: 'asc' },
    });
    const assetIds = rawImages.map((img) => img.imageAssetId).filter(Boolean);
    const assets = assetIds.length > 0
      ? await prisma.imageAsset.findMany({ where: { id: { in: assetIds } } })
      : [];
    const assetMap = new Map(assets.map((a) => [a.id, a]));
    const images = rawImages.map((img) => {
      const asset = assetMap.get(img.imageAssetId);
      return {
        id: img.id,
        assetId: img.imageAssetId,
        url: asset?.driveFileId ? `https://drive.google.com/thumbnail?id=${asset.driveFileId}&sz=w800` : '',
        driveFileId: asset?.driveFileId ?? '',
        sortOrder: img.sortOrder,
        altText: img.altText,
      };
    });

    return NextResponse.json({ ok: true, data: { ...page, images }, page: { ...page, images } });
  } catch (err) {
    return handleB2BError(err, "GET /api/b2b-landing/[id]");
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
      editorMode, infoCollection, buttonTitle, completionPageUrl, footerText,
      paymentEnabled, paymentType, productName, productPrice, cycleDay, expireDate,
      regEmailEnabled, regEmailSubject, regEmailContent,
      // commentConfig는 DB 컬럼 없음 — formConfig에 병합하거나 무시
    } = parsed.data;

    const sanitizedContent = htmlContent !== undefined ? sanitizeHtml(htmlContent) : undefined;

    const updateData: Record<string, unknown> = {
      ...(title              !== undefined ? { title }                                         : {}),
      ...(sanitizedContent   !== undefined ? { htmlContent: sanitizedContent }                 : {}),
      ...(partnerId          !== undefined ? { partnerId: partnerId ?? null }                  : {}),
      ...(isActive           !== undefined ? { isActive }                                      : {}),
      ...(groupId            !== undefined ? { groupId: groupId ?? null }                      : {}),
      ...(commentEnabled     !== undefined ? { commentEnabled }                                : {}),
      ...(autoFunnelId       !== undefined ? { autoFunnelId: autoFunnelId ?? null }            : {}),
      ...(description        !== undefined ? { description: description ?? null }              : {}),
      ...(headerScript       !== undefined ? { headerScript: sanitizeHeaderScript(headerScript) } : {}),
      ...(exposureTitle      !== undefined ? { exposureTitle: exposureTitle ?? null }           : {}),
      ...(exposureImage      !== undefined ? { exposureImage: exposureImage ?? null }           : {}),
      ...(formConfig         !== undefined ? { formConfig: formConfig ?? null }                : {}),
      ...(editorMode         !== undefined ? { editorMode }                                    : {}),
      ...(buttonTitle        !== undefined ? { buttonTitle: buttonTitle ?? null }              : {}),
      ...(completionPageUrl  !== undefined ? { completionPageUrl: completionPageUrl ?? null }  : {}),
      ...(footerText         !== undefined ? { footerText: footerText ?? null }                : {}),
      ...(paymentEnabled     !== undefined ? { paymentEnabled }                                : {}),
      ...(paymentType        !== undefined ? { paymentType: paymentType ?? null }              : {}),
      ...(productName        !== undefined ? { productName: productName ?? null }              : {}),
      ...(productPrice       !== undefined ? { productPrice: productPrice ?? null }            : {}),
      ...(cycleDay           !== undefined ? { cycleDay: cycleDay ?? null }                    : {}),
      ...(expireDate         !== undefined ? { expireDate: expireDate ? new Date(expireDate) : null } : {}),
      ...(regEmailEnabled    !== undefined ? { regEmailEnabled }                               : {}),
      ...(regEmailSubject    !== undefined ? { regEmailSubject: regEmailSubject ?? null }      : {}),
      ...(regEmailContent    !== undefined ? { regEmailContent: regEmailContent ?? null }      : {}),
    };

    const page = await prisma.b2BLandingPage.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json({ ok: true, data: page, page });
  } catch (err) {
    return handleB2BError(err, "PATCH /api/b2b-landing/[id]");
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

    await prisma.b2BLandingPage.delete({ where });
    return NextResponse.json({ ok: true, data: null, message: '삭제되었습니다.' });
  } catch (err) {
    return handleB2BError(err, "DELETE /api/b2b-landing/[id]");
  }
}
