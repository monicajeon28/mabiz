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

// GET: 이메일 주소록 목록 조회
export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const skip = (page - 1) * limit;

    const where: any = {
      adminId: admin.id,
    };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { memo: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.emailAddressBook.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.emailAddressBook.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('[Email Address Book] GET error:', error);
    return NextResponse.json(
      { ok: false, error: '이메일 주소록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 이메일 주소록 항목 추가
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, phone, memo } = body;

    if (!email) {
      return NextResponse.json({ ok: false, error: '이메일 주소는 필수입니다.' }, { status: 400 });
    }

    const item = await prisma.emailAddressBook.create({
      data: {
        adminId: admin.id,
        name: name || null,
        email,
        phone: phone || null,
        memo: memo || null,
      },
    });

    return NextResponse.json({ ok: true, item });
  } catch (error: any) {
    console.error('[Email Address Book] POST error:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ ok: false, error: '이미 존재하는 이메일 주소입니다.' }, { status: 400 });
    }
    return NextResponse.json(
      { ok: false, error: '이메일 주소록 항목을 추가하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
