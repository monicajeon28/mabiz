export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgIdOrNull, BONSA_ORG_ID, canManageSettings, canEditLandingPages } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { sanitizeHtml } from "@/lib/html-sanitizer";
import { sanitizeHeaderScript } from "@/lib/sanitize-header-script";
import { generateUniqueShortlink, buildLandingTargetUrl } from "@/lib/landing-page-utils";
import { IMAGE_FIELDS_BY_FORMAT } from "@/lib/landing-page-constants";

// GET /api/landing-pages
export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (!ctx) {
      logger.warn('[GET /api/landing-pages] 인증 실패 - 세션 없음');
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED', message: '로그인이 필요합니다' }, { status: 401 });
    }

    // 지사장(OWNER)·관리자(GLOBAL_ADMIN)는 조직 전체. 대리점장(AGENT)은 본인 소유분 + 공유받은 봇만
    // (지사가 공유한 봇을 복제해 개인 판매링크 확보 — 새 모델). 마케터(FREE_SALES)는 CRM 비로그인 → 차단.
    const isAgentPartner = ctx.role === 'AGENT';
    if (!canManageSettings(ctx) && !isAgentPartner) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN', message: '이 작업을 수행할 권한이 없습니다' }, { status: 403 });
    }

    const orgId = resolveOrgIdOrNull(ctx);
    const myOrgId = orgId ?? BONSA_ORG_ID;

    // orgId 검증 (null이 아닐 때만)
    if (orgId && !orgId.trim()) {
      logger.warn('[GET /api/landing-pages] 조직 ID가 빈 문자열', { orgId });
      return NextResponse.json({ ok: false, error: 'INVALID_ORG', message: '조직 정보가 유효하지 않습니다' }, { status: 400 });
    }

    // 내 페이지 — 대리점장(AGENT)은 본인이 만든(복제 포함) 페이지만(조직 전체 노출 차단)
    const pages = await prisma.crmLandingPage.findMany({
      where: {
        deletedAt: null, // 소프트삭제된 페이지 제외(삭제 후 부활 버그 수정)
        ...(orgId ? { organizationId: orgId } : {}),
        ...(isAgentPartner ? { createdByUserId: ctx.userId } : {}),
      },
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
          // 지정공유(나를 콕 집음): 조직 무관하게 표시(내가 만든 페이지만 제외) — 같은 지사 대리점장도 보이게
          { sharedToUserId: ctx.userId, landingPage: { id: { not: "" }, deletedAt: null, createdByUserId: { not: ctx.userId } } },
          // 조직 공유: 내 조직 대상 + 내 조직 페이지 제외
          { sharedToOrgId: myOrgId, sharedToUserId: "", landingPage: { id: { not: "" }, deletedAt: null, organizationId: { not: myOrgId } } },
          // 전체 공유: 내 조직 페이지 제외
          { isGlobal: true, sharedToUserId: "", landingPage: { id: { not: "" }, deletedAt: null, organizationId: { not: myOrgId } } },
        ],
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

    // 같은 페이지에 조직공유+지정공유가 둘 다 있으면 한 사람에게 2행 매치 → landingPageId로 중복 제거(카드 1장).
    const seenPageIds = new Set<string>();
    const sharedPages = receivedShares
      .filter((s) => {
        const pid = s.landingPage?.id;
        if (!pid || seenPageIds.has(pid)) return false;
        seenPageIds.add(pid);
        return true;
      })
      .map((s) => ({
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
    // 랜딩페이지 생성: 지사장(OWNER)·시스템관리자(GLOBAL_ADMIN)·대리점장(AGENT) 허용.
    // 대리점장도 마케팅용 랜딩을 직접 만들 수 있되, 본인 생성분만 보이고 편집됨(createdByUserId 격리).
    // 마케터(FREE_SALES)는 CRM 비로그인 → 차단.
    if (!canEditLandingPages(ctx)) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN', message: '랜딩페이지 생성 권한이 없습니다' }, { status: 403 });
    }
    // GLOBAL_ADMIN은 organizationId가 null → 본사 조직 ID 사용 (non-deterministic findFirst 제거)
    const orgId = ctx.organizationId ?? BONSA_ORG_ID;

    const body = await req.json();

    const {
      title, slug, htmlContent, groupId, editorMode, commentEnabled,
      pageFormat, ctaType, smsDayRange, companyName, isActive,
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
          // 만든 사람 기록 — 대리점장(AGENT)이 본인 페이지를 목록/편집에서 식별하는 기준
          createdByUserId: ctx.userId,
          htmlContent: sanitizeHtml(htmlContent ?? ""),
          groupId: groupId ?? null,
          editorMode: mode,
          commentEnabled: commentEnabled === true,
          // 신규페이지 임시(draft) 생성 시 isActive:false로 비공개 — 정식 저장 시 true로 갱신.
          // (명시적으로 false를 보낼 때만 비활성. 미지정 시 스키마 기본값 true 유지 → 기존 동작 무파괴)
          ...(isActive === false ? { isActive: false } : {}),
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

      // ShortLink도 함께 저장 — 🔴 /p/{shortlink} 정식 경로로 수정(과거 /landing/{id} 죽은 링크)
      // code는 항상 유니크해야 하므로 shortlink 없으면 cuid(id)로 폴백,
      // targetUrl은 /p 렌더러가 조회 가능한 shortlink/slug 로만(id는 /p에서 조회 불가).
      const targetUrl = buildLandingTargetUrl(newPage.shortlink ?? newPage.slug);
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
