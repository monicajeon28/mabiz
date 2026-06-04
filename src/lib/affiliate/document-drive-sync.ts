/**
 * Affiliate Document Drive Sync
 * - syncAllDocumentsToDrive(profileId?): GmAffiliateProfile의 SalesDocument를 Google Drive에 동기화
 *
 * 폴더 구조:
 *   GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID (root)
 *   └── {affiliateCode}_{displayName}/
 *       ├── 비교견적서/
 *       │   └── {docId}.txt
 *       ├── 환불증서/
 *       │   └── {docId}.txt
 *       └── 구매확인증/
 *           └── {docId}.txt
 *
 * 기존 서비스 활용:
 *   - src/lib/drive-client.ts  getDriveClient(), findOrCreateFolder()
 *   - src/lib/prisma.ts
 */

import { getDriveClient, findOrCreateFolder } from '@/lib/drive-client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// 문서 타입별 폴더명 매핑
const DOC_TYPE_FOLDER: Record<string, string> = {
  COMPARISON_QUOTE: '비교견적서',
  REFUND_CERTIFICATE: '환불증서',
  PURCHASE_CONFIRMATION: '구매확인증',
  PURCHASE_CONTRACT: '구매계약서',
};

// 문서 타입별 한글 레이블
const DOC_TYPE_LABEL: Record<string, string> = {
  COMPARISON_QUOTE: '비교견적서',
  REFUND_CERTIFICATE: '환불증서',
  PURCHASE_CONFIRMATION: '구매확인증',
  PURCHASE_CONTRACT: '구매계약서',
};

export interface SyncResult {
  synced: number;
  skipped: number;
  failed: number;
  fileIds: string[];
}

export interface SyncAllResult {
  ok: boolean;
  results?: SyncResult;
  error?: string;
}

/**
 * SalesDocument generatedData를 사람이 읽기 쉬운 텍스트로 변환
 */
function buildDocumentText(
  documentType: string,
  generatedData: Record<string, unknown>,
  docId: string
): string {
  const label = DOC_TYPE_LABEL[documentType] ?? documentType;
  const issuedAt = generatedData.issuedAt
    ? new Date(generatedData.issuedAt as string).toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
      })
    : new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  const lines: string[] = [
    `■ ${label}`,
    `문서번호: ${docId}`,
    `발급일시: ${issuedAt}`,
    '='.repeat(50),
    '',
  ];

  // 공통 필드
  if (generatedData.buyerName) lines.push(`고객명: ${generatedData.buyerName}`);
  if (generatedData.buyerTel) lines.push(`연락처: ${generatedData.buyerTel}`);
  if (generatedData.buyerEmail) lines.push(`이메일: ${generatedData.buyerEmail}`);
  if (generatedData.productName) lines.push(`상품명: ${generatedData.productName}`);

  if (documentType === 'COMPARISON_QUOTE') {
    if (generatedData.cruiseLine) lines.push(`크루즈라인: ${generatedData.cruiseLine}`);
    if (generatedData.nights) lines.push(`일수: ${generatedData.nights}박`);
    if (generatedData.departureDate) lines.push(`출발일: ${generatedData.departureDate}`);
    if (generatedData.price != null)
      lines.push(`당사 가격: ${Number(generatedData.price).toLocaleString()}원`);
    const competitors = generatedData.competitorPrices as Array<{
      name: string;
      price: number;
    }> | undefined;
    if (competitors && competitors.length > 0) {
      lines.push('');
      lines.push('[경쟁사 비교]');
      competitors.forEach((c) => {
        lines.push(`  ${c.name}: ${Number(c.price).toLocaleString()}원`);
      });
    }
  } else if (documentType === 'REFUND_CERTIFICATE') {
    if (generatedData.amount != null)
      lines.push(`결제금액: ${Number(generatedData.amount).toLocaleString()}원`);
    if (generatedData.refundAmount != null)
      lines.push(`환불금액: ${Number(generatedData.refundAmount).toLocaleString()}원`);
    if (generatedData.penaltyRate != null && Number(generatedData.penaltyRate) > 0)
      lines.push(
        `위약금: ${generatedData.penaltyRate}% (${Number(
          generatedData.penaltyAmount
        ).toLocaleString()}원)`
      );
    if (generatedData.refundBasis) lines.push(`환불 기준: ${generatedData.refundBasis}`);
    if (generatedData.paymentMethod) lines.push(`환불 수단: ${generatedData.paymentMethod}`);
    if (generatedData.companyAccount) lines.push(`정산 계좌: ${generatedData.companyAccount}`);
    if (generatedData.cancellationRequestedAt) {
      const dt = new Date(generatedData.cancellationRequestedAt as string).toLocaleString(
        'ko-KR',
        { timeZone: 'Asia/Seoul' }
      );
      lines.push(`취소 요청일: ${dt}`);
    }
    if (generatedData.refunderName) lines.push(`환불 요청자: ${generatedData.refunderName}`);
    if (generatedData.note) lines.push(`비고: ${generatedData.note}`);
  } else if (documentType === 'PURCHASE_CONFIRMATION') {
    if (generatedData.amount != null)
      lines.push(`결제금액: ${Number(generatedData.amount).toLocaleString()}원`);
    if (generatedData.paidAt) {
      const dt = new Date(generatedData.paidAt as string).toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
      });
      lines.push(`결제일시: ${dt}`);
    }
    if (generatedData.paymentMethod) lines.push(`결제수단: ${generatedData.paymentMethod}`);
  } else {
    // 기타 문서 타입: JSON 전체 출력
    lines.push(JSON.stringify(generatedData, null, 2));
  }

  lines.push('');
  lines.push('='.repeat(50));
  return lines.join('\n');
}

