import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { getOrgId } from "@/lib/org";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

// GET /api/contacts/[id]/call-logs
export async function GET(_req: Request, { params }: Params) {
  try {
    const orgId = await getOrgId();
    const { id } = await params;

    const contact = await prisma.contact.findFirst({ where: { id, organizationId: orgId } });
    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    const logs = await prisma.callLog.findMany({
      where: { contactId: id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ ok: true, logs });
  } catch (err) {
    logger.error("[GET call-logs]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST /api/contacts/[id]/call-logs
export async function POST(req: Request, { params }: Params) {
  try {
    const orgId = await getOrgId();
    const { userId } = await auth();
    const { id } = await params;
    const body = await req.json();

    const contact = await prisma.contact.findFirst({ where: { id, organizationId: orgId } });
    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    const { content, result, duration, convictionScore, nextAction, scheduledAt } = body;

    const log = await prisma.callLog.create({
      data: {
        contactId: id,
        userId: userId!,
        content,
        result,
        duration: duration ? parseInt(duration) : null,
        convictionScore: convictionScore ? parseInt(convictionScore) : null,
        nextAction,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
    });

    // 마지막 연락일 업데이트
    await prisma.contact.update({
      where: { id },
      data: { lastContactedAt: new Date() },
    });

    return NextResponse.json({ ok: true, log }, { status: 201 });
  } catch (err) {
    logger.error("[POST call-logs]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
