export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { backupCallLogsToGoogleDrive } from '@/lib/google-drive';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/contacts/[id]/call-logs/backup
 * 고객의 콜 기록을 Google Drive에 백업
 * 경로: 콜기록 / {userId}_{displayName} / {고객명}.txt
 */
export async function POST(_req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();

    const { id: contactId } = await params;

    // 고객 조회 (소유권 검증)
    const contactWhere = ctx.role === 'GLOBAL_ADMIN'
      ? { id: contactId }
      : { id: contactId, organizationId: ctx.organizationId! };
    const contact = await prisma.contact.findFirst({
      where: contactWhere,
      select: { id: true, name: true, phone: true },
    });
    if (!contact) return NextResponse.json({ ok: false, message: '고객을 찾을 수 없습니다.' }, { status: 404 });

    // 콜 기록 전체 조회
    const callLogs = await prisma.callLog.findMany({
      where:   { contactId },
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt:      true,
        result:         true,
        convictionScore: true,
        content:        true,
        nextAction:     true,
      },
    });

    if (callLogs.length === 0) {
      return NextResponse.json({ ok: false, message: '백업할 콜 기록이 없습니다.' }, { status: 400 });
    }

    // 현재 사용자 정보 (관리자 폴더명용)
    let userId: string;
    let displayName: string;
    if (ctx.role === 'GLOBAL_ADMIN') {
      userId = 'admin';
      const ga = await prisma.globalAdmin.findUnique({ where: { id: ctx.userId }, select: { displayName: true } });
      displayName = ga?.displayName ?? 'admin';
    } else {
      userId = ctx.userId;
      displayName = ctx.member?.displayName ?? ctx.userId;
    }

    // Drive 백업 실행
    const { fileId, viewUrl } = await backupCallLogsToGoogleDrive({
      userId,
      displayName,
      customerName:  contact.name,
      customerPhone: contact.phone,
      callLogs,
    });

    logger.log('[CallLog Backup] Google Drive 백업 완료', {
      contactId,
      fileId,
      count: callLogs.length,
    });

    return NextResponse.json({ ok: true, fileId, viewUrl, count: callLogs.length });

  } catch (err) {
    logger.error('[POST /api/contacts/[id]/call-logs/backup]', { err });
    return NextResponse.json({ ok: false, message: '백업 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
