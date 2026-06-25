/**
 * POST /api/contacts/backup
 * Contact 데이터를 Google Drive로 백업
 *
 * 요청:
 * {
 *   organizationId: string;
 *   accessToken: string;  // Google OAuth 액세스 토큰
 *   backupType?: 'MANUAL' | 'AUTO' | 'API';
 * }
 *
 * 응답:
 * {
 *   ok: boolean;
 *   backup?: { id, sheetId, backupAt, contactCount };
 *   error?: string;
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { backupContactsToDrive } from '@/lib/google-drive-backup';
import { getAuthContext, canManageSettings, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

interface BackupRequest {
  organizationId: string;
  accessToken: string;
  backupType?: 'MANUAL' | 'AUTO' | 'API';
}

export async function POST(request: NextRequest) {
  try {
    // [보안] 고객 PII 백업은 지사장(OWNER)·시스템관리자(GLOBAL_ADMIN) 전용.
    // 기존엔 인증이 전혀 없어 body의 organizationId만으로 임의 조직 PII를 내보낼 수 있었음(교차조직 유출).
    const ctx = await getAuthContext();
    if (!canManageSettings(ctx)) {
      return NextResponse.json({ ok: false, error: '권한이 없습니다' }, { status: 403 });
    }
    const body = (await request.json()) as BackupRequest;
    const { accessToken, backupType = 'MANUAL' } = body;
    // organizationId는 body를 신뢰하지 않고 본인 조직으로 강제 (GLOBAL_ADMIN만 body로 임의 조직 허용)
    const organizationId = ctx.role === 'GLOBAL_ADMIN'
      ? (body.organizationId ?? ctx.organizationId ?? '')
      : requireOrgId(ctx);

    if (!organizationId || !accessToken) {
      return NextResponse.json(
        {
          ok: false,
          error: 'organizationId와 accessToken이 필요합니다',
        },
        { status: 400 }
      );
    }

    // 1. Contact 조회
    const contacts = await prisma.contact.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        sourceId: true,
        visibility: true,
        createdAt: true,
      },
    });

    if (contacts.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: '백업할 Contact가 없습니다',
        },
        { status: 400 }
      );
    }

    // 2. Google Drive 백업
    const backupResult = await backupContactsToDrive(
      organizationId,
      contacts.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        sourceId: c.sourceId,
        visibility: c.visibility,
        createdAt: c.createdAt,
      })),
      accessToken
    );

    // 3. ContactBackup 레코드 생성
    const backup = await prisma.contactBackup.create({
      data: {
        organizationId,
        backupAt: backupResult.backupAt,
        contactCount: backupResult.count,
        driveSheetId: backupResult.sheetId,
        backupType,
        status: 'SUCCESS',
      },
    });

    logger.info('[contacts/backup] 백업 완료', {
      organizationId,
      backupId: backup.id,
      sheetId: backupResult.sheetId,
      count: contacts.length,
    });

    return NextResponse.json({
      ok: true,
      backup: {
        id: backup.id,
        sheetId: backupResult.sheetId,
        backupAt: backup.backupAt,
        contactCount: backup.contactCount,
      },
    });
  } catch (err) {
    logger.error('[contacts/backup]', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : '백업 실패',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/contacts/backup?organizationId=xxx&limit=10
 * 백업 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    // [보안] 백업 목록도 지사장·관리자 전용 + 본인 조직만
    const ctx = await getAuthContext();
    if (!canManageSettings(ctx)) {
      return NextResponse.json({ ok: false, error: '권한이 없습니다' }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const organizationId = ctx.role === 'GLOBAL_ADMIN'
      ? searchParams.get('organizationId')
      : (ctx.organizationId ?? null);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (!organizationId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'organizationId이 필요합니다',
        },
        { status: 400 }
      );
    }

    // ContactBackup 목록 조회
    const backups = await prisma.contactBackup.findMany({
      where: { organizationId },
      orderBy: { backupAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      ok: true,
      backups: backups.map((b) => ({
        id: b.id,
        backupAt: b.backupAt,
        contactCount: b.contactCount,
        sheetId: b.driveSheetId,
        backupType: b.backupType,
        status: b.status,
        errorMessage: b.errorMessage,
      })),
    });
  } catch (err) {
    logger.error('[contacts/backup GET]', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : '조회 실패',
      },
      { status: 500 }
    );
  }
}
