import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getAuthContext, buildContactWhere, canDelete, maskContactInfo, actorDisplayName } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

// GET /api/contacts/[id]
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx  = await getAuthContext();
    const { id } = await params;
    const where  = buildContactWhere(ctx, { id });

    const contact = await prisma.contact.findFirst({
      where,
      include: {
        groups:       { include: { group: true } },
        callLogs:     { orderBy: { createdAt: "desc" }, take: 30 },
        memos:        { orderBy: { createdAt: "desc" }, take: 30 },
        vipSequences: {
          where:   { status: "ACTIVE" },
          include: { logs: { orderBy: { scheduledAt: "asc" }, take: 30 } },
        },
      },
    });

    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    // ── 연결된 콜 기록 (DB 전달된 양방향 연결 고객) ─────────
    const transferLinks = await prisma.contactTransferLog.findMany({
      where: {
        OR: [
          { contactId: contact.id },     // 내가 보낸 복사본
          { newContactId: contact.id },  // 내가 받은 원본
        ],
        transferType: "ORG_COPY",
      },
      select: { contactId: true, newContactId: true },
    });

    const linkedIds = new Set<string>();
    for (const l of transferLinks) {
      if (l.contactId    !== contact.id && l.contactId)    linkedIds.add(l.contactId);
      if (l.newContactId !== contact.id && l.newContactId) linkedIds.add(l.newContactId);
    }

    let sharedCallLogs: Array<{
      id: string; createdAt: Date; content: string | null; result: string | null;
      duration: number | null; convictionScore: number | null; nextAction: string | null;
      scheduledAt: Date | null; userId: string;
      _sharedFrom: string; // 조직명
      _authorName: string | null;
    }> = [];

    if (linkedIds.size > 0) {
      const linkedContacts = await prisma.contact.findMany({
        where: { id: { in: [...linkedIds] } },
        include: {
          callLogs: { orderBy: { createdAt: "desc" }, take: 30 },
          organization: { select: { name: true } },
        },
      });
      for (const lc of linkedContacts) {
        sharedCallLogs.push(...lc.callLogs.map(log => ({
          ...log, _sharedFrom: lc.organization.name, _authorName: null,
        })));
      }
      // 최신순 정렬
      sharedCallLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    // ── userId → 이름 batch 조회 (callLogs + memos + sharedCallLogs) ──
    const rawUserIds = [
      ...contact.callLogs.map(l => l.userId),
      ...contact.memos.map(m => m.userId),
      ...sharedCallLogs.map(l => l.userId),
    ].filter(Boolean);
    const uniqueUserIds = [...new Set(rawUserIds)];

    const [gaList, memberList] = await Promise.all([
      uniqueUserIds.length > 0
        ? prisma.globalAdmin.findMany({
            where: { id: { in: uniqueUserIds } },
            select: { id: true, displayName: true },
          })
        : Promise.resolve([]),
      uniqueUserIds.length > 0
        ? prisma.organizationMember.findMany({
            where: { id: { in: uniqueUserIds } },
            select: { id: true, displayName: true, phone: true },
          })
        : Promise.resolve([]),
    ]);

    const nameMap = new Map<string, string>();
    for (const ga of gaList)     nameMap.set(ga.id, ga.displayName ?? '관리자');
    for (const m  of memberList) nameMap.set(m.id,  m.displayName  ?? m.phone ?? m.id);

    const callLogsWithAuthor = contact.callLogs.map(l => ({
      ...l, _authorName: nameMap.get(l.userId) ?? null,
    }));
    const memosWithAuthor = contact.memos.map(m => ({
      ...m, _authorName: nameMap.get(m.userId) ?? null,
    }));
    const sharedWithAuthor = sharedCallLogs.map(l => ({
      ...l, _authorName: nameMap.get(l.userId) ?? null,
    }));

    const masked = maskContactInfo(contact, ctx);
    return NextResponse.json({
      ok: true,
      contact: {
        ...masked,
        callLogs:       callLogsWithAuthor,
        memos:          memosWithAuthor,
        sharedCallLogs: sharedWithAuthor,
      },
    });
  } catch (err) {
    logger.error("[GET /api/contacts/[id]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// PATCH /api/contacts/[id]
export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx  = await getAuthContext();
    const { id } = await params;
    const body   = await req.json();
    const where  = buildContactWhere(ctx, { id });

    const existing = await prisma.contact.findFirst({ where });
    if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

    const { name, phone, email, type, cruiseInterest, budgetRange,
            adminMemo, assignedUserId, tags,
            departureDate, productName, bookingRef, commentEnabled,
            isActive } = body;

    // 필수 필드 빈 문자열 방지
    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      return NextResponse.json({ ok: false, message: '이름은 비워둘 수 없습니다.' }, { status: 400 });
    }
    if (phone !== undefined && (typeof phone !== 'string' || phone.trim() === '')) {
      return NextResponse.json({ ok: false, message: '전화번호는 비워둘 수 없습니다.' }, { status: 400 });
    }

    // organizationId 포함: findFirst → update 사이 TOCTOU 방지
    const contact = await prisma.contact.update({
      where: { id, organizationId: existing.organizationId },
      data: {
        ...(name           !== undefined ? { name }           : {}),
        // 전화번호는 OWNER/GLOBAL_ADMIN만 변경 가능 (고유 식별키 보호)
        ...(phone          !== undefined && ctx.role !== "AGENT" ? { phone } : {}),
        ...(email          !== undefined ? { email }          : {}),
        ...(type           !== undefined ? { type }           : {}),
        ...(cruiseInterest !== undefined ? { cruiseInterest } : {}),
        ...(budgetRange    !== undefined ? { budgetRange }    : {}),
        ...(adminMemo      !== undefined ? { adminMemo }      : {}),
        ...(departureDate  !== undefined ? { departureDate: departureDate ? new Date(departureDate) : null } : {}),
        ...(productName    !== undefined ? { productName }    : {}),
        ...(bookingRef     !== undefined ? { bookingRef }     : {}),
        // 태그 (WO-25C) — 배열 전체 교체 방식
        ...(Array.isArray(tags)          ? { tags }           : {}),
        // OWNER/ADMIN만 담당자 변경 가능
        ...(assignedUserId !== undefined && ctx.role !== "AGENT"
          ? { assignedUserId }
          : {}),
      },
    });
    void isActive; void commentEnabled; // 미사용 변수 TS 경고 방지

    return NextResponse.json({ ok: true, contact });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json(
        { ok: false, message: '이미 등록된 전화번호입니다.' },
        { status: 409 }
      );
    }
    logger.error("[PATCH /api/contacts/[id]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// DELETE /api/contacts/[id]
// 모든 삭제는 휴지통(soft delete: deletedAt + deletedBy 기록)으로 이동.
// 영구삭제는 휴지통(/api/contacts/trash/purge)에서만 가능 (GLOBAL_ADMIN).
// 권한: OWNER·GLOBAL_ADMIN만 / AGENT·FREE_SALES 불가
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx  = await getAuthContext();
    const { id } = await params;

    if (!canDelete(ctx)) {
      return NextResponse.json(
        { ok: false, message: "삭제 권한이 없습니다. (판매원은 삭제할 수 없습니다)" },
        { status: 403 }
      );
    }

    const where    = buildContactWhere(ctx, { id });
    const existing = await prisma.contact.findFirst({
      where,
      include: {
        callLogs:     { orderBy: { createdAt: "desc" } },
        memos:        { orderBy: { createdAt: "desc" } },
        groups:       { include: { group: { select: { id: true, name: true } } } },
        organization: { select: { id: true, name: true } },
      },
    });
    if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

    // 휴지통으로 이동 (소프트 삭제) + 삭제자 기록
    await prisma.contact.updateMany({
      where: buildContactWhere(ctx, { id }),
      data: {
        deletedAt:     new Date(),
        deletedBy:     ctx.userId,
        deletedByName: actorDisplayName(ctx),
      },
    });

    // Drive 백업 fire-and-forget (삭제 전 스냅샷)
    const transferLogs = await prisma.contactTransferLog.findMany({
      where: { contactId: id }, orderBy: { createdAt: "desc" },
    });
    import("@/lib/backup-xlsx").then(({ backupContactsToExcel }) =>
      backupContactsToExcel({
        orgName:              existing.organization.name,
        orgId:                existing.organizationId,
        contacts: [{
          ...existing,
          tags:        existing.tags ?? [],
          groups:      existing.groups,
          transferLogs: transferLogs.map(t => ({ ...t, toUserName: null })),
        }],
        mode:                 "pre_delete",
        contactNameForDelete: existing.name,
      }).catch((err) => logger.error("[DELETE] Drive 백업 실패", { id, error: err instanceof Error ? err.message : String(err) }))
    ).catch((err) => logger.error("[DELETE] 백업 모듈 로드 실패", { id, error: err instanceof Error ? err.message : String(err) }));
    logger.log("[DELETE] 휴지통 이동(soft)", { id, by: ctx.userId });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[DELETE /api/contacts/[id]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
