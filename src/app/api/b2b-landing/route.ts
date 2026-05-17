export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, resolveOrgIdOrNull, BONSA_ORG_ID } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/b2b-landing
export async function GET() {
  try {
    const ctx   = await getAuthContext();
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN', message: '이 작업을 수행할 권한이 없습니다' }, { status: 403 });
    }
    const orgId = resolveOrgIdOrNull(ctx);
    const myOrgId = orgId ?? BONSA_ORG_ID;

    // 내 페이지만 조회 (공유 기능 없음)
    const pages = await prisma.b2BLandingPage.findMany({
      where: { organizationId: myOrgId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { registrations: true } } },
    });

    return NextResponse.json({ ok: true, pages });
  } catch (err) {
    logger.error("[GET /api/b2b-landing]", { err });
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

// POST /api/b2b-landing
export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN', message: 'B2B 랜딩페이지 생성 권한이 없습니다' }, { status: 403 });
    }

    let orgId: string;
    if (ctx.role === 'GLOBAL_ADMIN' && !ctx.organizationId) {
      const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
      if (!firstOrg) return NextResponse.json({ ok: false, error: 'NO_ORG', message: '조직이 없습니다' }, { status: 500 });
      orgId = firstOrg.id;
    } else {
      orgId = resolveOrgId(ctx);
    }

    // AGENT는 자기 조직만 생성 가능
    const body = await req.json();
    if (ctx.role === 'AGENT' && body.organizationId && body.organizationId !== ctx.organizationId) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN', message: '자기 조직만 B2B 랜딩페이지 생성 가능합니다' }, { status: 403 });
    }

    const { title, htmlContent, partnerId, groupId, commentEnabled, ...rest } = body;

    if (!title?.trim()) {
      return NextResponse.json({ ok: false, error: 'INVALID_INPUT', message: "제목은 필수입니다." }, { status: 400 });
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
    logger.error("[POST /api/b2b-landing]", { err });
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR', message: 'B2B 랜딩페이지 생성 중 오류 발생' }, { status: 500 });
  }
}
