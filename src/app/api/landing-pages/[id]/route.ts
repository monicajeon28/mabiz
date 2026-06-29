import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAuthContext, canEditLandingPages, landingOwnershipScope } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { sanitizeHtml } from "@/lib/html-sanitizer";
import { sanitizeHeaderScript } from "@/lib/sanitize-header-script";
import { isFullHtmlDocument } from "@/lib/html-doc-detect";

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
  completionPageUrl: z.string()
    .refine(v => {
      if (!v) return true;
      try { const u = new URL(v); return ['http:', 'https:'].includes(u.protocol); }
      catch { return false; }
    }, { message: 'completionPageUrl은 http:// 또는 https:// URL이어야 합니다.' })
    .nullable().optional(),
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
  // SMS 자동화 범위 ("0-3" 등)
  smsDayRange:    z.string().nullable().optional(),
  // 프론트엔드 전용 (DB 저장 안 함, strict 우회용)
  commentConfig:  z.any().optional(),
}).strict();

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    // 랜딩페이지 접근: 지사장(OWNER)·관리자(GLOBAL_ADMIN)·대리점장(AGENT). 대리점장은 본인 생성분만(scope).
    if (!canEditLandingPages(ctx)) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN', message: '랜딩페이지 접근 권한이 없습니다' }, { status: 403 });
    }
    const { id } = await params;
    // 신청자 PII(registrations)는 지사장(OWNER) 전용 + 전화 마스킹.
    // [id]/registrations 전용 라우트(canManageSettings·phone 마스킹·필드 select)와 동일 정책으로 통일.
    // 대리점장(AGENT)은 본인 페이지여도 신청자 PII 인라인 제외(리드는 퍼널/CRM으로 흐름), 관리자(GLOBAL_ADMIN)도 제외(P0-5).
    const isOwner = ctx.role === 'OWNER';

    const page = await prisma.crmLandingPage.findFirst({
      where: { id, deletedAt: null, ...landingOwnershipScope(ctx) },
      include: {
        _count: { select: { registrations: true } },
        ...(isOwner ? { registrations: {
          orderBy: { createdAt: "desc" }, take: 50,
          select: {
            id: true, name: true, phone: true, email: true,
            utmSource: true, utmMedium: true, utmCampaign: true,
            funnelStarted: true, createdAt: true,
          },
        } } : {}),
        group: { select: { id: true, name: true, category: true } },
      },
    });
    if (!page) return NextResponse.json({ ok: false }, { status: 404 });

    // 전화 마스킹 (CLAUDE.md 조항 3, registrations 전용 라우트와 동일)
    const regs = (page as { registrations?: Array<{ phone: string }> }).registrations;
    const safePage = Array.isArray(regs)
      ? { ...page, registrations: regs.map((r) => ({ ...r, phone: r.phone ? r.phone.substring(0, 4) + "****" : r.phone })) }
      : page;

    const images = await prisma.crmLandingPageImage.findMany({
      where: { landingPageId: id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ ok: true, page: { ...safePage, images } });
  } catch (err) {
    logger.error("[GET /api/landing-pages/[id]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    // 랜딩페이지 수정: 지사장(OWNER)·관리자(GLOBAL_ADMIN)·대리점장(AGENT). 대리점장은 본인 생성분만(scope).
    if (!canEditLandingPages(ctx)) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN', message: '랜딩페이지 수정 권한이 없습니다' }, { status: 403 });
    }
    const { id } = await params;
    const body   = await req.json();

    // 복구 요청 처리 (deletedAt 초기화)
    if (body.action === 'restore') {
      const deleted = await prisma.crmLandingPage.findFirst({
        where: { id, ...landingOwnershipScope(ctx), deletedAt: { not: null } },
      });

      if (!deleted) {
        return NextResponse.json({ ok: false, message: '삭제된 페이지를 찾을 수 없습니다.' }, { status: 404 });
      }

      await prisma.crmLandingPage.update({
        where: { id },
        data: { deletedAt: null },
      });

      logger.log("[PATCH /api/landing-pages/[id]/restore]", { id, restoredBy: ctx.userId });
      return NextResponse.json({ ok: true, message: "페이지가 복구되었습니다." });
    }

    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: "잘못된 요청 데이터", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const existing = await prisma.crmLandingPage.findFirst({
      where: { id, deletedAt: null, ...landingOwnershipScope(ctx) },
    });
    if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

    const {
      title, slug, htmlContent, isActive, isPublic, groupId, commentEnabled, autoFunnelId,
      groupCategory, groupSubName,
      editorMode, description, category, pageGroup, buttonTitle, completionPageUrl,
      headerScript, exposureTitle, exposureImage, infoCollection, formConfig,
      paymentEnabled, paymentType, productName, productPrice, cycleDay, expireDate,
      regEmailEnabled, regEmailSubject, regEmailContent,
      pageFormat, ctaType, imageFieldConfig,
      blocksConfig, smsDayRange,
    } = parsed.data;
    // #19a — "전체 HTML 문서"(<!doctype/<html 시작)는 원본 그대로(verbatim) 저장.
    //   렌더측(src/app/p/[slug]/page.tsx)이 동일 판정으로 iframe 샌드박스(null origin)에서만 격리 렌더하므로
    //   저장 verbatim이 안전. sanitize하면 head/style/script/doctype가 strip돼 디자인이 죽고 <title>이 본문에 샘.
    //   빌더형·이미지형(항상 <div> 시작 → isFullHtmlDocument=false)은 기존 sanitize 유지 = 회귀 0.
    const storedContent = htmlContent !== undefined
      ? (isFullHtmlDocument(htmlContent) ? htmlContent : sanitizeHtml(htmlContent))
      : undefined;

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

    // groupId 업데이트: groupSubName이 정의되거나 groupId가 직접 전달된 경우만
    const shouldUpdateGroupId = groupSubName !== undefined || groupId !== undefined;

    const page = await prisma.crmLandingPage.update({
      where: { id },
      data: {
        ...(title             !== undefined ? { title }                                : {}),
        ...(slug              !== undefined ? { slug }                                  : {}),
        ...(storedContent     !== undefined ? { htmlContent: storedContent }            : {}),
        ...(isActive          !== undefined ? { isActive }                              : {}),
        ...(isPublic          !== undefined ? { isPublic }                              : {}),
        ...(shouldUpdateGroupId ? { groupId: resolvedGroupId ?? null }                  : {}),
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
        ...(smsDayRange !== undefined ? { smsDayRange: smsDayRange ?? null } : {}),
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

    // 삭제: 지사장(OWNER)·관리자(GLOBAL_ADMIN)·대리점장(AGENT). 대리점장은 본인 생성분만(scope).
    if (!canEditLandingPages(ctx)) {
      return NextResponse.json({ ok: false, message: "삭제 권한이 없습니다." }, { status: 403 });
    }

    // 소유권 스코프 — GLOBAL_ADMIN 전체 / OWNER 본인조직 / AGENT 본인생성분
    const where = { id, ...landingOwnershipScope(ctx) };

    const existing = await prisma.crmLandingPage.findFirst({ where });
    if (!existing) return NextResponse.json({ ok: false, message: "페이지를 찾을 수 없습니다." }, { status: 404 });

    // 소프트 삭제 (deletedAt 설정) - 복구 가능
    await prisma.crmLandingPage.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    logger.log("[DELETE /api/landing-pages/[id]]", { id, deletedBy: ctx.userId });
    return NextResponse.json({ ok: true, message: "페이지가 휴지통으로 이동되었습니다." });
  } catch (err) {
    logger.error("[DELETE /api/landing-pages/[id]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
