/**
 * POST /api/backup/contacts/[id]/restore
 *
 * Contact 백업 복구 API
 * - 지정된 Contact 복구
 * - 권한 검증 (OWNER 이상)
 * - 트랜잭션 보호 (DB 일관성)
 * - ContactBackupRestoreLog 감사 기록
 *
 * 요청본문:
 * {
 *   "fields": ["phone", "email", "name"], // 복구할 필드 목록 (선택사항)
 *   "backupId": "backup-id" // 특정 백업에서 복구 (선택사항)
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getAuthContext } from '@/lib/rbac';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 인증 확인
    const ctx = await getAuthContext();
    if (!ctx) {
      return NextResponse.json(
        { ok: false, error: '인증 필요' },
        { status: 401 }
      );
    }

    const contactId = params.id;
    const { fields = [], backupId } = await req.json();

    // Contact 존재 확인 + 권한 검증
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        organizationId: true,
        name: true,
        phone: true,
        email: true,
        deletedAt: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { ok: false, error: 'Contact 없음' },
        { status: 404 }
      );
    }

    // 조직 확인
    if (contact.organizationId !== ctx.organizationId) {
      return NextResponse.json(
        { ok: false, error: '권한 없음' },
        { status: 403 }
      );
    }

    // 역할 권한 검증 (OWNER/ADMIN만)
    if (!['OWNER', 'ADMIN'].includes(ctx.role)) {
      return NextResponse.json(
        { ok: false, error: '권한 없음' },
        { status: 403 }
      );
    }

    // 트랜잭션으로 복구 처리
    const result = await prisma.$transaction(async (tx) => {
      // 현재 Contact 상태 스냅샷 (이전 상태 저장용)
      const previousState = {
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
      };

      // 복구 데이터 (실제 구현에서는 백업 저장소에서 조회)
      // 현재는 deletedAt를 null로 설정하는 기본 복구만 구현
      const updateData: Record<string, unknown> = {
        deletedAt: null,
        deletedBy: null,
        deletedByName: null,
      };

      // 필드별 복구 (필드 리스트가 지정된 경우)
      if (fields.length > 0) {
        // TODO: 백업 저장소에서 필드별 이전 값 조회
        // 현재는 placeholder
      }

      // Contact 업데이트
      const restored = await tx.contact.update({
        where: { id: contactId },
        data: updateData,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          updatedAt: true,
        },
      });

      // 복구 로그 기록
      const restoreLog = await tx.contactBackupRestoreLog.create({
        data: {
          organizationId: contact.organizationId,
          contactId,
          backupId: backupId || null,
          restoredBy: ctx.userId,
          restoredByName: ctx.member?.displayName || '알 수 없음',
          restoredAt: new Date(),
          status: 'SUCCESS',
          restoredFields: JSON.stringify(
            fields.length > 0 ? fields : ['deletedAt', 'deletedBy', 'deletedByName']
          ),
        },
        select: {
          id: true,
          restoredAt: true,
          restoredFields: true,
        },
      });

      return {
        contact: restored,
        restoreLog,
        previousState,
      };
    });

    logger.info(`[POST /api/backup/contacts/[id]/restore] 복구 완료: ${contactId}`, {
      organizationId: contact.organizationId,
      restoredBy: ctx.userId,
      restoreLogId: result.restoreLog.id,
    });

    return NextResponse.json({
      ok: true,
      message: 'Contact 복구 완료',
      data: {
        contact: result.contact,
        restoreLog: result.restoreLog,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[POST /api/backup/contacts/[id]/restore]', err);

    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { ok: false, error: '잘못된 요청본문' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: 'Contact 복구 실패',
        message: err instanceof Error ? err.message : '',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/backup/contacts/[id]/restore/logs
 *
 * Contact 복구 이력 조회
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 인증 확인
    const ctx = await getAuthContext();
    if (!ctx) {
      return NextResponse.json(
        { ok: false, error: '인증 필요' },
        { status: 401 }
      );
    }

    const contactId = params.id;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Contact 존재 확인 + 권한 검증
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { organizationId: true },
    });

    if (!contact) {
      return NextResponse.json(
        { ok: false, error: 'Contact 없음' },
        { status: 404 }
      );
    }

    // 조직 확인
    if (contact.organizationId !== ctx.organizationId) {
      return NextResponse.json(
        { ok: false, error: '권한 없음' },
        { status: 403 }
      );
    }

    // 복구 로그 조회
    const [logs, total] = await Promise.all([
      prisma.contactBackupRestoreLog.findMany({
        where: { contactId },
        select: {
          id: true,
          restoredBy: true,
          restoredByName: true,
          restoredAt: true,
          status: true,
          restoredFields: true,
          errorMessage: true,
        },
        orderBy: { restoredAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.contactBackupRestoreLog.count({
        where: { contactId },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        logs,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[GET /api/backup/contacts/[id]/restore/logs]', err);

    return NextResponse.json(
      {
        ok: false,
        error: '복구 이력 조회 실패',
        message: err instanceof Error ? err.message : '',
      },
      { status: 500 }
    );
  }
}
