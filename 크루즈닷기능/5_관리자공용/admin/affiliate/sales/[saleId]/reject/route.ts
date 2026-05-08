export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/sales/[saleId]/reject/route.ts
// 판매 확정 거부 API

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { notifySaleRejected } from '@/lib/affiliate/sales-notification';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth() {
  const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sid) return null;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true, name: true },
        },
      },
    });

    if (!session || !session.User) return null;
    if (session.User.role !== 'admin') return null;
    return session.User;
  } catch (error) {
    console.error('[Reject Sale] Auth error:', error);
    return null;
  }
}

/**
 * POST: 판매 확정 거부
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ saleId: string }> }
) {
  try {
    // 1. 관리자 권한 확인
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    // 2. 판매 ID 확인
    const { saleId: saleIdStr } = await params;
    const saleId = parseInt(saleIdStr);
    if (isNaN(saleId)) {
      return NextResponse.json(
        { ok: false, error: '올바른 판매 ID가 아닙니다' },
        { status: 400 }
      );
    }

    // 3. 거부 사유 받기
    const body = await req.json();
    const { reason } = body;

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: '거부 사유를 입력해주세요' },
        { status: 400 }
      );
    }

    // 4. 판매 정보 확인
    const sale = await prisma.affiliateSale.findUnique({
      where: { id: saleId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!sale) {
      return NextResponse.json(
        { ok: false, error: '판매를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    if (sale.status !== 'PENDING_APPROVAL') {
      return NextResponse.json(
        { ok: false, error: '승인 대기 중인 판매만 거부할 수 있습니다' },
        { status: 400 }
      );
    }

    // 5. 판매 거부 처리
    const updatedSale = await prisma.affiliateSale.update({
      where: { id: saleId },
      data: {
        status: 'REJECTED',
        rejectedById: admin.id,
        rejectedAt: new Date(),
        rejectionReason: reason.trim(),
        // 상태를 PENDING으로 되돌려서 재요청 가능하게
        submittedAt: null,
        submittedById: null,
      },
    });

    // 6. 알림 전송
    try {
      await notifySaleRejected(saleId, reason.trim());
      logger.log(`[Reject Sale] 알림 전송 완료: Sale #${saleId}`);
    } catch (notificationError: any) {
      console.error(`[Reject Sale] 알림 전송 오류:`, notificationError);
      // 알림 실패해도 거부는 완료
    }

    return NextResponse.json({
      ok: true,
      message: '판매가 거부되었습니다',
      sale: {
        id: updatedSale.id,
        status: updatedSale.status,
        rejectionReason: updatedSale.rejectionReason,
      },
    });
  } catch (error: any) {
    console.error('[Reject Sale] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
