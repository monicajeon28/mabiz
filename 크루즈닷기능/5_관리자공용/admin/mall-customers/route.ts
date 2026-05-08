export const dynamic = 'force-dynamic';

// app/api/admin/mall-customers/route.ts
// 크루즈몰 고객 관리 API (커뮤니티, 리뷰, 상품 문의 활동 고객)

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
    logger.error('[Admin Mall Customers] Auth check error:', error);
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

    // URL 파라미터
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // 검색 조건
    const where: import('@prisma/client').Prisma.UserWhereInput = {
      // 메인몰 고객: role이 'community'인 고객
      role: 'community',
    };

    // 크루즈몰 활동이 있는 고객만 필터링 (커뮤니티, 리뷰, 상품 문의, 상품 조회)
    // 하지만 메인몰 회원가입 고객은 role: 'community'로 이미 구분되므로
    // role: 'community'인 모든 고객을 표시

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
      where.isHibernated = false;
      where.isLocked = false;
    } else if (status === 'hibernated') {
      where.isHibernated = true;
    } else if (status === 'locked') {
      where.isLocked = true;
    }

    // 정렬
    const orderBy: import('@prisma/client').Prisma.UserOrderByWithRelationInput = {};
    if (sortBy === 'name') {
      orderBy.name = sortOrder;
    } else if (sortBy === 'reviewCount') {
      // 후기 개수로 정렬은 별도 처리 필요
      orderBy.createdAt = sortOrder;
    } else if (sortBy === 'lastActiveAt') {
      orderBy.lastActiveAt = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    // 전체 개수 조회
    const total = await prisma.user.count({ where });

    // 데이터 조회
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
        lastActiveAt: true,
        isHibernated: true,
        isLocked: true,
        customerStatus: true, // customerStatus 추가
        password: true, // 비밀번호 (평문)
        PasswordEvent: {
          select: {
            id: true,
            to: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        genieStatus: true,
        genieLinkedAt: true,
        mallUserId: true,
        mallNickname: true,
        currentTripEndDate: true,
        testModeStartedAt: true, // 테스트 모드 시작 시간
        UserTrip: {  // Trip 정보 추가
          select: {
            id: true,
            createdAt: true,
            Trip: {
              select: {
                id: true,
                startDate: true,
                endDate: true,
                status: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        CommunityPost: {
          select: { id: true }
        },
        CommunityComment: {
          select: { id: true }
        },
        CruiseReview: {
          select: { id: true }
        },
        ProductInquiry: {
          select: { id: true }
        },
        ProductView: {
          select: { id: true }
        },
      },
      orderBy,
      skip,
      take: limit,
    });

    // 후기 개수로 정렬이 필요한 경우
    let sortedUsers = users;
    if (sortBy === 'reviewCount') {
      sortedUsers = [...users].sort((a, b) => {
        const aCount = a.CruiseReview?.length || 0;
        const bCount = b.CruiseReview?.length || 0;
        return sortOrder === 'desc' ? bCount - aCount : aCount - bCount;
      });
    }

    // 크루즈 가이드 지니 사용자 정보 조회
    // 고객 관리 페이지에서 설정한 연결 방식:
    // - 크루즈 가이드 지니 사용자의 mallUserId 필드에 크루즈몰 사용자 ID가 저장됨
    // - 따라서 크루즈몰 사용자 ID를 mallUserId로 가진 지니 사용자를 찾아야 함
    
    // 1. 모든 크루즈 가이드 지니 사용자 중에서 현재 크루즈몰 사용자 ID를 mallUserId로 가진 사용자 찾기
    const mallUserIdsForLookup = sortedUsers.map(u => u.id.toString());
    const genieUsersByMallUserId = await prisma.user.findMany({
      where: {
        OR: [
          { mallUserId: { in: mallUserIdsForLookup }, role: 'user' },
          // phone으로도 찾기 (mallUserId가 phone인 경우)
          ...sortedUsers.map(u => ({
            mallUserId: u.phone,
            role: 'user',
          })),
        ],
        genieStatus: { not: null }, // 지니 사용자만
      },
      select: {
        id: true,
        name: true,
        phone: true,
        genieStatus: true,
        genieLinkedAt: true,
        currentTripEndDate: true,
        mallUserId: true, // 어떤 크루즈몰 사용자와 연결되었는지 확인
        UserTrip: {
          orderBy: { createdAt: 'desc' }, // 최근 등록된 온보딩 정보 우선
          take: 1,
          select: {
            createdAt: true,
            Trip: {
              select: {
                endDate: true,
                createdAt: true,
                status: true,
              }
            }
          }
        }
      }
    });

    // mallUserId -> genieUser 매핑 생성
    type GenieUserEntry = (typeof genieUsersByMallUserId)[number];
    const genieUsersMapByMallUserId = new Map<string, GenieUserEntry>();
    genieUsersByMallUserId.forEach(genieUser => {
      if (genieUser.mallUserId) {
        // ID로 매핑
        const mallUserIdNum = parseInt(genieUser.mallUserId);
        if (!isNaN(mallUserIdNum)) {
          genieUsersMapByMallUserId.set(mallUserIdNum.toString(), genieUser);
        }
        // phone으로도 매핑 (mallUserId가 phone인 경우)
        genieUsersMapByMallUserId.set(genieUser.mallUserId, genieUser);
      }
    });
    
    // 2. 모든 활성 지니 사용자 조회 (같은 사용자 + 이름/전화번호 매칭용)
    const allActiveGenieUsers = await prisma.user.findMany({
      where: {
        role: 'user',
        genieStatus: 'active'
      },
      select: {
        id: true,
        name: true,
        phone: true,
        genieStatus: true,
        genieLinkedAt: true,
        currentTripEndDate: true,
        mallUserId: true,
        UserTrip: {
          orderBy: { createdAt: 'desc' }, // 최근 등록된 온보딩 정보 우선
          take: 1,
          select: {
            createdAt: true,
            Trip: {
              select: {
                endDate: true,
                createdAt: true,
                status: true,
              }
            }
          }
        }
      }
    });
    
    // 3. 각 지니 사용자의 최신 Trip 종료일 확인 (최근 등록된 온보딩 정보 기준)
    const genieUserTripsMap = new Map<number, Date>();
    const allGenieUsers = [...genieUsersByMallUserId, ...allActiveGenieUsers];
    
    for (const genieUser of allGenieUsers) {
      // 최근 등록된 온보딩 정보의 여행 종료일 우선 사용
      let tripEndDate = null;
      
      // UserTrip 배열에서 Trip 정보 추출
      const userTripItems = Array.isArray(genieUser.UserTrip) ? genieUser.UserTrip : [];
      const trips = userTripItems.map((ut: { Trip: { endDate: Date | null; createdAt: Date; status: string } | null }) => ut.Trip).filter((t): t is NonNullable<typeof t> => t !== null);

      if (trips.length > 0) {
        // createdAt 기준으로 정렬되어 있으므로 첫 번째 Trip 사용
        // endDate가 있고, 아직 지나지 않은 Trip 우선
        const validTrips = trips.filter((trip) => {
          if (!trip || !trip.endDate) return false;
          try {
            const endDate = new Date(trip.endDate);
            const now = new Date();
            return endDate >= now; // 아직 지나지 않은 Trip만
          } catch (error) {
            logger.error('[Mall Customers API] Error parsing trip endDate:', error);
            return false;
          }
        });

        if (validTrips.length > 0) {
          tripEndDate = validTrips[0].endDate;
        } else {
          // 모든 Trip이 지났으면 가장 최근 Trip의 endDate 사용
          tripEndDate = trips[0]?.endDate || null;
        }
      }
      
      const currentEndDate = genieUser.currentTripEndDate;
      
      // 최근 등록된 온보딩의 여행 종료일이 있으면 우선 사용
      if (tripEndDate) {
        genieUserTripsMap.set(genieUser.id, new Date(tripEndDate));
      } else if (currentEndDate) {
        // Trip이 없으면 currentTripEndDate 사용
        genieUserTripsMap.set(genieUser.id, new Date(currentEndDate));
      }
    }
    
    // 크루즈가이드 사용자 ID -> 여행 존재 여부 매핑 생성
    // UserTrip은 이미 take:1 로 조회됐으므로 추가 DB 호출 없이 판별
    const genieUserHasTripMap = new Map<number, boolean>();
    for (const genieUser of allGenieUsers) {
      const userTripItems = Array.isArray(genieUser.UserTrip) ? genieUser.UserTrip : [];
      genieUserHasTripMap.set(genieUser.id, userTripItems.length > 0);
    }

    return NextResponse.json(
      {
        ok: true,
        customers: sortedUsers.map(user => {
        // 크루즈 가이드 지니 사용자 찾기
        let genieUser = null;
        let linkedBy = null;
        let daysRemaining = null;
        
        // 1. 고객 관리에서 설정한 mallUserId 연결 확인 (최우선)
        // 크루즈 가이드 지니 사용자의 mallUserId가 현재 크루즈몰 사용자 ID와 일치하는 경우
        const foundGenieUserByMallUserId = genieUsersMapByMallUserId.get(user.id.toString()) || 
                                           (user.phone ? genieUsersMapByMallUserId.get(user.phone) : null);
        if (foundGenieUserByMallUserId) {
          genieUser = foundGenieUserByMallUserId;
          linkedBy = 'mallUserId'; // 고객 관리에서 설정한 연동
          
          // 최근 온보딩 여행상품 종료일까지 남은 일수 계산
          const endDate = genieUserTripsMap.get(foundGenieUserByMallUserId.id);
          if (endDate) {
            const now = new Date();
            now.setUTCHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setUTCHours(0, 0, 0, 0);
            const diffTime = end.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            daysRemaining = diffDays > 0 ? diffDays : 0;
            
            logger.debug(`[Mall Customers API] User ${user.id} (mallUserId): daysRemaining=${daysRemaining}, endDate=${endDate.toISOString()}`);
          } else {
            logger.debug(`[Mall Customers API] User ${user.id} (mallUserId): No endDate found for genieUser ${foundGenieUserByMallUserId.id}`);
          }
        }
        
        // 2. 같은 사용자가 지니를 사용하는 경우 (genieStatus가 active인 경우)
        if (!genieUser && user.genieStatus === 'active') {
          const foundGenieUser = allActiveGenieUsers.find(u => u.id === user.id);
          if (foundGenieUser) {
            genieUser = foundGenieUser;
            linkedBy = 'same_user'; // 같은 사용자
            
            // 최근 온보딩 여행상품 종료일까지 남은 일수 계산
            const endDate = genieUserTripsMap.get(foundGenieUser.id);
            if (endDate) {
              const now = new Date();
              now.setUTCHours(0, 0, 0, 0);
              const end = new Date(endDate);
              end.setUTCHours(0, 0, 0, 0);
              const diffTime = end.getTime() - now.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              daysRemaining = diffDays > 0 ? diffDays : 0;
              
              logger.debug(`[Mall Customers API] User ${user.id} (same_user): daysRemaining=${daysRemaining}, endDate=${endDate.toISOString()}`);
            } else {
              logger.debug(`[Mall Customers API] User ${user.id} (same_user): No endDate found`);
            }
          }
        }
        
        // 3. 이름과 전화번호로 매칭된 경우 확인 (자동 매칭, mallUserId가 없는 경우만)
        if (!genieUser && user.name && user.phone) {
          const matchingGenieUser = allActiveGenieUsers.find(u => 
            u.name === user.name && 
            u.phone === user.phone && 
            u.genieStatus === 'active' && 
            !u.mallUserId // 이미 다른 크루즈몰 사용자와 연결되지 않은 경우만
          );
          if (matchingGenieUser) {
            genieUser = matchingGenieUser;
            linkedBy = 'name_phone'; // 이름과 전화번호로 자동 연동
            
            // 최근 온보딩 여행상품 종료일까지 남은 일수 계산
            const endDate = genieUserTripsMap.get(matchingGenieUser.id);
            if (endDate) {
              const now = new Date();
              now.setUTCHours(0, 0, 0, 0);
              const end = new Date(endDate);
              end.setUTCHours(0, 0, 0, 0);
              const diffTime = end.getTime() - now.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              daysRemaining = diffDays > 0 ? diffDays : 0;
            }
          }
        }

        // 연동된 크루즈가이드 사용자의 여행이 있는지 확인 (genieUserHasTripMap 기준)
        const linkedGenieHasTrip = genieUser
          ? (genieUserHasTripMap.get(genieUser.id) || false)
          : false;

        // 지니 상태 결정 (상세 페이지와 동일한 로직)
        const userTripItems = Array.isArray(user.UserTrip) ? user.UserTrip : [];
        const hasTrip = userTripItems.length > 0;
        let genieStatus: 'active' | 'package' | 'dormant' | 'locked' | null = null;
        
        // 연동된 크루즈가이드 사용자의 여행이 있으면 무조건 활성화 (최우선)
        if (linkedGenieHasTrip) {
          genieStatus = 'active';
          // 백그라운드에서 상태 업데이트 (비동기, 에러가 발생해도 응답은 계속 진행)
          if (user.isLocked || user.isHibernated || user.customerStatus === 'locked' || user.customerStatus === 'dormant') {
            prisma.user.update({
              where: { id: user.id },
              data: {
                isLocked: false,
                lockedAt: null,
                lockedReason: null,
                isHibernated: false,
                hibernatedAt: null,
                customerStatus: 'active',
                lastActiveAt: new Date(),
              },
            }).catch(error => {
              logger.error(`[Mall Customers API] 크루즈몰 사용자 (ID: ${user.id}) 상태 활성화 실패:`, error);
            });
          }
        } else if (user.customerStatus === 'active' || user.customerStatus === 'package') {
          genieStatus = user.customerStatus;
        } else if (user.customerStatus === 'locked' || user.isLocked) {
          genieStatus = 'locked';
        } else if (user.customerStatus === 'dormant' || user.isHibernated) {
          genieStatus = 'dormant';
        } else if (hasTrip) {
          genieStatus = 'package';
        } else {
          genieStatus = 'locked'; // Trip 없으면 잠금
        }

        // 현재 비밀번호 가져오기
        // PasswordEvent.to 값만 사용 (평문 비밀번호)
        // password 필드는 해시된 값이므로 사용하지 않음
        const latestPasswordEvent = user.PasswordEvent && user.PasswordEvent.length > 0
          ? user.PasswordEvent[0]
          : null;
        const currentPassword = latestPasswordEvent?.to || null; // PasswordEvent.to 값만 사용, 없으면 null

        return {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          createdAt: user.createdAt.toISOString(),
          lastActiveAt: user.lastActiveAt?.toISOString() || null,
          isLocked: user.isLocked,
          isHibernated: user.isHibernated,
          genieStatus: genieStatus, // 계산된 지니 상태
          genieLinkedAt: user.genieLinkedAt?.toISOString() || null,
          reviewCount: user.CruiseReview?.length || 0,
          postCount: user.CommunityPost?.length || 0,
          commentCount: user.CommunityComment?.length || 0,
          inquiryCount: user.ProductInquiry?.length || 0,
          viewCount: user.ProductView?.length || 0,
          currentPassword, // 현재 비밀번호
          isLinked: !!genieUser, // 연동 여부 (크루즈가이드 지니와 연동된 경우)
          genieUser: genieUser ? {
            id: genieUser.id,
            name: genieUser.name,
            phone: genieUser.phone,
            genieStatus: genieUser.genieStatus,
            genieLinkedAt: genieUser.genieLinkedAt?.toISOString() || null,
            linkedBy: linkedBy,
            daysRemaining: daysRemaining,
          } : null,
        };
      }),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
    );
  } catch (error) {
    logger.error('[Admin Mall Customers API] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
