export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth';
import { runFullCustomerBackup } from '@/lib/google/customer-backup';

/**
 * 고객 데이터 Google 스프레드시트 백업 API
 * POST /api/admin/backup/customers
 *
 * 전체 고객 + 뱃지별 + 담당자별 + 상담기록(녹음파일 링크 포함)을 백업합니다.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await checkAdminAuth();

    if (!auth.isAdmin) {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다.' },
        { status: 401 }
      );
    }

    console.log('[Customer Backup API] Manual backup requested by:', auth.user?.id);

    // 고객 백업 실행
    const result = await runFullCustomerBackup();

    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: result.error || '백업 중 오류가 발생했습니다.',
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: '고객 데이터 백업이 완료되었습니다.',
      summary: result.summary,
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/11_cfi841QGIDaBmYdjdk3aHYp2UYpCnx1QVVrgV7QJY/edit',
    });
  } catch (error: any) {
    console.error('[Customer Backup API] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || '백업 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}

/**
 * 백업 상태 확인
 * GET /api/admin/backup/customers
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await checkAdminAuth();

    if (!auth.isAdmin) {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      ok: true,
      spreadsheetId: '11_cfi841QGIDaBmYdjdk3aHYp2UYpCnx1QVVrgV7QJY',
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/11_cfi841QGIDaBmYdjdk3aHYp2UYpCnx1QVVrgV7QJY/edit',
      sheets: [
        '전체 고객',
        '3일체험',
        '지니체험',
        'B2B유입',
        'B2B시스템',
        '크루즈몰',
        '전화문의',
        '랜딩유입',
        '구매확정',
        '환불',
        '재구매',
        '담당자별 고객',
        '상담기록',
      ],
      description: '상담기록 추가/수정 시 자동으로 백업됩니다.',
    });
  } catch (error: any) {
    console.error('[Customer Backup API] GET Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
