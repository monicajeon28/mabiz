export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * 정액제 판매원의 DB(고객 데이터) 백업
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || sessionUser.role !== 'admin') {
      return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;
    const contractId = parseInt(id);

    // 계약서 조회
    const contract = await prisma.affiliateContract.findUnique({
      where: { id: contractId },
      include: {
        User_AffiliateContract_userIdToUser: {
          include: {
            AffiliateProfile: true,
          },
        },
      },
    });

    if (!contract || !contract.User_AffiliateContract_userIdToUser) {
      return NextResponse.json({ ok: false, message: '계약서를 찾을 수 없습니다.' }, { status: 404 });
    }

    const profileId = contract.User_AffiliateContract_userIdToUser.AffiliateProfile?.id;
    if (!profileId) {
      return NextResponse.json({ ok: false, message: '어필리에이트 프로필을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 고객(리드) 데이터 백업
    const leads = await prisma.affiliateLead.findMany({
      where: {
        OR: [
          { agentId: profileId },
          { managerId: profileId },
        ],
      },
      include: {
        AffiliateSale: true,
      },
    });

    // 판매 데이터 백업
    const sales = await prisma.affiliateSale.findMany({
      where: {
        OR: [
          { agentId: profileId },
          { managerId: profileId },
        ],
      },
      include: {
        Reservation: true,
        CommissionLedger: true,
      },
    });

    // 링크 데이터 백업
    const links = await prisma.affiliateLink.findMany({
      where: {
        OR: [
          { agentId: profileId },
          { managerId: profileId },
        ],
      },
    });

    const backupData = {
      user: {
        id: contract.User_AffiliateContract_userIdToUser.id,
        name: contract.User_AffiliateContract_userIdToUser.name,
        phone: contract.User_AffiliateContract_userIdToUser.phone,
        email: contract.User_AffiliateContract_userIdToUser.email,
        mallUserId: contract.User_AffiliateContract_userIdToUser.mallUserId,
      },
      profile: contract.User_AffiliateContract_userIdToUser.AffiliateProfile,
      contract: {
        id: contract.id,
        name: contract.name,
        phone: contract.phone,
        status: contract.status,
        contractStartDate: contract.contractStartDate,
        contractEndDate: contract.contractEndDate,
      },
      leads: leads.map((lead) => ({
        id: lead.id,
        customerName: lead.customerName,
        customerPhone: lead.customerPhone,
        status: lead.status,
        createdAt: lead.createdAt,
        saleCount: lead.AffiliateSale.length,
      })),
      sales: sales.map((sale) => ({
        id: sale.id,
        productCode: sale.productCode,
        saleAmount: sale.saleAmount,
        status: sale.status,
        saleDate: sale.saleDate,
        createdAt: sale.createdAt,
        reservationCount: sale.Reservation.length,
        commissionCount: sale.CommissionLedger.length,
      })),
      links: links.map((link) => ({
        id: link.id,
        productCode: link.productCode,
        status: link.status,
        createdAt: link.createdAt,
      })),
      backupDate: new Date().toISOString(),
      backupBy: sessionUser.id,
      backupType: 'manual', // 수동 백업 표시
      summary: {
        leadCount: leads.length,
        saleCount: sales.length,
        linkCount: links.length,
        totalCount: leads.length + sales.length + links.length,
      },
    };

    // Google Drive에 정액제 백업 파일 저장 (자동 백업 시스템과 연동)
    const BACKUP_FOLDER_ID = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID || '1HSV-t7Z7t8byMDJMY5srrpJ3ziGqz9xK';
    let driveBackupUrl: string | null = null;

    try {
      const { uploadFileToDrive } = await import('@/lib/google-drive');

      // 백업 데이터를 JSON 문자열로 변환
      const backupJson = JSON.stringify(backupData, null, 2);
      const backupBuffer = Buffer.from(backupJson, 'utf-8');

      // 파일명: {mallUserId}_manual_backup_{날짜}_{시간}.json
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const fileName = `${contract.User_AffiliateContract_userIdToUser.mallUserId ?? 'unknown'}_manual_backup_${dateStr}.json`;

      const uploadResult = await uploadFileToDrive({
        folderId: BACKUP_FOLDER_ID,
        fileName,
        mimeType: 'application/json',
        buffer: backupBuffer,
        makePublic: false,
      });

      if (uploadResult.ok && uploadResult.url) {
        driveBackupUrl = uploadResult.url;
        logger.log('[Subscription Backup DB] Google Drive 업로드 성공', {
          contractId: contract.id,
          userId: contract.userId,
          fileName,
        });
      } else {
        logger.warn('[Subscription Backup DB] Google Drive 업로드 실패', {
          error: uploadResult.error,
        });
      }
    } catch (driveError: unknown) {
      logger.error('[Subscription Backup DB] Google Drive 업로드 오류', {
        error: driveError instanceof Error ? driveError.message : 'unknown',
      });
      // Google Drive 업로드 실패해도 로컬 다운로드는 계속 진행
    }

    // JSON 파일로 다운로드 가능하도록 반환
    const filename = `subscription_${contract.User_AffiliateContract_userIdToUser.mallUserId}_backup_${new Date().toISOString().split('T')[0]}.json`;

    return NextResponse.json({
      ok: true,
      message: driveBackupUrl
        ? 'DB 백업이 완료되었습니다. (Google Drive에도 저장되었습니다)'
        : 'DB 백업이 완료되었습니다. (Google Drive 저장 실패, 로컬 다운로드만 가능)',
      data: backupData,
      filename,
      driveBackupUrl,
    });
  } catch (error: unknown) {
    logger.error('[Subscription Backup DB API] Error', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { ok: false, message: 'DB 백업에 실패했습니다.' },
      { status: 500 }
    );
  }
}
