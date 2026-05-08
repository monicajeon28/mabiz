export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

const SESSION_COOKIE = 'cg.sid.v2';

async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  try {
    if (!sid) return false;

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { User: true },
    });

    if (!session || !session.User) return false;
    return session.User.role === 'admin';
  } catch (error) {
    console.error('[Admin Customer Groups Customers] Auth check error:', error);
    return false;
  }
}

// GET: 고객 그룹 관리 전용 고객 목록 조회
// 모든 고객을 보여주되, customerSource가 'group'인 고객도 포함 (고객 그룹 관리에서 추가한 고객)
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sid) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const isAdmin = await checkAdminAuth(sid);
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '1000');
    const groupId = searchParams.get('groupId'); // 특정 그룹에 속한 고객 제외 옵션

    // 검색 조건: admin이 아닌 모든 고객 (customerSource가 'group'인 고객도 포함)
    const where: any = {
      role: { not: 'admin' },
    };

    // 특정 그룹에 속한 고객 제외 옵션 (이미 그룹에 속한 고객은 제외하고 싶을 때)
    if (groupId) {
      const groupIdNum = parseInt(groupId);
      if (!isNaN(groupIdNum)) {
        const groupMemberIds = await prisma.customerGroupMember.findMany({
          where: { groupId: groupIdNum },
          select: { userId: true },
        }).then(members => members.map(m => m.userId));

        if (groupMemberIds.length > 0) {
          where.id = { notIn: groupMemberIds };
        }
      }
    }

    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
            { email: { contains: search } },
          ],
        },
      ];
    }

    // 고객 목록 조회
    const customers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
        customerSource: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return NextResponse.json({
      ok: true,
      customers: customers.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error('[Admin Customer Groups Customers] GET error:', error);
    return NextResponse.json(
      { ok: false, error: '고객 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
