export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/sales-confirmation/pending/route.ts
// 승인 대기 목록 조회 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdminAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * GET: 승인 대기 목록 조회
 */
export async function GET(req: NextRequest) {
  try {
    // 1. 관리자 권한 + 세션 만료 확인
    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    // 2. 승인 대기 판매 조회
    const pendingSales = await prisma.affiliateSale.findMany({
      where: {
        status: 'PENDING_APPROVAL',
      },
      select: {
        id: true,
        productCode: true,
        saleAmount: true,
        saleDate: true,
        submittedAt: true,
        audioFileGoogleDriveUrl: true,
        audioFileName: true,
        audioFileType: true,
        AffiliateProfile_agentIdToAffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            nickname: true,
            affiliateCode: true,
            User: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
          },
        },
        AffiliateProfile_managerIdToAffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            nickname: true,
            affiliateCode: true,
            User: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
          },
        },
        AffiliateLead: {
          select: {
            id: true,
            customerName: true,
            customerPhone: true,
          },
        },
        AffiliateProduct: {
          select: {
            productCode: true,
            title: true,
          },
        },
        Reservation: {
          select: {
            id: true,
            passportStatus: true,
            pnrStatus: true,
          },
          orderBy: { id: 'desc' },
          take: 1,
        },
      },
      orderBy: {
        submittedAt: 'asc', // 오래된 것부터
      },
    });

    return NextResponse.json({
      ok: true,
      sales: pendingSales.map((sale) => ({
        id: sale.id,
        productCode: sale.productCode,
        productTitle: sale.AffiliateProduct?.title,
        saleAmount: sale.saleAmount,
        saleDate: sale.saleDate,
        submittedAt: sale.submittedAt,
        audioFileGoogleDriveUrl: sale.audioFileGoogleDriveUrl,
        audioFileName: sale.audioFileName,
        audioFileType: sale.audioFileType,
        agent: sale.AffiliateProfile_agentIdToAffiliateProfile
          ? {
              name:
                sale.AffiliateProfile_agentIdToAffiliateProfile.displayName ||
                sale.AffiliateProfile_agentIdToAffiliateProfile.nickname ||
                sale.AffiliateProfile_agentIdToAffiliateProfile.User?.name ||
                null,
              code: sale.AffiliateProfile_agentIdToAffiliateProfile.affiliateCode,
              phone: sale.AffiliateProfile_agentIdToAffiliateProfile.User?.phone || null,
            }
          : null,
        manager: sale.AffiliateProfile_managerIdToAffiliateProfile
          ? {
              name:
                sale.AffiliateProfile_managerIdToAffiliateProfile.displayName ||
                sale.AffiliateProfile_managerIdToAffiliateProfile.nickname ||
                sale.AffiliateProfile_managerIdToAffiliateProfile.User?.name ||
                null,
              code: sale.AffiliateProfile_managerIdToAffiliateProfile.affiliateCode,
              phone: sale.AffiliateProfile_managerIdToAffiliateProfile.User?.phone || null,
            }
          : null,
        customer: sale.AffiliateLead
          ? {
              id: sale.AffiliateLead.id,
              customerName: sale.AffiliateLead.customerName,
              customerPhone: sale.AffiliateLead.customerPhone,
            }
          : null,
        reservation: sale.Reservation[0]
          ? {
              id: sale.Reservation[0].id,
              passportStatus: sale.Reservation[0].passportStatus,
              pnrStatus: sale.Reservation[0].pnrStatus,
            }
          : null,
        // 예약 없는 구형 Sale → undefined (UI에서 승인 버튼 활성 유지)
        canApprove: sale.Reservation[0]
          ? sale.Reservation[0].passportStatus === 'COMPLETED' &&
            sale.Reservation[0].pnrStatus === 'COMPLETED'
          : undefined,
      })),
      count: pendingSales.length,
    });
  } catch (error: any) {
    logger.error('[Sales Confirmation Pending] Error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
