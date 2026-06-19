import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, buildContactWhere, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/contacts/[id]/audit-logs
 * Contact의 변경 이력을 시간 역순으로 조회
 *
 * Query params:
 *   - limit: 한 번에 조회할 최대 개수 (기본값: 50)
 *   - offset: 건너뛸 개수 (기본값: 0)
 *   - action: 필터링할 액션 (CREATE, UPDATE, DELETE, IMPORT)
 */
export async function GET(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;

    // 쿼리 파라미터 파싱
    const url = new URL(req.url);
    const rawLimit = parseInt(url.searchParams.get('limit') || '50', 10);
    const limit = Math.min(Number.isNaN(rawLimit) ? 50 : rawLimit, 1000);
    const rawOffset = parseInt(url.searchParams.get('offset') || '0', 10);
    const offset = Math.max(0, Number.isNaN(rawOffset) ? 0 : rawOffset);
    const action = url.searchParams.get('action');

    // Contact 존재 여부 + 권한 검사
    const where = buildContactWhere(ctx, { id });
    const contact = await prisma.contact.findFirst({ where });

    if (!contact) {
      return NextResponse.json(
        { ok: false, message: 'Contact를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 조직 권한 재확인
    const orgId = resolveOrgId(ctx);
    if (contact.organizationId !== orgId) {
      return NextResponse.json(
        { ok: false, message: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    // Audit logs 조회
    const [logs, total] = await Promise.all([
      prisma.contactAuditLog.findMany({
        where: {
          contactId: id,
          organizationId: orgId,
          ...(action ? { action } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.contactAuditLog.count({
        where: {
          contactId: id,
          organizationId: orgId,
          ...(action ? { action } : {}),
        },
      }),
    ]);

    // 응답 포맷
    const formattedLogs = logs.map((log: any) => ({
      id: log.id,
      action: log.action,
      fieldChanged: log.fieldChanged,
      oldValue: log.oldValue ? JSON.parse(log.oldValue) : null,
      newValue: log.newValue ? JSON.parse(log.newValue) : null,
      userId: log.userId,
      reason: log.reason,
      createdAt: log.createdAt.toISOString(),
    }));

    return NextResponse.json({
      ok: true,
      logs: formattedLogs,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (err) {
    logger.error('[GET /api/contacts/[id]/audit-logs]', { err });
    return NextResponse.json(
      { ok: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
