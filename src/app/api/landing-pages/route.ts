export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, resolveOrgIdOrNull, BONSA_ORG_ID, canManageSettings } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { sanitizeHtml } from "@/lib/html-sanitizer";
import { sanitizeHeaderScript } from "@/lib/sanitize-header-script";
import { generateUniqueShortlink } from "@/lib/landing-page-utils";
import { IMAGE_FIELDS_BY_FORMAT } from "@/lib/landing-page-constants";

// GET /api/landing-pages
export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (!ctx) {
      logger.warn('[GET /api/landing-pages] 인증 실패 - 세션 없음');
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED', message: '로그인이 필요합니다' }, { status: 401 });
    }

    // 랜딩페이지는 대리점장(OWNER)·시스템관리자(GLOBAL_ADMIN) 전용 기능.
    // 판매원(AGENT)·프리세일즈(FREE_SALES) 조회 차단 (P0-2)
    if (!canManageSettings(ctx)) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN', message: '이 작업을 수행할 권한이 없습니다' }, { status: 403 });
    }

    const orgId = resolveOrgIdOrNull(ctx);
    const myOrgId = orgId ?? BONSA_ORG_ID;

    // orgId 검증 (null이 아닐 때만)
    if (orgId && !orgId.trim()) {
      logger.warn('[GET /api/landing-pages] 조직 ID가 빈 문자열', { orgId });
      return NextResponse.json({ ok: false, error: 'INVALID_ORG', message: '조직 정보가 유효하지 않습니다' }, { status: 400 });
    }

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
    // P0 수정: 1) landingPage IS NOT NULL (고아 레코드 제외)
    //         2) select 사용 (N+1 제거, include 대신 더 효율적)
    const receivedShares = await prisma.crmLandingShare.findMany({
      where: {
        OR: [
          { sharedToOrgId: myOrgId },
          { isGlobal: true },
        ],
        // 내 페이지는 제외 (자기 자신이 소유한 페이지)
        landingPage: {
          organizationId: { not: myOrgId },
          id: { not: "" }, // 고아 레코드 필터링 (FK Cascade 중 null 방지)
        },
      },
      select: {
        id: true,
        landingPageId: true,
        sharedByOrgId: true,
        sharedByName: true,
        createdAt: true,
        // landingPage 정보 인라인 (JOIN 일회)
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
    // P1 개선: 에러 타입 구분해서 클라이언트에 알림
    const errCode = (err as any)?.code;
    const message =
      errCode === 'P2025' ? '페이지를 찾을 수 없습니다' :
      errCode === 'P2002' ? '중복된 페이지가 있습니다' :
      '페이지 목록 조회에 실패했습니다';
    return NextResponse.json(
      { ok: false, error: errCode || 'UNKNOWN_ERROR', message },
      { status: 500 }
    );
  }
}

// POST /api/landing-pages
export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    // 랜딩페이지 생성은 대리점장(OWNER)·시스템관리자(GLOBAL_ADMIN)만 가능.
    // 판매원(AGENT)·프리세일즈(FREE_SALES)는 직접 POST 호출/직접 URL 접근 차단 (P0-2)
    if (!canManageSettings(ctx)) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN', message: '랜딩페이지 생성 권한이 없습니다' }, { status: 403 });
    }
    // GLOBAL_ADMIN은 organizationId가 null → 본사 조직 ID 사용 (non-deterministic findFirst 제거)
    const orgId = ctx.organizationId ?? BONSA_ORG_ID;

    const body = await req.json();

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
            productPrice: rest.productPrice ? parseInt(rest.productPrice, 10) : null,
            ...(rest.paymentType === 'subscription' ? {
              cycleDay: rest.cycleDay ? parseInt(rest.cycleDay, 10) : null,
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
    // P1 개선: 에러 타입 구분
    const errCode = (err as any)?.code;
    const message = '페이지 생성에 실패했습니다';
    return NextResponse.json(
      { ok: false, error: errCode || 'UNKNOWN_ERROR', message },
      { status: 500 }
    );
  }
}
