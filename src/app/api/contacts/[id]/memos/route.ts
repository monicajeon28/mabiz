import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { getOrgId } from "@/lib/org";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

// GET /api/contacts/[id]/memos
export async function GET(_req: Request, { params }: Params) {
  try {
    const orgId = await getOrgId();
    const { id } = await params;

    const contact = await prisma.contact.findFirst({ where: { id, organizationId: orgId } });
    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    const memos = await prisma.contactMemo.findMany({
      where: { contactId: id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ ok: true, memos });
  } catch (err) {
    logger.error("[GET memos]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST /api/contacts/[id]/memos
export async function POST(req: Request, { params }: Params) {
  try {
    const orgId = await getOrgId();
    const { userId } = await auth();
    const { id } = await params;
    const { content } = await req.json();

    if (!content?.trim()) {
      return NextResponse.json({ ok: false, message: "내용을 입력하세요." }, { status: 400 });
    }

    const contact = await prisma.contact.findFirst({ where: { id, organizationId: orgId } });
    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    const memo = await prisma.contactMemo.create({
      data: { contactId: id, userId: userId!, content },
    });
    return NextResponse.json({ ok: true, memo }, { status: 201 });
  } catch (err) {
    logger.error("[POST memos]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
