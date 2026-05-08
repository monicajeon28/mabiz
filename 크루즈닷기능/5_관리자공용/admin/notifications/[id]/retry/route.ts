export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { syncSaleCommissionLedgers } from '@/lib/affiliate/commission-ledger';
import { parseMetadataObject } from '@/lib/utils/metadata-parser';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. 인증 + 권한 검증
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    // DB에서 관리자 역할 재검증
    const admin = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true },
    });

    if (!admin || !['admin', 'superadmin'].includes(admin.role ?? '')) {
      logger.error('[Retry API] Unauthorized', {
        userId: sessionUser.id,
        role: admin?.role,
      });
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    // 2. 파라미터 파싱
    const { id } = await params;
    const notificationId = parseInt(id, 10);

    if (Number.isNaN(notificationId)) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 알림 ID' },
        { status: 400 }
      );
    }

    // 3. 알림 조회
    const notification = await prisma.adminNotification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return NextResponse.json(
        { ok: false, error: '알림을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 4. 알림 유형 검증
    if (notification.notificationType !== 'COMMISSION_SYNC_FAILED') {
      logger.debug('[Retry API] 재처리 불가능한 알림 유형', {
        notificationId,
        notificationType: notification.notificationType,
      });
      return NextResponse.json(
        { ok: false, error: '재처리 불가능한 알림 유형' },
        { status: 400 }
      );
    }

    // 5. metadata에서 saleId 추출 (타입 안전성)
    const metadata = parseMetadataObject(notification.metadata);
    const saleId = metadata.saleId;

    if (typeof saleId !== 'number' || Number.isNaN(saleId)) {
      logger.error('[Retry API] Invalid saleId in metadata', {
        notificationId,
        saleId,
      });
      return NextResponse.json(
        { ok: false, error: 'Invalid saleId in metadata' },
        { status: 400 }
      );
    }

    // 6. 즉시 응답 반환 (비동기 재처리 예약)
    logger.debug('[Retry API] 재처리 시작', {
      notificationId,
      saleId,
      adminId: sessionUser.id,
    });

    // 비동기 재처리 시작 (응답 대기 없음)
    retryCommissionSync(notificationId, saleId, sessionUser.id);

    return NextResponse.json({
      ok: true,
      message: '재처리가 시작되었습니다',
    });
  } catch (error) {
    logger.error('[Retry API] 오류', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: '서버 오류' },
      { status: 500 }
    );
  }
}

/**
 * 비동기 재처리 함수 (fire-and-forget)
 */
async function retryCommissionSync(
  notificationId: number,
  saleId: number,
  adminId: number
): Promise<void> {
  try {
    await syncSaleCommissionLedgers(saleId, {
      maxRetries: 3,
      retryDelay: 5000,
    });

    // 성공 시 알림 읽음 표시
    await prisma.adminNotification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    logger.debug('[Commission Sync Retry] 성공', {
      notificationId,
      saleId,
      adminId,
    });
  } catch (error) {
    logger.error('[Commission Sync Retry] 재처리 실패', {
      notificationId,
      saleId,
      adminId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
