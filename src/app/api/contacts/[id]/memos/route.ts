import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrgId } from "@/lib/org";
import { logger } from "@/lib/logger";
import { getAuthContext } from "@/lib/rbac";

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

// DELETE /api/contacts/[id]/memos?memoId=xxx  (단건)
// DELETE /api/contacts/[id]/memos              (전체)
export async function DELETE(req: Request, { params }: Params) {
  try {
    const orgId = await getOrgId();
    const ctx = await getAuthContext();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const memoId = searchParams.get("memoId");

    // [S-001] memoId UUID 형식 검증
    if (memoId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memoId)) {
      return NextResponse.json({ ok: false, message: "유효하지 않은 메모 ID 형식입니다" }, { status: 400 });
    }

    const contact = await prisma.contact.findFirst({ where: { id, organizationId: orgId } });
    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    // AGENT는 자신의 메모만 삭제 가능 (call-logs와 동일한 정책)
    const deleteWhere: Record<string, unknown> = { contactId: id };
    if (ctx.role === 'AGENT') {
      deleteWhere.userId = ctx.userId;
    }

    if (memoId) {
      await prisma.contactMemo.deleteMany({ where: { ...deleteWhere, id: memoId } });
    } else {
      await prisma.contactMemo.deleteMany({ where: deleteWhere });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[DELETE memos]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST /api/contacts/[id]/memos
export async function POST(req: Request, { params }: Params) {
  try {
    const orgId = await getOrgId();
    const ctx = await getAuthContext();
    const { id } = await params;
    const { content } = await req.json();

    if (!content?.trim()) {
      return NextResponse.json({ ok: false, message: "내용을 입력하세요." }, { status: 400 });
    }

    const contact = await prisma.contact.findFirst({ where: { id, organizationId: orgId } });
    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    const memo = await prisma.contactMemo.create({
      data: { contactId: id, userId: ctx.userId, content },
    });
    return NextResponse.json({ ok: true, memo }, { status: 201 });
  } catch (err) {
    logger.error("[POST memos]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
