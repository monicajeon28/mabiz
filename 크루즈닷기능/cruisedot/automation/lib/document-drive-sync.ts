// lib/affiliate/document-drive-sync.ts
// 어필리에이트 문서 구글 드라이브 동기화 유틸리티

import { findOrCreateFolder, uploadFileToDrive } from '@/lib/google-drive';
import prisma from '@/lib/prisma';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { generateContractPDFFromId } from '@/lib/affiliate/contract-pdf';
import dayjs from 'dayjs';

const ROOT_FOLDER_NAME = 'Affiliate_Documents';

/**
 * 프로필별 구글 드라이브 폴더 구조 생성 또는 찾기
 * 
 * Affiliate_Documents/
 * ├── {affiliateCode}_이름/
 * │   ├── Contracts/
 * │   ├── ID_Cards/
 * │   └── Bankbooks/
 */
export async function createProfileFolderStructure(profileId: number) {
  try {
    // 1. 프로필 정보 조회
    const profile = await prisma.affiliateProfile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        affiliateCode: true,
        displayName: true,
        type: true,
      },
    });

    if (!profile) {
      return { ok: false, error: '프로필을 찾을 수 없습니다.' };
    }

    // 2. 최상위 폴더 찾기/생성
    const rootFolderResult = await findOrCreateFolder(ROOT_FOLDER_NAME);
    if (!rootFolderResult.ok || !rootFolderResult.folderId) {
      return { ok: false, error: rootFolderResult.error || '루트 폴더를 찾거나 생성할 수 없습니다.' };
    }
    const rootFolderId = rootFolderResult.folderId;

    // 3. 프로필 폴더 이름 생성
    const profileFolderName = `${profile.affiliateCode}_${profile.displayName}`;
    const profileFolderResult = await findOrCreateFolder(profileFolderName, rootFolderId);
    if (!profileFolderResult.ok || !profileFolderResult.folderId) {
      return { ok: false, error: profileFolderResult.error || '프로필 폴더를 찾거나 생성할 수 없습니다.' };
    }
    const profileFolderId = profileFolderResult.folderId;

    // 4. 하위 폴더들 생성
    const subfolders = ['Contracts', 'ID_Cards', 'Bankbooks', 'Signatures'];
    const folderIds: Record<string, string> = {};

    for (const subfolderName of subfolders) {
      const subfolderResult = await findOrCreateFolder(subfolderName, profileFolderId);
      if (subfolderResult.ok && subfolderResult.folderId) {
        folderIds[subfolderName] = subfolderResult.folderId;
      } else {
        console.error(`[Document Drive Sync] Failed to create subfolder ${subfolderName}:`, subfolderResult.error);
      }
    }

    return {
      ok: true,
      profileFolderId,
      folderIds,
      profileFolderName,
    };
  } catch (error: any) {
    console.error('[Document Drive Sync] createProfileFolderStructure error:', error);
    return { ok: false, error: error.message || '폴더 구조 생성 중 오류가 발생했습니다.' };
  }
}

/**
 * 신분증 또는 통장 사본을 구글 드라이브에 업로드
 */
export async function uploadDocumentToDrive(params: {
  profileId: number;
  documentType: 'ID_CARD' | 'BANKBOOK';
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}) {
  try {
    const { profileId, documentType, buffer, fileName, mimeType } = params;

    // 1. 폴더 구조 생성
    const folderStructure = await createProfileFolderStructure(profileId);
    if (!folderStructure.ok || !folderStructure.folderIds) {
      return { ok: false, error: folderStructure.error || '폴더 구조를 생성할 수 없습니다.' };
    }

    // 2. 문서 타입에 따라 폴더 선택
    const folderKey = documentType === 'ID_CARD' ? 'ID_Cards' : 'Bankbooks';
    const folderId = folderStructure.folderIds[folderKey];

    if (!folderId) {
      return { ok: false, error: `${folderKey} 폴더를 찾을 수 없습니다.` };
    }

    // 3. 파일 이름에 타임스탬프 추가
    const timestamp = dayjs().format('YYYY-MM-DD_HHmmss');
    const fileExtension = fileName.split('.').pop() || 'jpg';
    const uniqueFileName = `${documentType.toLowerCase()}_${timestamp}.${fileExtension}`;

    // 4. 구글 드라이브에 업로드
    const uploadResult = await uploadFileToDrive({
      folderId,
      fileName: uniqueFileName,
      mimeType,
      buffer,
      makePublic: false, // 개인정보는 공개하지 않음
    });

    if (!uploadResult.ok || !uploadResult.fileId || !uploadResult.url) {
      return { ok: false, error: uploadResult.error || '파일 업로드에 실패했습니다.' };
    }

    return {
      ok: true,
      fileId: uploadResult.fileId,
      url: uploadResult.url,
      fileName: uniqueFileName,
    };
  } catch (error: any) {
    console.error('[Document Drive Sync] uploadDocumentToDrive error:', error);
    return { ok: false, error: error.message || '문서 업로드 중 오류가 발생했습니다.' };
  }
}

