export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * GET /api/partner/customers/excel/sample
 * 엑셀 샘플 파일 다운로드
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    // 샘플 데이터 생성
    const sampleData = [
      {
        이름: '홍길동',
        연락처: '010-1234-5678',
      },
      {
        이름: '김철수',
        연락처: '010-2345-6789',
      },
      {
        이름: '이영희',
        연락처: '010-3456-7890',
      },
    ];

    // 엑셀 워크북 생성
    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '고객 목록');

    // 엑셀 파일 버퍼 생성
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 파일명 생성
    const fileName = `고객_목록_샘플.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (error) {
    console.error('[Partner Customers Excel Sample] GET error:', error);
    return NextResponse.json(
      { ok: false, message: '샘플 파일 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
