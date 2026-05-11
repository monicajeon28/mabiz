import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId, canDelete } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { sanitizeHtml } from "@/lib/html-sanitizer";

const PatchSchema = z.object({
  title:          z.string().min(1).max(200).optional(),
  slug:           z.string().min(1).max(100).optional(),
  htmlContent:    z.string().optional(),
  isActive:       z.boolean().optional(),
  groupId:        z.string().nullable().optional(),
  commentEnabled: z.boolean().optional(),
  autoFunnelId:   z.string().nullable().optional(),
  // 결제 설정 (페이앱 B2B)
  paymentEnabled: z.boolean().optional(),
  paymentType:    z.enum(["onetime", "subscription"]).optional(),
  productName:    z.string().nullable().optional(),
  productPrice:   z.number().nullable().optional(),
  cycleDay:       z.number().min(1).max(90).nullable().optional(),
  expireDate:     z.string().nullable().optional(),
}).strict();

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id } = await params;

    const page = await prisma.crmLandingPage.findFirst({
      where: { id, organizationId: orgId },
      include: { _count: { select: { registrations: true } }, registrations: { orderBy: { createdAt: "desc" }, take: 50 } },
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
    const orgId = requireOrgId(ctx);
    const { id } = await params;
    const body   = await req.json();

    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: "잘못된 요청 데이터", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const existing = await prisma.crmLandingPage.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

    const {
      title, slug, htmlContent, isActive, groupId, commentEnabled, autoFunnelId,
      paymentEnabled, paymentType, productName, productPrice, cycleDay, expireDate,
    } = parsed.data;
    const sanitizedContent = htmlContent !== undefined ? sanitizeHtml(htmlContent) : undefined;
    const page = await prisma.crmLandingPage.update({
      where: { id },
      data: {
        ...(title            !== undefined ? { title }                              : {}),
        ...(slug             !== undefined ? { slug }                               : {}),
        ...(sanitizedContent !== undefined ? { htmlContent: sanitizedContent }      : {}),
        ...(isActive         !== undefined ? { isActive }                           : {}),
        ...(groupId          !== undefined ? { groupId: groupId ?? null }           : {}),
        ...(commentEnabled   !== undefined ? { commentEnabled }                     : {}),
        ...(autoFunnelId     !== undefined ? { autoFunnelId: autoFunnelId ?? null } : {}),
        ...(paymentEnabled   !== undefined ? { paymentEnabled }                     : {}),
        ...(paymentType      !== undefined ? { paymentType }                        : {}),
        ...(productName      !== undefined ? { productName: productName ?? null }   : {}),
        ...(productPrice     !== undefined ? { productPrice: productPrice ?? null } : {}),
        ...(cycleDay         !== undefined ? { cycleDay: cycleDay ?? null }          : {}),
        ...(expireDate       !== undefined ? { expireDate: expireDate ? new Date(expireDate) : null } : {}),
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
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id } = await params;

    if (!canDelete(ctx)) {
      return NextResponse.json({ ok: false, message: "삭제 권한이 없습니다." }, { status: 403 });
    }

    const existing = await prisma.crmLandingPage.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

    await prisma.crmLandingPage.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[DELETE /api/landing-pages/[id]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
