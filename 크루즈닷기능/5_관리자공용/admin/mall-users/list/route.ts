export const dynamic = 'force-dynamic';

// app/api/admin/mall-users/list/route.ts
// 크루즈몰 고객 전체 목록 조회 API

import { NextRequest, NextResponse } from 'next/server';
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

    return session?.User.role === 'admin';
  } catch (error) {
    logger.error('[Admin Mall Users List] Auth check error:', error);
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '100');

    // 크루즈몰(메인몰) 고객만 조회: role이 'community'인 고객만
    // customerStatus가 'test', 'test-locked', 'excel'이 아닌 고객
    const where: any = {
      AND: [
        // 크루즈몰(메인몰) 가입 고객만: role이 'community'
        { role: 'community' },
        // 테스트, 잠재고객 제외
        {
          OR: [
            { customerStatus: { not: 'test' } },
            { customerStatus: null },
          ],
        },
        {
          OR: [
            { customerStatus: { not: 'test-locked' } },
            { customerStatus: null },
          ],
        },
        {
          OR: [
            { customerStatus: { not: 'excel' } },
            { customerStatus: null },
          ],
        },
      ],
    };

    // 검색어가 있으면 필터링
    if (query && query.trim().length > 0) {
      where.AND.push({
        OR: [
          { name: { contains: query } },
          { phone: { contains: query } },
          { email: { contains: query } },
          { mallNickname: { contains: query } }, // 크루즈몰 닉네임 검색 추가
        ],
      });
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        mallUserId: true,
        mallNickname: true,
        customerStatus: true,
        createdAt: true,
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      ok: true,
      users: users.map(user => ({
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        mallNickname: user.mallNickname,
        displayName: user.mallNickname || user.name || user.phone || user.email || `사용자 ${user.id}`,
      })),
      total: users.length,
    });
  } catch (error) {
    logger.error('[Admin Mall Users List] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
