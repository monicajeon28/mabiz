import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, buildContactWhere, maskContactInfo } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { triggerGroupFunnel } from "@/lib/funnel-trigger";

// GET /api/contacts — 고객 목록 (역할 기반)
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const { searchParams } = new URL(req.url);

    const type    = searchParams.get("type");
    const channel = searchParams.get("channel"); // b2c, b2b, direct
    const q       = searchParams.get("q");
    const groupId = searchParams.get("groupId");
    const tagParam = searchParams.get("tags");                      // 쉼표 구분 태그 필터
    const tags    = tagParam ? tagParam.split(",").map((t) => t.trim()).filter(Boolean) : [];
    const assignedTo = searchParams.get("assignedTo");             // 담당자 필터 (userId 또는 "unassigned")
    const cursor  = searchParams.get("cursor");                     // cursor 기반 페이지네이션
    const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
    const page    = Number.isNaN(rawPage) ? 1 : Math.min(Math.max(1, rawPage), 10000);
    const safeLimit = Math.min(Number(searchParams.get("limit")) || 30, 200); // limit 상한 강제 (200건)

    const baseWhere = buildContactWhere(ctx, {
      ...(type ? { type } : {}),
      ...(channel ? { channel } : {}),
      ...(q
        ? { OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
          ]}
        : {}),
      ...(groupId ? { groups: { some: { groupId } } } : {}),
      // 태그 필터: AND 조건 (모든 태그를 포함한 고객)
      ...(tags.length > 0 ? { tags: { hasEvery: tags } } : {}),
      ...(assignedTo === "unassigned" ? { assignedUserId: null }
        : assignedTo ? { assignedUserId: assignedTo }
        : {}),
    });

    // cursor 기반 페이지네이션 또는 offset 기반 페이지네이션
    let where = baseWhere;
    let skip = 0;
    let take = safeLimit + 1;  // hasMore 판단용 +1

    if (cursor) {
      skip = 1;  // cursor 항목 제외
      where = { ...baseWhere, id: { gt: cursor } };  // id > cursor
    } else {
      take = safeLimit;  // offset 방식일 때는 +1 안 함
      skip = (page - 1) * safeLimit;
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where: cursor ? where : baseWhere,
        orderBy: { id: "asc" },
        skip: skip,
        take: cursor ? take : safeLimit,
        select: {
          id: true,
          phone: true,
          name: true,
          email: true,
          type: true,
          cruiseInterest: true,
          groups: { select: { id: true, groupId: true, group: { select: { id: true, name: true, color: true } } } },
          _count: { select: { callLogs: true } },
        },
      }),
      prisma.contact.count({ where: baseWhere }),
    ]);

    // cursor 기반일 때 +1 제거
    let returnedContacts = contacts;
    let nextCursor: string | null = null;
    let hasMore = false;

    if (cursor) {
      if (contacts.length > safeLimit) {
        hasMore = true;
        nextCursor = contacts[safeLimit]?.id || null;
        returnedContacts = contacts.slice(0, safeLimit);
      }
    }

    // AGENT 역할이면 개인정보 마스킹
    const masked = returnedContacts.map((c) => maskContactInfo(c, ctx));

    // ── 전달 이력 배치 조회 (N+1 없이) ──────────────────────────
    const contactIds = returnedContacts.map((c) => c.id);
    const rawLogs = contactIds.length > 0
      ? await prisma.contactTransferLog.findMany({
          where:   { contactId: { in: contactIds } },
          orderBy: { createdAt: "desc" },
          select:  { id: true, contactId: true, toUserId: true, transferType: true, newContactId: true, transferredBy: true },
        })
      : [];

    // contactId → 최신 로그 1건
    const latestLog = new Map<string, typeof rawLogs[0]>();
    for (const l of rawLogs) if (!latestLog.has(l.contactId)) latestLog.set(l.contactId, l);

    // toUserId 배치 이름 조회
    const toUserIds = [...new Set([...latestLog.values()].map((l) => l.toUserId).filter((x): x is string => !!x))];
    const [orgMembers, globalAdmins] = toUserIds.length === 0
      ? [[], []]
      : await Promise.all([
          prisma.organizationMember.findMany({
            where:  { id: { in: toUserIds } },
            select: { id: true, displayName: true, organization: { select: { name: true } } },
          }),
          prisma.globalAdmin.findMany({
            where:  { id: { in: toUserIds } },
            select: { id: true, displayName: true },
          }),
        ]);

    const nameMap = new Map<string, { name: string; orgName: string }>();
    orgMembers.forEach((m) => nameMap.set(m.id, { name: m.displayName ?? m.id, orgName: m.organization.name }));
    globalAdmins.forEach((a) => nameMap.set(a.id, { name: a.displayName ?? "본사", orgName: "본사" }));

    const contactsWithTransfer = masked.map((c) => {
      const log = latestLog.get(c.id);
      if (!log) return { ...c, lastTransferredTo: null };
      const target = log.toUserId ? nameMap.get(log.toUserId) : null;
      return {
        ...c,
        lastTransferredTo: target
          ? { name: target.name, orgName: target.orgName, logId: log.id, transferType: log.transferType, canRecall: log.transferredBy === ctx.userId || ctx.role === "GLOBAL_ADMIN" }
          : null,
      };
    });

    // cursor 기반이면 cursor 응답, 아니면 offset 응답
    if (cursor) {
      return NextResponse.json({ ok: true, data: contactsWithTransfer, nextCursor, hasMore, limit: safeLimit });
    }

    return NextResponse.json({ ok: true, contacts: contactsWithTransfer, total, page, limit: safeLimit });
  } catch (err) {
    logger.error("[GET /api/contacts]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST /api/contacts — 고객 생성 (OWNER / GLOBAL_ADMIN만)
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();

    // GLOBAL_ADMIN은 organizationId가 null — 첫 번째 조직 사용
    let orgId: string;
    if (ctx.organizationId) {
      orgId = ctx.organizationId;
    } else if (ctx.role === 'GLOBAL_ADMIN') {
      const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
      if (!firstOrg) return NextResponse.json({ ok: false, error: '조직이 없습니다.' }, { status: 500 });
      orgId = firstOrg.id;
    } else {
      return NextResponse.json({ ok: false, error: '조직 정보가 없습니다.' }, { status: 403 });
    }

    const body  = await req.json();
    const { name, phone, email, type, cruiseInterest, budgetRange, adminMemo, groupIds, assignedUserId } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { ok: false, message: "이름과 전화번호는 필수입니다." },
        { status: 400 }
      );
    }
    if (typeof name === 'string' && name.length > 100) {
      return NextResponse.json({ ok: false, message: "이름은 100자 이하여야 합니다." }, { status: 400 });
    }
    if (typeof phone === 'string' && phone.length > 20) {
      return NextResponse.json({ ok: false, message: "전화번호는 20자 이하여야 합니다." }, { status: 400 });
    }

    const contact = await prisma.contact.create({
      data: {
        organizationId: orgId,
        name,
        phone,
        email:          email          ?? null,
        type:           type           ?? "LEAD",
        cruiseInterest: cruiseInterest ?? null,
        budgetRange:    budgetRange    ?? null,
        adminMemo:      adminMemo      ?? null,
        assignedUserId: assignedUserId ?? null,
        ...(groupIds?.length
          ? { groups: { create: (groupIds as string[]).map((gid) => ({ groupId: gid })) } }
          : {}),
      },
    });

    logger.log("[POST /api/contacts] 고객 생성", { id: contact.id });

    // 퍼널 상태 자동 생성 (fire-and-forget)
    prisma.contactFunnelState.upsert({
      where: {
        contactId: contact.id,
      },
      update: {},
      create: {
        organizationId: orgId,
        contactId: contact.id,
        status: 'PENDING',
      },
    }).catch((err) => {
      logger.error('[POST /api/contacts] 퍼널 상태 생성 실패', { err, contactId: contact.id });
    });

    // 그룹 배정 시 퍼널 자동 시작 (fire-and-forget)
    if (groupIds?.length && contact.id) {
      for (const gid of groupIds as string[]) {
        triggerGroupFunnel({
          contactId:      contact.id,
          groupId:        gid,
          organizationId: orgId,
        }).catch(() => {});
      }
    }

    return NextResponse.json({ ok: true, contact }, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { ok: false, message: "이미 등록된 전화번호입니다." },
        { status: 409 }
      );
    }
    logger.error("[POST /api/contacts]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
