export const dynamic = 'force-dynamic';

/**
 * 관리자 - 크루즈몰 매출관리 API
 * GET /api/admin/mall-sales
 *
 * 웰컴페이먼츠 결제 내역 조회 및 통계
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

// 관리자 권한 확인
async function verifyAdmin() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return null;

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, name: true, role: true },
  });

  if (!user || !['admin', 'superadmin'].includes(user.role || '')) {
    return null;
  }

  return user;
}

// 상태 라벨 매핑
const STATUS_LABELS: Record<string, string> = {
  pending: '대기중',
  paid: '결제완료',
  completed: '결제완료',
  cancelled: '환불완료',
  failed: '결제실패',
};

export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || '';
    const month = searchParams.get('month') || '';

    // 기본 필터 조건
    const where: any = {};

    // 상태 필터
    if (status !== 'all') {
      where.status = status;
    }

    // 검색 (이름 또는 연락처)
    if (search) {
      where.OR = [
        { buyerName: { contains: search } },
        { buyerTel: { contains: search } },
      ];
    }

    // 월별 필터
    if (month) {
      const [year, monthNum] = month.split('-').map(Number);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);
      where.createdAt = {
        gte: startDate,
        lte: endDate,
      };
    }

    // 전체 개수
    const totalCount = await prisma.payment.count({ where });

    // 결제 내역 조회
    const payments = await prisma.payment.findMany({
      where,
      include: {
        AffiliateSale: {
          select: {
            id: true,
            status: true,
            agentId: true,
            managerId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // 응답 데이터 변환
    const paymentList = payments.map((p) => ({
      id: p.id,
      orderId: p.orderId,
      pgTransactionId: p.pgTransactionId,
      productCode: p.productCode,
      productName: p.productName,
      amount: p.amount,
      customerName: p.buyerName,
      customerPhone: p.buyerTel,
      customerEmail: p.buyerEmail,
      status: p.status,
      statusLabel: STATUS_LABELS[p.status] || p.status,
      pgProvider: p.pgProvider,
      affiliateCode: p.affiliateCode,
      paidAt: p.paidAt?.toISOString() || null,
      cancelledAt: p.cancelledAt?.toISOString() || null,
      failedAt: p.failedAt?.toISOString() || null,
      createdAt: p.createdAt.toISOString(),
      // 어필리에이트 정보
      sale: p.AffiliateSale ? {
        id: p.AffiliateSale.id,
        status: p.AffiliateSale.status,
        agentId: p.AffiliateSale.agentId,
        managerId: p.AffiliateSale.managerId,
      } : null,
    }));

    // 통계 계산
    const statsWhere: any = {};
    if (month) {
      const [year, monthNum] = month.split('-').map(Number);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);
      statsWhere.createdAt = { gte: startDate, lte: endDate };
    }

    // 결제완료 통계
    const paidStats = await prisma.payment.aggregate({
      where: { ...statsWhere, status: 'paid' },
      _sum: { amount: true },
      _count: true,
    });

    // 환불완료 통계
    const cancelledStats = await prisma.payment.aggregate({
      where: { ...statsWhere, status: 'cancelled' },
      _sum: { amount: true },
      _count: true,
    });

    const stats = {
      totalPaid: paidStats._sum.amount || 0,
      totalPaidCount: paidStats._count || 0,
      totalCancelled: cancelledStats._sum.amount || 0,
      totalCancelledCount: cancelledStats._count || 0,
      netSales: (paidStats._sum.amount || 0) - (cancelledStats._sum.amount || 0),
    };

    // 월별 통계 (최근 12개월)
    const monthlyStats = await getMonthlyStats();

    return NextResponse.json({
      ok: true,
      payments: paymentList,
      stats,
      monthlyStats,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    logger.error('[Mall Sales API] Error:', error);
    return NextResponse.json(
      { ok: false, error: '매출 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 월별 통계 조회
async function getMonthlyStats() {
  const results: any[] = [];
  const now = new Date();

  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const dateFilter = { createdAt: { gte: startDate, lte: endDate } };

    const [paid, cancelled] = await Promise.all([
      prisma.payment.aggregate({
        where: { ...dateFilter, status: 'paid' },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { ...dateFilter, status: 'cancelled' },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    results.push({
      year,
      month,
      label: `${year}년 ${month}월`,
      totalPaid: paid._sum.amount || 0,
      paidCount: paid._count || 0,
      totalCancelled: cancelled._sum.amount || 0,
      cancelledCount: cancelled._count || 0,
      netSales: (paid._sum.amount || 0) - (cancelled._sum.amount || 0),
    });
  }

  return results.reverse();
}

// DELETE - 결제 내역 삭제
export async function DELETE(req: NextRequest) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const deleteAll = searchParams.get('deleteAll') === 'true';

    if (deleteAll) {
      // 전체 삭제 (필터 조건 기준)
      const status = searchParams.get('status') || 'all';
      const search = searchParams.get('search') || '';
      const month = searchParams.get('month') || '';

      const where: any = {};

      if (status !== 'all') {
        where.status = status;
      }

      if (search) {
        where.OR = [
          { buyerName: { contains: search } },
          { buyerTel: { contains: search } },
        ];
      }

      if (month) {
        const [year, monthNum] = month.split('-').map(Number);
        const startDate = new Date(year, monthNum - 1, 1);
        const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);
        where.createdAt = { gte: startDate, lte: endDate };
      }

      // 관련 AffiliateSale 먼저 삭제
      const paymentsToDelete = await prisma.payment.findMany({
        where,
        select: { id: true },
      });
      const paymentIds = paymentsToDelete.map((p) => p.id);

      if (paymentIds.length > 0) {
        // AffiliateSale 삭제
        await prisma.affiliateSale.deleteMany({
          where: { paymentId: { in: paymentIds } },
        });

        // Payment 삭제
        const result = await prisma.payment.deleteMany({ where });

        logger.log(`[Mall Sales DELETE] Admin ${admin.id} deleted ${result.count} payments (all with filters)`);

        return NextResponse.json({
          ok: true,
          deletedCount: result.count,
          message: `${result.count}건이 삭제되었습니다.`,
        });
      }

      return NextResponse.json({
        ok: true,
        deletedCount: 0,
        message: '삭제할 항목이 없습니다.',
      });
    } else {
      // 선택 삭제
      const body = await req.json();
      const { ids } = body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json(
          { ok: false, error: '삭제할 항목을 선택해주세요.' },
          { status: 400 }
        );
      }
      if (ids.length > 200) {
        return NextResponse.json(
          { ok: false, error: '한 번에 최대 200건까지 삭제할 수 있습니다.' },
          { status: 400 }
        );
      }
      if (!ids.every((id: unknown) => typeof id === 'number' && Number.isInteger(id) && id > 0)) {
        return NextResponse.json(
          { ok: false, error: '잘못된 결제 ID가 포함되어 있습니다.' },
          { status: 400 }
        );
      }

      // AffiliateSale 먼저 삭제
      await prisma.affiliateSale.deleteMany({
        where: { paymentId: { in: ids } },
      });

      // Payment 삭제
      const result = await prisma.payment.deleteMany({
        where: { id: { in: ids } },
      });

      logger.log(`[Mall Sales DELETE] Admin ${admin.id} deleted ${result.count} payments (selected ids count: ${ids.length})`);

      return NextResponse.json({
        ok: true,
        deletedCount: result.count,
        message: `${result.count}건이 삭제되었습니다.`,
      });
    }
  } catch (error) {
    logger.error('[Mall Sales DELETE] Error:', error);
    return NextResponse.json(
      { ok: false, error: '삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
