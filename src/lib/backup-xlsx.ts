/**
 * Google Drive Excel 백업 유틸
 * - 고객 전체 데이터를 4개 시트 xlsx로 생성 후 Drive 업로드
 */
export const runtime = 'nodejs';

import * as XLSX from 'xlsx';
import { Readable } from 'stream';
import { google } from 'googleapis';
import { logger } from '@/lib/logger';
import { formatKSTDate } from '@/lib/utils/dateUtils';
import { parseServiceAccount } from '@/lib/parse-service-account';

const CRM_BACKUP_ROOT =
  process.env.GOOGLE_DRIVE_CRM_BACKUP_FOLDER_ID ?? '1g8vNIeXEVHkavQnlBAXsBMkVZB_Y29Fk';

function getDriveClient() {
  if (!CRM_BACKUP_ROOT) {
    throw new Error('GOOGLE_DRIVE_CRM_BACKUP_FOLDER_ID is not configured');
  }

  // 검증된 단일 인증(parse-service-account)으로 통일 — 공유드라이브 접근 보장
  const credentials = parseServiceAccount(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

async function findOrCreateFolder(name: string, parentId: string): Promise<string> {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    corpora: 'allDrives',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });
  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  });
  return created.data.id!;
}

async function findFile(name: string, parentId: string): Promise<string | null> {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    corpora: 'allDrives',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });
  return res.data.files?.[0]?.id ?? null;
}

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export interface BackupContact {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  type: string;
  cruiseInterest: string | null;
  budgetRange: string | null;
  adminMemo: string | null;
  leadScore: number;
  tags: string[];
  groups: Array<{ group: { id: string; name: string } }>;
  assignedUserId: string | null;
  departureDate: Date | null;
  productName: string | null;
  bookingRef: string | null;
  lastContactedAt: Date | null;
  purchasedAt: Date | null;
  createdAt: Date;
  sourceOrgId: string | null;
  callLogs: Array<{
    id: string;
    content: string | null;
    result: string | null;
    convictionScore: number | null;
    nextAction: string | null;
    createdAt: Date;
  }>;
  memos: Array<{
    id: string;
    content: string;
    createdAt: Date;
  }>;
  transferLogs: Array<{
    id: string;
    toUserId: string | null;
    toUserName?: string | null;
    toOrgId: string | null;
    transferType: string;
    transferredBy: string;
    createdAt: Date;
  }>;
}

// ─── 한국어 매핑 ──────────────────────────────────────────────────────────────

const TYPE_KO: Record<string, string> = {
  LEAD: '잠재고객',
  CUSTOMER: '구매완료',
  UNSUBSCRIBED: '수신거부',
};

const BUDGET_KO: Record<string, string> = {
  ECONOMY: '100만원 이하',
  STANDARD: '100~300만원',
  PREMIUM: '300만원 이상',
};

const RESULT_KO: Record<string, string> = {
  INTERESTED: '관심있음',
  PENDING: '보류',
  REJECTED: '거절',
  RESCHEDULED: '재콜예약',
};

const TRANSFER_TYPE_KO: Record<string, string> = {
  ORG_COPY: '조직복사',
  AGENT_ASSIGN: '담당자배정',
};

// ─── xlsx 생성 ────────────────────────────────────────────────────────────────

