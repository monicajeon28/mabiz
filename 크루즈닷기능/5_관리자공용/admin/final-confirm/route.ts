import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인 헬퍼
async function checkAdminAuth(): Promise<{ ok: boolean; userId?: number; userName?: string; error?: string }> {
  const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sid) {
    return { ok: false, error: '로그인이 필요합니다.' };
  }

  const session = await prisma.session.findUnique({
    where: { id: sid },
    include: {
      User: {
        select: { id: true, role: true, name: true },
      },
    },
  });

  if (!session?.User) {
    return { ok: false, error: '세션이 만료되었습니다.' };
  }

  if (session.User.role !== 'admin') {
    return { ok: false, error: '관리자 권한이 필요합니다.' };
  }

  return { ok: true, userId: session.User.id, userName: session.User.name || undefined };
}

/**
 * 관리자 최종확인 관리 API
 * - GET: 최종확인 요청 목록 조회
 * - POST: 최종확인 승인/거절
 */

// GET: 최종확인 요청 목록 조회
export async function GET(request: NextRequest) {
  try {
    const auth = await checkAdminAuth();
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.error === '관리자 권한이 필요합니다.' ? 403 : 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'REQUESTED'; // PENDING, REQUESTED, APPROVED, REJECTED
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // 최종확인 요청된 예약 조회
    const where: any = {};
    if (status !== 'ALL') {
      where.finalConfirmStatus = status;
    }

    const [reservations, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        include: {
          User: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
          Trip: {
            select: {
              id: true,
              productCode: true,
              shipName: true,
              departureDate: true,
            },
          },
          Traveler: {
            select: {
              id: true,
              korName: true,
              engSurname: true,
              engGivenName: true,
              passportNo: true,
              passportImage: true,
              expiryDate: true,
            },
          },
          AffiliateSale: {
            include: {
              AffiliateProfile_agentIdToAffiliateProfile: {
                select: {
                  id: true,
                  displayName: true,
                  branchLabel: true,
                  type: true,
                },
              },
              AffiliateLead: {
                select: {
                  id: true,
                  customerName: true,
                  customerPhone: true,
                },
              },
            },
          },
        },
        orderBy: [
          { finalConfirmRequestedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.reservation.count({ where }),
    ]);

    // 데이터 가공
    const items = reservations.map((r) => {
      const sale = r.AffiliateSale;
      const agent = sale?.AffiliateProfile_agentIdToAffiliateProfile;
      const lead = sale?.AffiliateLead;

      return {
        id: r.id,
        // 고객 정보
        customer: {
          id: r.User?.id,
          name: r.User?.name || lead?.customerName || '-',
          phone: r.User?.phone || lead?.customerPhone || '-',
          email: r.User?.email,
        },
        // 상품 정보
        trip: r.Trip ? {
          id: r.Trip.id,
          productCode: r.Trip.productCode,
          shipName: r.Trip.shipName,
          departureDate: r.Trip.departureDate,
        } : null,
        // 여행자 정보 (여권 포함)
        travelers: r.Traveler?.map((t) => ({
          id: t.id,
          korName: t.korName,
          engName: `${t.engSurname || ''} ${t.engGivenName || ''}`.trim(),
          passportNo: t.passportNo,
          passportImage: t.passportImage,
          expiryDate: t.expiryDate,
        })) || [],
        // 담당자 정보
        agent: agent ? {
          id: agent.id,
          displayName: agent.displayName,
          legalName: agent.legalName,
          type: agent.type,
        } : null,
        // 예약 상태
        pnrStatus: r.pnrStatus,
        passportStatus: r.passportStatus,
        cabinType: r.cabinType,
        // 최종확인 상태
        finalConfirm: {
          status: (r as any).finalConfirmStatus || 'PENDING',
          requestedAt: (r as any).finalConfirmRequestedAt,
          approvedAt: (r as any).finalConfirmApprovedAt,
          rejectedAt: (r as any).finalConfirmRejectedAt,
          rejectionReason: (r as any).finalConfirmRejectionReason,
          audioUrl: (r as any).finalConfirmAudioDriveUrl,
        },
        // 기타
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });

    return NextResponse.json({
      ok: true,
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error: any) {
    console.error('[Admin Final Confirm GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 최종확인 승인/거절
export async function POST(request: NextRequest) {
  try {
    const auth = await checkAdminAuth();
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.error === '관리자 권한이 필요합니다.' ? 403 : 401 });
    }

    const body = await request.json();
    const { reservationId, action, rejectionReason } = body;

    if (!reservationId || !action) {
      return NextResponse.json({ ok: false, error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ ok: false, error: '잘못된 액션입니다.' }, { status: 400 });
    }

    // 예약 조회
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        AffiliateSale: {
          include: {
            AffiliateProfile_agentIdToAffiliateProfile: {
              select: {
                id: true,
                legalName: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    if (!reservation) {
      return NextResponse.json({ ok: false, error: '예약을 찾을 수 없습니다.' }, { status: 404 });
    }

    if ((reservation as any).finalConfirmStatus !== 'REQUESTED') {
      return NextResponse.json({ ok: false, error: '요청 상태가 아닙니다.' }, { status: 400 });
    }

    const agent = reservation.AffiliateSale?.AffiliateProfile_agentIdToAffiliateProfile;
    const agentLegalName = agent?.legalName || agent?.displayName || '';

    if (action === 'approve') {
      // 승인 처리
      await prisma.reservation.update({
        where: { id: reservationId },
        data: {
          finalConfirmStatus: 'APPROVED',
          finalConfirmApprovedAt: new Date(),
          finalConfirmApprovedById: auth.userId,
          lastModifiedByName: agentLegalName, // 최종수정자 = 담당자 계약서상 이름
        } as any,
      });

      // AffiliateSale 상태도 CONFIRMED로 변경 (수수료 확정)
      if (reservation.AffiliateSale) {
        await prisma.affiliateSale.update({
          where: { id: reservation.AffiliateSale.id },
          data: {
            status: 'CONFIRMED',
            confirmedAt: new Date(),
          },
        });
      }

      // 관리자 액션 로그
      await prisma.adminActionLog.create({
        data: {
          adminId: auth.userId!,
          action: 'FINAL_CONFIRM_APPROVED',
          details: {
            reservationId,
            agentLegalName,
            approvedBy: auth.userName,
          },
        },
      });

      return NextResponse.json({
        ok: true,
        message: '최종확인이 승인되었습니다.',
        status: 'APPROVED',
      });

    } else {
      // 거절 처리
      if (!rejectionReason) {
        return NextResponse.json({ ok: false, error: '거절 사유를 입력해주세요.' }, { status: 400 });
      }

      await prisma.reservation.update({
        where: { id: reservationId },
        data: {
          finalConfirmStatus: 'REJECTED',
          finalConfirmRejectedAt: new Date(),
          finalConfirmRejectedById: auth.userId,
          finalConfirmRejectionReason: rejectionReason,
        } as any,
      });

      // 관리자 액션 로그
      await prisma.adminActionLog.create({
        data: {
          adminId: auth.userId!,
          action: 'FINAL_CONFIRM_REJECTED',
          details: {
            reservationId,
            rejectionReason,
            rejectedBy: auth.userName,
          },
        },
      });

      return NextResponse.json({
        ok: true,
        message: '최종확인이 거절되었습니다.',
        status: 'REJECTED',
      });
    }

  } catch (error: any) {
    console.error('[Admin Final Confirm POST] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
