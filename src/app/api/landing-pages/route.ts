export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, resolveOrgIdOrNull, BONSA_ORG_ID } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { sanitizeHtml } from "@/lib/html-sanitizer";
import { sanitizeHeaderScript } from "@/lib/sanitize-header-script";
import { generateUniqueShortlink } from "@/lib/landing-page-utils";
import { IMAGE_FIELDS_BY_FORMAT, CTA_PSYCHOLOGY_MAP } from "@/lib/landing-page-constants";

// GET /api/landing-pages
export async function GET() {
  try {
    const ctx   = await getAuthContext();
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN', message: '이 작업을 수행할 권한이 없습니다' }, { status: 403 });
    }
    const orgId = resolveOrgIdOrNull(ctx);
    const myOrgId = orgId ?? BONSA_ORG_ID;

    // 내 페이지
    const pages = await prisma.crmLandingPage.findMany({
      where: { ...(orgId ? { organizationId: orgId } : {}) },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        shortlink: true,
        isActive: true,
        viewCount: true,
        createdAt: true,
        groupId: true,
        _count: { select: { registrations: true } },
      },
    });

    // 공유받은 페이지 (sharedToOrgId = myOrgId OR isGlobal = true)
    const receivedShares = await prisma.crmLandingShare.findMany({
      where: {
        OR: [
          { sharedToOrgId: myOrgId },
          { isGlobal: true },
        ],
        // 내 페이지는 제외 (자기 자신이 소유한 페이지)
        landingPage: {
          organizationId: { not: myOrgId },
        },
      },
      include: {
        landingPage: {
          select: {
            id: true,
            title: true,
            slug: true,
            shortlink: true,
            isActive: true,
            viewCount: true,
            createdAt: true,
            groupId: true,
            _count: { select: { registrations: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 공유한 조직 이름 조회
    const byOrgIds = [...new Set(receivedShares.map((s) => s.sharedByOrgId))];
    const byOrgs = byOrgIds.length > 0
      ? await prisma.organization.findMany({
          where: { id: { in: byOrgIds } },
          select: { id: true, name: true },
        })
      : [];
    const byOrgMap = Object.fromEntries(byOrgs.map((o) => [o.id, o.name]));

    const sharedPages = receivedShares.map((s) => ({
      ...s.landingPage,
      isShared: true,
      sharedByName: s.sharedByName,
      sharedByOrgId: s.sharedByOrgId,
      sharedByOrgName: byOrgMap[s.sharedByOrgId] ?? s.sharedByOrgId,
      shareId: s.id,
    }));

    return NextResponse.json({ ok: true, pages, sharedPages });
  } catch (err) {
    logger.error("[GET /api/landing-pages]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST /api/landing-pages
export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN', message: '랜딩페이지 생성 권한이 없습니다' }, { status: 403 });
    }
    // GLOBAL_ADMIN은 organizationId가 null → DB에서 실제 첫 번째 조직 사용
    let orgId: string;
    if (ctx.role === 'GLOBAL_ADMIN' && !ctx.organizationId) {
      const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
      if (!firstOrg) return NextResponse.json({ ok: false, message: '조직이 없습니다' }, { status: 500 });
      orgId = firstOrg.id;
    } else {
      orgId = resolveOrgId(ctx);
    }

    // AGENT는 자기 조직만 생성 가능
    const body = await req.json();
    if (ctx.role === 'AGENT' && body.organizationId && body.organizationId !== ctx.organizationId) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN', message: '자기 조직만 랜딩페이지 생성 가능합니다' }, { status: 403 });
    }

    const {
      title, slug, htmlContent, groupId, editorMode, commentEnabled,
      pageFormat, ctaType, smsDayRange, companyName,
      ...rest
    } = body;

    if (!title?.trim() || !slug?.trim()) {
      return NextResponse.json({ ok: false, message: "제목과 슬러그는 필수입니다." }, { status: 400 });
    }

    const mode = editorMode === 'image' ? 'image' : 'html';

    // Phase 3: pageFormat 유효성 검증
    const VALID_FORMATS = ['squeeze', 'vsl', 'webinar', 'funnel', 'tripwire', 'downsell', 'launch', 'hybrid'];
    const validFormat = VALID_FORMATS.includes(pageFormat) ? pageFormat : 'hybrid';

    // Phase 3: ctaType 유효성 검증
    const VALID_CTA_TYPES = ['default', 'urgent', 'explore', 'reserve'];
    const validCtaType = VALID_CTA_TYPES.includes(ctaType) ? ctaType : 'default';

    // 무작위 8자 shortlink 생성 (충돌 시 자동 재시도)
    const shortlink = await generateUniqueShortlink();

    // 트랜잭션: CrmLandingPage 생성 + ShortLink 저장
    const page = await prisma.$transaction(async (tx) => {
      const newPage = await tx.crmLandingPage.create({
        data: {
          organizationId: orgId, title, slug, shortlink,
          htmlContent: sanitizeHtml(htmlContent ?? ""),
          groupId: groupId ?? null,
          editorMode: mode,
          commentEnabled: commentEnabled === true,
          // Phase 3: pageFormat + ctaType + imageFieldConfig + smsDayRange
          pageFormat: validFormat,
          ctaType: validCtaType,
          imageFieldConfig: IMAGE_FIELDS_BY_FORMAT[validFormat] ?? {},
          smsDayRange: smsDayRange ?? null,
          // 에디터 고도화 필드
          ...(rest.description      ? { description: rest.description }            : {}),
          ...(rest.buttonTitle      ? { buttonTitle: rest.buttonTitle }             : {}),
          ...(rest.completionPageUrl ? { completionPageUrl: (() => {
            try { const u = new URL(rest.completionPageUrl); return ['http:', 'https:'].includes(u.protocol) ? rest.completionPageUrl : null; }
            catch { return null; }
          })() } : {}),
          ...(rest.headerScript     ? { headerScript: sanitizeHeaderScript(rest.headerScript) } : {}),
          ...(rest.exposureTitle    ? { exposureTitle: rest.exposureTitle }         : {}),
          ...(rest.exposureImage    ? { exposureImage: rest.exposureImage }         : {}),
          ...(rest.formConfig       ? { formConfig: rest.formConfig, infoCollection: true } : {}),
          // 결제 설정 (있으면)
          ...(rest.paymentEnabled ? {
            paymentEnabled: true,
            paymentType: rest.paymentType ?? null,
            productName: rest.productName ?? null,
            productPrice: rest.productPrice ? parseInt(rest.productPrice) : null,
            ...(rest.paymentType === 'subscription' ? {
              cycleDay: rest.cycleDay ? parseInt(rest.cycleDay) : null,
              expireDate: rest.expireDate ? new Date(rest.expireDate) : null,
            } : {}),
          } : {}),
        },
      });

      // ShortLink도 함께 저장
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const targetUrl = `${appUrl}/landing/${newPage.id}`;
      await tx.shortLink.create({
        data: {
          code: newPage.shortlink ?? newPage.id,
          targetUrl,
          title: newPage.title,
          organizationId: orgId,
          createdBy: ctx.userId,
          category: "landing",
          isActive: true,
        },
      });

      return newPage;
    });

    // Phase 3: SMS 시퀀스 자동 생성 기능 제거 (2026-06-15)
    // SMS 자동화 기능이 삭제되었습니다. 수동 SMS 관리 시스템으로 전환합니다.

    logger.log("[POST /api/landing-pages] 생성", { id: page.id, shortlink: page.shortlink });
    return NextResponse.json({ ok: true, page }, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json({ ok: false, message: "이미 사용 중인 슬러그입니다." }, { status: 409 });
    }
    logger.error("[POST /api/landing-pages]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
