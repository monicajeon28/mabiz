export const runtime = 'nodejs';

/**
 * POST /api/backup/contact/[id]
 * 특정 고객 1명을 포함한 조직 전체 최신 백업을 Drive에 업로드
 * Auth: FREE_SALES 제외 모든 역할
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, buildContactWhere, requireNotFreeSales } from '@/lib/rbac';
import { backupContactsToExcel, type BackupContact } from '@/lib/backup-xlsx';
import { logger } from '@/lib/logger';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    requireNotFreeSales(ctx);

    const { id } = await params;

    // 접근 가능한 고객인지 확인
    const where = buildContactWhere(ctx, { id });

    const contact = await prisma.contact.findFirst({
      where,
      include: {
        callLogs:     { orderBy: { createdAt: 'desc' } },
        memos:        { orderBy: { createdAt: 'desc' } },
        groups:       { include: { group: { select: { id: true, name: true } } } },
        organization: { select: { id: true, name: true } },
      },
    });

    if (!contact) {
      return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    }

    // transferLogs 별도 조회 (Contact 모델에 직접 relation 없음)
    const transferLogs = await prisma.contactTransferLog.findMany({
      where: { contactId: id },
      orderBy: { createdAt: 'desc' },
    });

    const orgName = contact.organization.name;
    const orgId   = contact.organization.id;

    const backupContact: BackupContact = {
      id:              contact.id,
      name:            contact.name,
      phone:           contact.phone,
      email:           contact.email,
      type:            contact.type,
      cruiseInterest:  contact.cruiseInterest,
      budgetRange:     contact.budgetRange,
      adminMemo:       contact.adminMemo,
      leadScore:       contact.leadScore,
      tags:            contact.tags,
      groups:          contact.groups,
      assignedUserId:  contact.assignedUserId,
      departureDate:   contact.departureDate,
      productName:     contact.productName,
      bookingRef:      contact.bookingRef,
      lastContactedAt: contact.lastContactedAt,
      purchasedAt:     contact.purchasedAt,
      createdAt:       contact.createdAt,
      sourceOrgId:     contact.sourceOrgId,
      callLogs:        contact.callLogs.map((l) => ({
        id:             l.id,
        content:        l.content,
        result:         l.result,
        convictionScore: l.convictionScore,
        nextAction:     l.nextAction,
        createdAt:      l.createdAt,
      })),
      memos:           contact.memos.map((m) => ({
        id:        m.id,
        content:   m.content,
        createdAt: m.createdAt,
      })),
      transferLogs:    transferLogs.map((t) => ({
        id:           t.id,
        toUserId:     t.toUserId,
        toUserName:   null,
        toOrgId:      t.toOrgId,
        transferType: t.transferType,
        transferredBy: t.transferredBy,
        createdAt:    t.createdAt,
      })),
    };

    const { fileId, viewUrl } = await backupContactsToExcel({
      orgName,
      orgId,
      contacts: [backupContact],
      mode: 'latest',
    });

    logger.log('[POST /api/backup/contact/:id]', { id, orgName, fileId });

    return NextResponse.json({ ok: true, fileId, viewUrl, count: 1 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHORIZED' || message === 'FREE_SALES_NO_ACCESS') {
      return NextResponse.json({ ok: false, error: message }, { status: 403 });
    }
    logger.error('[POST /api/backup/contact/:id]', { err });
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
