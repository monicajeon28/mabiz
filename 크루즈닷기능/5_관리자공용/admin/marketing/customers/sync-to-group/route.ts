export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE } from '@/lib/session';

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

    if (!session || !session.User) return false;
    return session.User.role === 'admin';
  } catch (error) {
    console.error('[Marketing Customers Sync] Auth check error:', error);
    return false;
  }
}

// 마케팅 고객을 기존 고객 그룹에 동기화
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;

    if (!sid) {
      return NextResponse.json({
        ok: false,
        error: '인증이 필요합니다.'
      }, { status: 403 });
    }

    const isAdmin = await checkAdminAuth(sid);
    if (!isAdmin) {
      return NextResponse.json({
        ok: false,
        error: '관리자 권한이 필요합니다.'
      }, { status: 403 });
    }

    const body = await req.json();
    const { customerId, groupId } = body;

    // 마케팅 고객 정보 가져오기
    const marketingCustomer = await prisma.marketingCustomer.findUnique({
      where: { id: customerId },
    });

    if (!marketingCustomer) {
      return NextResponse.json({
        ok: false,
        error: '마케팅 고객을 찾을 수 없습니다.',
      }, { status: 404 });
    }

    // 전화번호로 기존 User 찾기 또는 생성
    let user = null;
    if (marketingCustomer.phone) {
      user = await prisma.user.findFirst({
        where: { phone: marketingCustomer.phone },
      });
    }

    // User가 없으면 생성
    if (!user) {
      // 임시 비밀번호 생성
      const tempPassword = Math.random().toString(36).slice(-8);
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      user = await prisma.user.create({
        data: {
          name: marketingCustomer.name,
          email: marketingCustomer.email,
          phone: marketingCustomer.phone,
          password: hashedPassword,
          role: 'USER',
          updatedAt: new Date(),
        },
      });
    }

    // 고객 그룹에 추가 (중복 체크)
    const existingMember = await prisma.customerGroupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: user.id,
        },
      },
    });

    if (!existingMember) {
      await prisma.customerGroupMember.create({
        data: {
          groupId,
          userId: user.id,
          addedBy: parseInt(sid), // 세션에서 adminId 가져오기 (실제로는 session.userId 사용)
        },
      });
    }

    return NextResponse.json({
      ok: true,
      message: '고객 그룹에 추가되었습니다.',
      data: {
        userId: user.id,
        groupId,
      },
    });
  } catch (error) {
    console.error('[Marketing Customers Sync] Error:', error);
    return NextResponse.json({
      ok: false,
      error: '동기화에 실패했습니다.',
    }, { status: 500 });
  }
}