function buildWorkbook(contacts: BackupContact[]): Buffer {
  const wb = XLSX.utils.book_new();

  // Sheet1: 고객목록
  const contactRows = contacts.map((c) => ({
    고객ID:       c.id,
    이름:         c.name,
    전화번호:     c.phone,
    이메일:       c.email ?? '',
    유형:         TYPE_KO[c.type] ?? c.type,
    관심크루즈:   c.cruiseInterest ?? '',
    예산범위:     BUDGET_KO[c.budgetRange ?? ''] ?? (c.budgetRange ?? ''),
    리드점수:     c.leadScore,
    태그:         c.tags.join(', '),
    그룹:         (c.groups ?? []).map(g => g.group.name).join(', '),
    출발예정일:   c.departureDate  ? formatKSTDate(c.departureDate)  : '',
    예약상품명:   c.productName    ?? '',
    예약번호:     c.bookingRef     ?? '',
    마지막연락일: c.lastContactedAt ? formatKSTDate(c.lastContactedAt) : '',
    구매일:       c.purchasedAt    ? formatKSTDate(c.purchasedAt)    : '',
    관리자메모:   c.adminMemo      ?? '',
    등록일:       formatKSTDate(c.createdAt),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(contactRows), '고객목록');

  // Sheet2: 콜기록
  const callRows = contacts.flatMap((c) =>
    c.callLogs.map((log) => ({
      고객ID:   c.id,
      이름:     c.name,
      기록일시: formatKSTDate(log.createdAt),
      결과:     RESULT_KO[log.result ?? ''] ?? (log.result ?? ''),
      확신도점수: log.convictionScore ?? '',
      내용:     log.content ?? '',
      다음액션: log.nextAction ?? '',
    }))
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(callRows), '콜기록');

  // Sheet3: 메모
  const memoRows = contacts.flatMap((c) =>
    c.memos.map((m) => ({
      고객ID:   c.id,
      이름:     c.name,
      작성일시: formatKSTDate(m.createdAt),
      내용:     m.content,
    }))
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(memoRows), '메모');

  // Sheet4: 전달이력
  const transferRows = contacts.flatMap((c) =>
    c.transferLogs.map((t) => ({
      고객ID:   c.id,
      이름:     c.name,
      전달일시: formatKSTDate(t.createdAt),
      전달유형: TRANSFER_TYPE_KO[t.transferType] ?? t.transferType,
      전달대상: t.toUserName ?? t.toUserId ?? t.toOrgId ?? '',
    }))
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(transferRows), '전달이력');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// ─── 메인 함수 ────────────────────────────────────────────────────────────────

export async function backupContactsToExcel(params: {
  orgName: string;
  orgId: string;
  contacts: BackupContact[];
  mode: 'latest' | 'pre_delete';
  contactNameForDelete?: string;
}): Promise<{ fileId: string; viewUrl: string }> {
  const { orgName, contacts, mode, contactNameForDelete } = params;

  logger.log('[backupContactsToExcel] 시작', { orgName, mode, count: contacts.length });

  // 1. xlsx 버퍼 생성
  const buf = buildWorkbook(contacts);

  // 2. Drive 폴더 경로 확보
  // CRM백업/
  const crmRootId = await findOrCreateFolder('CRM백업', CRM_BACKUP_ROOT);
  // CRM백업/{orgName}/
  const orgFolderId = await findOrCreateFolder(orgName, crmRootId);

  const drive = getDriveClient();
  const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  let fileId: string;

  if (mode === 'latest') {
    // 고정 파일명 — 기존 파일 덮어쓰기
    const fileName = '고객전체_최신.xlsx';
    const existingId = await findFile(fileName, orgFolderId);

    if (existingId) {
      const updated = await drive.files.update({
        fileId: existingId,
        media: { mimeType: MIME, body: Readable.from(buf) },
        fields: 'id',
        supportsAllDrives: true,
      });
      fileId = updated.data.id!;
    } else {
      const created = await drive.files.create({
        requestBody: { name: fileName, parents: [orgFolderId] },
        media: { mimeType: MIME, body: Readable.from(buf) },
        fields: 'id',
        supportsAllDrives: true,
      });
      fileId = created.data.id!;
    }
  } else {
    // pre_delete — 삭제전백업/ 하위에 고유 파일로 생성
    const deleteFolderId = await findOrCreateFolder('삭제전백업', orgFolderId);

    const safeName = (contactNameForDelete ?? 'unknown').replace(/[/\\?%*:|"<>]/g, '_');
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `${safeName}_${ts}.xlsx`;

    const created = await drive.files.create({
      requestBody: { name: fileName, parents: [deleteFolderId] },
      media: { mimeType: MIME, body: Readable.from(buf) },
      fields: 'id',
      supportsAllDrives: true,
    });
    fileId = created.data.id!;
  }

  // 3. webViewLink 조회
  const meta = await drive.files.get({
    fileId,
    fields: 'webViewLink',
    supportsAllDrives: true,
  });

  const viewUrl = meta.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`;

  logger.log('[backupContactsToExcel] 완료', { fileId, viewUrl });

  return { fileId, viewUrl };
}
