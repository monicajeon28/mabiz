import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { triggerGroupFunnel } from "@/lib/funnel-trigger";
import { logger } from "@/lib/logger";
import { addLeadScore } from "@/lib/lead-score";

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

    // ★ contactId 소유권 검증 — 타 조직 고객을 이 그룹에 끼워넣기 방지
    const validContacts = await prisma.contact.findMany({
      where: { id: { in: contactIds }, organizationId: orgId },
      select: { id: true },
    });
    const validIds = new Set(validContacts.map((c) => c.id));
    const filteredIds = contactIds.filter((id: string) => validIds.has(id));

    if (filteredIds.length === 0) {
      return NextResponse.json({ ok: false, message: "유효한 고객이 없습니다." }, { status: 400 });
    }

    const results = await Promise.allSettled(
      filteredIds.map(async (contactId: string) => {
        // 그룹에 추가 (이미 있으면 upsert)
        await prisma.contactGroupMember.upsert({
          where: { groupId_contactId: { groupId, contactId } },
          create: { groupId, contactId },
          update: {},
        });

        // 리드 스코어 +10 (그룹 배정 = 파트너 관심)
        addLeadScore(contactId, "GROUP_ASSIGNED").catch(() => {});

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
