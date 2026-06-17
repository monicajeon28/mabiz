import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getAuthContext, buildContactWhere, canDelete, maskContactInfo, actorDisplayName, resolveOrgId } from "@/lib/rbac";
import { backupContactsToExcel } from "@/lib/backup-xlsx";
import { logger } from "@/lib/logger";
import { logContactChange, logContactChanges } from "@/lib/audit/log-contact-change";

type Params = { params: Promise<{ id: string }> };

// GET /api/contacts/[id]
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx  = await getAuthContext();
    const { id } = await params;

    // 권한 검사 먼저 — FREE_SALES 차단 (buildContactWhere 호출 전)
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

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
          ...log, _sharedFrom: lc.organization.name, _authorName: null as string | null,
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

    // FREE_SALES 역할 미리 차단
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const where  = buildContactWhere(ctx, { id });
    const existing = await prisma.contact.findFirst({ where });
    if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

    const { name, phone, email, type, cruiseInterest, budgetRange,
            adminMemo, assignedUserId, tags,
            departureDate, productName, bookingRef, commentEnabled,
            isActive, _auditReason } = body;

    // 필수 필드 빈 문자열 방지
    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      return NextResponse.json({ ok: false, message: '이름은 비워둘 수 없습니다.' }, { status: 400 });
    }
    if (phone !== undefined && (typeof phone !== 'string' || phone.trim() === '')) {
      return NextResponse.json({ ok: false, message: '전화번호는 비워둘 수 없습니다.' }, { status: 400 });
    }

    // ═══════════════════════════════════════════════════════════════
    // 권한 검증: buildContactWhere 필터 + 추가 역할별 검증
    // ═══════════════════════════════════════════════════════════════
    // TOCTOU 방지: organizationId 확인 (GLOBAL_ADMIN은 전체 접근 허용)
    if (ctx.role !== 'GLOBAL_ADMIN' && existing.organizationId !== resolveOrgId(ctx)) {
      return NextResponse.json(
        { ok: false, message: '권한이 없습니다' },
        { status: 403 }
      );
    }

    // AGENT: 할당된 Contact만 수정 가능 (할당되지 않은 Contact는 읽기만)
    if (ctx.role === 'AGENT' && existing.assignedUserId && existing.assignedUserId !== ctx.userId) {
      return NextResponse.json(
        { ok: false, message: '할당된 고객만 수정할 수 있습니다' },
        { status: 403 }
      );
    }

    // OWNER: ADMIN_ONLY Contact 수정 불가 (관리자 전용)
    if (ctx.role === 'OWNER' && existing.visibility === 'ADMIN_ONLY') {
      return NextResponse.json(
        { ok: false, message: '관리자만 수정 가능한 고객입니다' },
        { status: 403 }
      );
    }

    // 업데이트될 데이터 구성
    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined && ctx.role !== "AGENT") updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (type !== undefined) updateData.type = type;
    if (cruiseInterest !== undefined) updateData.cruiseInterest = cruiseInterest;
    if (budgetRange !== undefined) updateData.budgetRange = budgetRange;
    if (adminMemo !== undefined) updateData.adminMemo = adminMemo;
    if (departureDate !== undefined) updateData.departureDate = departureDate ? new Date(departureDate) : null;
    if (productName !== undefined) updateData.productName = productName;
    if (bookingRef !== undefined) updateData.bookingRef = bookingRef;
    if (Array.isArray(tags)) updateData.tags = tags;
    if (assignedUserId !== undefined && ctx.role !== "AGENT") updateData.assignedUserId = assignedUserId;

    const contact = await prisma.contact.update({
      where: { id, organizationId: existing.organizationId },
      data: updateData,
    });

    // 변경 이력 자동 기록 (비동기, 실패해도 계속 진행)
    void (async () => {
      const changes: Array<{
        fieldChanged: string;
        oldValue: any;
        newValue: any;
      }> = [];

      // 각 필드별 변경 기록
      if (name !== undefined && existing.name !== name) {
        changes.push({
          fieldChanged: 'name',
          oldValue: existing.name,
          newValue: name,
        });
      }
      if (phone !== undefined && ctx.role !== "AGENT" && existing.phone !== phone) {
        changes.push({
          fieldChanged: 'phone',
          oldValue: existing.phone,
          newValue: phone,
        });
      }
      if (email !== undefined && existing.email !== email) {
        changes.push({
          fieldChanged: 'email',
          oldValue: existing.email,
          newValue: email,
        });
      }
      if (type !== undefined && existing.type !== type) {
        changes.push({
          fieldChanged: 'type',
          oldValue: existing.type,
          newValue: type,
        });
      }
      if (cruiseInterest !== undefined && existing.cruiseInterest !== cruiseInterest) {
        changes.push({
          fieldChanged: 'cruiseInterest',
          oldValue: existing.cruiseInterest,
          newValue: cruiseInterest,
        });
      }
      if (budgetRange !== undefined && existing.budgetRange !== budgetRange) {
        changes.push({
          fieldChanged: 'budgetRange',
          oldValue: existing.budgetRange,
          newValue: budgetRange,
        });
      }
      if (adminMemo !== undefined && existing.adminMemo !== adminMemo) {
        changes.push({
          fieldChanged: 'adminMemo',
          oldValue: existing.adminMemo,
          newValue: adminMemo,
        });
      }
      if (productName !== undefined && existing.productName !== productName) {
        changes.push({
          fieldChanged: 'productName',
          oldValue: existing.productName,
          newValue: productName,
        });
      }
      if (bookingRef !== undefined && existing.bookingRef !== bookingRef) {
        changes.push({
          fieldChanged: 'bookingRef',
          oldValue: existing.bookingRef,
          newValue: bookingRef,
        });
      }
      if (departureDate !== undefined && existing.departureDate?.toISOString() !== new Date(departureDate).toISOString()) {
        changes.push({
          fieldChanged: 'departureDate',
          oldValue: existing.departureDate?.toISOString(),
          newValue: departureDate ? new Date(departureDate).toISOString() : null,
        });
      }
      if (Array.isArray(tags) && JSON.stringify(existing.tags) !== JSON.stringify(tags)) {
        changes.push({
          fieldChanged: 'tags',
          oldValue: existing.tags,
          newValue: tags,
        });
      }
      if (assignedUserId !== undefined && ctx.role !== "AGENT" && existing.assignedUserId !== assignedUserId) {
        changes.push({
          fieldChanged: 'assignedUserId',
          oldValue: existing.assignedUserId,
          newValue: assignedUserId,
        });
      }

      // 변경사항이 있으면 로깅
      if (changes.length > 0) {
        await logContactChanges({
          contactId: id,
          organizationId: existing.organizationId,
          userId: ctx.userId,
          action: 'UPDATE',
          changes: changes.map(c => ({
            ...c,
            reason: _auditReason,
          })),
        });
      }
    })();

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

    // TOCTOU 방지: organizationId 확인 (GLOBAL_ADMIN은 전체 접근 허용)
    if (ctx.role !== 'GLOBAL_ADMIN' && existing.organizationId !== resolveOrgId(ctx)) {
      return NextResponse.json(
        { ok: false, message: '권한이 없습니다' },
        { status: 403 }
      );
    }

    // 휴지통으로 이동 (소프트 삭제) + 삭제자 기록
    await prisma.contact.updateMany({
      where: buildContactWhere(ctx, { id }),
      data: {
        deletedAt:     new Date(),
        deletedBy:     ctx.userId,
        deletedByName: actorDisplayName(ctx),
      },
    });

    // 삭제 이력 기록
    void logContactChange({
      contactId: id,
      organizationId: existing.organizationId,
      userId: ctx.userId,
      action: 'DELETE',
      reason: '휴지통으로 이동',
    });

    // Drive 백업은 삭제보다 먼저 완료되어야 한다.
    const transferLogs = await prisma.contactTransferLog.findMany({
      where: { contactId: id }, orderBy: { createdAt: "desc" },
    });
    try {
      await backupContactsToExcel({
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
      });
    } catch (backupErr) {
      logger.error("[DELETE] Drive 백업 실패", {
        id,
        error: backupErr instanceof Error ? backupErr.message : String(backupErr),
      });
      return NextResponse.json(
        { ok: false, message: "백업에 실패해 삭제를 중단했습니다.", code: "BACKUP_FAILED" },
        { status: 503 },
      );
    }
    logger.log("[DELETE] 휴지통 이동(soft)", { id, by: ctx.userId });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[DELETE /api/contacts/[id]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
