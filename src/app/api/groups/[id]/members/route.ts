import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { triggerGroupFunnel } from "@/lib/funnel-trigger";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

// POST /api/groups/[id]/members — 고객을 그룹에 추가 → 퍼널 자동 시작
export async function POST(req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id: groupId } = await params;
    const { contactIds } = await req.json(); // string[]

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ ok: false, message: "contactIds 필수" }, { status: 400 });
    }

    // 그룹이 이 조직 소유인지 확인
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId: orgId },
    });
    if (!group) return NextResponse.json({ ok: false }, { status: 404 });

    const results = await Promise.allSettled(
      contactIds.map(async (contactId: string) => {
        // 그룹에 추가 (이미 있으면 upsert)
        await prisma.contactGroupMember.upsert({
          where: { groupId_contactId: { groupId, contactId } },
          create: { groupId, contactId },
          update: {},
        });

        // ★ 핵심: 그룹에 퍼널이 연결되어 있으면 자동 시작
        // 그룹 배정 후 퍼널 자동 시작 (sendFirst: true → 즉시 첫 SMS)
        // fire-and-forget: 퍼널 실패해도 그룹 배정은 성공으로 응답
        if (group.funnelId) {
          triggerGroupFunnel({
            contactId,
            groupId,
            organizationId: orgId,
            sendFirst: true,
          }).catch((err) => {
            logger.error('[GroupMember] 퍼널 트리거 실패', { err });
          });
        }

        return contactId;
      })
    );

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failCount    = results.filter((r) => r.status === "rejected").length;

    logger.log("[POST /api/groups/members] 그룹 배정 완료", {
      groupId, successCount, failCount,
      funnelTriggered: !!group.funnelId,
    });

    return NextResponse.json({ ok: true, successCount, failCount });
  } catch (err) {
    logger.error("[POST /api/groups/[id]/members]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// DELETE /api/groups/[id]/members — 그룹에서 제거
export async function DELETE(req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id: groupId } = await params;
    const { contactIds } = await req.json();

    // 그룹 소유권 확인
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId: orgId },
    });
    if (!group) return NextResponse.json({ ok: false }, { status: 404 });

    await prisma.contactGroupMember.deleteMany({
      where: { groupId, contactId: { in: contactIds } },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[DELETE /api/groups/[id]/members]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
