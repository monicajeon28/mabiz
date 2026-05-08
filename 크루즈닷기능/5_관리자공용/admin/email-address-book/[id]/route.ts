export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/auth';
import prisma from '@/lib/prisma';

async function checkAdminAuth() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sid) return null;

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    if (!session || !session.User || session.User.role !== 'admin') {
      return null;
    }

    return {
      id: session.User.id,
      name: session.User.name,
      role: session.User.role,
    };
  } catch (error) {
    console.error('[Email Address Book] Auth check error:', error);
    return null;
  }
}

// PUT: 이메일 주소록 항목 수정
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const { id: idStr } = await params;
    const id = parseInt(idStr);
    const body = await req.json();
    const { name, email, phone, memo } = body;

    if (!email) {
      return NextResponse.json({ ok: false, error: '이메일 주소는 필수입니다.' }, { status: 400 });
    }

    // 권한 확인 (본인이 생성한 항목만 수정 가능)
    const existing = await prisma.emailAddressBook.findUnique({
      where: { id },
    });

    if (!existing || existing.adminId !== admin.id) {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const item = await prisma.emailAddressBook.update({
      where: { id },
      data: {
        name: name || null,
        email,
        phone: phone || null,
        memo: memo || null,
      },
    });

    return NextResponse.json({ ok: true, item });
  } catch (error: any) {
    console.error('[Email Address Book] PUT error:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ ok: false, error: '이미 존재하는 이메일 주소입니다.' }, { status: 400 });
    }
    return NextResponse.json(
      { ok: false, error: '이메일 주소록 항목을 수정하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 이메일 주소록 항목 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const { id: idStr } = await params;
    const id = parseInt(idStr);

    // 권한 확인 (본인이 생성한 항목만 삭제 가능)
    const existing = await prisma.emailAddressBook.findUnique({
      where: { id },
    });

    if (!existing || existing.adminId !== admin.id) {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    await prisma.emailAddressBook.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Email Address Book] DELETE error:', error);
    return NextResponse.json(
      { ok: false, error: '이메일 주소록 항목을 삭제하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
