export const dynamic = 'force-dynamic';

export const runtime = 'nodejs'; // Edge Runtime 금지 (xlsx 라이브러리 사용)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import * as XLSX from 'xlsx';

/**
 * POST /api/partner/customers/parse-excel
 * 엑셀 파일 파싱 (고객 정보 추출)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { profile } = await requirePartnerContext();
    
    // 대리점장만 가능
    if (profile.type !== 'BRANCH_MANAGER') {
      return NextResponse.json({ ok: false, error: 'Only branch managers can parse excel' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ ok: false, error: '파일이 필요합니다.' }, { status: 400 });
    }

    // 엑셀 파일 읽기
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

    if (jsonData.length === 0) {
      return NextResponse.json({ ok: false, error: '엑셀 파일에 데이터가 없습니다.' }, { status: 400 });
    }

    // 데이터 파싱
    const customers = jsonData
      .map(row => ({
        name: String(row['이름'] || row['name'] || row['Name'] || '').trim(),
        phone: String(row['연락처'] || row['전화번호'] || row['phone'] || row['Phone'] || '').trim(),
        email: String(row['이메일'] || row['email'] || row['Email'] || '').trim() || '',
        notes: String(row['비고'] || row['notes'] || row['Notes'] || '').trim() || '',
      }))
      .filter(item => item.name && item.phone);

    return NextResponse.json({
      ok: true,
      customers,
      total: customers.length,
    });
  } catch (error: any) {
    console.error('[Partner Parse Excel] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '엑셀 파일 파싱 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
