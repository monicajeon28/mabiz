export const dynamic = 'force-dynamic';

// app/api/admin/inquiries/[inquiryId]/route.ts
// 구매 문의 삭제 API

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

// DELETE: 구매 문의 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: { inquiryId: string } }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const inquiryId = parseInt(params.inquiryId);
    if (isNaN(inquiryId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid inquiry ID' },
        { status: 400 }
      );
    }

    // ProductInquiry 조회
    const inquiry = await prisma.productInquiry.findUnique({
      where: { id: inquiryId },
    });

    if (!inquiry) {
      return NextResponse.json(
        { ok: false, error: 'Inquiry not found' },
        { status: 404 }
      );
    }

    // 삭제
    await prisma.productInquiry.delete({
      where: { id: inquiryId },
    });

    return NextResponse.json({
      ok: true,
      message: '문의가 삭제되었습니다.',
    });
  } catch (error: any) {
    console.error('[Admin Inquiry Delete] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '삭제 실패' },
      { status: 500 }
    );
  }
}