/**
 * 계약서 PDF를 구글 드라이브에 업로드
 */
export async function uploadContractPDFToDrive(contractId: number) {
  try {
    // 1. 계약서 정보 조회
    const contract = await prisma.affiliateContract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        name: true,
        invitedByProfileId: true,
        contractSignedAt: true,
        createdAt: true,
      },
    });

    if (!contract) {
      return { ok: false, error: '계약서를 찾을 수 없습니다.' };
    }

    if (!contract.invitedByProfileId) {
      return { ok: false, error: '계약서에 연결된 프로필이 없습니다.' };
    }

    // 2. PDF 생성
    const pdfBuffer = await generateContractPDFFromId(contractId);

    // 3. 서버에 먼저 저장 (안정성 확보)
    const { writeFile, mkdir } = await import('fs/promises');
    const { existsSync } = await import('fs');
    const { join } = await import('path');
    
    const timestamp = dayjs(contract.contractSignedAt || contract.createdAt).format('YYYY-MM-DD');
    const safeName = contract.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const localFileName = `contract_${contract.id}_${safeName}_${timestamp}.pdf`;
    
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'contracts');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }
    
    const filepath = join(uploadDir, localFileName);
    await writeFile(filepath, pdfBuffer);
    const serverUrl = `/uploads/contracts/${localFileName}`;
    console.log('[Contract PDF] 파일이 서버에 저장되었습니다:', serverUrl);

    // 4. 구글 드라이브 백업 (실패해도 계속 진행)
    let backupUrl: string | null = null;
    let backupError: string | null = null;
    
    try {
      const folderStructure = await createProfileFolderStructure(contract.invitedByProfileId);
      if (folderStructure.ok && folderStructure.folderIds) {
        const folderId = folderStructure.folderIds['Contracts'];
        if (folderId) {
          const fileName = `contract_${contract.name}_${timestamp}.pdf`;
          const uploadResult = await uploadFileToDrive({
            folderId,
            fileName,
            mimeType: 'application/pdf',
            buffer: pdfBuffer,
            makePublic: false, // 계약서는 비공개
          });

          if (uploadResult.ok && uploadResult.url) {
            backupUrl = uploadResult.url;
            console.log('[Contract PDF] 구글 드라이브 백업 성공:', backupUrl);
          } else {
            backupError = uploadResult.error || '구글 드라이브 백업 실패';
            console.warn('[Contract PDF] 구글 드라이브 백업 실패 (서버 저장은 성공):', backupError);
          }
        }
      }
    } catch (backupErr: any) {
      backupError = backupErr?.message || '구글 드라이브 백업 중 오류 발생';
      console.warn('[Contract PDF] 구글 드라이브 백업 중 오류 (서버 저장은 성공):', backupError);
    }

    // 서버 URL을 기본으로 반환 (백업 URL은 metadata에 저장 가능)
    return {
      ok: true,
      fileId: null, // 서버 저장은 fileId 없음
      url: serverUrl, // 서버 URL을 기본으로 사용
      backupUrl: backupUrl, // 백업 URL (있으면)
      fileName: localFileName,
      backupError: backupError || undefined,
    };
  } catch (error: any) {
    console.error('[Document Drive Sync] uploadContractPDFToDrive error:', error);
    return { ok: false, error: error.message || '계약서 PDF 업로드 중 오류가 발생했습니다.' };
  }
}

