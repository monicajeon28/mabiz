// app/api/admin/affiliate/excel-backup/route.ts
// 관리자 패널에서 엑셀 백업 트리거

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { uploadAllExcels, uploadCashflowExcel, uploadTotalcashExcel } from '@/lib/affiliate/excel-backup';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      return NextResponse.json({ error: '인증되지 않음' }, { status: 401 });
    }

    // 관리자 권한 확인
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true }
    });

    const isAdmin = user?.role === 'ADMIN' || user?.role === 'admin';
    if (!isAdmin) {
      return NextResponse.json({ error: '권한 없음' }, { status: 403 });
    }

    const body = await request.json();
    const { period, type } = body; // period: "YYYY-MM", type: "cashflow" | "totalcash" | "all"

    if (!period) {
      return NextResponse.json({ error: '기간(period)이 필요합니다' }, { status: 400 });
    }

    // 기간 형식 검증 (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ error: '잘못된 기간 형식입니다. YYYY-MM 형식을 사용하세요.' }, { status: 400 });
    }

    let results: any;

    switch (type) {
      case 'cashflow':
        results = await uploadCashflowExcel(period);
        break;
      case 'totalcash':
        results = await uploadTotalcashExcel(period);
        break;
      case 'all':
      default:
        results = await uploadAllExcels(period);
        break;
    }

    return NextResponse.json({
      success: true,
      period,
      type,
      results,
    });
  } catch (error: any) {
    console.error('[Excel Backup API] Error:', error);
    return NextResponse.json(
      {
        error: '엑셀 백업 실패',
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}

// 백업 상태 조회 (옵션)
export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      return NextResponse.json({ error: '인증되지 않음' }, { status: 401 });
    }

    // 관리자 권한 확인
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true }
    });

    const isAdmin = user?.role === 'ADMIN' || user?.role === 'admin';
    if (!isAdmin) {
      return NextResponse.json({ error: '권한 없음' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period');

    if (!period) {
      return NextResponse.json({ error: '기간(period)이 필요합니다' }, { status: 400 });
    }

    // 여기서는 단순히 가능한 백업 정보를 반환
    // 실제로는 Google Drive에서 파일 목록을 가져올 수 있음
    return NextResponse.json({
      period,
      cashflowUrl: `https://drive.google.com/drive/folders/1kv9XlTFLh8QqTlDvakwaxB_LtTQxv6Hx`,
      totalcashUrl: `https://drive.google.com/drive/folders/1GC4hwjkVNqUmBGhaE5PmldoMr0WUEkGo`,
    });
  } catch (error: any) {
    console.error('[Excel Backup API GET] Error:', error);
    return NextResponse.json(
      {
        error: '백업 상태 조회 실패',
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
