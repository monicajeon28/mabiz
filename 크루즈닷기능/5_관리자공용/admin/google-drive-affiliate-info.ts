// lib/google-drive-affiliate-info.ts
// 판매원/대리점장 정보를 Google Drive에 저장하는 유틸리티

import { uploadFileToDrive, findOrCreateFolder } from '../google-drive';
import { getDriveFolderId } from '@/lib/config/drive-config';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * 판매원/대리점장 정보 파일을 Google Drive에 업로드 (계층적 구조)
 * 구조: Affiliate_Documents -> [Code]_[Name] -> [Type]
 */
export async function uploadAffiliateInfoFile(
  affiliateId: string | number,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string = 'image/jpeg',
  fileType: 'idCard' | 'bankbook' | 'contract' | 'signature' | 'audio' | 'other' = 'other'
): Promise<{ ok: boolean; url?: string; fileId?: string; error?: string }> {
  try {
    // 1. 루트 폴더 ID 가져오기 (AFFILIATE_DOCUMENTS)
    const affiliateDocsFolderId = await getDriveFolderId('AFFILIATE_DOCUMENTS');

    if (!affiliateDocsFolderId) {
      return {
        ok: false,
        error: 'GOOGLE_DRIVE_AFFILIATE_DOCUMENTS_FOLDER_ID가 설정되지 않았습니다.',
      };
    }

    // 2. 판매원 정보 조회 (폴더명 생성을 위해)
    let folderName = `affiliate_${affiliateId}`; // 기본값

    // affiliateId가 숫자면 DB 조회 시도
    const idNum = Number(affiliateId);
    if (!isNaN(idNum)) {
      try {
        // 1순위: userId로 AffiliateProfile 조회 (업로드 API에서 session.userId를 전달하므로)
        let profile = await prisma.affiliateProfile.findFirst({
          where: { userId: idNum },
          select: {
            affiliateCode: true,
            User: { select: { name: true } }
          }
        });

        // userId로 못 찾았으면 profile.id로 조회 시도 (백업용)
        if (!profile) {
          profile = await prisma.affiliateProfile.findUnique({
            where: { id: idNum },
            select: {
              affiliateCode: true,
              User: { select: { name: true } }
            }
          });
        }

        if (profile) {
          const code = profile.affiliateCode || `AFF-${idNum}`;
          const name = profile.User?.name || 'Unknown';
          folderName = `${code}_${name}`; // [Code]_[Name] 형식
        } else {
          // 2순위: AffiliateContract 조회 (이름만 사용)
          const contract = await prisma.affiliateContract.findUnique({
            where: { id: idNum },
            select: {
              name: true,
              User_AffiliateContract_userIdToUser: { select: { name: true } }
            }
          });

          if (contract) {
            const name = contract.name || contract.User_AffiliateContract_userIdToUser?.name || 'Unknown';
            folderName = `Contract_${idNum}_${name}`;
          }
        }
      } catch (e) {
        logger.warn('[Affiliate Info Upload] Failed to fetch affiliate info for folder name:', e);
      }
    }

    // 3. 판매원 폴더 생성/찾기
    const affiliateFolderResult = await findOrCreateFolder(folderName, affiliateDocsFolderId);

    if (!affiliateFolderResult.ok || !affiliateFolderResult.folderId) {
      return {
        ok: false,
        error: affiliateFolderResult.error || '판매원 폴더 생성 실패',
      };
    }

    // 4. 파일 타입별 서브폴더 생성 (영어 이름 사용)
    let targetFolderId = affiliateFolderResult.folderId;
    const typeFolderMap: Record<string, string> = {
      idCard: 'ID_Cards',
      bankbook: 'BankBooks',
      contract: 'Contracts',
      signature: 'Signatures',
      audio: 'Audio',
      other: 'Etc'
    };

    const subFolderName = typeFolderMap[fileType] || 'Etc';

    const typeFolderResult = await findOrCreateFolder(subFolderName, targetFolderId);
    if (typeFolderResult.ok && typeFolderResult.folderId) {
      targetFolderId = typeFolderResult.folderId;
    }

    // 5. Google Drive에 업로드
    const uploadResult = await uploadFileToDrive({
      folderId: targetFolderId,
      fileName: fileName,
      mimeType: mimeType,
      buffer: fileBuffer,
      makePublic: false, // 판매원 정보는 비공개
    });

    if (uploadResult.ok && uploadResult.url) {
      return {
        ok: true,
        url: uploadResult.url,
        fileId: uploadResult.fileId,
      };
    } else {
      return {
        ok: false,
        error: uploadResult.error || '파일 업로드 실패',
      };
    }
  } catch (error: any) {
    logger.error('[Affiliate Info Upload] Error:', error);
    return {
      ok: false,
      error: error?.message || '파일 업로드 중 오류가 발생했습니다.',
    };
  }
}

