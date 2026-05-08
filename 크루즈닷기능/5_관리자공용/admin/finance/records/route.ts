import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, AdminAuthError } from '@/lib/auth/requireAdmin';

// GET: 월별 기록 조회
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    // 특정 월 조회
    if (year && month) {
      const record = await prisma.financeRecord.findFirst({
        where: {
          year: parseInt(year),
          month: parseInt(month),
        },
      });

      return NextResponse.json({ record });
    }

    // 전체 목록 조회
    const records = await prisma.financeRecord.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 24, // 최근 2년
    });

    return NextResponse.json({ records });
  } catch (error) {
    console.error('Failed to get finance records:', error);
    return NextResponse.json(
      { error: '기록 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 월별 기록 저장
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { year, month, sales, commission, fixedCosts, variableCosts, result, budget } = body;

    // 기존 기록 확인
    const existing = await prisma.financeRecord.findFirst({
      where: { year, month },
    });

    const data = {
      year,
      month,
      salesData: sales,
      commissionData: commission,
      fixedCostsData: fixedCosts,
      variableCostsData: variableCosts,
      resultData: result,
      budgetData: budget || null,
      updatedAt: new Date(),
    };

    let record;
    if (existing) {
      // 업데이트
      record = await prisma.financeRecord.update({
        where: { id: existing.id },
        data,
      });
    } else {
      // 신규 생성
      record = await prisma.financeRecord.create({
        data: {
          ...data,
          createdAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      record: {
        id: record.id,
        year: record.year,
        month: record.month,
        sales: record.salesData,
        commission: record.commissionData,
        fixedCosts: record.fixedCostsData,
        variableCosts: record.variableCostsData,
        result: record.resultData,
        budget: record.budgetData,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        backedUpAt: record.backedUpAt,
      },
    });
  } catch (error) {
    console.error('Failed to save finance record:', error);
    return NextResponse.json(
      { error: '기록 저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}
