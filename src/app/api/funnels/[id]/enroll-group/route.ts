export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/funnels/[id]/enroll-group
 * 그룹 전체를 퍼널에 일괄 등록 → VipCareSequence + VipCareLog (D+0~D+N)
 *
 * body: { groupId: string; startDate?: string }
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const ctx    = await getAuthContext();
    const orgId  = resolveOrgId(ctx);
    const { id: funnelId } = await params;
    const body   = await req.json() as { groupId?: string; startDate?: string };

    if (!body.groupId) {
      return NextResponse.json({ ok: false, message: "groupId 필수" }, { status: 400 });
    }

    // 퍼널 + 스테이지 조회 (소유권 검증 포함)
    const funnel = await prisma.funnel.findFirst({
      where: { id: funnelId, organizationId: orgId },
      include: { stages: { orderBy: { order: "asc" } } },
    });
    if (!funnel) {
      return NextResponse.json({ ok: false, message: "퍼널 없음" }, { status: 404 });
    }
    if (funnel.stages.length === 0) {
      return NextResponse.json(
        { ok: false, message: "스테이지를 먼저 추가하세요 (퍼널 편집 → 스테이지 관리)" },
        { status: 400 }
      );
    }

    // 그룹 + 멤버 조회 (수신거부 제외)
    const group = await prisma.contactGroup.findFirst({
      where: { id: body.groupId, organizationId: orgId },
      include: {
        members: {
          include: {
            contact: {
              select: { id: true, name: true, phone: true, optOutAt: true },
            },
          },
        },
      },
    });
    if (!group) {
      return NextResponse.json({ ok: false, message: "그룹 없음" }, { status: 404 });
    }

    const eligible = group.members
      .map(m => m.contact)
      .filter(c => !c.optOutAt && c.phone);

    if (eligible.length === 0) {
      return NextResponse.json({
        ok: true, enrolled: 0, skipped: 0,
        reason: "수신거부 또는 전화번호 없는 고객만 있어 등록 불가",
      });
    }

    // 이미 ACTIVE로 등록된 고객 제외 (중복 방지)
    const existing = await prisma.vipCareSequence.findMany({
      where: {
        funnelId,
        contactId: { in: eligible.map(c => c.id) },
        status: "ACTIVE",
      },
      select: { contactId: true },
    });
    const activeSet = new Set(existing.map(s => s.contactId));
    const toEnroll  = eligible.filter(c => !activeSet.has(c.id));
    const skipped   = eligible.length - toEnroll.length;

    const baseDate = body.startDate ? new Date(body.startDate) : new Date();

    // 일괄 등록 — interactive transaction: 부분 실패 시 전체 롤백 보장
    // (배열 방식 $transaction은 각 쿼리가 독립 실행되어 중간 실패 시 롤백 불가)
    await prisma.$transaction(async (tx) => {
      for (const contact of toEnroll) {
        const logs = funnel.stages.map(stage => {
          const scheduledAt = new Date(baseDate);
          scheduledAt.setUTCDate(scheduledAt.getUTCDate() + (stage.triggerOffset ?? 0));
          scheduledAt.setUTCHours(1, 0, 0, 0); // UTC 01:00 = KST 10:00

          const rawContent = (stage as Record<string, unknown>).messageContent as string | null ?? null;
          const content = rawContent
            ? rawContent.replace(/\[고객명\]/g, contact.name).replace(/\[이름\]/g, contact.name)
            : null;

          return {
            stageOrder: stage.order,
            scheduledAt,
            status:     "PENDING",
            channel:    (stage as Record<string, unknown>).channel as string | null ?? "SMS",
            content,
          };
        });

        await tx.vipCareSequence.create({
          data: {
            contactId: contact.id,
            funnelId,
            startDate: baseDate,
            status:    "ACTIVE",
            logs:      { create: logs },
          },
        });
      }
    });
    const enrolled = toEnroll.length;

    logger.log("[POST /api/funnels/[id]/enroll-group]", {
      funnelId,
      groupId: body.groupId,
      groupName: group.name,
      enrolled,
      skipped,
      orgId,
    });

    return NextResponse.json({ ok: true, enrolled, skipped }, { status: 201 });
  } catch (err) {
    logger.error("[POST /api/funnels/[id]/enroll-group]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
