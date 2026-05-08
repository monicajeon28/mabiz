export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * 무료 체험 종료 후 재구매 안한 계정 자동 삭제
 * (cron job 또는 수동 실행용)
 */
export async function POST() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || sessionUser.role !== 'admin') {
      return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
    }

    const now = new Date();
    const deletedAccounts = [];
    const skippedAccounts = [];

    const expiredTrials = await prisma.affiliateContract.findMany({
      where: {
        AND: [
          {
            metadata: {
              path: ['contractType'],
              equals: 'SUBSCRIPTION_AGENT',
            },
          },
          {
            metadata: {
              path: ['isTrial'],
              equals: true,
            },
          },
        ],
      },
      include: {
        User_AffiliateContract_userIdToUser: {
          include: {
            AffiliateProfile: true,
          },
        },
      },
    });

    for (const contract of expiredTrials) {
      const metadata = (contract.metadata as Record<string, unknown>) || {};
      const trialEndDate = metadata.trialEndDate ? new Date(metadata.trialEndDate as string) : null;

      // 무료 체험 종료일이 지난 경우만 처리
      if (trialEndDate && now > trialEndDate) {
        // 재구매 여부 확인
        const hasPaid = contract.status === 'completed' && contract.contractEndDate && now < contract.contractEndDate;

        if (hasPaid) {
          skippedAccounts.push({
            contractId: contract.id,
            userId: contract.userId,
            mallUserId: contract.User_AffiliateContract_userIdToUser?.mallUserId,
            reason: '재구매 완료',
          });
          continue;
        }

        // 데이터 사용량 확인
        const profileId = contract.User_AffiliateContract_userIdToUser?.AffiliateProfile?.id;
        let totalDataCount = 0;

        if (profileId) {
          const leadCount = await prisma.affiliateLead.count({
            where: {
              OR: [
                { agentId: profileId },
                { managerId: profileId },
              ],
            },
          });

          const saleCount = await prisma.affiliateSale.count({
            where: {
              OR: [
                { agentId: profileId },
                { managerId: profileId },
              ],
            },
          });

          const linkCount = await prisma.affiliateLink.count({
            where: {
              OR: [
                { agentId: profileId },
                { managerId: profileId },
              ],
            },
          });

          totalDataCount = leadCount + saleCount + linkCount;
        }

        // 데이터가 있으면 백업 후 삭제
        if (totalDataCount > 0) {
          const backupData = {
            user: {
              id: contract.User_AffiliateContract_userIdToUser?.id,
              name: contract.User_AffiliateContract_userIdToUser?.name,
              phone: contract.User_AffiliateContract_userIdToUser?.phone,
              email: contract.User_AffiliateContract_userIdToUser?.email,
              mallUserId: contract.User_AffiliateContract_userIdToUser?.mallUserId,
            },
            profile: contract.User_AffiliateContract_userIdToUser?.AffiliateProfile,
            contract: {
              id: contract.id,
              name: contract.name,
              phone: contract.phone,
              status: contract.status,
              contractStartDate: contract.contractStartDate,
              contractEndDate: contract.contractEndDate,
            },
            backupDate: new Date().toISOString(),
            backupReason: '무료 체험 종료 자동 삭제',
            dataCount: totalDataCount,
          };

          const BACKUP_FOLDER_ID = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID || '1HSV-t7Z7t8byMDJMY5srrpJ3ziGqz9xK';
          try {
            const { uploadFileToDrive } = await import('@/lib/google-drive');

            const backupJson = JSON.stringify(backupData, null, 2);
            const backupBuffer = Buffer.from(backupJson, 'utf-8');

            const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const fileName = `${contract.User_AffiliateContract_userIdToUser?.mallUserId || 'unknown'}_deleted_backup_${dateStr}.json`;

            const uploadResult = await uploadFileToDrive({
              folderId: BACKUP_FOLDER_ID,
              fileName,
              mimeType: 'application/json',
              buffer: backupBuffer,
              makePublic: false,
            });

            if (uploadResult.ok && uploadResult.url) {
              logger.log('[Auto Delete Expired Trials] Google Drive 백업 성공', {
                contractId: contract.id,
                fileName,
              });
            } else {
              logger.warn('[Auto Delete Expired Trials] Google Drive 백업 실패', { error: uploadResult.error });
            }
          } catch (driveError) {
            logger.error('[Auto Delete Expired Trials] Google Drive 백업 오류:', driveError);
          }

          logger.log('[Auto Delete Expired Trials] Backup', {
            contractId: contract.id,
            userId: contract.userId,
            dataCount: totalDataCount,
          });
        }

        // 계약서 삭제
        await prisma.affiliateContract.delete({
          where: { id: contract.id },
        });

        deletedAccounts.push({
          contractId: contract.id,
          userId: contract.userId,
          mallUserId: contract.User_AffiliateContract_userIdToUser?.mallUserId,
          dataCount: totalDataCount,
        });

        logger.log('[Auto Delete Expired Trials] Deleted', {
          contractId: contract.id,
          userId: contract.userId,
          mallUserId: contract.User_AffiliateContract_userIdToUser?.mallUserId,
          dataCount: totalDataCount,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      message: `처리 완료: ${deletedAccounts.length}개 삭제, ${skippedAccounts.length}개 스킵`,
      deleted: deletedAccounts,
      skipped: skippedAccounts,
    });
  } catch (error) {
    logger.error('[Auto Delete Expired Trials API] Error:', error);
    return NextResponse.json(
      { ok: false, message: '자동 삭제 처리에 실패했습니다.' },
      { status: 500 }
    );
  }
}
