export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return null;
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true, name: true },
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
    console.error('[Prospects] Auth check error:', error);
    return null;
  }
}

// PUT: 잠재고객 수정
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const { id: idStr } = await params; const id = parseInt(idStr);
    const body = await req.json();
    const { name, email, phone, source, notes, tags, isActive } = body;

    // 모든 필드가 선택사항이므로 검증 제거

    // 중복 확인 (이메일 또는 전화번호로, 자기 자신 제외)
    let existing = null;
    if (email) {
      existing = await prisma.prospect.findFirst({
        where: {
          email,
          id: { not: id },
        },
      });
    } else if (phone) {
      existing = await prisma.prospect.findFirst({
        where: {
          phone,
          email: null,
          id: { not: id },
        },
      });
    }

    if (existing) {
      return NextResponse.json(
        { ok: false, error: '이미 등록된 연락처입니다.' },
        { status: 400 }
      );
    }

    const prospect = await prisma.prospect.update({
      where: { id },
      data: {
        name: name || null,
        email: email || null, // 이메일이 없을 수 있음
        phone: phone || null,
        source: source || null,
        notes: notes || null,
        tags: tags && tags.length > 0 ? tags : null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json({ ok: true, prospect });
  } catch (error) {
    console.error('[Prospects PUT] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to update prospect' },
      { status: 500 }
    );
  }
}

// DELETE: 잠재고객 삭제
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const { id: idStr } = await params; const id = parseInt(idStr);

    await prisma.prospect.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Prospects DELETE] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to delete prospect' },
      { status: 500 }
    );
  }
}
