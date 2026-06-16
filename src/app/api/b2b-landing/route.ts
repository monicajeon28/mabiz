export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, resolveOrgIdOrNull, BONSA_ORG_ID } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { ForbiddenError, ValidationError, B2BError } from "@/lib/b2b/errors";
import { handleB2BError } from "@/lib/b2b/response-handler";

const nanoid = customAlphabet('0-9a-z', 8);

// GET /api/b2b-landing
export async function GET() {
  try {
    const ctx   = await getAuthContext();
    if (ctx.role === 'FREE_SALES') {
      throw new ForbiddenError();
    }
    const orgId = resolveOrgIdOrNull(ctx);
    const myOrgId = orgId ?? BONSA_ORG_ID;

    // 내 페이지만 조회 (공유 기능 없음)
    const pages = await prisma.b2BLandingPage.findMany({
      where: { organizationId: myOrgId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { registrations: true } },
      },
    });

    // ShortLink에서 createdBy(어필리에이트) + PayApp 결제 수 조회
    const pageIds = pages.map((p) => p.id);
    const [shortLinks, paymentCounts] = await Promise.all([
      pageIds.length > 0
        ? prisma.shortLink.findMany({
            where: { category: 'b2b-landing', targetUrl: { in: pageIds.map((id) => `${process.env.NEXT_PUBLIC_APP_URL}/b2b-landing/${id}`) } },
            select: { targetUrl: true, createdBy: true, code: true },
          })
        : Promise.resolve([]),
      pageIds.length > 0
        ? prisma.payAppPayment.groupBy({
            by: ['landingPageId'],
            where: { landingPageId: { in: pageIds }, status: 'paid' },
            _count: { id: true },
            _sum:   { amount: true },
          })
        : Promise.resolve([]),
    ]);

    // pageId → ShortLink 맵
    const shortLinkMap = new Map(
      shortLinks.map((sl) => {
        const pageId = sl.targetUrl.split('/').pop() ?? '';
        return [pageId, { createdBy: sl.createdBy, shortlinkCode: sl.code }];
      })
    );
    const paymentMap = new Map(
      paymentCounts.map((p) => [p.landingPageId, { count: p._count.id, revenue: p._sum.amount ?? 0 }])
    );

    const enrichedPages = pages.map((p) => ({
      ...p,
      shortlinkInfo: shortLinkMap.get(p.id) ?? null,
      payappStats: paymentMap.get(p.id) ?? { count: 0, revenue: 0 },
    }));

    return NextResponse.json({ ok: true, pages: enrichedPages });
  } catch (err) {
    return handleB2BError(err, "GET /api/b2b-landing");
  }
}

// POST /api/b2b-landing
export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    if (ctx.role === 'FREE_SALES') {
      throw new ForbiddenError();
    }

    let orgId: string;
    if (ctx.role === 'GLOBAL_ADMIN' && !ctx.organizationId) {
      const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
      if (!firstOrg) throw new Error('조직이 없습니다');
      orgId = firstOrg.id;
    } else {
      orgId = resolveOrgId(ctx);
    }

    // AGENT는 자기 조직만 생성 가능
    const body = await req.json();
    if (ctx.role === 'AGENT' && body.organizationId && body.organizationId !== ctx.organizationId) {
      throw new ForbiddenError();
    }

    const { title, htmlContent, partnerId, groupId, commentEnabled, ...rest } = body;

    if (!title?.trim()) {
      throw new ValidationError('제목은 필수입니다.');
    }

    // 무작위 8자 shortlink 생성 (충돌 시 자동 재시도)
    let shortlinkCode = nanoid();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await prisma.shortLink.findFirst({
        where: { code: shortlinkCode },
        select: { id: true },
      });
      if (!existing) break;
      shortlinkCode = nanoid();
      attempts++;
    }
    if (attempts >= 10) {
      throw new ValidationError('숏링크 코드 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }

    // partnerId는 선택사항 (null 가능)
    const page = await prisma.b2BLandingPage.create({
      data: {
        organizationId: orgId,
        title,
        htmlContent: htmlContent ?? "",
        partnerId: partnerId ?? null,
        groupId: groupId ?? null,
        commentEnabled: commentEnabled === true,
        ...(rest.description       ? { description: rest.description }              : {}),
        ...(rest.headerScript      ? { headerScript: rest.headerScript }            : {}),
        ...(rest.exposureTitle     ? { exposureTitle: rest.exposureTitle }          : {}),
        ...(rest.exposureImage     ? { exposureImage: rest.exposureImage }          : {}),
        ...(rest.formConfig        ? { formConfig: rest.formConfig }                : {}),
        ...(rest.editorMode        ? { editorMode: rest.editorMode }                : {}),
        ...(rest.buttonTitle       ? { buttonTitle: rest.buttonTitle }              : {}),
        ...(rest.completionPageUrl ? { completionPageUrl: rest.completionPageUrl }  : {}),
        ...(rest.paymentEnabled !== undefined ? { paymentEnabled: rest.paymentEnabled } : {}),
        ...(rest.paymentType       ? { paymentType: rest.paymentType }              : {}),
        ...(rest.productName       ? { productName: rest.productName }              : {}),
        ...(rest.productPrice !== undefined ? { productPrice: rest.productPrice }   : {}),
        ...(rest.cycleDay !== undefined     ? { cycleDay: rest.cycleDay }           : {}),
        ...(rest.expireDate        ? { expireDate: new Date(rest.expireDate) }      : {}),
      },
    });

    // ShortLink 레코드 자동 생성
    const targetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/b2b-landing/${page.id}`;
    await prisma.shortLink.create({
      data: {
        code: shortlinkCode,
        targetUrl,
        title: page.title,
        organizationId: orgId,
        createdBy: ctx.userId,
        category: 'b2b-landing',
        isActive: true,
      },
    });

    logger.log("[POST /api/b2b-landing] 생성", { id: page.id, orgId, shortlinkCode });
    return NextResponse.json({ ok: true, page, shortlinkCode }, { status: 201 });
  } catch (err: unknown) {
    return handleB2BError(err, "POST /api/b2b-landing");
  }
}
