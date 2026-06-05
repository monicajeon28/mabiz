/**
 * Neon → Supabase → Google Drive 3단계 매일 백업
 *
 * 1단계 neonToSupabase(): Neon(메인/SSoT) 핵심 테이블을 Supabase의 crm_backup 에
 *   날짜별 JSON 스냅샷으로 미러링 (재해/실수삭제 복구용 2차 저장소)
 * 2단계 supabaseToDrive(): Supabase 그날 스냅샷을 Google Drive 에 날짜별 폴더로 덤프
 *   (장기 보관/감사용 3차 저장소)
 *
 * 호출: /api/cron/full-backup (매일) — CRON_SECRET 인증
 */
import pg from 'pg';
import { Readable } from 'stream';
import { getDriveClient, findOrCreateFolder } from '@/lib/drive-client';
import { logger } from '@/lib/logger';

const { Client } = pg;

// Neon/Supabase 모두 SSL 필수 (Supabase pooler는 self-signed → rejectUnauthorized:false)
function makeClient(connectionString: string) {
  return new Client({ connectionString, ssl: { rejectUnauthorized: false } });
}

// 백업 대상 핵심 테이블 (Neon 실제 테이블명 기준)
export const BACKUP_TABLES = [
  'User',            // 회원 (GmUser @map "User")
  'Contact',         // 고객
  'CallLog',         // 콜기록
  'ContactMemo',     // 메모
  'SalesDocument',   // 서류(견적/확인/환불/계약)
  'Payment',         // 결제
  'AffiliateSale',   // 제휴 판매/수당
] as const;

export type NeonToSupabaseResult = { table: string; rows: number }[];
export type SupabaseToDriveResult = { table: string; fileId: string }[];

// ── 1단계: Neon → Supabase (crm_backup 테이블에 JSON 스냅샷 upsert) ──────────────
export async function neonToSupabase(snapshotDate: string): Promise<NeonToSupabaseResult> {
  const neonUrl = process.env.DATABASE_URL;
  const supaUrl = process.env.SUPABASE_BACKUP_URL;
  if (!neonUrl) throw new Error('DATABASE_URL 미설정');
  if (!supaUrl) throw new Error('SUPABASE_BACKUP_URL 미설정 — Neon→Supabase 백업 불가');

  const neon = makeClient(neonUrl);
  const supa = makeClient(supaUrl);
  await neon.connect();
  await supa.connect();

  const results: NeonToSupabaseResult = [];
  try {
    // 백업 저장 테이블 (없으면 자동 생성)
    await supa.query(`
      CREATE TABLE IF NOT EXISTS crm_backup (
        table_name    TEXT        NOT NULL,
        snapshot_date DATE        NOT NULL,
        row_count     INTEGER     NOT NULL,
        payload       JSONB       NOT NULL,
        backed_up_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (table_name, snapshot_date)
      )
    `);

    for (const table of BACKUP_TABLES) {
      const { rows } = await neon.query(`SELECT * FROM "${table}"`);
      await supa.query(
        `INSERT INTO crm_backup (table_name, snapshot_date, row_count, payload)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (table_name, snapshot_date)
         DO UPDATE SET row_count = $3, payload = $4, backed_up_at = NOW()`,
        [table, snapshotDate, rows.length, JSON.stringify(rows)],
      );
      results.push({ table, rows: rows.length });
    }
  } finally {
    await neon.end().catch(() => {});
    await supa.end().catch(() => {});
  }
  return results;
}

// ── 2단계: Supabase → Google Drive (날짜별 폴더에 테이블별 JSON 파일) ────────────
export async function supabaseToDrive(snapshotDate: string): Promise<SupabaseToDriveResult> {
  const supaUrl = process.env.SUPABASE_BACKUP_URL;
  const rootFolder = process.env.GOOGLE_DRIVE_DB_BACKUP_FOLDER_ID;
  if (!supaUrl) throw new Error('SUPABASE_BACKUP_URL 미설정');
  if (!rootFolder) throw new Error('GOOGLE_DRIVE_DB_BACKUP_FOLDER_ID 미설정 — Drive 덤프 불가');

  const supa = makeClient(supaUrl);
  await supa.connect();

  const uploaded: SupabaseToDriveResult = [];
  try {
    const { rows } = await supa.query<{ table_name: string; row_count: number; payload: unknown }>(
      `SELECT table_name, row_count, payload FROM crm_backup WHERE snapshot_date = $1`,
      [snapshotDate],
    );

    const drive = getDriveClient();
    // DB백업폴더/{날짜}/
    const dateFolderId = await findOrCreateFolder(snapshotDate, rootFolder);

    for (const r of rows) {
      const content = JSON.stringify(
        { table: r.table_name, rowCount: r.row_count, snapshotDate, data: r.payload },
        null,
        2,
      );
      const fileName = `${r.table_name}.json`;

      // 같은 날 재실행 시 덮어쓰기
      const existing = await drive.files.list({
        q: `name='${fileName}' and '${dateFolderId}' in parents and trashed=false`,
        fields: 'files(id)',
        corpora: 'allDrives',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      });

      let fileId: string;
      if (existing.data.files?.[0]?.id) {
        const u = await drive.files.update({
          fileId: existing.data.files[0].id,
          media: { mimeType: 'application/json', body: Readable.from(content) },
          fields: 'id',
          supportsAllDrives: true,
        });
        fileId = u.data.id!;
      } else {
        const c = await drive.files.create({
          requestBody: { name: fileName, parents: [dateFolderId] },
          media: { mimeType: 'application/json', body: Readable.from(content) },
          fields: 'id',
          supportsAllDrives: true,
        });
        fileId = c.data.id!;
      }
      uploaded.push({ table: r.table_name, fileId });
    }
  } finally {
    await supa.end().catch(() => {});
  }
  return uploaded;
}

// ── 전체 파이프라인 (cron 진입점에서 호출) ───────────────────────────────────────
export async function runFullBackup(snapshotDate: string) {
  const neon = await neonToSupabase(snapshotDate);
  const drive = await supabaseToDrive(snapshotDate);
  return { snapshotDate, neonToSupabase: neon, supabaseToDrive: drive };
}
