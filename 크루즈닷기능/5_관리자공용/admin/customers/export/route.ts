export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import * as XLSX from 'xlsx';
import { getAffiliateOwnershipForUsers } from '@/lib/affiliate/customer-ownership';

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

    return session?.User?.role === 'admin';
  } catch (error) {
    console.error('[Export Customers] Auth check error:', error);
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    // 관리자 권한 확인
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
        error: '인증이 필요합니다.' 
      }, { status: 403 });
    }

    // URL 파라미터
    const { searchParams } = new URL(req.url);
    const customerGroup = searchParams.get('customerGroup') || 'all';

    // 전체 고객 조회 (페이지네이션 없이)
    const whereConditions: any[] = [
      { role: { not: 'admin' } },
    ];

    // customerGroup 필터링
    if (customerGroup && customerGroup !== 'all') {
      if (customerGroup === 'mall') {
        whereConditions.push({
          role: 'community',
          customerSource: 'mall-signup',
        });
      } else if (customerGroup === 'trial') {
        whereConditions.push({
          OR: [
            { customerSource: 'test-guide' },
            { testModeStartedAt: { not: null } },
          ],
        });
      } else if (customerGroup === 'purchase') {
        whereConditions.push({
          OR: [
            { customerStatus: 'purchase_confirmed' },
            { Reservation: { some: {} } },
            { customerSource: 'cruise-guide' },
          ],
        });
      } else if (customerGroup === 'refund') {
        whereConditions.push({
          customerStatus: 'refunded',
        });
      }
    }

    const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

    // 고객 데이터 조회
    const customers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
        lastActiveAt: true,
        customerStatus: true,
        customerSource: true,
        role: true,
        mallUserId: true,
        mallNickname: true,
        testModeStartedAt: true,
        isHibernated: true,
        isLocked: true,
        tripCount: true,
        totalTripCount: true,
        AffiliateProfile: {
          select: {
            displayName: true,
            branchLabel: true,
            affiliateCode: true,
          },
        },
        UserTrip: {
          select: {
            cruiseName: true,
            destination: true,
            startDate: true,
            endDate: true,
          },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Reservation 정보 조회 (병렬 처리)
    const customerIds = customers.map(c => c.id);
    const [reservations, ownershipMap] = await Promise.all([
      customerIds.length > 0
        ? prisma.reservation.findMany({
            where: { mainUserId: { in: customerIds } },
            select: {
              id: true,
              mainUserId: true,
              totalPeople: true,
              Traveler: {
                select: {
                  korName: true,
                  engSurname: true,
                  engGivenName: true,
                  passportNo: true,
                  expiryDate: true,
                  issueDate: true,
                },
              },
            },
            orderBy: { id: 'desc' },
          })
        : Promise.resolve([]),
      getAffiliateOwnershipForUsers(
        customers.map(c => ({ id: c.id, phone: c.phone || null }))
      ).catch(() => new Map()),
    ]);

    // Reservation 매핑
    const reservationMap = new Map<number, typeof reservations[0]>();
    reservations.forEach(res => {
      if (res.mainUserId && !reservationMap.has(res.mainUserId)) {
        reservationMap.set(res.mainUserId, res);
      }
    });

    // 엑셀 데이터 준비
    const excelData = customers.map(customer => {
      const reservation = reservationMap.get(customer.id);
      const ownership = ownershipMap.get(customer.id);
      const trip = customer.UserTrip?.[0];

      // 고객 유형 결정
      let customerType = '일반';
      if (customer.customerSource === 'mall-signup' || customer.role === 'community') {
        customerType = '크루즈몰';
      } else if (customer.customerSource === 'cruise-guide' || customer.customerStatus === 'purchase_confirmed' || reservation) {
        customerType = '크루즈가이드';
      } else if (customer.customerSource === 'test-guide' || customer.testModeStartedAt) {
        customerType = '3일 체험';
      }

      // 소속 정보
      let affiliation = '본사';
      if (ownership) {
        if (ownership.ownerType === 'BRANCH_MANAGER') {
          affiliation = ownership.ownerBranchLabel || ownership.ownerName || '대리점장';
        } else if (ownership.ownerType === 'SALES_AGENT') {
          affiliation = ownership.ownerName || '판매원';
        }
      } else if (customer.AffiliateProfile) {
        affiliation = customer.AffiliateProfile.branchLabel || customer.AffiliateProfile.displayName || '본사';
      }

      return {
        'ID': customer.id,
        '이름': customer.name || '',
        '전화번호': customer.phone || '',
        '이메일': customer.email || '',
        '고객 유형': customerType,
        '소속': affiliation,
        '가입일': customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('ko-KR') : '',
        '최근 접속일': customer.lastActiveAt ? new Date(customer.lastActiveAt).toLocaleDateString('ko-KR') : '',
        '여행 횟수': customer.tripCount || 0,
        '총 여행 횟수': customer.totalTripCount || 0,
        '상태': customer.customerStatus || '',
        '동면': customer.isHibernated ? 'Y' : 'N',
        '잠금': customer.isLocked ? 'Y' : 'N',
        '크루즈명': trip?.cruiseName || '',
        '여행지': Array.isArray(trip?.destination) ? trip.destination.join(', ') : (trip?.destination || ''),
        '출발일': trip?.startDate ? new Date(trip.startDate).toLocaleDateString('ko-KR') : '',
        '종료일': trip?.endDate ? new Date(trip.endDate).toLocaleDateString('ko-KR') : '',
        '예약 인원': reservation?.totalPeople || 0,
        '여권 등록 수': reservation?.Traveler?.filter(t => t.passportNo && t.passportNo.trim() !== '')?.length || 0,
        '여권 미등록 수': reservation ? Math.max(0, (reservation.totalPeople || 0) - (reservation.Traveler?.filter(t => t.passportNo && t.passportNo.trim() !== '')?.length || 0)) : 0,
      };
    });

    // 엑셀 파일 생성
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '고객 목록');

    // 버퍼로 변환
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 파일명 생성
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `고객목록_${customerGroup}_${dateStr}.xlsx`;

    // 응답 반환
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error: any) {
    console.error('[Export Customers] Error:', error);
    return NextResponse.json(
      { 
        ok: false, 
        error: '엑셀 다운로드 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
