import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { backupContactsToDrive } from '@/lib/google-drive';
import { logger } from '@/lib/logger';

/**
 * POST /api/backup/contacts
 *
 * 수동 Contact 백업 (ADMIN 권한)
 * 현재 조직의 Contact을 Google Drive에 백업
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: '인증 필요' }, { status: 401 });
    }

    // ADMIN 권한 확인
    if (session.role !== 'GLOBAL_ADMIN' && session.role !== 'OWNER') {
      return NextResponse.json(
        { ok: false, error: '권한 없음 (ADMIN만 백업 가능)' },
        { status: 403 }
      );
    }

    if (!session.organizationId) {
      return NextResponse.json({ ok: false, error: '조직 정보 없음' }, { status: 400 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: {
        id: true,
        name: true,
        googleDriveAccessToken: true,
      },
    });

    const accessToken = organization?.googleDriveAccessToken;

    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: 'Google Drive 연동 필요' },
        { status: 400 }
      );
    }

    // Contact 조회
    const contacts = await prisma.contact.findMany({
      where: {
        organizationId: session.organizationId,
        visibility: { in: ['SHARED', 'ADMIN_ONLY'] },
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        sourceId: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Google Drive 백업
    const result = await backupContactsToDrive(
      session.organizationId,
      contacts as Array<{
        id: string;
        name: string;
        phone: string;
        email?: string | null;
        sourceId?: string | null;
        visibility?: string;
        createdAt: Date;
        updatedAt: Date;
      }>,
      accessToken
    );

    // 백업 기록 저장
    const backup = await prisma.contactBackup.create({
      data: {
        organizationId: session.organizationId,
        backupAt: result.backupAt,
        contactCount: result.count,
        driveSheetId: result.sheetId,
        backupType: 'MANUAL',
        status: 'SUCCESS',
      },
    });

    logger.info(`[POST /api/backup/contacts] ${result.count}개 Contact 백업됨`, {
      organizationId: session.organizationId,
      sheetId: result.sheetId,
    });

    return NextResponse.json({
      ok: true,
      message: `${result.count}개 Contact 백업됨`,
      backup: {
        id: backup.id,
        sheetId: result.sheetId,
        backupAt: result.backupAt,
        contactCount: result.count,
      },
    });
  } catch (err) {
    logger.error('[POST /api/backup/contacts]', err);

    // 실패 기록 저장
    try {
      const session2 = await getAuthSession();
      if (session2?.organizationId) {
        await prisma.contactBackup.create({
          data: {
            organizationId: session2.organizationId,
            backupAt: new Date(),
            contactCount: 0,
            backupType: 'MANUAL',
            status: 'FAILED',
            errorMessage: err instanceof Error ? err.message : '알 수 없는 오류',
          },
        });
      }
    } catch (logErr) {
      logger.error('[POST /api/backup/contacts] 실패 기록 저장 실패', logErr);
    }

    return NextResponse.json(
      { ok: false, error: '백업 실패' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/backup/contacts
 *
 * Contact 백업 기록 조회 (ADMIN 권한)
 * 최근 10개의 백업 기록 반환
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: '인증 필요' }, { status: 401 });
    }

    if (!session.organizationId) {
      return NextResponse.json({ ok: false, error: '조직 정보 없음' }, { status: 400 });
    }

    // ADMIN 권한 확인
    if (session.role !== 'GLOBAL_ADMIN' && session.role !== 'OWNER') {
      return NextResponse.json(
        { ok: false, error: '권한 없음' },
        { status: 403 }
      );
    }

    const backups = await prisma.contactBackup.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { backupAt: 'desc' },
      take: 10,
      select: {
        id: true,
        backupAt: true,
        contactCount: true,
        driveSheetId: true,
        backupType: true,
        status: true,
        errorMessage: true,
      },
    });

    return NextResponse.json({
      ok: true,
      backups,
      total: backups.length,
    });
  } catch (err) {
    logger.error('[GET /api/backup/contacts]', err);
    return NextResponse.json(
      { ok: false, error: '조회 실패' },
      { status: 500 }
    );
  }
}
