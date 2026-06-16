import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, resolveOrgIdOrNull, canDelete } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { sanitizeHtml } from "@/lib/html-sanitizer";
import { sanitizeHeaderScript } from "@/lib/sanitize-header-script";
import { IMAGE_FIELDS_BY_FORMAT, CTA_PSYCHOLOGY_MAP } from "@/lib/landing-page-constants";

const PatchSchema = z.object({
  title:          z.string().min(1).max(200).optional(),
  slug:           z.string().min(1).max(100).optional(),
  htmlContent:    z.string().optional(),
  isActive:       z.boolean().optional(),
  isPublic:       z.boolean().optional(),
  groupId:        z.string().nullable().optional(),
  // 이름+연락처 입력 시 배정 그룹: 대그룹=카테고리, 소그룹=그룹명. 서버가 그룹 관리에 생성/연결
  groupCategory:  z.string().max(100).nullable().optional(),
  groupSubName:   z.string().max(100).nullable().optional(),
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
  regEmailSubject: z.string().max(200).nullable().optional(), // P0-6: DoS 방지
  regEmailContent: z.string().max(10000).nullable().optional(), // P0-6: DoS 방지
  // Phase 3: pageFormat + ctaType + SMS 재생성
  pageFormat:     z.enum(['squeeze', 'vsl', 'webinar', 'funnel', 'tripwire', 'downsell', 'launch', 'hybrid']).optional(),
  ctaType:        z.enum(['default', 'urgent', 'explore', 'reserve']).optional(),
  imageFieldConfig: z.record(z.string(), z.any()).optional(),
  companyName:    z.string().nullable().optional(),
  // 블록 에디터 설정 (JSON 문자열로 저장)
  blocksConfig:   z.string().nullable().optional(),
  // 프론트엔드 전용 (DB 저장 안 함, strict 우회용)
  commentConfig:  z.any().optional(),
}).strict();

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = resolveOrgIdOrNull(ctx);
    const { id } = await params;
    // GLOBAL_ADMIN은 조직 필터 없이 조회 가능하지만 신청자 PII(registrations) 제외 (P0-5)
    const isGlobalAdmin = ctx.role === 'GLOBAL_ADMIN';

    const page = await prisma.crmLandingPage.findFirst({
      where: { id, ...(orgId ? { organizationId: orgId } : {}) },
      include: {
        _count: { select: { registrations: true } },
        ...(!isGlobalAdmin ? { registrations: { orderBy: { createdAt: "desc" }, take: 50 } } : {}),
        group: { select: { id: true, name: true, category: true } },
      },
    });
    if (!page) return NextResponse.json({ ok: false }, { status: 404 });

    const images = await prisma.crmLandingPageImage.findMany({
      where: { landingPageId: id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ ok: true, page: { ...page, images } });
  } catch (err) {
    logger.error("[GET /api/landing-pages/[id]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    // GLOBAL_ADMIN은 null → org 필터 없이 전체 접근 가능
    const orgId = resolveOrgIdOrNull(ctx);
    const { id } = await params;
    const body   = await req.json();

    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: "잘못된 요청 데이터", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const existing = await prisma.crmLandingPage.findFirst({
      where: { id, ...(orgId ? { organizationId: orgId } : {}) },
    });
    if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

    const {
      title, slug, htmlContent, isActive, isPublic, groupId, commentEnabled, autoFunnelId,
      groupCategory, groupSubName,
      editorMode, description, category, pageGroup, buttonTitle, completionPageUrl,
      headerScript, exposureTitle, exposureImage, infoCollection, formConfig,
      paymentEnabled, paymentType, productName, productPrice, cycleDay, expireDate,
      regEmailEnabled, regEmailSubject, regEmailContent,
      pageFormat, ctaType, imageFieldConfig, companyName,
      blocksConfig,
    } = parsed.data;
    const sanitizedContent = htmlContent !== undefined ? sanitizeHtml(htmlContent) : undefined;

    // Phase 3: pageFormat 유효성 검증
    const VALID_FORMATS = ['squeeze', 'vsl', 'webinar', 'funnel', 'tripwire', 'downsell', 'launch', 'hybrid'];
    const validFormat = pageFormat && VALID_FORMATS.includes(pageFormat) ? pageFormat : undefined;

    // ── 그룹 관리 연결: 대그룹(카테고리) + 소그룹(그룹명) → ContactGroup 생성/재사용 ──
    // groupSubName이 오면 groupId보다 우선. 같은 조직 내 (name, category) 동일 그룹이 있으면 재사용.
    let resolvedGroupId: string | null | undefined = groupId;
    if (groupSubName !== undefined) {
      const subName = (groupSubName ?? "").trim();
      if (!subName) {
        resolvedGroupId = null; // 소그룹 비우면 배정 해제
      } else {
        const cat = (groupCategory ?? "").trim() || null;
        const found = await prisma.contactGroup.findFirst({
          where: { organizationId: existing.organizationId, name: subName, category: cat },
          select: { id: true },
        });
        if (found) {
          resolvedGroupId = found.id;
        } else {
          const createdGroup = await prisma.contactGroup.create({
            data: {
              organizationId: existing.organizationId,
              name: subName,
              category: cat,
              ownerId: ctx.userId,
            },
            select: { id: true },
          });
          resolvedGroupId = createdGroup.id;
        }
      }
    }
    const page = await prisma.crmLandingPage.update({
      where: { id },
      data: {
        ...(title             !== undefined ? { title }                                : {}),
        ...(slug              !== undefined ? { slug }                                  : {}),
        ...(sanitizedContent  !== undefined ? { htmlContent: sanitizedContent }         : {}),
        ...(isActive          !== undefined ? { isActive }                              : {}),
        ...(isPublic          !== undefined ? { isPublic }                              : {}),
        ...(resolvedGroupId   !== undefined ? { groupId: resolvedGroupId }      : {}),
        ...(commentEnabled    !== undefined ? { commentEnabled }                        : {}),
        ...(autoFunnelId      !== undefined ? { autoFunnelId: autoFunnelId ?? null }    : {}),
        ...(editorMode        !== undefined ? { editorMode }                            : {}),
        ...(description       !== undefined ? { description: description ?? null }      : {}),
        ...(category          !== undefined ? { category: category ?? null }            : {}),
        ...(pageGroup         !== undefined ? { pageGroup: pageGroup ?? null }          : {}),
        ...(buttonTitle       !== undefined ? { buttonTitle: buttonTitle ?? null }       : {}),
        ...(completionPageUrl !== undefined ? { completionPageUrl: completionPageUrl ?? null } : {}),
        ...(headerScript      !== undefined ? { headerScript: sanitizeHeaderScript(headerScript) } : {}),
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
        // Phase 3: pageFormat + ctaType + imageFieldConfig
        ...(validFormat       !== undefined ? { pageFormat: validFormat }                : {}),
        ...(ctaType           !== undefined ? { ctaType }                               : {}),
        ...(imageFieldConfig  !== undefined ? { imageFieldConfig: imageFieldConfig ?? null } : {}),
        ...(blocksConfig !== undefined ? {
          blocksConfig: blocksConfig ? JSON.parse(blocksConfig) : null,
        } : {}),
      },
    });

    // Phase 3: SMS 시퀀스 자동 재생성 기능 제거 (2026-06-15)
    // SMS 자동화 기능이 삭제되었습니다. 수동 SMS 관리 시스템으로 전환합니다.

    return NextResponse.json({ ok: true, page });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ ok: false, message: '이미 사용 중인 슬러그입니다.' }, { status: 409 });
    }
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

    await prisma.crmLandingPage.delete({ where });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[DELETE /api/landing-pages/[id]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
