/**
 * 파트너 계약 신청 → Google Drive Excel 백업
 * 시트 구성: 대리점장 / 판매원 / 프리세일즈 / 파트너스 / 전체
 */
export const runtime = 'nodejs';

import * as XLSX from 'xlsx';
import { Readable } from 'stream';
import { logger } from '@/lib/logger';
import { getDriveClient, findOrCreateFolder, findFile } from '@/lib/drive-client';
import { formatKSTDate } from '@/lib/utils/dateUtils';

const BACKUP_ROOT =
  process.env.GOOGLE_DRIVE_CRM_BACKUP_FOLDER_ID ?? '';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// ── 계약 타입 정의 ─────────────────────────────────────────────────────────────

export interface AffiliateContractRow {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  contractType: string;      // metadata.type
  tierLabel: string | null;  // 등급명
  createdAt: Date;
  submittedAt?: Date | null;
  contractSignedAt?: Date | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectReason?: string | null;
  rejectedByName?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankAccountHolder?: string | null;
  address?: string | null;
}

// ── 상수 매핑 ────────────────────────────────────────────────────────────────

const STATUS_KO: Record<string, string> = {
  submitted: '검토대기',
  PROCESSING: '처리중',
  APPROVED: '승인완료',
  rejected: '반려',
};

const CONTRACT_TYPE_KO: Record<string, string> = {
  BRANCH_MANAGER: '대리점장',
  SALES_AGENT: '판매원',
  PRE_SALES: '프리세일즈',
  HQ: '본사',
  CRUISE_PARTNER: '파트너스',
};

const SHEET_ORDER: Array<{ typeKey: string; sheetName: string }> = [
  { typeKey: 'BRANCH_MANAGER', sheetName: '대리점장' },
  { typeKey: 'SALES_AGENT',    sheetName: '판매원' },
  { typeKey: 'PRE_SALES',      sheetName: '프리세일즈' },
  { typeKey: 'CRUISE_PARTNER', sheetName: '파트너스' },
  { typeKey: 'HQ',             sheetName: '본사' },
];

// ── 행 변환 ───────────────────────────────────────────────────────────────────

function toExcelRow(c: AffiliateContractRow) {
  return {
    'ID':         c.id,
    '이름':       c.name ?? '',
    '전화번호':   c.phone ?? '',
    '이메일':     c.email ?? '',
    '상태':       STATUS_KO[c.status] ?? c.status,
    '계약유형':   CONTRACT_TYPE_KO[c.contractType] ?? c.contractType,
    '등급':       c.tierLabel ?? '',
    '접수일':     formatKSTDate(c.createdAt),
    '서명일':     c.contractSignedAt ? formatKSTDate(c.contractSignedAt) : '',
    '승인일':     c.approvedAt ? c.approvedAt.slice(0, 10) : '',
    '반려일시':   c.rejectedAt ? new Date(c.rejectedAt).toLocaleString('ko-KR') : '',
    '반려사유':   c.rejectReason ?? '',
    '반려자':     c.rejectedByName ?? '',
    '은행명':     c.bankName ?? '',
    '계좌번호':   c.bankAccount ?? '',
    '예금주':     c.bankAccountHolder ?? '',
    '주소':       c.address ?? '',
  };
}

// ── Workbook 빌드 ─────────────────────────────────────────────────────────────

function buildWorkbook(contracts: AffiliateContractRow[]): Buffer {
  const wb = XLSX.utils.book_new();

  // 타입별 시트
  for (const { typeKey, sheetName } of SHEET_ORDER) {
    const rows = contracts
      .filter((c) => c.contractType === typeKey)
      .map(toExcelRow);
    // 데이터 없어도 헤더만 있는 빈 시트로 추가
    const ws = rows.length > 0
      ? XLSX.utils.json_to_sheet(rows)
      : XLSX.utils.json_to_sheet([toExcelRow({
          id: 0, name: null, phone: null, email: null, status: '',
          contractType: typeKey, tierLabel: null, createdAt: new Date(),
        })], { skipHeader: false });
    if (rows.length === 0) {
      // 빈 시트: 헤더만 남기고 데이터행 제거
      ws['!ref'] = 'A1:Q1';
    }
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  // 전체 시트
  const allRows = contracts.map(toExcelRow);
  XLSX.utils.book_append_sheet(
    wb,
    allRows.length > 0 ? XLSX.utils.json_to_sheet(allRows) : XLSX.utils.aoa_to_sheet([[]]),
    '전체',
  );

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// ── Drive 업로드 ──────────────────────────────────────────────────────────────

async function uploadToPartnerFolder(
  buf: Buffer,
  fileName: string,
): Promise<{ fileId: string; viewUrl: string }> {
  if (!BACKUP_ROOT) {
    throw new Error('GOOGLE_DRIVE_CRM_BACKUP_FOLDER_ID 환경변수가 설정되지 않았습니다.');
  }

  const drive = getDriveClient();

  // 폴더: CRM백업/파트너계약/
  const crmRootId = await findOrCreateFolder('CRM백업', BACKUP_ROOT);
  const partnerFolderId = await findOrCreateFolder('파트너계약', crmRootId);

  const existingId = await findFile(fileName, partnerFolderId);

  let fileId: string;
  let viewUrl: string;

  if (existingId) {
    const updated = await drive.files.update({
      fileId: existingId,
      media: { mimeType: XLSX_MIME, body: Readable.from(buf) },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });
    if (!updated.data.id) throw new Error(`Drive 파일 업데이트 실패: ${fileName}`);
    fileId = updated.data.id;
    viewUrl = updated.data.webViewLink ?? '';
  } else {
    const created = await drive.files.create({
      requestBody: { name: fileName, parents: [partnerFolderId] },
      media: { mimeType: XLSX_MIME, body: Readable.from(buf) },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });
    if (!created.data.id) throw new Error(`Drive 파일 생성 실패: ${fileName}`);
    fileId = created.data.id;
    viewUrl = created.data.webViewLink ?? '';
  }

  return {
    fileId,
    viewUrl: viewUrl || `https://drive.google.com/file/d/${fileId}/view`,
  };
}

// ── 메인 함수 ─────────────────────────────────────────────────────────────────

export async function backupAffiliateContractsToExcel(
  contracts: AffiliateContractRow[],
  dateLabel: string, // 'YYYY-MM-DD' 형식
): Promise<{ latestFileId: string; latestViewUrl: string; monthlyFileId: string; monthlyViewUrl: string }> {
  logger.info('[backupAffiliateContractsToExcel] 시작', {
    total: contracts.length,
    byType: Object.fromEntries(
      SHEET_ORDER.map(({ typeKey, sheetName }) => [
        sheetName,
        contracts.filter((c) => c.contractType === typeKey).length,
      ])
    ),
  });

  const buf = buildWorkbook(contracts);

  // 1. 최신 파일 (고정명 — 덮어쓰기)
  const latest = await uploadToPartnerFolder(buf, '파트너계약_전체_최신.xlsx');

  // 2. 월별 스냅샷 (월 단위, YYYY-MM 고정명)
  const monthLabel = dateLabel.slice(0, 7); // 'YYYY-MM'
  const monthly = await uploadToPartnerFolder(buf, `파트너계약_${monthLabel}.xlsx`);

  logger.info('[backupAffiliateContractsToExcel] 완료', {
    latestFileId: latest.fileId,
    monthlyFileId: monthly.fileId,
  });

  return {
    latestFileId: latest.fileId,
    latestViewUrl: latest.viewUrl,
    monthlyFileId: monthly.fileId,
    monthlyViewUrl: monthly.viewUrl,
  };
}
