import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, resolveOrgIdOrNull, canDelete } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { sanitizeHtml } from "@/lib/html-sanitizer";

const PatchSchema = z.object({
  title:          z.string().min(1).max(200).optional(),
  slug:           z.string().min(1).max(100).optional(),
  htmlContent:    z.string().optional(),
  isActive:       z.boolean().optional(),
  isPublic:       z.boolean().optional(),
  groupId:        z.string().nullable().optional(),
  commentEnabled: z.boolean().optional(),
  autoFunnelId:   z.string().nullable().optional(),
  // 에디터 고도화 필드
  editorMode:       z.enum(["html", "image"]).optional(),
  description:      z.string().nullable().optional(),
  category:         z.string().nullable().optional(),
  pageGroup:        z.string().nullable().optional(),
  buttonTitle:      z.string().nullable().optional(),
  completionPageUrl: z.string().nullable().optional(),
  headerScript:     z.string().nullable().optional(),
  exposureTitle:    z.string().nullable().optional(),
  exposureImage:    z.string().nullable().optional(),
  infoCollection:   z.boolean().optional(),
  formConfig:       z.any().optional(),
  // 결제 설정 (페이앱 B2B)
  paymentEnabled: z.boolean().optional(),
  paymentType:    z.enum(["onetime", "subscription"]).optional(),
  productName:    z.string().nullable().optional(),
  productPrice:   z.number().nullable().optional(),
  cycleDay:       z.number().min(1).max(90).nullable().optional(),
  expireDate:     z.string().nullable().optional(),
  // 신청 완료 이메일 설정
  regEmailEnabled: z.boolean().optional(),
  regEmailSubject: z.string().nullable().optional(),
  regEmailContent: z.string().nullable().optional(),
  // 프론트엔드 전용 (DB 저장 안 함, strict 우회용)
  commentConfig:  z.any().optional(),
}).strict();

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = resolveOrgIdOrNull(ctx);
    const { id } = await params;

    const page = await prisma.crmLandingPage.findFirst({
      where: { id, ...(orgId ? { organizationId: orgId } : {}) },
      include: {
        _count: { select: { registrations: true } },
        registrations: { orderBy: { createdAt: "desc" }, take: 50 },
        images: {
          orderBy: { sortOrder: "asc" },
          include: { imageAsset: { select: { id: true, driveFileId: true, originalFileName: true, mimeType: true, width: true, height: true } } },
        },
      },
    });
    if (!page) return NextResponse.json({ ok: false }, { status: 404 });
    return NextResponse.json({ ok: true, page });
  } catch (err) {
    logger.error("[GET /api/landing-pages/[id]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
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
      return NextResponse.json({ ok: false, message: "잘못된 요청 데이터", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const existing = await prisma.crmLandingPage.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

    const {
      title, slug, htmlContent, isActive, isPublic, groupId, commentEnabled, autoFunnelId,
      editorMode, description, category, pageGroup, buttonTitle, completionPageUrl,
      headerScript, exposureTitle, exposureImage, infoCollection, formConfig,
      paymentEnabled, paymentType, productName, productPrice, cycleDay, expireDate,
      regEmailEnabled, regEmailSubject, regEmailContent,
    } = parsed.data;
    const sanitizedContent = htmlContent !== undefined ? sanitizeHtml(htmlContent) : undefined;
    const page = await prisma.crmLandingPage.update({
      where: { id },
      data: {
        ...(title             !== undefined ? { title }                                : {}),
        ...(slug              !== undefined ? { slug }                                  : {}),
        ...(sanitizedContent  !== undefined ? { htmlContent: sanitizedContent }         : {}),
        ...(isActive          !== undefined ? { isActive }                              : {}),
        ...(isPublic          !== undefined ? { isPublic }                              : {}),
        ...(groupId           !== undefined ? { groupId: groupId ?? null }              : {}),
        ...(commentEnabled    !== undefined ? { commentEnabled }                        : {}),
        ...(autoFunnelId      !== undefined ? { autoFunnelId: autoFunnelId ?? null }    : {}),
        ...(editorMode        !== undefined ? { editorMode }                            : {}),
        ...(description       !== undefined ? { description: description ?? null }      : {}),
        ...(category          !== undefined ? { category: category ?? null }            : {}),
        ...(pageGroup         !== undefined ? { pageGroup: pageGroup ?? null }          : {}),
        ...(buttonTitle       !== undefined ? { buttonTitle: buttonTitle ?? null }       : {}),
        ...(completionPageUrl !== undefined ? { completionPageUrl: completionPageUrl ?? null } : {}),
        ...(headerScript      !== undefined ? { headerScript: headerScript ?? null }    : {}),
        ...(exposureTitle     !== undefined ? { exposureTitle: exposureTitle ?? null }   : {}),
        ...(exposureImage     !== undefined ? { exposureImage: exposureImage ?? null }   : {}),
        ...(infoCollection    !== undefined ? { infoCollection }                         : {}),
        ...(formConfig        !== undefined ? { formConfig: formConfig ?? null }        : {}),
        ...(paymentEnabled   !== undefined ? { paymentEnabled }                     : {}),
        ...(paymentType      !== undefined ? { paymentType }                        : {}),
        ...(productName      !== undefined ? { productName: productName ?? null }   : {}),
        ...(productPrice     !== undefined ? { productPrice: productPrice ?? null } : {}),
        ...(cycleDay         !== undefined ? { cycleDay: cycleDay ?? null }          : {}),
        ...(expireDate        !== undefined ? { expireDate: expireDate ? new Date(expireDate) : null } : {}),
        ...(regEmailEnabled   !== undefined ? { regEmailEnabled }                                      : {}),
        ...(regEmailSubject   !== undefined ? { regEmailSubject: regEmailSubject ?? null }             : {}),
        ...(regEmailContent   !== undefined ? { regEmailContent: regEmailContent ?? null }             : {}),
      },
    });
    return NextResponse.json({ ok: true, page });
  } catch (err) {
    logger.error("[PATCH /api/landing-pages/[id]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;

    if (!canDelete(ctx)) {
      return NextResponse.json({ ok: false, message: "삭제 권한이 없습니다." }, { status: 403 });
    }

    // GLOBAL_ADMIN은 조직 필터 없이 삭제 가능
    const where = ctx.role === "GLOBAL_ADMIN"
      ? { id }
      : { id, organizationId: resolveOrgId(ctx) };

    const existing = await prisma.crmLandingPage.findFirst({ where });
    if (!existing) return NextResponse.json({ ok: false, message: "페이지를 찾을 수 없습니다." }, { status: 404 });

    await prisma.crmLandingPage.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[DELETE /api/landing-pages/[id]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