/**
 * Drive에 txt 파일 업서트 (있으면 덮어쓰기, 없으면 신규 생성)
 */
async function upsertDriveFile(
  name: string,
  content: string,
  parentFolderId: string
): Promise<string> {
  const drive = getDriveClient();

  // 기존 파일 탐색
  const res = await drive.files.list({
    q: `name='${name.replace(/'/g, "\\'")}' and '${parentFolderId}' in parents and trashed=false`,
    fields: 'files(id)',
    corpora: 'allDrives',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });
  const existingId = res.data.files?.[0]?.id ?? null;

  if (existingId) {
    const updated = await drive.files.update({
      fileId: existingId,
      media: { mimeType: 'text/plain; charset=utf-8', body: content },
      fields: 'id',
      supportsAllDrives: true,
    });
    return updated.data.id!;
  }

  const created = await drive.files.create({
    requestBody: { name, parents: [parentFolderId] },
    media: { mimeType: 'text/plain; charset=utf-8', body: content },
    fields: 'id',
    supportsAllDrives: true,
  });
  return created.data.id!;
}

/**
 * 특정 GmAffiliateProfile(또는 전체)의 SalesDocument를 Google Drive에 동기화
 *
 * @param profileId - GmAffiliateProfile.id (없으면 전체 처리하지 않음 — 호출자가 루프 처리)
 * @returns SyncAllResult
 *
 * 환경변수:
 *   GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID — 문서 동기화 루트 폴더 ID (필수)
 *   GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL + GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY — 서비스 계정 (drive-client.ts 참조)
 */