/**
 * 계약서 승인 시 서명 이미지를 Drive에 백업
 */
export async function backupContractSignaturesToDrive(
  contractId: number,
  profileId: number,
  contractName: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    // 계약서 조회
    const contract = await prisma.affiliateContract.findUnique({
      where: { id: contractId },
      select: {
        metadata: true,
      },
    });

    if (!contract) {
      return { ok: false, error: '계약서를 찾을 수 없습니다.' };
    }

    const metadata = contract.metadata as any;
    const signatures = metadata?.signatures;

    if (!signatures) {
      logger.log('[Signature Backup] 서명이 없습니다.');
      return { ok: true }; // 서명이 없어도 성공으로 처리
    }

    // 프로필 조회
    const profile = await prisma.affiliateProfile.findUnique({
      where: { id: profileId },
      select: {
        affiliateCode: true,
        User: { select: { name: true } },
      },
    });

    if (!profile) {
      return { ok: false, error: '프로필을 찾을 수 없습니다.' };
    }

    // 서명 타입별로 업로드
    for (const sigType of ['main', 'b2b', 'education']) {
      const sig = signatures[sigType];
      if (sig?.url && sig.url.startsWith('data:image')) {
        // Base64 데이터 추출
        const matches = sig.url.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1];
          const base64Content = matches[2];
          const buffer = Buffer.from(base64Content, 'base64');
          const fileName = `${sigType}_signature_${contractName}_${contractId}.png`;

          const result = await uploadAffiliateInfoFile(
            profileId,
            buffer,
            fileName,
            mimeType,
            'signature'
          );

          if (result.ok) {
            logger.log(`[Signature Backup] ${sigType} 서명 업로드 성공: ${result.url}`);
          } else {
            logger.error(`[Signature Backup] ${sigType} 서명 업로드 실패: ${result.error}`);
          }
        }
      }
    }

    return { ok: true };
  } catch (error: any) {
    logger.error('[Signature Backup] Error:', error);
    return { ok: false, error: error?.message || '서명 백업 중 오류가 발생했습니다.' };
  }
}

/**
 * 계약서 승인 시 PDF를 Drive에 백업 (Contracts 폴더에 저장)
 */
export async function backupContractPDFToDrive(
  contractId: number,
  profileId: number,
  contractName: string
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    // PDF 생성
    const { generateContractPDFFromId } = await import('@/lib/affiliate/contract-pdf');
    const pdfBuffer = await generateContractPDFFromId(contractId);

    // 파일명 생성
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const fileName = `contract_${contractName}_${contractId}_${timestamp}.pdf`;

    // uploadAffiliateInfoFile을 사용하여 Contracts 폴더에 저장
    const result = await uploadAffiliateInfoFile(
      profileId,
      pdfBuffer,
      fileName,
      'application/pdf',
      'contract'
    );

    if (result.ok) {
      logger.log(`[Contract PDF Backup] PDF 업로드 성공: ${result.url}`);
      return { ok: true, url: result.url };
    } else {
      logger.error(`[Contract PDF Backup] PDF 업로드 실패: ${result.error}`);
      return { ok: false, error: result.error };
    }
  } catch (error: any) {
    logger.error('[Contract PDF Backup] Error:', error);
    return { ok: false, error: error?.message || 'PDF 백업 중 오류가 발생했습니다.' };
  }
}

/**
 * Deprecated: Use uploadAffiliateInfoFile instead
 */
export async function uploadAffiliateFileByType(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string = 'image/jpeg',
  fileType: 'idCard' | 'bankbook' | 'contract' | 'signature' | 'audio'
): Promise<{ ok: boolean; url?: string; fileId?: string; error?: string }> {
  // Redirect to new function with a generic ID if specific ID not provided
  // This function signature doesn't have ID, so we can't organize by folder properly.
  // But existing calls might need migration.
  // For now, let's try to use a "Unsorted" folder or just fail gracefully?
  // Better: Update callers to provide ID.
  logger.warn('[Deprecated] uploadAffiliateFileByType called. Please use uploadAffiliateInfoFile.');
  return uploadAffiliateInfoFile('Unsorted', fileBuffer, fileName, mimeType, fileType);
}
