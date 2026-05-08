export const dynamic = 'force-dynamic';

// app/api/admin/inquiries/[inquiryId]/status/route.ts
// 구매 문의 상태 변경 API

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

export async function PUT(
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

    const body = await req.json();
    const { status } = body;

    // 유효한 상태 값 확인
    const validStatuses = ['pending', 'unavailable', 'passport_waiting', 'confirmed', 'refund'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid status' },
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

    // 상태 업데이트
    await prisma.productInquiry.update({
      where: { id: inquiryId },
      data: { status },
    });

    return NextResponse.json({
      ok: true,
      message: '상태가 변경되었습니다.',
      status,
    });
  } catch (error: any) {
    console.error('[Admin Inquiry Status Update] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '상태 변경 실패' },
      { status: 500 }
    );
  }
}