export async function syncAllDocumentsToDrive(
  profileId: number
): Promise<SyncAllResult> {
  const rootFolderId = process.env.GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID;
  if (!rootFolderId) {
    return {
      ok: false,
      error: 'GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID 환경변수 미설정',
    };
  }

  try {
    // 1. GmAffiliateProfile 조회
    const profile = await prisma.gmAffiliateProfile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        affiliateCode: true,
        displayName: true,
      },
    });

    if (!profile) {
      return { ok: false, error: `GmAffiliateProfile not found: ${profileId}` };
    }

    // 2. 이 프로필 코드와 연결된 AffiliateSale의 SalesDocument 조회
    //    AffiliateSale.affiliateCode = GmAffiliateProfile.affiliateCode 로 연결
    const salesDocs = await prisma.salesDocument.findMany({
      where: {
        affiliateSale: {
          affiliateCode: profile.affiliateCode,
        },
        status: { in: ['APPROVED', 'PENDING_APPROVAL'] },
      },
      select: {
        id: true,
        documentType: true,
        status: true,
        generatedData: true,
        orderId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    logger.log('[DocumentDriveSync] 동기화 시작', {
      profileId,
      affiliateCode: profile.affiliateCode,
      documentCount: salesDocs.length,
    });

    if (salesDocs.length === 0) {
      return {
        ok: true,
        results: { synced: 0, skipped: 0, failed: 0, fileIds: [] },
      };
    }

    // 3. 프로필 폴더 생성 (없으면 생성)
    const safeName = `${profile.affiliateCode}_${(profile.displayName ?? 'unknown').replace(/[/\\?%*:|"<>]/g, '_')}`;
    const profileFolderId = await findOrCreateFolder(safeName, rootFolderId);

    const result: SyncResult = { synced: 0, skipped: 0, failed: 0, fileIds: [] };

    // 4. 문서 타입별 폴더 캐시
    const typeFolderCache: Record<string, string> = {};

    for (const doc of salesDocs) {
      try {
        const typeFolder = DOC_TYPE_FOLDER[doc.documentType];
        if (!typeFolder) {
          logger.log('[DocumentDriveSync] 알 수 없는 문서 타입 — 건너뜀', {
            docId: doc.id,
            documentType: doc.documentType,
          });
          result.skipped++;
          continue;
        }

        // 문서 타입 폴더 (캐시)
        if (!typeFolderCache[doc.documentType]) {
          typeFolderCache[doc.documentType] = await findOrCreateFolder(
            typeFolder,
            profileFolderId
          );
        }
        const typeFolderId = typeFolderCache[doc.documentType];

        // 파일명: {docId}.txt
        const fileName = `${doc.id}.txt`;
        const content = buildDocumentText(
          doc.documentType,
          doc.generatedData as Record<string, unknown>,
          doc.id
        );

        const fileId = await upsertDriveFile(fileName, content, typeFolderId);
        result.synced++;
        result.fileIds.push(fileId);
      } catch (docErr) {
        logger.error('[DocumentDriveSync] 문서 동기화 오류', {
          docId: doc.id,
          error: docErr instanceof Error ? docErr.message : String(docErr),
        });
        result.failed++;
      }
    }

    logger.log('[DocumentDriveSync] 동기화 완료', {
      profileId,
      affiliateCode: profile.affiliateCode,
      ...result,
    });

    return { ok: true, results: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[DocumentDriveSync] 동기화 오류', { error: message, profileId });
    return { ok: false, error: message };
  }
}

export interface ContractDriveResult {
  ok: boolean;
  driveFileId?: string;
  driveUrl?: string;
  error?: string;
}

/**
 * 구매계약서 서명 완료 시 Google Drive에 저장
 * - 폴더: GOOGLE_DRIVE_CONTRACTS_FOLDER_ID (지정된 공유 드라이브 폴더)
 * - 파일명: {고객명}_{연락처}_{YYYY-MM-DD}.html
 */
export async function saveContractToDrive(
  documentId: string,
  htmlContent: string,
  customerName: string,
  organizationId: string,
  customerPhone?: string
): Promise<ContractDriveResult> {
  // 계약서 전용 폴더 ID (환경변수 우선, 없으면 기본 폴더로 fallback)
  const contractFolderId =
    process.env.GOOGLE_DRIVE_CONTRACTS_FOLDER_ID ||
    process.env.GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID;
  if (!contractFolderId) {
    logger.log('[ContractDriveSync] Drive 폴더 ID 미설정 — 건너뜀');
    return { ok: false, error: 'Drive 폴더 ID 미설정' };
  }

  try {
    const drive = getDriveClient();

    const safeName = customerName.replace(/[/\\?%*:|"<>]/g, '_');
    const safePhone = (customerPhone ?? '').replace(/[^0-9]/g, '');
    const dateStr = new Date().toISOString().split('T')[0];
    const namePart = safePhone ? `${safeName}_${safePhone}` : safeName;
    const fileName = `${namePart}_${dateStr}.html`;

    // 기존 파일 탐색 (같은 이름이면 덮어쓰기)
    const list = await drive.files.list({
      q: `name='${fileName.replace(/'/g, "\\'")}' and '${contractFolderId}' in parents and trashed=false`,
      fields: 'files(id)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const existingId = list.data.files?.[0]?.id ?? null;

    let fileId: string;
    if (existingId) {
      const updated = await drive.files.update({
        fileId: existingId,
        media: { mimeType: 'text/html; charset=utf-8', body: htmlContent },
        fields: 'id',
        supportsAllDrives: true,
      });
      fileId = updated.data.id!;
    } else {
      const created = await drive.files.create({
        requestBody: { name: fileName, parents: [contractFolderId] },
        media: { mimeType: 'text/html; charset=utf-8', body: htmlContent },
        fields: 'id',
        supportsAllDrives: true,
      });
      fileId = created.data.id!;
    }

    const driveUrl = `https://drive.google.com/file/d/${fileId}/view`;
    logger.log('[ContractDriveSync] 저장 완료', { documentId, fileId, driveUrl });
    return { ok: true, driveFileId: fileId, driveUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[ContractDriveSync] 저장 오류', { error: message, documentId });
    return { ok: false, error: message };
  }
}
