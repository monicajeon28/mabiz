/**
 * 마케팅 월별 매출 → Google Sheets 내보내기
 * 서비스 계정: GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY (Drive와 동일 계정)
 * 시트 ID: MARKETING_REPORT_SPREADSHEET_ID 환경변수
 */
import { google } from 'googleapis';
import { parseServiceAccount } from '@/lib/parse-service-account';
import { logger } from '@/lib/logger';

export interface MonthlyOrgRow {
  month: string;        // "2026-05"
  orgName: string;      // "전체" or 대리점 이름
  totalRevenue: number;
  totalRefund: number;
  netRevenue: number;
  paidCount: number;
}

function getSheetsClient() {
  const key = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY;
  if (!key) throw new Error('GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY 미설정');
  const credentials = parseServiceAccount(key);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });
  return google.sheets({ version: 'v4', auth });
}

const SHEET_NAME = '월별_매출_리포트';
const HEADER_ROW = ['월', '대리점', '매출(원)', '환불(원)', '순매출(원)', '건수', '업데이트'];

/**
 * 해당 월 데이터를 Google Sheets에 upsert (있으면 업데이트, 없으면 추가)
 */
export async function exportMonthlyToSheets(rows: MonthlyOrgRow[]): Promise<void> {
  const spreadsheetId = process.env.MARKETING_REPORT_SPREADSHEET_ID;
  if (!spreadsheetId) {
    logger.warn('[marketing-sheets] MARKETING_REPORT_SPREADSHEET_ID 미설정 — Sheets 백업 건너뜀');
    return;
  }

  const sheets = getSheetsClient();

  // 1. 시트 존재 여부 확인 + 없으면 생성
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetExists = meta.data.sheets?.some(
      s => s.properties?.title === SHEET_NAME
    );
    if (!sheetExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: SHEET_NAME } } }],
        },
      });
      // 헤더 행 추가
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [HEADER_ROW] },
      });
    }
  } catch (err) {
    logger.error('[marketing-sheets] 시트 초기화 실패', { err: err instanceof Error ? err.message : String(err) });
    throw err;
  }

  // 2. 기존 데이터 읽기 (헤더 제외)
  const existingRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A2:G`,
  });
  const existing: string[][] = (existingRes.data.values as string[][] | null | undefined) ?? [];

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const newRows = rows.map(r => [
    r.month,
    r.orgName,
    String(Math.round(r.totalRevenue)),
    String(Math.round(r.totalRefund)),
    String(Math.round(r.netRevenue)),
    String(r.paidCount),
    now,
  ]);

  // 3. upsert: 같은 월+대리점 행 찾아서 업데이트, 없으면 추가
  const updated = [...existing];
  for (const newRow of newRows) {
    const [month, orgName] = [newRow[0], newRow[1]];
    const idx = updated.findIndex(r => r[0] === month && r[1] === orgName);
    if (idx >= 0) {
      updated[idx] = newRow;
    } else {
      updated.push(newRow);
    }
  }

  // 4. 전체 덮어쓰기 (A2~)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAME}!A2`,
    valueInputOption: 'RAW',
    requestBody: { values: updated },
  });

  logger.info('[marketing-sheets] Sheets 업데이트 완료', { rows: newRows.length });
}
