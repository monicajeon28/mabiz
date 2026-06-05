import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { triggerGroupFunnel } from "@/lib/funnel-trigger";
import { triggerGroupFunnelSms } from "@/lib/funnel-sms-trigger";
import { shouldResetOnReentry } from "@/lib/funnel-sms-helpers";
import { logger } from "@/lib/logger";
import { addLeadScore } from "@/lib/lead-score";

type Params = { params: Promise<{ id: string }> };

// GET /api/groups/[id]/members — 그룹 멤버 목록 조회
export async function GET(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    let orgId: string;
    if (ctx.organizationId) {
      orgId = ctx.organizationId;
    } else if (ctx.role === 'GLOBAL_ADMIN') {
      const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
      if (!firstOrg) return NextResponse.json({ ok: false }, { status: 500 });
      orgId = firstOrg.id;
    } else {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const { id: groupId } = await params;
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') ?? '';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10));
    const skip = (page - 1) * limit;

    // 그룹 소유권 확인
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId: orgId },
      select: { id: true, name: true },
    });
    if (!group) return NextResponse.json({ ok: false }, { status: 404 });

    const where = {
      groupId,
      ...(q ? {
        contact: {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { phone: { contains: q } },
          ],
        },
      } : {}),
    };

    const [members, total] = await Promise.all([
      prisma.contactGroupMember.findMany({
        where,
        orderBy: { addedAt: 'desc' },
        skip,
        take: limit,
        select: {
          contactId: true,
          addedAt: true,
          contact: { select: { name: true, phone: true } },
        },
      }),
      prisma.contactGroupMember.count({ where }),
    ]);

    const now = new Date();
    const result = members.map((m) => ({
      contactId: m.contactId,
      name: m.contact.name ?? '이름없음',
      phone: m.contact.phone ?? '',
      addedAt: m.addedAt.toISOString(),
      daysSince: Math.floor((now.getTime() - m.addedAt.getTime()) / 86_400_000),
    }));

    return NextResponse.json({ ok: true, members: result, total, groupName: group.name });
  } catch (err) {
    logger.error('[GET /api/groups/[id]/members]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST /api/groups/[id]/members — 고객을 그룹에 추가 → 퍼널 자동 시작
export async function POST(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    let orgId: string;
    if (ctx.organizationId) {
      orgId = ctx.organizationId;
    } else if (ctx.role === 'GLOBAL_ADMIN') {
      const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
      if (!firstOrg) return NextResponse.json({ ok: false, error: '조직이 없습니다.' }, { status: 500 });
      orgId = firstOrg.id;
    } else {
      return NextResponse.json({ ok: false }, { status: 403 });
    }
    const { id: groupId } = await params;
    const { contactIds } = await req.json(); // string[]

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ ok: false, message: "contactIds 필수" }, { status: 400 });
    }

    // 그룹이 이 조직 소유이고, 내 그룹(ownerId === ctx.userId) 또는 공유 그룹(ownerId === null)인지 확인
    const group = await prisma.contactGroup.findFirst({
      where: {
        id: groupId,
        organizationId: orgId,
        ...(ctx.role !== 'GLOBAL_ADMIN'
          ? { OR: [{ ownerId: ctx.userId }, { ownerId: null }] }
          : {}),
      },
    });
    if (!group) return NextResponse.json({ ok: false }, { status: 404 });

    // ★ contactId 소유권 검증 — 타 조직 고객을 이 그룹에 끼워넣기 방지
    // 공유받은 복사본(sourceOrgId 있음)도 내 조직에 속하므로 허용
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
        // 재유입 정책: RESET 계열이면 addedAt=now 갱신 → 퍼널문자 0일차부터 재시작.
        // KEEP(기본)이면 update:{} → 최초 입력일 유지(재발송 안 함).
        const member = await prisma.contactGroupMember.upsert({
          where: { groupId_contactId: { groupId, contactId } },
          create: { groupId, contactId },
          update: shouldResetOnReentry(group.reEntryPolicy) ? { addedAt: new Date() } : {},
          select: { addedAt: true },
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
          }).catch((err) => {
            logger.error('[GroupMember] 퍼널 트리거 실패', { err });
          });
        }

        // ★ 퍼널문자(FunnelSms) 트리거 — 그룹에 funnelSmsIds[] 또는 레거시 funnelSmsId가 연결된 경우
        // fire-and-forget: 실패해도 그룹 배정은 성공으로 응답
        const memberFunnelSmsIds =
          (group.funnelSmsIds && group.funnelSmsIds.length > 0)
            ? group.funnelSmsIds
            : (group.funnelSmsId ? [group.funnelSmsId] : []);
        for (const funnelSmsId of memberFunnelSmsIds) {
          triggerGroupFunnelSms({
            contactId,
            groupId,
            organizationId: orgId,
            funnelSmsId,
            // 발송 기준일 = 고객이 그룹에 들어온 날(최초 입력일).
            anchorDate:     member.addedAt,
          }).catch((err) => {
            logger.error('[GroupMember] 퍼널문자 트리거 실패', { err, funnelSmsId });
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
    const ctx = await getAuthContext();
    let orgId: string;
    if (ctx.organizationId) {
      orgId = ctx.organizationId;
    } else if (ctx.role === 'GLOBAL_ADMIN') {
      const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
      if (!firstOrg) return NextResponse.json({ ok: false }, { status: 500 });
      orgId = firstOrg.id;
    } else {
      return NextResponse.json({ ok: false }, { status: 403 });
    }
    const { id: groupId } = await params;
    const { contactIds } = await req.json();

    // 그룹 소유권 확인 (내 그룹 또는 공유 그룹만 조작 가능)
    const group = await prisma.contactGroup.findFirst({
      where: {
        id: groupId,
        organizationId: orgId,
        ...(ctx.role !== 'GLOBAL_ADMIN'
          ? { OR: [{ ownerId: ctx.userId }, { ownerId: null }] }
          : {}),
      },
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
