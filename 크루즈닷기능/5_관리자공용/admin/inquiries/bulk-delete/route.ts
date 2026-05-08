export const dynamic = 'force-dynamic';

// app/api/admin/inquiries/bulk-delete/route.ts
// 구매 문의 일괄 삭제 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cg.sid.v2';

async function checkAdminAuth() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return null;
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { User: true },
    });

    if (session && session.User.role === 'admin') {
      return session.User;
    }
  } catch (error) {
    console.error('[Admin Auth] Error:', error);
  }

  return null;
}

// POST: 구매 문의 일괄 삭제
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { inquiryIds } = await req.json();

    if (!inquiryIds || !Array.isArray(inquiryIds) || inquiryIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: '삭제할 문의를 선택해주세요.' },
        { status: 400 }
      );
    }

    // 모든 ID가 숫자인지 확인
    const validIds = inquiryIds.filter((id: any) => typeof id === 'number' && !isNaN(id));
    if (validIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 문의 ID입니다.' },
        { status: 400 }
      );
    }

    // 일괄 삭제
    const result = await prisma.productInquiry.deleteMany({
      where: {
        id: { in: validIds },
      },
    });

    return NextResponse.json({
      ok: true,
      message: `${result.count}개의 문의가 삭제되었습니다.`,
      deletedCount: result.count,
    });
  } catch (error: any) {
    console.error('[Admin Inquiry Bulk Delete] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '일괄 삭제 실패' },
      { status: 500 }
    );
  }
}
