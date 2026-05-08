export const dynamic = 'force-dynamic';

// app/api/admin/users/[userId]/approve-genie/route.ts
// 일반 크루즈 가이드 사용 승인 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;

  const session = await prisma.session.findUnique({
    where: { id: sid },
    include: {
      User: {
        select: { role: true },
      },
    },
  });

  return session?.User.role === 'admin';
}

// POST: 일반 크루즈 가이드 사용 승인
export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });
    }

    const { userId: userIdStr } = await params; const userId = parseInt(userIdStr);
    if (isNaN(userId)) {
      return NextResponse.json({ ok: false, error: 'Invalid user ID' }, { status: 400 });
    }

    // 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phone: true,
        testModeStartedAt: true,
        customerStatus: true,
        mallUserId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
    }

    // 이미 일반 크루즈 가이드 사용 중인지 확인
    if (!user.testModeStartedAt && (user.customerStatus === 'active' || user.customerStatus === 'package')) {
      return NextResponse.json({
        ok: false,
        error: '이미 일반 크루즈 가이드를 사용 중입니다.',
      }, { status: 400 });
    }

    // 3일 체험 사용자인 경우 체험 종료 처리
    if (user.testModeStartedAt) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          testModeStartedAt: null, // 3일 체험 종료
          customerStatus: 'active', // 일반 크루즈 가이드 활성화
        },
      });
    } else {
      // 3일 체험이 아닌 경우 일반 크루즈 가이드 활성화
      await prisma.user.update({
        where: { id: userId },
        data: {
          customerStatus: 'active',
        },
      });
    }

    // 대리점장/판매원에 자동 연동
    // 고객의 전화번호로 AffiliateLead를 찾아서 소유권 확인
    if (user.phone) {
      const lead = await prisma.affiliateLead.findFirst({
        where: {
          customerPhone: user.phone,
        },
        include: {
          AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile: {
            select: {
              id: true,
              type: true,
              displayName: true,
              affiliateCode: true,
            },
          },
          AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile: {
            select: {
              id: true,
              type: true,
              displayName: true,
              affiliateCode: true,
            },
          },
        },
      });

      // Lead가 있으면 이미 대리점장/판매원에 연동되어 있음
      // Lead가 없어도 User 정보는 업데이트되었으므로 상태 딱지가 자동으로 표시됨
    }

    return NextResponse.json({
      ok: true,
      message: '일반 크루즈 가이드 사용이 승인되었습니다.',
      user: {
        id: user.id,
        name: user.name,
        customerStatus: 'active',
        testModeStartedAt: null,
      },
    });
  } catch (error) {
    logger.error('[Approve Genie] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
