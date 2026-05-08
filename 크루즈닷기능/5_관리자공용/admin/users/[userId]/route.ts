export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdminAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';

// 고객 상세 정보 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const auth = await checkAdminAuth();

    if (!auth.isAdmin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      include: {
        Reservation: {
          include: {
            Traveler: true,
            Trip: {
              include: {
                Reservation: {
                  include: {
                    Traveler: true,
                  },
                },
              },
            },
            AffiliateSale: {
              include: {
                AffiliateProfile_agentIdToAffiliateProfile: {
                  select: {
                    id: true,
                    displayName: true,
                    type: true,
                    contactPhone: true,
                    affiliateCode: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        CustomerNote_CustomerNote_customerIdToUser: {
          orderBy: { createdAt: 'desc' },
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

    if (!user) {
      return NextResponse.json({ ok: false, error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    // APIS 정보 조회
    let apisInfo = null;
    const latestReservation = user.Reservation[0];
    if (latestReservation?.Trip) {
      const trip = latestReservation.Trip;
      apisInfo = {
        spreadsheetId: (trip as any).spreadsheetId || null,
        googleFolderId: (trip as any).googleFolderId || null,
        tripId: trip.id,
      };
    }

    // 담당자 정보 (가장 최근 예약의 담당자)
    const assignedManager = latestReservation?.AffiliateSale?.AffiliateProfile_agentIdToAffiliateProfile || null;

    // 상담기록 포맷팅
    const consultationNotes = user.CustomerNote_CustomerNote_customerIdToUser.map((note) => {
      let createdByLabel = '본사';
      if (note.createdByType === 'BRANCH_MANAGER') {
        createdByLabel = '대리점장';
      } else if (note.createdByType === 'SALES_AGENT') {
        createdByLabel = '판매원';
      }

      return {
        id: note.id,
        content: note.content,
        consultedAt: note.consultedAt?.toISOString() || note.createdAt.toISOString(),
        nextActionDate: note.nextActionDate?.toISOString() || null,
        nextActionNote: note.nextActionNote,
        statusAfter: note.statusAfter,
        audioFileUrl: note.audioFileUrl,
        createdByLabel,
        createdByName: note.createdByName || '관리자',
        createdAt: note.createdAt.toISOString(),
      };
    });

    // Reservation에서 Trip 정보를 추출하여 trips 배열 생성
    const tripsMap = new Map<number, any>();
    user.Reservation.forEach((res: any) => {
      if (res.Trip && !tripsMap.has(res.Trip.id)) {
        tripsMap.set(res.Trip.id, {
          ...res.Trip,
          Reservation: res.Trip.Reservation || [res],
        });
      }
    });
    const trips = Array.from(tripsMap.values());

    // 비밀번호 처리: PasswordEvent 우선, 없으면 password 필드 (해시 감지)
    const latestPasswordEvent = (user as any).PasswordEvent && (user as any).PasswordEvent.length > 0
      ? (user as any).PasswordEvent[0]
      : null;

    let currentPassword: string | null = null;
    if (latestPasswordEvent?.to) {
      // PasswordEvent의 비밀번호 (평문)
      currentPassword = latestPasswordEvent.to;
    } else if (user.password) {
      const pwd = user.password;
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

    // 응답 데이터 구성
    const responseData = {
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
        lastActiveAt: user.lastActiveAt?.toISOString() || null,
        isLocked: user.isLocked,
        isHibernated: user.isHibernated,
        customerStatus: user.customerStatus,
        customerSource: user.customerSource,
        role: user.role,
        mallUserId: user.mallUserId,
        mallNickname: user.mallNickname,
        kakaoChannelAdded: user.kakaoChannelAdded,
        kakaoChannelAddedAt: user.kakaoChannelAddedAt?.toISOString() || null,
        pwaGenieInstalledAt: user.pwaGenieInstalledAt?.toISOString() || null,
        pwaMallInstalledAt: user.pwaMallInstalledAt?.toISOString() || null,
        currentPassword, // 관리자용 비밀번호 표시 (해시 감지 적용)
        nextActionDate: user.nextActionDate?.toISOString() || null,
        nextActionNote: user.nextActionNote,
        customerGroupId: user.customerGroupId,
        customerGroupName: null, // 추후 CustomerGroup 모델 연결 시 구현
        assignedManager,
        consultationNotes,
        trips,
        reservations: user.Reservation,
        refundHistory: [], // RefundHistory 관계가 없으므로 빈 배열
        apisInfo,
      },
    };

    return NextResponse.json(responseData);
  } catch (error: any) {
    logger.error('[Admin User Detail Error]', error);
    return NextResponse.json({ ok: false, error: error.message || '조회 실패' }, { status: 500 });
  }
}

// 고객 정보 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const auth = await checkAdminAuth();

    if (!auth.isAdmin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const {
      customerStatus,
      nextActionDate,
      nextActionNote,
      customerGroupId,
      adminMemo,
    } = body;

    const updateData: any = {};

    if (customerStatus !== undefined) {
      updateData.customerStatus = customerStatus;
    }
    if (nextActionDate !== undefined) {
      updateData.nextActionDate = nextActionDate ? new Date(nextActionDate) : null;
    }
    if (nextActionNote !== undefined) {
      updateData.nextActionNote = nextActionNote;
    }
    if (customerGroupId !== undefined) {
      updateData.customerGroupId = customerGroupId;
    }
    if (adminMemo !== undefined) {
      updateData.adminMemo = adminMemo;
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: updateData,
    });

    // Google 스프레드시트 백업 트리거 (비동기)
    import('@/lib/google/customer-backup').then(({ backupCustomerToSheet }) => {
      backupCustomerToSheet(parseInt(userId)).catch((err: any) => {
        logger.error('[Google Backup Error]', err);
      });
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: updatedUser.id,
        customerStatus: updatedUser.customerStatus,
        nextActionDate: updatedUser.nextActionDate?.toISOString() || null,
        nextActionNote: updatedUser.nextActionNote,
      },
      message: '고객 정보가 수정되었습니다.',
    });
  } catch (error: any) {
    logger.error('[Admin User Update Error]', error);
    return NextResponse.json({ ok: false, error: error.message || '수정 실패' }, { status: 500 });
  }
}