/**
 * 서명 이미지를 구글 드라이브에 업로드
 * (기존 upload/route.ts에서 사용하던 로직을 여기로 통합)
 */
export async function uploadSignatureToDrive(params: {
  profileId: number;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}) {
  try {
    const { profileId, buffer, fileName, mimeType } = params;

    // 1. 폴더 구조 생성
    const folderStructure = await createProfileFolderStructure(profileId);
    if (!folderStructure.ok || !folderStructure.folderIds) {
      return { ok: false, error: folderStructure.error || '폴더 구조를 생성할 수 없습니다.' };
    }

    const folderId = folderStructure.folderIds['Signatures'];
    if (!folderId) {
      return { ok: false, error: 'Signatures 폴더를 찾을 수 없습니다.' };
    }

    // 2. 파일 이름에 타임스탬프 추가
    const timestamp = dayjs().format('YYYY-MM-DD_HHmmss');
    const fileExtension = fileName.split('.').pop() || 'png';
    const uniqueFileName = `signature_${timestamp}.${fileExtension}`;

    // 3. 구글 드라이브에 업로드
    const uploadResult = await uploadFileToDrive({
      folderId,
      fileName: uniqueFileName,
      mimeType: mimeType || 'image/png',
      buffer,
      makePublic: true, // 서명은 계약서에 포함되므로 공개
    });

    if (!uploadResult.ok || !uploadResult.fileId || !uploadResult.url) {
      return { ok: false, error: uploadResult.error || '서명 업로드에 실패했습니다.' };
    }

    return {
      ok: true,
      fileId: uploadResult.fileId,
      url: uploadResult.url,
      fileName: uniqueFileName,
    };
  } catch (error: any) {
    console.error('[Document Drive Sync] uploadSignatureToDrive error:', error);
    return { ok: false, error: error.message || '서명 업로드 중 오류가 발생했습니다.' };
  }
}

/**
 * 프로필의 모든 문서를 구글 드라이브에 동기화
 */
export async function syncAllDocumentsToDrive(profileId: number) {
  try {
    const results = {
      contracts: [] as any[],
      documents: [] as any[],
      errors: [] as string[],
    };

    // 1. 계약서 동기화
    const contracts = await prisma.affiliateContract.findMany({
      where: {
        invitedByProfileId: profileId,
        status: { in: ['approved', 'completed'] },
      },
      select: { id: true },
    });

    for (const contract of contracts) {
      const uploadResult = await uploadContractPDFToDrive(contract.id);
      if (uploadResult.ok) {
        results.contracts.push({ contractId: contract.id, ...uploadResult });
      } else {
        results.errors.push(`Contract ${contract.id}: ${uploadResult.error}`);
      }
    }

    // 2. 신분증/통장 사본 동기화
    const documents = await prisma.affiliateDocument.findMany({
      where: {
        profileId,
        documentType: { in: ['ID_CARD', 'BANKBOOK'] },
        status: 'APPROVED',
      },
      select: {
        id: true,
        documentType: true,
        filePath: true,
        fileName: true,
      },
    });

    for (const doc of documents) {
      try {
        // 로컬 파일 읽기
        const filePath = join(process.cwd(), 'public', doc.filePath);
        const buffer = await readFile(filePath);
        const mimeType = doc.fileName?.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';

        const uploadResult = await uploadDocumentToDrive({
          profileId,
          documentType: doc.documentType as 'ID_CARD' | 'BANKBOOK',
          buffer,
          fileName: doc.fileName || 'document.jpg',
          mimeType,
        });

        if (uploadResult.ok) {
          results.documents.push({ documentId: doc.id, ...uploadResult });
        } else {
          results.errors.push(`Document ${doc.id}: ${uploadResult.error}`);
        }
      } catch (fileError: any) {
        results.errors.push(`Document ${doc.id}: ${fileError.message}`);
      }
    }

    return {
      ok: true,
      results,
    };
  } catch (error: any) {
    console.error('[Document Drive Sync] syncAllDocumentsToDrive error:', error);
    return { ok: false, error: error.message || '문서 동기화 중 오류가 발생했습니다.' };
  }
}
