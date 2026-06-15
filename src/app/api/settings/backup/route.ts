/**
 * Backup Settings API — 수동/자동 백업 조회 및 실행
 * GET /api/settings/backup — 백업 기록 조회
 * POST /api/settings/backup — 수동 백업 실행
 */
import { NextResponse } from 'next/server';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { backupContactsToExcel, type BackupContact } from '@/lib/backup-xlsx';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface BackupRecord {
  id: string;
  backupAt: string;
  contactCount: number;
  driveFileId?: string;
  driveViewLink?: string;
  backupType: 'MANUAL' | 'AUTO';
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  errorMessage?: string;
}

// ── GET: 백업 기록 조회 ────────────────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext().catch(() => null);
    if (!ctx?.userId) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const orgId = resolveOrgId(ctx);
    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: '조직 정보를 찾을 수 없습니다' },
        { status: 400 }
      );
    }

    // BackupJob 테이블에서 조직의 Contact 백업 기록 조회
    const backupJobs = await prisma.backupJob.findMany({
      where: {
        targetId: orgId,
        type: 'CONTACT_BACKUP',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // 응답 형식으로 변환
    const backups: BackupRecord[] = backupJobs.map((job) => {
      const payload = job.payload as Record<string, unknown> | null || {};
      return {
        id: job.id,
        backupAt: job.createdAt.toISOString(),
        contactCount: (payload.contactCount as number) || 0,
        driveFileId: (payload.driveFileId as string) || undefined,
        driveViewLink: (payload.driveViewLink as string) || undefined,
        backupType: (payload.backupType as 'MANUAL' | 'AUTO') || 'AUTO',
        status: (job.status as 'SUCCESS' | 'FAILED' | 'PENDING') || 'PENDING',
        errorMessage: job.lastError || undefined,
      };
    });

    logger.log('[api/settings/backup] GET 성공', {
      userId: ctx.userId,
      orgId,
      count: backups.length,
    });

    return NextResponse.json({
      ok: true,
      backups,
      total: backups.length,
    });
  } catch (err) {
    logger.error('[api/settings/backup] GET 실패', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, error: '백업 기록 조회 실패' },
      { status: 500 }
    );
  }
}

// ── POST: 수동 백업 실행 ────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const ctx = await getAuthContext().catch(() => null);
    if (!ctx?.userId) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const orgId = resolveOrgId(ctx);
    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: '조직 정보를 찾을 수 없습니다' },
        { status: 400 }
      );
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    });

    if (!org) {
      return NextResponse.json(
        { ok: false, error: '조직을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // Contact 조회 (최대 1000명)
    const contacts = await prisma.contact.findMany({
      where: {
        organizationId: org.id,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      include: {
        callLogs: { orderBy: { createdAt: 'desc' }, take: 50 },
        memos: { orderBy: { createdAt: 'desc' }, take: 20 },
        groups: { include: { group: { select: { id: true, name: true } } } },
      },
    });

    if (contacts.length === 0) {
      return NextResponse.json(
        { ok: false, error: '백업할 Contact가 없습니다' },
        { status: 400 }
      );
    }

    // TransferLog 일괄 조회
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

    // BackupContact 형식으로 변환
    const backupContacts: BackupContact[] = contacts.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      type: c.type,
      cruiseInterest: c.cruiseInterest,
      budgetRange: c.budgetRange,
      adminMemo: c.adminMemo,
      leadScore: c.leadScore,
      tags: c.tags,
      groups: c.groups,
      assignedUserId: c.assignedUserId,
      departureDate: c.departureDate,
      productName: c.productName,
      bookingRef: c.bookingRef,
      lastContactedAt: c.lastContactedAt,
      purchasedAt: c.purchasedAt,
      createdAt: c.createdAt,
      sourceOrgId: c.sourceOrgId,
      callLogs: c.callLogs.map((l) => ({
        id: l.id,
        content: l.content,
        result: l.result,
        convictionScore: l.convictionScore,
        nextAction: l.nextAction,
        createdAt: l.createdAt,
      })),
      memos: c.memos.map((m) => ({
        id: m.id,
        content: m.content,
        createdAt: m.createdAt,
      })),
      transferLogs: (transferMap.get(c.id) ?? []).map((t) => ({
        id: t.id,
        toUserId: t.toUserId,
        toUserName: null,
        toOrgId: t.toOrgId,
        transferType: t.transferType,
        transferredBy: t.transferredBy,
        createdAt: t.createdAt,
      })),
    }));

    // Google Drive에 Excel 백업 생성
    const { fileId, viewUrl } = await backupContactsToExcel({
      orgName: org.name,
      orgId: org.id,
      contacts: backupContacts,
      mode: 'latest',
    });

    // BackupJob에 기록 저장
    const backupJob = await prisma.backupJob.create({
      data: {
        type: 'CONTACT_BACKUP',
        targetId: org.id,
        status: 'SUCCESS',
        payload: {
          contactCount: contacts.length,
          driveFileId: fileId,
          driveViewLink: viewUrl,
          backupType: 'MANUAL',
          completedAt: new Date().toISOString(),
        },
      },
    });

    const duration = Date.now() - startTime;
    logger.log('[api/settings/backup] POST 성공', {
      userId: ctx.userId,
      orgId: org.id,
      orgName: org.name,
      contactCount: contacts.length,
      fileId,
      duration,
    });

    return NextResponse.json({
      ok: true,
      backup: {
        id: backupJob.id,
        contactCount: contacts.length,
        driveFileId: fileId,
        driveViewLink: viewUrl,
        backupAt: backupJob.createdAt.toISOString(),
        backupType: 'MANUAL',
      },
    });
  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);

    logger.error('[api/settings/backup] POST 실패', {
      error: errorMsg,
      duration,
    });

    // 실패 기록 저장
    try {
      const ctx2 = await getAuthContext().catch(() => null);
      if (ctx2?.userId) {
        const orgId2 = resolveOrgId(ctx2);
        if (orgId2) {
          await prisma.backupJob.create({
            data: {
              type: 'CONTACT_BACKUP',
              targetId: orgId2,
              status: 'FAILED',
              lastError: errorMsg,
              payload: {
                backupType: 'MANUAL',
                failedAt: new Date().toISOString(),
              },
            },
          });
        }
      }
    } catch {
      // 기록 저장 실패는 무시
    }

    return NextResponse.json(
      { ok: false, error: '백업 실행 실패: ' + errorMsg },
      { status: 500 }
    );
  }
}
