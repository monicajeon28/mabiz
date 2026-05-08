export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 관리자 권한 체크
    const user = await prisma.user.findUnique({
      where: { id: Number(session.userId) },
      select: { role: true },
    });

    if (!user || !['admin', 'superadmin'].includes(user.role || '')) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    // 예약 목록 조회 (결제 완료된 예약만)
    const reservations = await prisma.reservation.findMany({
      where: {
        // 취소되지 않은 예약만
        status: { not: 'CANCELLED' },
      },
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
            shipName: true,
            departureDate: true,
            spreadsheetId: true,
            productCode: true,
          },
        },
        Traveler: {
          select: {
            id: true,
            korName: true,
            engSurname: true,
            engGivenName: true,
            passportNo: true,
            nationality: true,
            birthDate: true,
            issueDate: true,    // 여권생성일
            expiryDate: true,
            gender: true,
            residentNum: true,  // 주민번호
            roomNumber: true,
            passportImage: true,
            notes: true,        // 비고
          },
        },
        AffiliateSale: {
          select: {
            id: true,
            status: true,
            saleDate: true,
            refundedAt: true,
            createdAt: true,
            updatedAt: true,
            AffiliateProfile_agentIdToAffiliateProfile: {
              select: {
                id: true,
                displayName: true,
                type: true,
                userId: true,
              },
            },
            AffiliateProfile_managerIdToAffiliateProfile: {
              select: {
                id: true,
                displayName: true,
                type: true,
                userId: true,
              },
            },
            AffiliateLink: {
              select: {
                id: true,
                code: true,
                title: true,
              },
            },
            Payment: {
              select: {
                id: true,
                orderId: true,
                amount: true,
                status: true,
                paidAt: true,
                cancelledAt: true,
                pgTransactionId: true,
                buyerName: true,
                buyerTel: true,
                pgProvider: true,
                metadata: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const mappedReservations = reservations.map((r) => {
      // 결제 메타데이터에서 결제 방법 추출
      const paymentMetadata = r.AffiliateSale?.Payment?.metadata as Record<string, any> | null;
      const payMethod = paymentMetadata?.payMethod || paymentMetadata?.pay_method || r.AffiliateSale?.Payment?.pgProvider || null;

      // 판매 채널 결정: 링크가 있으면 해당 링크 정보, 없으면 직접판매
      const agent = r.AffiliateSale?.AffiliateProfile_agentIdToAffiliateProfile;
      const manager = r.AffiliateSale?.AffiliateProfile_managerIdToAffiliateProfile;
      const link = r.AffiliateSale?.AffiliateLink;

      let salesChannel = '직접 판매';
      let salesChannelDetail = '';

      if (link) {
        salesChannel = link.title || `링크(${link.code})`;
        salesChannelDetail = link.code;
      } else if (agent) {
        salesChannel = agent.displayName || '판매원';
        salesChannelDetail = agent.type === 'SALES' ? '판매원' : agent.type === 'BRANCH' ? '대리점장' : agent.type || '';
      }

      return {
        id: r.id,
        totalPeople: r.totalPeople,
        pnrStatus: r.pnrStatus,
        createdAt: r.createdAt?.toISOString(),
        user: r.User ? {
          id: r.User.id,
          name: r.User.name,
          phone: r.User.phone,
          email: r.User.email,
        } : null,
        trip: r.Trip ? {
          id: r.Trip.id,
          departureDate: r.Trip.departureDate?.toISOString(),
          spreadsheetId: r.Trip.spreadsheetId,
          shipName: r.Trip.shipName,
          productCode: r.Trip.productCode,
          product: {
            cruiseLine: null,
            shipName: r.Trip.shipName,
            packageName: r.Trip.productCode,
          },
        } : null,
        travelers: r.Traveler.map((t) => ({
          id: t.id,
          korName: t.korName,
          engSurname: t.engSurname,
          engGivenName: t.engGivenName,
          passportNo: t.passportNo,
          nationality: t.nationality,
          birthDate: t.birthDate,
          issueDate: t.issueDate,      // 여권생성일
          expiryDate: t.expiryDate,
          gender: t.gender,
          residentNum: t.residentNum,  // 주민번호
          roomNumber: t.roomNumber,
          passportImage: t.passportImage,
          notes: t.notes,              // 비고
        })),
        // 판매원 정보 (실제 판매자)
        agent: agent ? {
          id: agent.id,
          displayName: agent.displayName,
          type: agent.type,
        } : null,
        // 대리점장 정보
        manager: manager ? {
          id: manager.id,
          displayName: manager.displayName,
          type: manager.type,
        } : null,
        // 판매 채널 정보
        salesChannel,
        salesChannelDetail,
        // 판매 링크 정보
        link: link ? {
          id: link.id,
          code: link.code,
          title: link.title,
        } : null,
        // 결제 정보 추가
        payment: r.AffiliateSale?.Payment ? {
          id: r.AffiliateSale.Payment.id,
          orderId: r.AffiliateSale.Payment.orderId,
          amount: r.AffiliateSale.Payment.amount,
          status: r.AffiliateSale.Payment.status,
          paidAt: r.AffiliateSale.Payment.paidAt?.toISOString(),
          cancelledAt: r.AffiliateSale.Payment.cancelledAt?.toISOString(),
          pgTransactionId: r.AffiliateSale.Payment.pgTransactionId,
          buyerName: r.AffiliateSale.Payment.buyerName,
          buyerTel: r.AffiliateSale.Payment.buyerTel,
          payMethod: payMethod,
        } : null,
        // 판매/환불 상태
        saleStatus: r.AffiliateSale?.status || null,
        saleRefundedAt: r.AffiliateSale?.refundedAt?.toISOString() || null,
        // 판매일 (AffiliateSale 기준)
        saleDate: r.AffiliateSale?.saleDate?.toISOString() || r.AffiliateSale?.createdAt?.toISOString() || null,
      };
    });

    return NextResponse.json({
      ok: true,
      reservations: mappedReservations,
    });
  } catch (error: any) {
    console.error('[Admin Purchased Customers] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch reservations' },
      { status: 500 }
    );
  }
}
