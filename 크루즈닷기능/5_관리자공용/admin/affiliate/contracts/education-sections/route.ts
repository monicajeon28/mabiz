export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/contracts/education-sections/route.ts
// 교육 계약서 섹션을 반환하는 API

import { NextRequest, NextResponse } from 'next/server';
import { EDUCATION_CONTRACT_SECTIONS } from '@/lib/affiliate/education-contract-sections';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type') || 'SALES_AGENT';

    const sections = EDUCATION_CONTRACT_SECTIONS[type] || EDUCATION_CONTRACT_SECTIONS['SALES_AGENT'] || [];

    return NextResponse.json({
      ok: true,
      sections,
    });
  } catch (error: any) {
    console.error('[Education Contract Sections API] error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || '교육 계약서 섹션을 가져오는 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
