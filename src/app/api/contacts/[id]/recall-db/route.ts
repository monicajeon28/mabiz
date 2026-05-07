import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireNotFreeSales } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/contacts/[id]/recall-db
 * DB 회수 — 전달한 고객을 상대방이 못 보게 함
 *
 * body: { logId: string }
 *
 * ORG_COPY 타입: newContactId 고객 소프트 삭제 (상대 조직에서 제거)
 * AGENT_ASSIGN 타입: 로그 삭제 + assignedUserId null로 원복 (미배정 상태)
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    requireNotFreeSales(ctx);

    const { id: contactId } = await params;
    const { logId } = (await req.json()) as { logId?: string };

    if (!logId) {
      return NextResponse.json({ ok: false, message: "logId가 필요합니다." }, { status: 400 });
    }

    // 로그 조회 + 소유권 검증
    const log = await prisma.contactTransferLog.findFirst({
      where: {
        id:        logId,
        contactId: contactId,
        ...(ctx.role !== "GLOBAL_ADMIN" ? { transferredBy: ctx.userId } : {}),
      },
      select: { id: true, transferType: true, newContactId: true, toUserId: true, contactId: true },
    });

    if (!log) {
      return NextResponse.json({ ok: false, message: "전달 이력을 찾을 수 없거나 권한이 없습니다." }, { status: 404 });
    }

    if (log.transferType === "ORG_COPY" && log.newContactId) {
      // 상대 조직의 복사본 소프트 삭제 (이미 삭제되었어도 안전)
      await prisma.$transaction([
        prisma.contact.updateMany({
          where: { id: log.newContactId },
          data:  { deletedAt: new Date() },
        }),
        prisma.contactTransferLog.delete({ where: { id: log.id } }),
      ]);
      logger.log("[recall-db] ORG_COPY 회수 — 복사본 소프트 삭제", { contactId, newContactId: log.newContactId });
    } else {
      // AGENT_ASSIGN: 로그 삭제 + assignedUserId null (미배정 상태로 원복)
      // 원래 담당자를 로그에 저장하지 않으므로 null(미배정)이 가장 안전
      await prisma.$transaction([
        prisma.contact.update({
          where: { id: contactId },
          data:  { assignedUserId: null },
        }),
        prisma.contactTransferLog.delete({ where: { id: log.id } }),
      ]);
      logger.log("[recall-db] AGENT_ASSIGN 회수 — 미배정 상태로 원복", { contactId, toUserId: log.toUserId });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[POST /api/contacts/[id]/recall-db]", { err });
    return NextResponse.json({ ok: false, message: "회수 중 오류가 발생했습니다." }, { status: 500 });
  }
}
