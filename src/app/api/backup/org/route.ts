export const runtime = 'nodejs';

/**
 * POST /api/backup/org
 * 조직 전체 고객을 하나의 xlsx로 Drive에 백업
 * Auth: OWNER, GLOBAL_ADMIN — AGENT는 buildContactWhere에 의해 담당 고객만 포함
 * FREE_SALES 접근 불가
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, buildContactWhere, requireNotFreeSales } from '@/lib/rbac';
import { backupContactsToExcel, type BackupContact } from '@/lib/backup-xlsx';
import { logger } from '@/lib/logger';

export async function POST(_req: Request) {
  try {
    const ctx = await getAuthContext();
    requireNotFreeSales(ctx);

    // AGENT도 자기 담당 고객 백업 가능 (buildContactWhere가 스코프 제한)
    const where = buildContactWhere(ctx, { deletedAt: null });

    // take: 1000 제한 (OOM/타임아웃 방지 — Vercel 512MB/30s)
    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 1000,
      include: {
        callLogs:     { orderBy: { createdAt: 'desc' }, take: 50 },
        memos:        { orderBy: { createdAt: 'desc' }, take: 20 },
        groups:       { include: { group: { select: { id: true, name: true } } } },
        organization: { select: { id: true, name: true } },
      },
    });

    if (contacts.length === 0) {
      return NextResponse.json({ ok: true, fileId: null, viewUrl: null, count: 0 });
    }

    // transferLogs 일괄 조회
    const contactIds = contacts.map((c) => c.id);
    const allTransferLogs = await prisma.contactTransferLog.findMany({
      where: { contactId: { in: contactIds } },
      orderBy: { createdAt: 'desc' },
    });
    const transferMap = new Map<string, typeof allTransferLogs>();
    for (const t of allTransferLogs) {
      const list = transferMap.get(t.contactId) ?? [];
      list.push(t);
      transferMap.set(t.contactId, list);
    }

    // 조직명 결정
    const orgName =
      ctx.role === 'GLOBAL_ADMIN'
        ? '전체'
        : ctx.role === 'AGENT'
        ? `${contacts[0].organization.name}_담당고객`
        : contacts[0].organization.name;
    const orgId = ctx.organizationId ?? 'global';

    const backupContacts: BackupContact[] = contacts.map((c) => ({
      id:              c.id,
      name:            c.name,
      phone:           c.phone,
      email:           c.email,
      type:            c.type,
      cruiseInterest:  c.cruiseInterest,
      budgetRange:     c.budgetRange,
      adminMemo:       c.adminMemo,
      leadScore:       c.leadScore,
      tags:            c.tags,
      groups:          c.groups,
      assignedUserId:  c.assignedUserId,
      departureDate:   c.departureDate,
      productName:     c.productName,
      bookingRef:      c.bookingRef,
      lastContactedAt: c.lastContactedAt,
      purchasedAt:     c.purchasedAt,
      createdAt:       c.createdAt,
      sourceOrgId:     c.sourceOrgId,
      callLogs: c.callLogs.map((l) => ({
        id:              l.id,
        content:         l.content,
        result:          l.result,
        convictionScore: l.convictionScore,
        nextAction:      l.nextAction,
        createdAt:       l.createdAt,
      })),
      memos: c.memos.map((m) => ({
        id:        m.id,
        content:   m.content,
        createdAt: m.createdAt,
      })),
      transferLogs: (transferMap.get(c.id) ?? []).map((t) => ({
        id:            t.id,
        toUserId:      t.toUserId,
        toUserName:    null,
        toOrgId:       t.toOrgId,
        transferType:  t.transferType,
        transferredBy: t.transferredBy,
        createdAt:     t.createdAt,
      })),
    }));

    const { fileId, viewUrl } = await backupContactsToExcel({
      orgName,
      orgId,
      contacts: backupContacts,
      mode: 'latest',
    });

    logger.log('[POST /api/backup/org]', { orgName, count: contacts.length, fileId });

    return NextResponse.json({ ok: true, fileId, viewUrl, count: contacts.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHORIZED' || message === 'FREE_SALES_NO_ACCESS') {
      return NextResponse.json({ ok: false, error: message }, { status: 403 });
    }
    logger.error('[POST /api/backup/org]', { err });
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
