export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, resolveOrgIdOrNull, BONSA_ORG_ID } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { ForbiddenError, ValidationError, B2BError } from "@/lib/b2b/errors";
import { handleB2BError } from "@/lib/b2b/response-handler";

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

    return NextResponse.json({ ok: true, pages });
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

    // partnerId는 선택사항 (null 가능)
    const page = await prisma.b2BLandingPage.create({
      data: {
        organizationId: orgId,
        title,
        htmlContent: htmlContent ?? "",
        partnerId: partnerId ?? null,
        groupId: groupId ?? null,
        commentEnabled: commentEnabled === true,
        ...(rest.description      ? { description: rest.description }            : {}),
        ...(rest.headerScript     ? { headerScript: rest.headerScript }           : {}),
        ...(rest.exposureTitle    ? { exposureTitle: rest.exposureTitle }         : {}),
        ...(rest.exposureImage    ? { exposureImage: rest.exposureImage }         : {}),
        ...(rest.formConfig       ? { formConfig: rest.formConfig }               : {}),
      },
    });

    logger.log("[POST /api/b2b-landing] 생성", { id: page.id, orgId });
    return NextResponse.json({ ok: true, page }, { status: 201 });
  } catch (err: unknown) {
    return handleB2BError(err, "POST /api/b2b-landing");
  }
}
