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
    console.error('[Cruise Guide Users] Auth check error:', error);
    return null;
  }
}

// GET: 크루즈가이드 사용자 목록 조회 (전체고객관리의 활성, 패키지, 잠금 상태 고객들)
export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all'; // all, active, package, locked
    const sortBy = searchParams.get('sortBy') || 'createdAt'; // createdAt, name, tripCount, lastActiveAt
    const sortOrder = searchParams.get('sortOrder') || 'desc'; // asc, desc
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;
    const mallUserId = searchParams.get('mallUserId'); // 크루즈몰 고객 ID로 연동된 크루즈 가이드 지니 사용자 찾기
    const kakaoChannelAdded = searchParams.get('kakaoChannelAdded') === 'true'; // 카카오 채널 추가한 고객만 필터링

    // mallUserId로 연동된 크루즈 가이드 지니 사용자 찾기
    if (mallUserId) {
      const mallUserIdNum = parseInt(mallUserId, 10);
      if (!isNaN(mallUserIdNum)) {
        const linkedGenieUser = await prisma.user.findFirst({
          where: {
            role: 'user',
            mallUserId: mallUserIdNum.toString(),
            name: { not: null },
            phone: { not: null },
          },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            customerStatus: true,
            Trip: {
              select: {
                id: true,
                cruiseName: true,
                destination: true,
                startDate: true,
                endDate: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            PasswordEvent: {
              select: {
                id: true,
                to: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });

        if (linkedGenieUser) {
          const latestPasswordEvent = linkedGenieUser.PasswordEvent && linkedGenieUser.PasswordEvent.length > 0
            ? linkedGenieUser.PasswordEvent[0]
            : null;
          const currentPassword = latestPasswordEvent?.to || null;

          return NextResponse.json({
            ok: true,
            users: [{
              id: linkedGenieUser.id,
              name: linkedGenieUser.name,
              phone: linkedGenieUser.phone,
              email: linkedGenieUser.email,
              customerStatus: linkedGenieUser.customerStatus,
              customerType: 'cruise-guide',
              customerTypeLabel: '크루즈 가이드',
              hasActiveTrip: linkedGenieUser.Trip && linkedGenieUser.Trip.length > 0,
              currentPassword: currentPassword,
            }],
          });
        } else {
          return NextResponse.json({
            ok: true,
            users: [],
          });
        }
      }
    }

    const where: any = {
      role: { not: 'admin' },
      // 크루즈가이드 고객: 이름, 전화번호 있고 상태는 활성, 패키지, 잠금 처리된 고객
      // Trip이 있고 customerStatus가 'test', 'test-locked', 'excel'이 아닌 고객
      // 활성 상태만 표시 (온보딩 완료된 고객)
      AND: [
        { name: { not: null } },
        { phone: { not: null } },
        { Trip: { some: {} } },
        // 활성 상태만 (active, package, locked) - dormant 제외
        {
          OR: [
            { customerStatus: { in: ['active', 'package', 'locked'] } },
            {
              AND: [
                { customerStatus: null },
                { isLocked: false },
                { isHibernated: false },
              ],
            },
          ],
        },
        // 테스트 상태 제외
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
        // 잠재고객 제외
        {
          OR: [
            { customerStatus: { not: 'excel' } },
            { customerStatus: null },
          ],
        },
      ],
    };

    // 카카오 채널 추가 필터
    if (kakaoChannelAdded) {
      where.AND = [
        ...(where.AND || []),
        { kakaoChannelAdded: true },
      ];
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

    // 상태 필터
    if (status === 'active') {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { customerStatus: 'active' },
            {
              AND: [
                { customerStatus: null },
                { isHibernated: false },
                { isLocked: false },
              ],
            },
          ],
        },
      ];
    } else if (status === 'package') {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { customerStatus: 'package' },
            {
              AND: [
                { customerStatus: null },
                { Trip: { some: {} } },
              ],
            },
          ],
        },
      ];
    } else if (status === 'locked') {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { customerStatus: 'locked' },
            { isLocked: true },
          ],
        },
      ];
    }

    // 정렬
    const orderBy: any = {};
    if (sortBy === 'name') {
      orderBy.name = sortOrder;
    } else if (sortBy === 'tripCount') {
      orderBy.tripCount = sortOrder;
    } else if (sortBy === 'lastActiveAt') {
      orderBy.lastActiveAt = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    // 전체 개수 조회
    const total = await prisma.user.count({ where });

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        customerStatus: true,
        mallUserId: true,
        isLocked: true,
        isHibernated: true,
        createdAt: true,
        lastActiveAt: true,
        tripCount: true,
        totalTripCount: true,
        currentTripEndDate: true,
        password: true,
        kakaoChannelAdded: true,
        kakaoChannelAddedAt: true,
        PasswordEvent: {
          select: {
            id: true,
            to: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        Trip: {
          select: {
            id: true,
            cruiseName: true,
            companionType: true,
            destination: true,
            startDate: true,
            endDate: true,
            status: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy,
      skip,
      take: limit,
    });

    return NextResponse.json({
      ok: true,
      total,
      users: users.map(user => {
        // 고객 분류 결정
        let customerType: 'cruise-guide' | 'mall' | 'test' = 'cruise-guide';
        let customerTypeLabel = '크루즈가이드';
        
        // 크루즈몰 고객 체크 (mallUserId가 있으면 크루즈몰)
        if (user.mallUserId) {
          customerType = 'mall';
          customerTypeLabel = '크루즈몰';
        }
        // 테스트 고객 체크 (customerStatus가 'test'이면 테스트)
        else if (user.customerStatus === 'test') {
          customerType = 'test';
          customerTypeLabel = '테스트';
        }
        // 그 외는 크루즈가이드 (Trip이 있고 이름, 전화번호가 있는 고객)
        else if (user.Trip && user.Trip.length > 0 && user.name && user.phone) {
          customerType = 'cruise-guide';
          customerTypeLabel = '크루즈가이드';
        }

        // 지니 상태 결정
        let genieStatus: 'active' | 'package' | 'locked' | null = null;
        if (user.customerStatus === 'active' || user.customerStatus === 'package') {
          genieStatus = user.customerStatus;
        } else if (user.customerStatus === 'locked' || user.isLocked) {
          genieStatus = 'locked';
        } else if (user.Trip && user.Trip.length > 0) {
          genieStatus = 'package';
        } else {
          genieStatus = 'locked';
        }

        // 현재 비밀번호 가져오기
        // PasswordEvent.to 값만 사용 (평문 비밀번호)
        // password 필드는 해시된 값이므로 사용하지 않음
        const latestPasswordEvent = user.PasswordEvent && user.PasswordEvent.length > 0
          ? user.PasswordEvent[0]
          : null;
        const currentPassword = latestPasswordEvent?.to || null; // PasswordEvent.to 값만 사용, 없으면 null

        // 여행 종료일까지 남은 일수 계산
        let daysRemaining: number | null = null;
        if (user.currentTripEndDate) {
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          const endDate = new Date(user.currentTripEndDate);
          endDate.setHours(0, 0, 0, 0);
          const diffTime = endDate.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          daysRemaining = diffDays;
        }

        return {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          customerStatus: user.customerStatus,
          customerType,
          customerTypeLabel,
          hasActiveTrip: user.Trip && user.Trip.length > 0,
          status: genieStatus,
          isLocked: user.isLocked,
          createdAt: user.createdAt.toISOString(),
          lastActiveAt: user.lastActiveAt?.toISOString() || null,
          tripCount: user.tripCount || 0,
          totalTripCount: user.totalTripCount || 0,
          currentTripEndDate: user.currentTripEndDate?.toISOString() || null,
          currentPassword,
          daysRemaining,
          kakaoChannelAdded: user.kakaoChannelAdded || false,
          kakaoChannelAddedAt: user.kakaoChannelAddedAt?.toISOString() || null,
          trips: (user.Trip || []).map(trip => ({
            id: trip.id,
            cruiseName: trip.cruiseName,
            companionType: trip.companionType,
            destination: trip.destination,
            startDate: trip.startDate?.toISOString() || null,
            endDate: trip.endDate?.toISOString() || null,
          })),
        };
      }),
    });
  } catch (error) {
    console.error('[Cruise Guide Users GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to fetch cruise guide users' },
      { status: 500 }
    );
  }
}
