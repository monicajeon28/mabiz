import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';

/**
 * DELETE /api/unsubscribed/[id]
 * 수신거부 해제 (RBAC: ADMIN 이상)
 *
 * 권한:
 * - ADMIN: 자신의 조직 + 전체 조직
 * - GLOBAL_ADMIN: 전체 조직
 *
 * 응답:
 * {
 *   ok: true,
 *   message: "수신거부가 해제되었습니다."
 * }
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. 인증 확인
    const session = await getMabizSession();
    if (!session?.userId) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. 권한 확인 (OWNER/GLOBAL_ADMIN만 삭제 가능)
    const allowedRoles = ['OWNER', 'GLOBAL_ADMIN'];
    if (!allowedRoles.includes(session.role)) {
      // 감사 로깅: 권한 없음 시도
      logger.warn('[UnsubscribedDelete] 권한 없음', {
        userId: session.userId,
        userRole: session.role,
        organizationId: session.organizationId,
        targetId: params.id,
      });
      return NextResponse.json(
        {
          ok: false,
          error: 'Only admins can remove unsubscribed entries',
        },
        { status: 403 }
      );
    }

    // 3. 레코드 확인 (반드시 자신의 조직!)
    const record = await prisma.unsubscribed.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        organizationId: true,
        phone: true,
        name: true,
        createdBy: true,
      },
    });

    if (!record) {
      return NextResponse.json(
        { ok: false, error: 'Not found' },
        { status: 404 }
      );
    }

    // 4. 권한 재확인 (자신의 조직인지 - IDOR 차단)
    if (
      record.organizationId !== session.organizationId &&
      session.role !== 'GLOBAL_ADMIN'
    ) {
      // 감사 로깅: IDOR 시도 감지
      logger.error('[UnsubscribedDelete] IDOR 시도 감지', {
        userId: session.userId,
        userRole: session.role,
        userOrgId: session.organizationId,
        recordOrgId: record.organizationId,
        targetId: params.id,
      });
      return NextResponse.json(
        { ok: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 5. 삭제 실행
    await prisma.unsubscribed.delete({
      where: { id: params.id },
    });

    // 6. 감사 로깅
    logger.warn('[UnsubscribedDelete] 거부 해제', {
      organizationId: record.organizationId,
      userId: session.userId,
      role: session.role,
      unsubscribedId: params.id,
      phone: maskPhone(record.phone),
      name: record.name,
      originalCreatedBy: record.createdBy,
      reason: 'Admin manually removed',
    });

    // 7. 응답
    return NextResponse.json({
      ok: true,
      message: '수신거부가 해제되었습니다.',
    });
  } catch (error) {
    logger.error('[UnsubscribedDelete] 에러:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : '해제 실패',
      },
      { status: 500 }
    );
  }
}

/**
 * 전화번호 마스킹 (로깅용)
 */
function maskPhone(phone: string): string {
  if (!phone || phone.length < 8) return phone;
  if (phone.includes('-')) {
    const parts = phone.split('-');
    if (parts.length === 3) {
      return `${parts[0]}-****-${parts[2]}`;
    }
  }
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}
