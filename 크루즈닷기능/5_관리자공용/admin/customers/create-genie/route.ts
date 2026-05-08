export const dynamic = 'force-dynamic';

// app/api/admin/customers/create-genie/route.ts
// 지니가이드 고객 추가 API (전체 고객 관리용)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cg.sid.v2';

async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;
  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { User: { select: { role: true } } },
    });
    return session?.User?.role === 'admin' || false;
  } catch (error) {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid || !(await checkAdminAuth(sid))) {
      return NextResponse.json({ 
        ok: false, 
        error: '인증이 필요합니다.' 
      }, { status: 403 });
    }

    const { name, phone } = await req.json();

    if (!name || !phone) {
      return NextResponse.json(
        { ok: false, error: '이름과 연락처는 필수입니다.' },
        { status: 400 }
      );
    }

    // 중복 확인 (같은 이름과 전화번호)
    const existing = await prisma.user.findFirst({
      where: {
        name,
        phone,
      },
    });

    if (existing) {
      return NextResponse.json(
        { ok: false, error: '이미 존재하는 고객입니다.' },
        { status: 400 }
      );
    }

    // 지니가이드 고객 생성 (비밀번호 3800)
    const user = await prisma.user.create({
      data: {
        name,
        phone,
        password: '3800',
        role: 'user',
        onboarded: false,
        loginCount: 0,
        tripCount: 0,
        totalTripCount: 0,
      },
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[Admin Create Genie Customer] Error:', error);
    return NextResponse.json(
      { ok: false, error: '고객 추가 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
