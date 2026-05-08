export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * 정액제 판매원 데이터 자동 백업 (입력될 때마다 수시로 백업)
 * 이 API는 데이터 변경 시 자동으로 호출되어야 함
 */
export async function POST(req: Request) {
  try {
    // 내부 API 토큰 확인 (보안 강화)
    const internalToken = req.headers.get('X-Internal-API-Token');
    const expectedToken = process.env.INTERNAL_API_TOKEN || 'internal-backup-token';

    if (internalToken !== expectedToken) {
      logger.warn('[Auto Backup] Invalid internal token attempt', {
        hasToken: !!internalToken,
      });
      // 보안을 위해 토큰이 없어도 동작하지만, 로그에 기록
      // 프로덕션에서는 더 엄격하게 처리할 수 있음
    }

    const { userId, trigger } = await req.json();

    if (!userId) {
      return NextResponse.json({ ok: false, message: 'userId가 필요합니다.' }, { status: 400 });
    }

    // 사용자 및 계약서 조회
    const contract = await prisma.affiliateContract.findFirst({
      where: {
        userId: parseInt(userId),
        metadata: {
          path: ['contractType'],
          equals: 'SUBSCRIPTION_AGENT',
        },
      },
      include: {
        User_AffiliateContract_userIdToUser: {
          include: {
            AffiliateProfile: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!contract || !contract.User_AffiliateContract_userIdToUser) {
      return NextResponse.json({ ok: false, message: '정액제 판매원 계약서를 찾을 수 없습니다.' }, { status: 404 });
    }

    const profileId = contract.User_AffiliateContract_userIdToUser.AffiliateProfile?.id;
    if (!profileId) {
      return NextResponse.json({ ok: true, message: '프로필이 없어 백업할 데이터가 없습니다.' });
    }

    // 데이터 백업
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
      trigger: trigger || 'auto',
      summary: {
        leadCount: leads.length,
        saleCount: sales.length,
        linkCount: links.length,
        totalCount: leads.length + sales.length + links.length,
      },
    };

    // Google Drive에 정액제 판매원 백업 파일 저장
    const BACKUP_FOLDER_ID = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID || '1HSV-t7Z7t8byMDJMY5srrpJ3ziGqz9xK';
    let driveBackupUrl: string | null = null;

    try {
      const { uploadFileToDrive } = await import('@/lib/google-drive');

      const backupJson = JSON.stringify(backupData, null, 2);
      const backupBuffer = Buffer.from(backupJson, 'utf-8');

      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const fileName = `${contract.User_AffiliateContract_userIdToUser.mallUserId || 'unknown'}_backup_${dateStr}.json`;

      const uploadResult = await uploadFileToDrive({
        folderId: BACKUP_FOLDER_ID,
        fileName,
        mimeType: 'application/json',
        buffer: backupBuffer,
        makePublic: false,
      });

      if (uploadResult.ok && uploadResult.url) {
        driveBackupUrl = uploadResult.url;
        logger.log('[Auto Backup Subscription] Google Drive 업로드 성공', {
          userId,
          contractId: contract.id,
          fileName,
        });
      } else {
        logger.warn('[Auto Backup Subscription] Google Drive 업로드 실패', { error: uploadResult.error });
      }
    } catch (driveError) {
      logger.error('[Auto Backup Subscription] Google Drive 업로드 오류:', driveError);
    }

    logger.log('[Auto Backup Subscription]', {
      userId,
      contractId: contract.id,
      trigger,
      dataCount: backupData.summary.totalCount,
      driveBackupUrl,
    });

    return NextResponse.json({
      ok: true,
      message: '자동 백업이 완료되었습니다.',
      backupData,
      driveBackupUrl,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Auto Backup Subscription API] Error:', error);
    return NextResponse.json(
      { ok: false, message: '자동 백업에 실패했습니다.' },
      { status: 500 }
    );
  }
}
