export const dynamic = 'force-dynamic';

/**
 * 관리자 - 랜딩페이지 매출관리 API
 * GET /api/admin/payapp-sales - 매출 목록 및 통계 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getPayTypeName } from '@/lib/payapp';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 쿼리 파라미터
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status'); // paid, refunded, all
    const landingPageId = searchParams.get('landingPageId');
    const search = searchParams.get('search'); // 이름, 연락처 검색
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const month = searchParams.get('month'); // YYYY-MM 형식

    // WHERE 조건 구성
    const where: any = {};

    if (status && status !== 'all') {
      where.status = status;
    }

    if (landingPageId) {
      where.landingPageId = parseInt(landingPageId);
    }

    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search.replace(/-/g, '') } },
      ];
    }

    // 날짜 필터
    if (month) {
      const [year, mon] = month.split('-').map(Number);
      const monthStart = new Date(year, mon - 1, 1);
      const monthEnd = new Date(year, mon, 0, 23, 59, 59, 999);
      where.createdAt = {
        gte: monthStart,
        lte: monthEnd,
      };
    } else {
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate + 'T23:59:59.999Z');
        }
      }
    }

    // 매출 목록 조회
    const [payments, totalCount] = await Promise.all([
      prisma.payAppPayment.findMany({
        where,
        include: {
          LandingPage: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payAppPayment.count({ where }),
    ]);

    // 통계 계산 (paid 상태만)
    const paidWhere = { ...where, status: 'paid' };
    const refundedWhere = { ...where, status: { in: ['refunded', 'partial_refunded'] } };

    const [paidStats, refundedStats, monthlyStats] = await Promise.all([
      // 결제 완료 통계
      prisma.payAppPayment.aggregate({
        where: paidWhere,
        _sum: { amount: true },
        _count: true,
      }),
      // 환불 통계
      prisma.payAppPayment.aggregate({
        where: refundedWhere,
        _sum: { refundAmount: true },
        _count: true,
      }),
      // 월별 통계 (최근 12개월)
      getMonthlyStats(),
    ]);

    // 응답 데이터 가공
    const formattedPayments = payments.map((p) => ({
      id: p.id,
      orderId: p.orderId,
      mulNo: p.mulNo,
      landingPageId: p.landingPageId,
      landingPageTitle: p.LandingPage?.title || '삭제된 페이지',
      landingPageSlug: p.LandingPage?.slug,
      productName: p.productName,
      amount: p.amount,
      customerName: p.customerName,
      customerPhone: p.customerPhone,
      customerEmail: p.customerEmail,
      status: p.status,
      statusLabel: getStatusLabel(p.status),
      payType: p.payType,
      payTypeName: p.payType ? getPayTypeName(p.payType) : null,
      cardName: p.cardName,
      paidAt: p.paidAt,
      cancelledAt: p.cancelledAt,
      refundedAt: p.refundedAt,
      refundAmount: p.refundAmount,
      refundReason: p.refundReason,
      createdAt: p.createdAt,
    }));

    return NextResponse.json({
      ok: true,
      payments: formattedPayments,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats: {
        totalPaid: paidStats._sum.amount || 0,
        totalPaidCount: paidStats._count || 0,
        totalRefunded: refundedStats._sum.refundAmount || 0,
        totalRefundedCount: refundedStats._count || 0,
        netSales: (paidStats._sum.amount || 0) - (refundedStats._sum.refundAmount || 0),
      },
      monthlyStats,
    });
  } catch (error: any) {
    console.error('[Admin PayApp Sales] 조회 오류:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || '매출 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 상태 라벨
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '대기중',
    requested: '결제요청',
    waiting: '입금대기',
    paid: '결제완료',
    cancelled: '취소',
    refunded: '환불완료',
    partial_refunded: '부분환불',
    failed: '실패',
  };
  return labels[status] || status;
}

// 월별 통계 (최근 12개월)
async function getMonthlyStats() {
  const now = new Date();
  const stats = [];

  for (let i = 0; i < 12; i++) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const [paid, refunded] = await Promise.all([
      prisma.payAppPayment.aggregate({
        where: {
          status: 'paid',
          paidAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payAppPayment.aggregate({
        where: {
          status: { in: ['refunded', 'partial_refunded'] },
          refundedAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { refundAmount: true },
        _count: true,
      }),
    ]);

    stats.push({
      year,
      month: month + 1,
      label: `${year}-${String(month + 1).padStart(2, '0')}`,
      totalPaid: paid._sum.amount || 0,
      paidCount: paid._count || 0,
      totalRefunded: refunded._sum.refundAmount || 0,
      refundedCount: refunded._count || 0,
      netSales: (paid._sum.amount || 0) - (refunded._sum.refundAmount || 0),
    });
  }

  return stats.reverse(); // 오래된 순으로 정렬
}

// DELETE - 결제 내역 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deleteAll = searchParams.get('deleteAll') === 'true';

    if (deleteAll) {
      // 전체 삭제 (필터 조건 기준)
      const status = searchParams.get('status') || 'all';
      const search = searchParams.get('search') || '';
      const month = searchParams.get('month') || '';

      const where: any = {};

      if (status && status !== 'all') {
        where.status = status;
      }

      if (search) {
        where.OR = [
          { customerName: { contains: search, mode: 'insensitive' } },
          { customerPhone: { contains: search.replace(/-/g, '') } },
        ];
      }

      if (month) {
        const [year, mon] = month.split('-').map(Number);
        const monthStart = new Date(year, mon - 1, 1);
        const monthEnd = new Date(year, mon, 0, 23, 59, 59, 999);
        where.createdAt = { gte: monthStart, lte: monthEnd };
      }

      const result = await prisma.payAppPayment.deleteMany({ where });

      console.log(`[PayApp Sales DELETE] Deleted ${result.count} payments (all with filters)`);

      return NextResponse.json({
        ok: true,
        deletedCount: result.count,
        message: `${result.count}건이 삭제되었습니다.`,
      });
    } else {
      // 선택 삭제
      const body = await request.json();
      const { ids } = body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json(
          { ok: false, error: '삭제할 항목을 선택해주세요.' },
          { status: 400 }
        );
      }

      const result = await prisma.payAppPayment.deleteMany({
        where: { id: { in: ids } },
      });

      console.log(`[PayApp Sales DELETE] Deleted ${result.count} payments (selected: ${ids.join(', ')})`);

      return NextResponse.json({
        ok: true,
        deletedCount: result.count,
        message: `${result.count}건이 삭제되었습니다.`,
      });
    }
  } catch (error: any) {
    console.error('[PayApp Sales DELETE] 삭제 오류:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || '삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
