export const dynamic = 'force-dynamic';

// app/api/admin/mall-users/search/route.ts
// 크루즈몰 고객 검색 API (닉네임, 이름, 전화번호로 검색)

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
    logger.error('[Admin Mall Users Search] Auth check error:', error);
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
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        ok: true,
        users: [],
      });
    }

    // 크루즈몰 활동이 있는 고객만 검색 (커뮤니티, 리뷰, 상품 문의, 상품 조회)
    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { CommunityPost: { some: {} } },
              { CommunityComment: { some: {} } },
              { CruiseReview: { some: {} } },
              { ProductInquiry: { some: {} } },
              { ProductView: { some: {} } },
            ]
          },
          {
            OR: [
              { name: { contains: query } },
              { phone: { contains: query } },
              { email: { contains: query } },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
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
        displayName: user.name || user.phone || user.email || `사용자 ${user.id}`,
      })),
    });
  } catch (error) {
    logger.error('[Admin Mall Users Search] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
