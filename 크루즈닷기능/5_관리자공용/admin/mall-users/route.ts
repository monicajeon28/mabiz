export const dynamic = 'force-dynamic';

import { logger } from '@/lib/logger';
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
    logger.error('[Mall Users] Auth check error:', error);
    return null;
  }
}

// GET: 크루즈몰 사용자 목록 조회
export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const emailOnly = searchParams.get('emailOnly') === 'true';
    const kakaoChannelAdded = searchParams.get('kakaoChannelAdded') === 'true'; // 카카오 채널 추가한 고객만 필터링

    logger.log('[Mall Users API] Request params:', { emailOnly, kakaoChannelAdded });

    // 크루즈몰(메인몰) 고객: role이 'community'인 고객만
    const baseCondition: any = {
      role: 'community',
    };

    // emailOnly가 true이면 이메일이 있고 빈 문자열이 아닌 고객만
    let whereClause: any;
    if (emailOnly) {
      whereClause = {
        ...baseCondition,
        AND: [
          { email: { not: null } },
          { email: { not: '' } },
        ],
      };
    } else {
      whereClause = baseCondition;
    }

    // 카카오 채널 추가 필터
    if (kakaoChannelAdded) {
      if (whereClause.AND) {
        whereClause.AND.push({ kakaoChannelAdded: true });
      } else {
        whereClause.kakaoChannelAdded = true;
      }
    }

    logger.log('[Mall Users API] Where clause:', JSON.stringify(whereClause, null, 2));

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        mallUserId: true, // 크루즈몰 아이디 (영문형)
        mallNickname: true,
        customerStatus: true,
        kakaoChannelAdded: true,
        kakaoChannelAddedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    logger.log('[Mall Users API] Found users:', users.length);
    if (users.length > 0) {
      logger.log('[Mall Users API] Sample user:', {
        id: users[0].id,
        name: users[0].name,
        email: users[0].email,
        role: users[0].role,
        mallUserId: users[0].mallUserId,
      });
    }

    return NextResponse.json({
      ok: true,
      users: users.map(user => ({
        ...user,
        customerType: 'mall',
        customerTypeLabel: '크루즈몰',
      })),
    });
  } catch (error) {
    logger.error('[Mall Users GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to fetch mall users' },
      { status: 500 }
    );
  }
}
