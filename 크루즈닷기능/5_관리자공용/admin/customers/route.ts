export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { getAffiliateOwnershipForUsers } from '@/lib/affiliate/customer-ownership';
import { getCurrentCustomerGroup, CustomerGroup, getCustomerCountByGroup } from '@/lib/customer-journey';
import { logger } from '@/lib/logger';

// 관리자 페이지에서만 사용하는 확장된 고객 그룹 타입
type AdminCustomerGroup = CustomerGroup | 'inquiry' | 'all' | 'passport';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) {
    logger.debug('[Admin Customers] No session ID');
    return false;
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { role: true },
        },
      },
    });

    if (!session) {
      logger.debug('[Admin Customers] Session not found:', sid);
      return false;
    }

    if (!session.User) {
      logger.debug('[Admin Customers] User not found in session');
      return false;
    }

    const isAdmin = session.User.role === 'admin';
    logger.debug('[Admin Customers] Auth check:', { userId: session.userId, role: session.User.role, isAdmin });
    return isAdmin;
  } catch (error) {
    console.error('[Admin Customers] Auth check error:', error);
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      logger.debug('[Admin Customers] No session cookie found');
      return NextResponse.json({ 
        ok: false, 
        error: '인증이 필요합니다. 다시 로그인해 주세요.',
        details: 'No session cookie'
      }, { status: 403 });
    }

    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      console.log('[Admin Customers] Admin check failed for session:', sid);
      return NextResponse.json({ 
        ok: false, 
        error: '인증이 필요합니다. 다시 로그인해 주세요.',
        details: 'Admin check failed'
      }, { status: 403 });
    }

    // URL 파라미터
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all'; // all, active, hibernated, locked
    const certificateType = searchParams.get('certificateType') || 'all'; // all, purchase_confirmed, refunded
    const monthFilter = searchParams.get('monthFilter') || ''; // YYYY-MM 형식
    const sortBy = searchParams.get('sortBy') || 'createdAt'; // createdAt, name, tripCount, lastActiveAt
    const sortOrder = searchParams.get('sortOrder') || 'desc'; // asc, desc
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;
    const userType = searchParams.get('userType') || 'all'; // all, trial, regular - 3일 체험 사용자와 일반 사용자 구분
    const managerProfileId = searchParams.get('managerProfileId'); // 점장별 필터링
    const ownerSearch = searchParams.get('ownerSearch') || ''; // 담당자 이름 검색
    const customerGroupRaw = searchParams.get('customerGroup');
    const customerGroup: AdminCustomerGroup | null = customerGroupRaw === 'all' ? 'all' : (customerGroupRaw as AdminCustomerGroup | null); // 고객 그룹 필터: all, prospects, trial, mall, purchase, refund, passport, manager-customers, agent-customers, inquiry
    const customerSource = searchParams.get('customerSource'); // B2B_TRIAL_SUBSCRIPTION, affiliate-contract-approval 등 고객 소스 필터

    // 연동된 크루즈몰 고객 ID 목록 조회 (중복 제거용) - 성능 최적화: 필요할 때만 조회
    // 크루즈 가이드 고객 중 mallUserId가 설정된 고객들의 mallUserId 목록
    // 성능 최적화: count만 사용하여 전체 조회 대신 존재 여부만 확인
    let linkedMallUserIds: number[] = [];
    if (customerGroup !== 'mall' && customerGroup !== 'all') {
      // mall이나 all이 아닐 때만 조회 (필터링에 필요할 때만)
      // 최적화: 실제로 필요한 경우에만 전체 목록 조회 (필터링 조건에 따라)
      const hasLinkedMallUsers = await prisma.user.count({
        where: {
          role: 'user',
          mallUserId: { not: null },
        },
        take: 1, // 존재 여부만 확인
      });
      
      // 연동된 고객이 있을 때만 전체 ID 목록 조회
      if (hasLinkedMallUsers > 0) {
        linkedMallUserIds = await prisma.user.findMany({
          where: {
            role: 'user',
            mallUserId: { not: null },
          },
          select: {
            mallUserId: true,
          },
        }).then(users => 
          users
            .map(u => u.mallUserId)
            .filter((id): id is string => id !== null)
            .map(id => parseInt(id, 10))
            .filter(id => !isNaN(id))
        );
      }
    }

    // 검색 조건 - AND 구조로 시작
    const whereConditions: any[] = [
      // role이 'admin'이 아닌 모든 사용자 표시
      { role: { not: 'admin' } },
    ];

    // customerSource 필터 (B2B 잠재고객 등)
    if (customerSource) {
      if (customerSource === 'B2B') {
        // B2B로 시작하는 모든 소스 필터
        whereConditions.push({
          customerSource: { startsWith: 'B2B' },
        });
      } else {
        whereConditions.push({
          customerSource: customerSource,
        });
      }
    }

    // customerGroup에 따른 초기 필터링 (DB 쿼리 최적화)
    // customerGroup이 없거나 'all'이면 필터링하지 않음 (전체 고객 조회)
    if (customerGroup && customerGroup !== 'all') {
      if (customerGroup === 'mall') {
        // 크루즈몰 고객만 조회: role이 'community'이고 customerSource가 'mall-signup'
        whereConditions.push({
          role: 'community',
          customerSource: 'mall-signup',
        });
      } else if (customerGroup === 'trial') {
        // 3일 체험 고객만 조회
        whereConditions.push({
          OR: [
            { customerSource: 'test-guide' },
            { testModeStartedAt: { not: null } },
          ],
        });
      } else if (customerGroup === 'purchase') {
        // 구매 고객만 조회 (카운트 조건과 동일하게)
        // customerStatus가 'purchase_confirmed'이거나 Reservation이 있거나 customerSource가 'cruise-guide'인 고객
        whereConditions.push({
          OR: [
            { customerStatus: 'purchase_confirmed' },
            { Reservation: { some: {} } },
            { customerSource: 'cruise-guide' },
          ],
        });
      } else if (customerGroup === 'refund') {
        // 환불 고객만 조회
        whereConditions.push({
          customerStatus: 'refunded',
        });
      } else if ((customerGroupRaw as string) === 'inquiry') {
        // 문의 고객만 조회: product-inquiry 또는 phone-consultation
        whereConditions.push({
          OR: [
            { customerSource: 'product-inquiry' },
            { customerSource: 'phone-consultation' },
          ],
        });
      }
      // 다른 customerGroup들 (passport, manager-customers, agent-customers, prospects)은
      // getCurrentCustomerGroup 함수에서 처리되므로 여기서는 필터링하지 않음
    }

    // 3일 체험 사용자와 일반 사용자 구분 (customerGroup이 'trial', 'mall', 'all'이 아닐 때만 적용)
    if (customerGroup && customerGroup !== 'trial' && customerGroup !== 'mall' && customerGroup !== 'all') {
      if (userType === 'trial') {
        // 3일 체험 사용자만 조회 (testModeStartedAt이 있는 사용자)
        whereConditions.push({
          testModeStartedAt: { not: null },
        });
      } else if (userType === 'regular') {
        // 일반 사용자만 조회 (testModeStartedAt이 null인 사용자)
        whereConditions.push({
          OR: [
            { testModeStartedAt: null },
            { testModeStartedAt: undefined },
          ],
        });
      }
    }
    // userType === 'all'이면 필터링하지 않음

    // 연동된 크루즈몰 고객은 제외 (단, customerGroup이 'mall'이거나 'all'일 때는 제외하지 않음)
    if (customerGroup !== 'mall' && customerGroup !== 'all' && linkedMallUserIds.length > 0) {
      whereConditions.push({
        NOT: {
          AND: [
            { role: 'community' },
            { id: { in: linkedMallUserIds } },
          ],
        },
      });
    }

    // 검색 조건 추가
    // SQLite 호환: contains는 Prisma가 자동으로 LIKE로 변환하지만, 안전하게 처리
    if (search) {
      whereConditions.push({
        OR: [
          // SQLite에서는 contains가 LIKE로 변환됨
          { name: { contains: search } },
          { phone: { contains: search } },
          { email: { contains: search } },
        ],
      });
    }

    // 상태 필터
    if (status === 'active') {
      // 활성 상태: customerStatus가 'active', 'package', 'test'이고, 잠금/동면이 아닌 경우
      // 'test'는 3일 체험 사용자도 포함
      whereConditions.push({
        OR: [
          { customerStatus: { in: ['active', 'package', 'test'] } },
          {
            AND: [
              { customerStatus: null },
              { isHibernated: false },
              { isLocked: false },
            ],
          },
        ],
      });
    } else if (status === 'hibernated') {
      // 동면 상태: customerStatus가 'dormant'이거나 isHibernated가 true인 경우
      whereConditions.push({
        OR: [
          { customerStatus: 'dormant' },
          { isHibernated: true },
        ],
      });
    } else if (status === 'locked') {
      // 잠금 상태: customerStatus가 'locked'이거나 isLocked가 true인 경우
      whereConditions.push({
        OR: [
          { customerStatus: 'locked' },
          { isLocked: true },
        ],
      });
    }

    // 인증서 타입 필터 (all이 아닐 때만 적용)
    if (certificateType && certificateType !== 'all') {
      if (certificateType === 'purchase_confirmed') {
        whereConditions.push({
          customerStatus: 'purchase_confirmed',
        });
      } else if (certificateType === 'refunded') {
        whereConditions.push({
          customerStatus: 'refunded',
        });
      }
    }

    // 월별 필터 (가입 월 기준 - createdAt)
    if (monthFilter && monthFilter.trim() !== '') {
      try {
        const [year, month] = monthFilter.split('-').map(Number);
        if (year && month && !isNaN(year) && !isNaN(month)) {
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0, 23, 59, 59, 999);
          
          // createdAt 기준으로 필터링 (가입 월 기준)
          whereConditions.push({
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          });
        }
      } catch (monthFilterError: any) {
        console.error('[Admin Customers API] Month filter error:', monthFilterError);
        // 필터 파싱 실패 시 해당 필터 무시
      }
    }

    const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

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
    let total = 0;
    try {
      total = await prisma.user.count({ where });
    } catch (countError: any) {
      console.error('[Admin Customers API] Count query error:', countError);
      // count 실패 시 기본값 사용
      total = 0;
    }

    // 데이터 조회
    let customers: any[] = [];
    try {
      customers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
        lastActiveAt: true,
        tripCount: true,
        totalTripCount: true,
        isHibernated: true,
        isLocked: true,
        password: true, // 비밀번호 (평문)
        customerStatus: true, // ✅ customerStatus 필드 추가
        customerSource: true, // ✅ customerSource 필드 추가
        testModeStartedAt: true, // 테스트 모드 시작 시간
        currentTripEndDate: true,
        updatedAt: true, // 인증서 처리 날짜 확인용
        // metadata: true, // User 모델에 없으므로 제거
        mallUserId: true, // 크루즈몰 사용자 ID
        mallNickname: true, // 크루즈몰 닉네임
        kakaoChannelAdded: true, // 카카오 채널 추가 여부
        kakaoChannelAddedAt: true, // 카카오 채널 추가 일시
        pwaGenieInstalledAt: true, // 크루즈가이드 지니 바탕화면 추가 일시
        pwaMallInstalledAt: true, // 크루즈몰 바탕화면 추가 일시
        role: true, // role 추가 (크루즈몰 고객 구분용)
        AffiliateProfile: {
          select: {
            id: true,
            type: true,
            status: true,
            displayName: true,
            nickname: true,
            affiliateCode: true,
            branchLabel: true,
          },
        },
        UserTrip: {
          select: {
            id: true,
            cruiseName: true,
            companionType: true,
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
      orderBy,
      skip,
      take: limit,
      });
      // 성능 최적화: 불필요한 로그 제거
    } catch (findManyError: any) {
      console.error('[Admin Customers API] FindMany query error:', findManyError);
      console.error('[Admin Customers API] FindMany error details:', {
        message: findManyError?.message,
        code: findManyError?.code,
        meta: findManyError?.meta,
      });
      // 빈 배열 반환하여 계속 진행
      customers = [];
    }

    // 연동된 크루즈몰 고객 정보 조회 (mallUserId가 있는 크루즈 가이드 고객용)
    const mallUserIdsToFetch = customers
      .filter(c => c.mallUserId && c.role === 'user')
      .map(c => parseInt(c.mallUserId!, 10))
      .filter(id => !isNaN(id));
    
    const linkedMallUsers = mallUserIdsToFetch.length > 0
      ? await prisma.user.findMany({
          where: {
            id: { in: mallUserIdsToFetch },
            role: 'community',
          },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            mallNickname: true,
          },
        })
      : [];
    
    const mallUsersMap = new Map(
      linkedMallUsers.map(mu => [mu.id, mu])
    );

    // 크루즈몰 고객(role: 'community')이 크루즈가이드와 연동되었는지 확인
    // 1. mallUserId로 연결된 경우
    // 2. 이름과 연락처가 같은 경우 (통합 고객)
    const mallCustomerIds = customers
      .filter(c => c.role === 'community')
      .map(c => c.id.toString());
    
    const mallCustomerPhones = customers
      .filter(c => c.role === 'community' && c.phone)
      .map(c => c.phone!);
    
    const mallCustomerNames = customers
      .filter(c => c.role === 'community' && c.name)
      .map(c => c.name!);
    
    // 이름과 연락처로 통합 고객 찾기
    const linkedGenieUsers = (mallCustomerIds.length > 0 || mallCustomerPhones.length > 0 || mallCustomerNames.length > 0)
      ? await prisma.user.findMany({
          where: {
            role: 'user',
            OR: [
              // mallUserId로 연결
              { mallUserId: { in: mallCustomerIds } },
              { mallUserId: { in: mallCustomerPhones } },
              // 이름과 연락처가 같은 경우 (통합 고객)
              ...(mallCustomerNames.length > 0 && mallCustomerPhones.length > 0 ? [{
                AND: [
                  { name: { in: mallCustomerNames } },
                  { phone: { in: mallCustomerPhones } },
                ]
              }] : []),
            ],
          },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            mallUserId: true,
            UserTrip: {
              select: { id: true },
              take: 1,
            },
          },
        })
      : [];
    
    // 크루즈몰 고객 ID -> 크루즈가이드 사용자 매핑 생성
    const genieUsersMapByMallId = new Map<string, any>();
    const genieUsersMapByNamePhone = new Map<string, any>(); // 이름+연락처로 매핑
    
    linkedGenieUsers.forEach(genieUser => {
      if (genieUser.mallUserId) {
        // ID로 매핑
        const mallUserIdNum = parseInt(genieUser.mallUserId);
        if (!isNaN(mallUserIdNum)) {
          genieUsersMapByMallId.set(mallUserIdNum.toString(), genieUser);
        }
        // phone으로도 매핑 (mallUserId가 phone인 경우)
        genieUsersMapByMallId.set(genieUser.mallUserId, genieUser);
      }
      // 이름과 연락처로 매핑 (통합 고객)
      if (genieUser.name && genieUser.phone) {
        const key = `${genieUser.name}|${genieUser.phone}`;
        genieUsersMapByNamePhone.set(key, genieUser);
      }
    });
    
    // 크루즈가이드 사용자 ID -> 여행 존재 여부 매핑 생성
    const genieUserHasTripMap = new Map<number, boolean>();
    linkedGenieUsers.forEach(genieUser => {
      // UserTrip이 이미 조회되어 있으면 확인
      if (genieUser.UserTrip && genieUser.UserTrip.length > 0) {
        genieUserHasTripMap.set(genieUser.id, true);
      }
    });

    const preparedCustomers = customers.map((customer) => {
      let mergedCustomer = { ...customer };
      if (customer.mallUserId && customer.role === 'user') {
        const mallUserIdNum = parseInt(customer.mallUserId, 10);
        if (!isNaN(mallUserIdNum)) {
          const linkedMallUser = mallUsersMap.get(mallUserIdNum);
          if (linkedMallUser) {
            mergedCustomer = {
              ...customer,
              name: customer.name || (linkedMallUser as any).name || customer.mallNickname || null,
              phone: customer.phone || (linkedMallUser as any).phone || null,
              email: customer.email || (linkedMallUser as any).email || null,
              mallNickname: customer.mallNickname || (linkedMallUser as any).mallNickname || null,
            };
          }
        }
      }

      let isLinkedForMallCustomer = false;
      let linkedGenieUser = null;
      if (mergedCustomer.role === 'community') {
        // 1. mallUserId로 연결 확인
        linkedGenieUser = genieUsersMapByMallId.get(mergedCustomer.id.toString());
        if (!linkedGenieUser && mergedCustomer.phone) {
          linkedGenieUser = genieUsersMapByMallId.get(mergedCustomer.phone);
        }
        // 2. 이름과 연락처로 통합 고객 확인 (같은 고객이 크루즈몰과 크루즈가이드 지니를 모두 이용하는 경우)
        if (!linkedGenieUser && mergedCustomer.name && mergedCustomer.phone) {
          const namePhoneKey = `${mergedCustomer.name}|${mergedCustomer.phone}`;
          linkedGenieUser = genieUsersMapByNamePhone.get(namePhoneKey) || null;
        }
        isLinkedForMallCustomer = !!linkedGenieUser;
      }

      let linkedGenieHasTrip = false;
      if (linkedGenieUser) {
        linkedGenieHasTrip = genieUserHasTripMap.has(linkedGenieUser.id);
      }

      const hasTrip = mergedCustomer.UserTrip && mergedCustomer.UserTrip.length > 0;
      const customerStatus = mergedCustomer.customerStatus;
      const customerSource = mergedCustomer.customerSource;

      let customerType: 'cruise-guide' | 'mall' | 'test' | 'admin' | 'mall-admin' | 'prospect' = 'cruise-guide';

      if (customerSource === 'admin') {
        customerType = 'admin';
      } else if (customerSource === 'mall-admin') {
        customerType = 'mall-admin';
      } else if (customerSource === 'mall-signup') {
        customerType = 'mall';
      } else if (customerSource === 'test-guide') {
        customerType = 'test';
      } else if (customerSource === 'cruise-guide') {
        customerType = 'cruise-guide';
      } else if (customerSource === 'product-inquiry' || customerSource === 'phone-consultation') {
        // 절대법칙: 크루즈몰 전화상담 버튼으로 이름과 연락처를 입력한 고객은 잠재고객(prospect)
        customerType = 'prospect';
      } else if (customerStatus === 'test' || customerStatus === 'test-locked') {
        customerType = 'test';
      } else if (customerStatus === 'excel') {
        customerType = 'prospect';
      } else if (mergedCustomer.mallUserId && mergedCustomer.role === 'user') {
        customerType = 'mall';
      } else if (mergedCustomer.email && mergedCustomer.mallNickname && mergedCustomer.role === 'community') {
        customerType = 'mall';
      } else if (mergedCustomer.name && mergedCustomer.phone && hasTrip) {
        customerType = 'cruise-guide';
      }

      let genieStatus: 'active' | 'package' | 'dormant' | 'locked' | 'test' | 'test-locked' | null = null;

      if (customerType === 'test') {
        if (customerStatus === 'test-locked') {
          genieStatus = 'test-locked';
        } else if (mergedCustomer.testModeStartedAt) {
          const now = new Date();
          const testModeEndAt = new Date(mergedCustomer.testModeStartedAt);
          testModeEndAt.setHours(testModeEndAt.getHours() + 72);
          genieStatus = now > testModeEndAt ? 'test-locked' : 'test';
        } else {
          genieStatus = 'test';
        }
      } else if (customerType === 'prospect') {
        genieStatus = null;
      } else if (linkedGenieHasTrip && mergedCustomer.role === 'community') {
        genieStatus = 'active';
        if (mergedCustomer.isLocked || mergedCustomer.isHibernated || customerStatus === 'locked' || customerStatus === 'dormant') {
          // 비동기 업데이트 (await 없이 실행, 에러는 catch로 처리)
          prisma.user.update({
            where: { id: mergedCustomer.id },
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
            console.error(`[Admin Customers API] 크루즈몰 사용자 (ID: ${mergedCustomer.id}) 상태 활성화 실패:`, error);
          });
        }
      } else if (customerStatus === 'active' || customerStatus === 'package') {
        genieStatus = customerStatus;
      } else if (customerStatus === 'locked' || mergedCustomer.isLocked) {
        genieStatus = 'locked';
      } else if (customerStatus === 'dormant' || mergedCustomer.isHibernated) {
        genieStatus = 'dormant';
      } else if (hasTrip || linkedGenieHasTrip) {
        genieStatus = 'package';
      } else {
        genieStatus = 'locked';
      }

      // 비밀번호: PasswordEvent의 최신 비밀번호를 우선 사용, 없으면 password 필드 사용
      // password 필드가 해시된 경우를 대비해 PasswordEvent 우선
      const latestPasswordEvent = mergedCustomer.PasswordEvent && mergedCustomer.PasswordEvent.length > 0
        ? mergedCustomer.PasswordEvent[0]
        : null;
      
      // 비밀번호를 문자형식 그대로 표시 (관리자 요구사항)
      let currentPassword: string | null = null;
      if (latestPasswordEvent?.to) {
        currentPassword = latestPasswordEvent.to; // PasswordEvent의 비밀번호 (평문)
      } else if (mergedCustomer.password) {
        const pwd = mergedCustomer.password;
        // 해시된 비밀번호 감지 (bcrypt, argon2, scrypt 등)
        const isHashed =
          pwd.startsWith('$2') ||           // bcrypt
          pwd.startsWith('$argon2') ||      // argon2
          pwd.startsWith('$scrypt') ||      // scrypt
          pwd.length > 50 ||                // 너무 긴 문자열 (해시일 가능성)
          /^[a-f0-9]{64}$/i.test(pwd) ||    // SHA-256 hex
          /^[a-f0-9]{128}$/i.test(pwd) ||   // SHA-512 hex
          /[^\x20-\x7E]/.test(pwd);         // 출력 불가능한 문자 포함 (바이너리/인코딩)

        if (isHashed) {
          // 해시된 비밀번호는 표시 불가, 기본값 사용
          currentPassword = '(암호화됨) 3800';
        } else {
          // 평문 비밀번호
          currentPassword = pwd;
        }
      } else {
        // 비밀번호가 없으면 기본값
        currentPassword = '3800';
      }

      let daysRemaining: number | null = null;
      if (mergedCustomer.currentTripEndDate) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const endDate = new Date(mergedCustomer.currentTripEndDate);
        endDate.setHours(0, 0, 0, 0);
        const diffTime = endDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        daysRemaining = diffDays;
      }

      return {
        ...mergedCustomer,
        createdAt: mergedCustomer.createdAt.toISOString(),
        lastActiveAt: mergedCustomer.lastActiveAt?.toISOString() || null,
        currentTripEndDate: mergedCustomer.currentTripEndDate?.toISOString() || null,
        status: genieStatus,
        customerType: mergedCustomer.AffiliateProfile ? 'partner' : customerType,
        customerSource: mergedCustomer.customerSource || null, // 고객 유입 경로 (전화상담신청 딱지용)
        isMallUser: customerType === 'mall' || (!!mergedCustomer.mallUserId && mergedCustomer.role === 'user'),
        isLinked: (!!mergedCustomer.mallUserId && mergedCustomer.role === 'user') || isLinkedForMallCustomer,
        currentPassword,
        daysRemaining,
        kakaoChannelAdded: mergedCustomer.kakaoChannelAdded || false,
        kakaoChannelAddedAt: mergedCustomer.kakaoChannelAddedAt?.toISOString() || null,
        role: mergedCustomer.role,
        AffiliateProfile: mergedCustomer.AffiliateProfile ? {
          id: mergedCustomer.AffiliateProfile.id,
          type: mergedCustomer.AffiliateProfile.type,
          status: mergedCustomer.AffiliateProfile.status,
          displayName: mergedCustomer.AffiliateProfile.displayName,
          nickname: mergedCustomer.AffiliateProfile.nickname,
          affiliateCode: mergedCustomer.AffiliateProfile.affiliateCode,
          branchLabel: mergedCustomer.AffiliateProfile.branchLabel,
        } : null,
        trips: (mergedCustomer.UserTrip || []).map(trip => ({
          ...trip,
          startDate: trip.startDate?.toISOString() || null,
          endDate: trip.endDate?.toISOString() || null,
        })),
      };
    });

    // 각 고객의 Reservation 정보 조회 (구매 정보 및 여권 상태) - 성능 최적화: 병렬 처리
    const customerIds = preparedCustomers.map(c => c.id);
    
    // Reservation 조회와 소유권 조회를 병렬로 실행
    const [reservations, ownershipMap] = await Promise.all([
      // Reservation 조회 (결제 정보 포함)
      customerIds.length > 0 ? prisma.reservation.findMany({
        where: { mainUserId: { in: customerIds } },
        select: {
          id: true,
          mainUserId: true,
          tripId: true,
          totalPeople: true,
          passportStatus: true,
          affiliateSaleId: true,
          Traveler: {
            select: {
              id: true,
              passportNo: true,
              birthDate: true,
              expiryDate: true,
              engGivenName: true,
              engSurname: true,
              korName: true,
              passportImage: true, // 여권 이미지 포함
            },
          },
          // AffiliateSale과 Payment 정보 포함 (환불 기능용)
          AffiliateSale: {
            select: {
              id: true,
              status: true,
              saleAmount: true,
              refundedAt: true,
              Payment: {
                select: {
                  id: true,
                  orderId: true,
                  amount: true,
                  status: true,
                  buyerName: true,
                  buyerTel: true,
                  productName: true,
                  pgTransactionId: true,
                  paidAt: true,
                  cancelledAt: true,
                },
              },
            },
          },
        },
        orderBy: { id: 'desc' },
      }).catch((error) => {
        console.error('[Admin Customers API] Reservation query error:', error);
        return [];
      }) : Promise.resolve([]),
      
      // 소유권 정보 조회 (병렬 처리)
      getAffiliateOwnershipForUsers(
        preparedCustomers.map((customer) => ({
          id: customer.id,
          phone: customer.phone || null,
        })),
      ).catch((error: any) => {
        console.error('[Admin Customers API] Ownership query error:', error);
        return new Map();
      }),
    ]);
    
    // 방법 2는 제거: Reservation은 mainUserId로 직접 조회하는 것이 가장 안정적
    // APIS 관련 로직은 유지하되, Trip 모델 직접 조회는 제거
    
      // 성능 최적화: 불필요한 로그 제거

    // 고객별 Reservation 정보 매핑 (최신 예약 기준)
    const reservationMap = new Map<number, any>();
    reservations.forEach(res => {
      // mainUserId가 없는 예약은 건너뜀
      if (!res.mainUserId) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[Reservation Debug] Reservation ${res.id} has no mainUserId`);
        }
        return;
      }
      // 이미 있는 경우는 무시 (최신 것만 유지)
      if (!reservationMap.has(res.mainUserId)) {
        reservationMap.set(res.mainUserId, res);
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Reservation Debug] Mapped reservation ${res.id} to customer ${res.mainUserId}`, {
            totalPeople: res.totalPeople,
            travelersCount: res.Traveler?.length || 0,
            travelersWithPassport: res.Traveler?.filter(t => t.passportNo && t.passportNo.trim() !== '')?.length || 0,
          });
        }
      }
    });
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Reservation Debug] Total reservations: ${reservations.length}, Mapped to ${reservationMap.size} customers`);
      console.log(`[Reservation Debug] Customer IDs with reservations:`, Array.from(reservationMap.keys()));
    }

    // 고객별 예약 개수 계산
    const reservationCountMap = new Map<number, number>();
    reservations.forEach(res => {
      const count = reservationCountMap.get(res.mainUserId) || 0;
      reservationCountMap.set(res.mainUserId, count + 1);
    });

    // 고객 데이터에 구매 정보 및 여권 상태 추가
    const customersWithPurchaseInfo = preparedCustomers.map(customer => {
      const latestReservation = reservationMap.get(customer.id);
      const hasReservation = !!latestReservation;
      const reservationCount = reservationCountMap.get(customer.id) || 0;
      
      let passportInfo = null;
      if (latestReservation) {
        // 디버깅: 여권 정보 확인
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Passport Debug] Customer ${customer.id}:`, {
            hasReservation: true,
            totalPeople: latestReservation.totalPeople,
            travelersCount: latestReservation.Traveler?.length || 0,
            travelersWithPassportNo: latestReservation.Traveler?.filter(t => t.passportNo && t.passportNo.trim() !== '').length || 0,
          });
        }
        const totalPeople = latestReservation.totalPeople || 0;
        const travelersWithPassport = latestReservation.Traveler?.filter(t => t.passportNo && t.passportNo.trim() !== '')?.length || 0;
        const missingCount = Math.max(0, totalPeople - travelersWithPassport);
        
        // 여권 만료 6개월 이내 체크
        const sixMonthsFromNow = new Date();
        sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
        
        const expiringPassports = latestReservation.Traveler?.filter(t => {
          if (!t.expiryDate) return false;
          const expiryDate = new Date(t.expiryDate);
          return expiryDate <= sixMonthsFromNow && expiryDate >= new Date(); // 6개월 이내 + 아직 만료되지 않음
        }) || [];
        
        const expiredPassports = latestReservation.Traveler?.filter(t => {
          if (!t.expiryDate) return false;
          const expiryDate = new Date(t.expiryDate);
          return expiryDate < new Date(); // 이미 만료됨
        }) || [];
        
        passportInfo = {
          totalPeople,
          travelersWithPassport,
          missingCount,
          expiringCount: expiringPassports.length, // 6개월 이내 만료
          expiredCount: expiredPassports.length, // 이미 만료됨
          expiringPassports: expiringPassports.map(t => ({
            name: t.korName || `${t.engSurname || ''} ${t.engGivenName || ''}`.trim() || '이름 없음',
            expiryDate: t.expiryDate,
          })),
          expiredPassports: expiredPassports.map(t => ({
            name: t.korName || `${t.engSurname || ''} ${t.engGivenName || ''}`.trim() || '이름 없음',
            expiryDate: t.expiryDate,
          })),
        };
      }

      // 결제 정보 추출
      let paymentInfo = null;
      if (latestReservation?.AffiliateSale?.Payment) {
        const payment = latestReservation.AffiliateSale.Payment;
        paymentInfo = {
          id: payment.id,
          orderId: payment.orderId,
          amount: payment.amount,
          status: payment.status,
          buyerName: payment.buyerName,
          buyerTel: payment.buyerTel,
          productName: payment.productName,
          pgTransactionId: payment.pgTransactionId,
          paidAt: payment.paidAt?.toISOString() || null,
          cancelledAt: payment.cancelledAt?.toISOString() || null,
          canRefund: payment.status === 'paid' && !payment.cancelledAt && !!payment.pgTransactionId,
          saleStatus: latestReservation.AffiliateSale.status,
          saleAmount: latestReservation.AffiliateSale.saleAmount,
        };
      }

      return {
        ...customer,
        hasReservation,
        reservationCount,
        passportInfo,
        paymentInfo,
      };
    });

    // ownershipMap은 이미 위에서 병렬로 조회됨

    // 랜딩페이지로 유입된 고객의 점장 소유권 정보 조회
    const customerPhones = customersWithPurchaseInfo
      .map(c => c.phone)
      .filter((phone): phone is string => phone !== null);
    
    const landingPageOwnershipMap = new Map<number, {
      managerProfileId: number;
      managerDisplayName: string | null;
      managerBranchLabel: string | null;
      landingPageId: number;
      landingPageTitle: string | null;
    }>();

    if (customerPhones.length > 0) {
      // 랜딩페이지 등록 정보 조회
      const landingPageRegistrations = await prisma.landingPageRegistration.findMany({
        where: {
          phone: { in: customerPhones },
          userId: { not: null },
          deletedAt: null,
        },
        include: {
          LandingPage: {
            select: {
              id: true,
              title: true,
              adminId: true,
            },
          },
          User: {
            select: {
              id: true,
            },
          },
        },
      });

      // 성능 최적화: 랜딩페이지 ID 목록을 먼저 수집한 후 배치로 조회
      const landingPageIds = [...new Set(landingPageRegistrations.map(r => r.landingPageId))];
      
      // 모든 랜딩페이지의 공유 정보를 한 번에 조회
      const allSharedLandingPages = landingPageIds.length > 0
        ? await prisma.sharedLandingPage.findMany({
            where: {
              landingPageId: { in: landingPageIds },
            },
            include: {
              AffiliateProfile: {
                select: {
                  id: true,
                  displayName: true,
                  branchLabel: true,
                },
              },
            },
          })
        : [];
      
      // 랜딩페이지 ID별로 공유 정보 매핑
      const sharedByLandingPageId = new Map<number, typeof allSharedLandingPages>();
      for (const shared of allSharedLandingPages) {
        if (!sharedByLandingPageId.has(shared.landingPageId)) {
          sharedByLandingPageId.set(shared.landingPageId, []);
        }
        sharedByLandingPageId.get(shared.landingPageId)!.push(shared);
      }
      
      // 각 등록에 대해 점장 소유권 확인 (이미 조회한 데이터 사용)
      for (const registration of landingPageRegistrations) {
        if (!registration.User) continue;

        const sharedLandingPages = sharedByLandingPageId.get(registration.landingPageId) || [];
        
        for (const shared of sharedLandingPages) {
          if (!landingPageOwnershipMap.has(registration.User.id)) {
            landingPageOwnershipMap.set(registration.User.id, {
              managerProfileId: shared.managerProfileId,
              managerDisplayName: shared.AffiliateProfile?.displayName || null,
              managerBranchLabel: shared.AffiliateProfile?.branchLabel || null,
              landingPageId: registration.landingPageId,
              landingPageTitle: registration.LandingPage?.title || null,
            });
            break; // 첫 번째 매칭만 사용
          }
        }
      }
    }

    // 점장별 필터링 적용
    let filteredCustomers = customersWithPurchaseInfo;
    if (managerProfileId) {
      const managerId = parseInt(managerProfileId, 10);
      if (!isNaN(managerId)) {
        filteredCustomers = customersWithPurchaseInfo.filter(customer => {
          const ownership = ownershipMap.get(customer.id);
          const landingOwnership = landingPageOwnershipMap.get(customer.id);

          // AffiliateLead 기반 소유권 확인
          if (ownership) {
            if (ownership.ownerType === 'BRANCH_MANAGER' && ownership.ownerProfileId === managerId) {
              return true;
            }
          }

          // 랜딩페이지 기반 소유권 확인
          if (landingOwnership && landingOwnership.managerProfileId === managerId) {
            return true;
          }

          return false;
        });
      }
    }

    // 담당자 이름 검색 필터 적용
    if (ownerSearch) {
      const searchLower = ownerSearch.toLowerCase();
      filteredCustomers = filteredCustomers.filter(customer => {
        const ownership = ownershipMap.get(customer.id);
        const landingOwnership = landingPageOwnershipMap.get(customer.id);

        // AffiliateLead 기반 소유권에서 이름 검색
        if (ownership) {
          const ownerName = ownership.ownerName?.toLowerCase() || '';
          const ownerNickname = ownership.ownerNickname?.toLowerCase() || '';
          const managerName = ownership.managerProfile?.displayName?.toLowerCase() || '';
          const managerNickname = ownership.managerProfile?.nickname?.toLowerCase() || '';

          if (ownerName.includes(searchLower) ||
              ownerNickname.includes(searchLower) ||
              managerName.includes(searchLower) ||
              managerNickname.includes(searchLower)) {
            return true;
          }
        }

        // 랜딩페이지 기반 소유권에서 이름 검색
        if (landingOwnership) {
          const managerDisplayName = landingOwnership.managerDisplayName?.toLowerCase() || '';
          if (managerDisplayName.includes(searchLower)) {
            return true;
          }
        }

        return false;
      });
    }

    // 각 고객의 현재 그룹 계산 및 그룹 필터링
    let customersWithGroup: any[] = [];
    try {
      customersWithGroup = await Promise.all(
        filteredCustomers.map(async (customer) => {
          try {
            const ownership = ownershipMap.get(customer.id) || null;
            const landingOwnership = landingPageOwnershipMap.get(customer.id) || null;
            
            // 랜딩페이지 소유권 정보를 affiliateOwnership에 통합
            let finalOwnership = ownership;
            if (landingOwnership && !ownership) {
              // 랜딩페이지로만 유입된 경우
              finalOwnership = {
                ownerType: 'BRANCH_MANAGER' as const,
                ownerProfileId: landingOwnership.managerProfileId,
                ownerName: landingOwnership.managerDisplayName,
                ownerNickname: null,
                ownerAffiliateCode: null,
                ownerBranchLabel: landingOwnership.managerBranchLabel,
                ownerStatus: null,
                ownerPhone: null,
                source: 'landing-page' as const,
                managerProfile: null,
                leadId: null,
                leadStatus: null,
              };
            } else if (landingOwnership && ownership) {
              // 둘 다 있는 경우 랜딩페이지 정보를 우선
              finalOwnership = {
                ...ownership,
                ownerProfileId: landingOwnership.managerProfileId,
                ownerName: landingOwnership.managerDisplayName,
                ownerBranchLabel: landingOwnership.managerBranchLabel,
                source: 'landing-page' as const,
              };
            }

            // 현재 고객 그룹 계산 (성능 최적화: 이미 가져온 데이터로 직접 계산, DB 쿼리 없음)
            let currentGroup: CustomerGroup | 'landing-page' | null = null;
            try {
              // getCurrentCustomerGroup 로직을 인라인으로 구현 (이미 데이터가 있으므로 추가 쿼리 불필요)
              // 1. 환불고객 (최우선)
              if (customer.customerStatus === 'refunded') {
                currentGroup = 'refund';
              }
              // 2. 구매고객
              else if (customer.customerStatus === 'purchase_confirmed' || customer.hasReservation) {
                currentGroup = 'purchase';
              }
              // 3. 3일 체험 고객
              else if (customer.customerSource === 'test-guide' || customer.testModeStartedAt) {
                currentGroup = 'trial';
              }
              // 4. 크루즈몰 고객 (정확한 조건)
              else if (customer.role === 'community' && customer.customerSource === 'mall-signup') {
                currentGroup = 'mall';
              }
              // 5. 랜딩페이지 고객 (prospects로 매핑)
              else if (customer.customerSource === 'landing-page') {
                currentGroup = 'landing-page'; // 나중에 prospects로 매핑됨
              }
              
              // customerGroup이 'mall'이고 role이 'community', customerSource가 'mall-signup'이면 강제로 'mall' 그룹 설정
              if (customerGroup === 'mall' && customer.role === 'community' && customer.customerSource === 'mall-signup') {
                currentGroup = 'mall';
              }
            } catch (groupError: any) {
              console.error(`[Admin Customers API] Failed to get current group for user ${customer.id}:`, groupError);
              // 그룹 계산 실패 시 customerGroup이 'mall'이면 'mall'로 설정
              if (customerGroup === 'mall' && customer.role === 'community' && customer.customerSource === 'mall-signup') {
                currentGroup = 'mall';
              } else {
                currentGroup = null;
              }
            }

            return {
              ...customer,
              affiliateOwnership: finalOwnership ? { ...finalOwnership } : null,
              landingPageOwnership: landingOwnership,
              currentGroup: currentGroup === 'landing-page' ? null : currentGroup, // landing-page는 null로 변환 (prospects로 처리)
            };
          } catch (customerError: any) {
            console.error(`[Admin Customers API] Error processing customer ${customer.id}:`, customerError);
            // 에러가 발생해도 기본 정보는 반환
            return {
              ...customer,
              affiliateOwnership: null,
              landingPageOwnership: null,
              currentGroup: null,
            };
          }
        })
      );
      // 성능 최적화: 불필요한 로그 제거
    } catch (groupProcessingError: any) {
      console.error('[Admin Customers API] Error processing customers for group calculation:', groupProcessingError);
      // 에러 발생 시 기본 정보만으로 반환
      customersWithGroup = filteredCustomers.map(customer => ({
        ...customer,
        affiliateOwnership: null,
        landingPageOwnership: null,
        currentGroup: null,
      }));
    }

    // 고객 그룹 필터링 (passport는 구매고객 중 여권 정보가 있는/없는 고객)
    // customerGroup이 없거나 'all'이면 필터링하지 않음 (전체 고객 표시)
    const effectiveGroup: AdminCustomerGroup | null = customerGroup as AdminCustomerGroup | null;
    let customersWithOwnership = customersWithGroup;
    if (effectiveGroup && effectiveGroup !== 'all') {
      try {
        if (effectiveGroup === 'passport' as AdminCustomerGroup) {
          // 여권 관리: 구매고객 중 여권 정보가 있는 고객
          customersWithOwnership = customersWithGroup.filter(
            (c) => {
              const isPurchase = c.currentGroup === 'purchase';
              const hasPassportInfo = c.passportInfo && Object.keys(c.passportInfo).length > 0;
              return isPurchase && hasPassportInfo;
            }
          );
        } else if (effectiveGroup === 'manager-customers') {
          // 대리점장 고객: 소유권이 BRANCH_MANAGER인 고객만 (소스 충돌 방지)
          customersWithOwnership = customersWithGroup.filter(
            (c) => {
              try {
                if (!c.affiliateOwnership) return false;
                // 소유권 타입이 BRANCH_MANAGER인 경우만 필터링
                const isManagerCustomer = c.affiliateOwnership.ownerType === 'BRANCH_MANAGER';
                // 랜딩페이지 소유권도 확인 (랜딩페이지는 대리점장 소유)
                const hasLandingOwnership = c.landingPageOwnership && c.landingPageOwnership.managerProfileId;
                return isManagerCustomer || !!hasLandingOwnership;
              } catch (e) {
                console.error(`[Admin Customers API] Error filtering manager customer ${c.id}:`, e);
                return false; // 에러 발생 시 해당 고객 제외
              }
            }
          );
        } else if (effectiveGroup === 'agent-customers') {
          // 판매원 고객: 소유권이 SALES_AGENT인 고객만 (소스 충돌 방지)
          customersWithOwnership = customersWithGroup.filter(
            (c) => {
              try {
                if (!c.affiliateOwnership) return false;
                // 소유권 타입이 SALES_AGENT인 경우만 필터링
                return c.affiliateOwnership.ownerType === 'SALES_AGENT';
              } catch (e) {
                console.error(`[Admin Customers API] Error filtering agent customer ${c.id}:`, e);
                return false; // 에러 발생 시 해당 고객 제외
              }
            }
          );
        } else if (effectiveGroup === 'prospects') {
          // 잠재고객: 랜딩페이지로 유입된 고객 (landing-page 그룹)
          customersWithOwnership = customersWithGroup.filter(
            (c) => {
              try {
                // currentGroup이 landing-page이거나, 그룹이 없고 customerSource가 없는 경우
                if (c.currentGroup === 'landing-page') {
                  return true;
                }
                if (!c.currentGroup && !c.customerSource) {
                  return true; // 초기 상태는 잠재고객으로 분류
                }
                return false;
              } catch (e) {
                console.error(`[Admin Customers API] Error filtering prospects customer ${c.id}:`, e);
                return false;
              }
            }
          );
        } else if (effectiveGroup === 'mall') {
          // 크루즈몰 고객: DB에서 이미 필터링했지만, 안전을 위해 다시 확인
          customersWithOwnership = customersWithGroup.filter(
            (c) => {
              try {
                // role과 customerSource로 명확하게 필터링
                return c.role === 'community' && c.customerSource === 'mall-signup';
              } catch (e) {
                console.error(`[Admin Customers API] Error filtering mall customer ${c.id}:`, e);
                return false;
              }
            }
          );
        } else if ((customerGroupRaw as string) === 'inquiry') {
          // 문의 고객: product-inquiry 또는 phone-consultation
          customersWithOwnership = customersWithGroup.filter(
            (c) => {
              try {
                return c.customerSource === 'product-inquiry' || c.customerSource === 'phone-consultation';
              } catch (e) {
                console.error(`[Admin Customers API] Error filtering inquiry customer ${c.id}:`, e);
                return false;
              }
            }
          );
        } else {
          // 일반 그룹 필터링
          customersWithOwnership = customersWithGroup.filter(
            (c) => {
              // null 체크 및 그룹 매칭
              if (!c.currentGroup) {
                return false; // 초기 상태는 prospects 그룹으로 분류되므로 여기서는 제외
              }
              return c.currentGroup === effectiveGroup;
            }
          );
        }
      } catch (filterError: any) {
        console.error('[Admin Customers API] Group filter error:', filterError);
        // 필터링 에러 발생 시 전체 고객 반환 (에러 방지)
        customersWithOwnership = customersWithGroup;
      }
    }

    // 점장 목록 조회 (필터링 옵션용)
    const managers = await prisma.affiliateProfile.findMany({
      where: {
        type: 'BRANCH_MANAGER',
        status: 'ACTIVE',
      },
      select: {
        id: true,
        displayName: true,
        branchLabel: true,
        affiliateCode: true,
      },
      orderBy: {
        displayName: 'asc',
      },
    });

    // 그룹별 고객 수 계산 (성능 최적화: DB 집계 쿼리 사용)
    // 주의: groupCounts는 전체 고객을 기준으로 계산해야 하므로, 페이지네이션된 결과가 아닌 전체 고객을 기준으로 계산
    let groupCounts: Record<string, number> = {
      'all': 0,
      'trial': 0,
      'mall': 0,
      'purchase': 0,
      'refund': 0,
      'passport': 0,
      'manager-customers': 0,
      'agent-customers': 0,
      'prospects': 0,
      'inquiry': 0,
    };
    
    try {
      // 성능 최적화: 모든 count 쿼리를 병렬로 실행하여 대기 시간 최소화
      const [
        totalCount,
        refundCount,
        purchaseCount,
        trialCount,
        mallCount,
        prospectsCount,
        inquiryCount,
      ] = await Promise.all([
        // 전체 고객 수
        prisma.user.count({
          where: { role: { not: 'admin' } },
        }),
        // 환불 고객 수
        prisma.user.count({
          where: {
            role: { not: 'admin' },
            customerStatus: 'refunded',
          },
        }),
        // 구매 고객 수 (customerStatus가 'purchase_confirmed'이거나 Reservation이 있는 고객, 또는 customerSource가 'cruise-guide'인 고객)
        prisma.user.count({
          where: {
            role: { not: 'admin' },
            OR: [
              { customerStatus: 'purchase_confirmed' },
              { Reservation: { some: {} } },
              { customerSource: 'cruise-guide' }, // 크루즈가이드 고객 = 구매 고객
            ],
          },
        }),
        // 3일 체험 고객 수
        prisma.user.count({
          where: {
            role: { not: 'admin' },
            OR: [
              { customerSource: 'test-guide' },
              { testModeStartedAt: { not: null } },
            ],
          },
        }),
        // 크루즈몰 고객 수 (정확한 조건: role이 'community'이고 customerSource가 'mall-signup')
        prisma.user.count({
          where: {
            role: 'community',
            customerSource: 'mall-signup',
          },
        }),
        // prospects는 랜딩페이지 고객 + 그룹이 없는 고객
        prisma.user.count({
          where: {
            role: { not: 'admin' },
            OR: [
              { customerSource: 'landing-page' },
              {
                AND: [
                  { customerSource: { notIn: ['test-guide', 'mall-signup'] } },
                  { customerSource: null },
                ],
              },
            ],
            customerStatus: { notIn: ['purchase_confirmed', 'refunded'] },
            testModeStartedAt: null,
            NOT: {
              AND: [
                { role: 'community' },
                { customerSource: 'mall-signup' },
              ],
            },
            Reservation: { none: {} },
          },
        }),
        // 문의 고객 수 (product-inquiry 또는 phone-consultation)
        prisma.user.count({
          where: {
            role: { not: 'admin' },
            OR: [
              { customerSource: 'product-inquiry' },
              { customerSource: 'phone-consultation' },
            ],
          },
        }),
      ]);
      
      groupCounts['all'] = totalCount;
      groupCounts['refund'] = refundCount;
      groupCounts['purchase'] = purchaseCount;
      groupCounts['trial'] = trialCount;
      groupCounts['mall'] = mallCount;
      groupCounts['prospects'] = prospectsCount;
      groupCounts['inquiry'] = inquiryCount;
      
      // 소유권 기반 그룹 카운트는 별도로 계산 (성능 최적화를 위해 나중에 추가 가능)
      // 현재는 기본 그룹 카운트만 계산
      
      // 성능 최적화: 불필요한 로그 제거
      
    } catch (countError) {
      console.error('[Admin Customers API] Error calculating group counts:', countError);
      // 에러 발생 시 기본값 사용
      groupCounts['all'] = customersWithGroup.length;
    }
    
    // 페이지네이션 적용 (필터링된 고객 목록 기준)
    // 그룹 필터링 후에는 이미 메모리에서 필터링되었으므로 slice만 적용
    if (!Array.isArray(customersWithOwnership)) {
      console.error('[Admin Customers API] customersWithOwnership is not an array:', typeof customersWithOwnership);
      customersWithOwnership = [];
    }
    const paginatedCustomers = customersWithOwnership.slice(skip, skip + limit);
    
    // 총 개수는 필터링된 고객 목록의 길이
    const filteredTotal = customersWithOwnership.length;
    
    // 성능 최적화: 불필요한 로그 제거
    
    return NextResponse.json({
      ok: true,
      customers: paginatedCustomers,
      customersCount: paginatedCustomers.length, // 현재 페이지의 고객 수
      total: filteredTotal, // 필터링된 전체 고객 수
      managers: managers.map(m => ({
        id: m.id,
        displayName: m.displayName,
        branchLabel: m.branchLabel,
        affiliateCode: m.affiliateCode,
      })),
      groupCounts, // 그룹별 고객 수 추가
      pagination: {
        total: filteredTotal,
        page,
        limit,
        totalPages: Math.ceil(filteredTotal / limit),
      },
    }, {
      // 성능 최적화: API 응답 캐싱 헤더 추가
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        // s-maxage: CDN/프록시 캐시 시간 (30초)
        // stale-while-revalidate: 캐시 만료 후에도 60초간 오래된 데이터 제공 (백그라운드 재검증)
      },
    });
  } catch (error: any) {
    console.error('[Admin Customers API] Error:', error);
    console.error('[Admin Customers API] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      code: error?.code,
      meta: error?.meta,
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    // Prisma 에러인 경우 더 자세한 정보 제공
    if (error?.code) {
      console.error('[Admin Customers API] Prisma error code:', error.code);
      console.error('[Admin Customers API] Prisma error meta:', error.meta);
    }
    
    return NextResponse.json(
      { 
        ok: false, 
        error: '고객 목록을 불러올 수 없습니다.',
        details: process.env.NODE_ENV === 'development' 
          ? {
              message: error instanceof Error ? error.message : String(error),
              code: error?.code,
              meta: error?.meta,
            }
          : undefined
      },
      { status: 500 }
    );
  }
}
