/**
 * 고객 전체 Excel 백업 cron — 조직별 고객목록+콜기록+메모+전달이력 xlsx → Google Drive
 * 스케줄: vercel.json (매일 새벽). 인증: CRON_SECRET
 *
 * Drive 폴더 구조:
 *   GOOGLE_DRIVE_CRM_BACKUP_FOLDER_ID/
 *   └── CRM백업/
 *       └── {조직명}/
 *           └── 고객전체_최신.xlsx  ← 매일 덮어쓰기
 */
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { backupContactsToExcel, type BackupContact } from '@/lib/backup-xlsx';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ')
    ? auth.slice(7)
    : (req.headers.get('x-vercel-cron-secret') ?? '');
  if (token.length !== secret.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, message: 'CRON_SECRET 미설정' }, { status: 500 });
  }
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, message: '인증 실패' }, { status: 401 });
  }

  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true },
  });

  logger.log('[cron/backup-contacts-excel] 시작', { orgCount: orgs.length });

  let successCount = 0;
  let failedCount = 0;
  let totalContacts = 0;

  for (const org of orgs) {
    try {
      // 1000명 제한 (OOM/타임아웃 방지)
      const contacts = await prisma.contact.findMany({
        where: { organizationId: org.id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 1000,
        include: {
          callLogs: { orderBy: { createdAt: 'desc' }, take: 50 },
          memos:    { orderBy: { createdAt: 'desc' }, take: 20 },
          groups:   { include: { group: { select: { id: true, name: true } } } },
        },
      });

      if (contacts.length === 0) continue;

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

      await backupContactsToExcel({
        orgName: org.name,
        orgId:   org.id,
        contacts: backupContacts,
        mode: 'latest',
      });

      successCount++;
      totalContacts += contacts.length;
      logger.log('[cron/backup-contacts-excel] 조직 완료', {
        orgId: org.id, orgName: org.name, count: contacts.length,
      });
    } catch (err) {
      failedCount++;
      logger.error('[cron/backup-contacts-excel] 조직 실패', {
        orgId: org.id, orgName: org.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.log('[cron/backup-contacts-excel] 완료', {
    orgCount: orgs.length, successCount, failedCount, totalContacts,
  });
  return NextResponse.json({ ok: true, orgCount: orgs.length, successCount, failedCount, totalContacts });
}
