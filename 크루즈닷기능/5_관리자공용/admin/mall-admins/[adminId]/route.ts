export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { role: true },
        },
      },
    });

    return session?.User?.role === 'admin' || false;
  } catch (error) {
    return false;
  }
}

export async function GET(req: NextRequest, props: { params: Promise<{ adminId: string }> }) {
  const params = await props.params;
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;

    if (!sid || !(await checkAdminAuth(sid))) {
      return NextResponse.json({
        ok: false,
        error: '인증이 필요합니다.'
      }, { status: 403 });
    }

    const adminId = parseInt(params.adminId, 10);
    if (isNaN(adminId)) {
      return NextResponse.json(
        { ok: false, error: '잘못된 관리자 ID입니다.' },
        { status: 400 }
      );
    }

    const admin = await prisma.user.findFirst({
      where: {
        id: adminId,
        role: 'admin',
        phone: {
          in: ['user1', 'user2', 'user3', 'user4', 'user5', 'user6', 'user7', 'user8', 'user9', 'user10'],
        },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
        lastActiveAt: true,
        loginCount: true,
        isLocked: true,
        isHibernated: true,
        adminMemo: true, // 기능 설정 저장용
        mallNickname: true, // 닉네임 저장용
      },
    });

    if (!admin) {
      return NextResponse.json(
        { ok: false, error: '크루즈몰 관리자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      admin: {
        ...admin,
        createdAt: admin.createdAt.toISOString(),
        lastActiveAt: admin.lastActiveAt?.toISOString() || null,
      },
    });
  } catch (error) {
    logger.error('[Admin Mall Admins API] Get error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ adminId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;

    if (!sid || !(await checkAdminAuth(sid))) {
      return NextResponse.json({
        ok: false,
        error: '인증이 필요합니다.'
      }, { status: 403 });
    }

    const { adminId: idStr } = await params;
    const adminId = parseInt(idStr, 10);
    if (isNaN(adminId)) {
      return NextResponse.json(
        { ok: false, error: '잘못된 관리자 ID입니다.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { name, phone, email, password, mallNickname, featureSettings } = body;

    // phone 변경 시 user1~user10 형식인지 확인
    if (phone !== undefined && !/^user(1[0]|[1-9])$/.test(phone)) {
      return NextResponse.json(
        { ok: false, error: '전화번호는 user1~user10 형식이어야 합니다.' },
        { status: 400 }
      );
    }

    // 입력 검증
    if (password !== undefined && password !== '' && (typeof password !== 'string' || password.length < 4 || password.length > 100)) {
      return NextResponse.json({ ok: false, error: '비밀번호는 4-100자여야 합니다.' }, { status: 400 });
    }
    if (name !== undefined && name !== null && (typeof name !== 'string' || name.length > 100)) {
      return NextResponse.json({ ok: false, error: '이름은 최대 100자입니다.' }, { status: 400 });
    }
    if (email !== undefined && email !== null && email !== '' && (typeof email !== 'string' || email.length > 254)) {
      return NextResponse.json({ ok: false, error: '이메일은 최대 254자입니다.' }, { status: 400 });
    }
    if (mallNickname !== undefined && mallNickname !== null && mallNickname !== '' && (typeof mallNickname !== 'string' || mallNickname.length > 50)) {
      return NextResponse.json({ ok: false, error: '닉네임은 최대 50자입니다.' }, { status: 400 });
    }

    const updateData: Prisma.UserUpdateInput = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email || null;
    if (password !== undefined && password !== '') {
      const bcrypt = await import('bcryptjs');
      updateData.password = await bcrypt.default.hash(password, 10);
    }
    if (mallNickname !== undefined) updateData.mallNickname = mallNickname || null;
    // 기능 설정을 JSON으로 저장 (adminMemo 필드 사용)
    if (featureSettings !== undefined) {
      updateData.adminMemo = JSON.stringify(featureSettings);
    }

    const admin = await prisma.user.update({
      where: {
        id: adminId,
        role: 'admin',
        phone: {
          in: ['user1', 'user2', 'user3', 'user4', 'user5', 'user6', 'user7', 'user8', 'user9', 'user10'],
        },
      },
      data: updateData,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
        lastActiveAt: true,
        loginCount: true,
        isLocked: true,
        isHibernated: true,
        adminMemo: true, // 기능 설정 저장용
        mallNickname: true, // 닉네임 저장용
      },
    });

    return NextResponse.json({
      ok: true,
      admin: {
        ...admin,
        createdAt: admin.createdAt.toISOString(),
        lastActiveAt: admin.lastActiveAt?.toISOString() || null,
      },
    });
  } catch (error) {
    logger.error('[Admin Mall Admins API] Update error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ adminId: string }> }) {
  const params = await props.params;
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;

    if (!sid || !(await checkAdminAuth(sid))) {
      return NextResponse.json({
        ok: false,
        error: '인증이 필요합니다.'
      }, { status: 403 });
    }

    const adminId = parseInt(params.adminId, 10);
    if (isNaN(adminId)) {
      return NextResponse.json(
        { ok: false, error: '잘못된 관리자 ID입니다.' },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: {
        id: adminId,
        role: 'admin',
        phone: {
          in: ['user1', 'user2', 'user3', 'user4', 'user5', 'user6', 'user7', 'user8', 'user9', 'user10'],
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('[Admin Mall Admins API] Delete error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
