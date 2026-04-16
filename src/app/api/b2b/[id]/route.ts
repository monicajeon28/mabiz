import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId, canDelete } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

const VALID_STATUSES = ["NEW", "CONTACTED", "NEGOTIATING", "WON", "LOST"];

// PATCH /api/b2b/[id] — 상태 변경 + 정보 업데이트
export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = ctx.role === "GLOBAL_ADMIN" ? undefined : requireOrgId(ctx);
    const { id } = await params;

    const existing = await prisma.b2BProspect.findFirst({
      where: { id, ...(orgId ? { organizationId: orgId } : {}) },
    });
    if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

    const body = await req.json() as {
      status?: string; notes?: string; packageInterest?: string;
      groupSize?: number; budget?: string; preferredDate?: string;
      destination?: string; assignedUserId?: string; companyName?: string;
    };

    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ ok: false, message: "유효하지 않은 상태값입니다." }, { status: 400 });
    }

    const updated = await prisma.b2BProspect.update({
      where: { id },
      data: {
        ...(body.status          !== undefined ? { status:          body.status }          : {}),
        ...(body.notes           !== undefined ? { notes:           body.notes }           : {}),
        ...(body.packageInterest !== undefined ? { packageInterest: body.packageInterest } : {}),
        ...(body.groupSize       !== undefined ? { groupSize:       body.groupSize }       : {}),
        ...(body.budget          !== undefined ? { budget:          body.budget }          : {}),
        ...(body.preferredDate   !== undefined ? { preferredDate:   body.preferredDate }   : {}),
        ...(body.destination     !== undefined ? { destination:     body.destination }     : {}),
        ...(body.companyName     !== undefined ? { companyName:     body.companyName }     : {}),
        ...(body.assignedUserId  !== undefined ? { assignedUserId:  body.assignedUserId }  : {}),
      },
    });

    logger.log("[PATCH /api/b2b/[id]]", { id, status: body.status });

    return NextResponse.json({ ok: true, prospect: updated });
  } catch (err) {
    logger.error("[PATCH /api/b2b/[id]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// DELETE /api/b2b/[id]
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = ctx.role === "GLOBAL_ADMIN" ? undefined : requireOrgId(ctx);
    const { id } = await params;

    if (!canDelete(ctx)) {
      return NextResponse.json({ ok: false, message: "삭제 권한이 없습니다." }, { status: 403 });
    }

    const existing = await prisma.b2BProspect.findFirst({
      where: { id, ...(orgId ? { organizationId: orgId } : {}) },
    });
    if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

    await prisma.b2BProspect.delete({ where: { id } });

    logger.log("[DELETE /api/b2b/[id]]", { id });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[DELETE /api/b2b/[id]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
