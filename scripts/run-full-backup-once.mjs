// 매일 백업 파이프라인 1회 실제 실행 검증 (Neon→Supabase→Drive)
// 실행: node scripts/run-full-backup-once.mjs
import fs from 'fs';
import pg from 'pg';
import { Readable } from 'stream';
import { google } from 'googleapis';

const txt = fs.readFileSync('.env.local', 'utf8');
const env = (n) => { const m = txt.match(new RegExp('^' + n + '=(.*)$', 'm')); return m ? m[1].replace(/^["']|["']$/g, '') : undefined; };
function parseSA(raw) {
  if (!raw) return null;
  const u = raw.replace(/^["']|["']$/g, ''); const ue = u.replace(/\\"/g, '"');
  for (const c of [raw, u, ue]) { try { const o = JSON.parse(c); if (typeof o.private_key === 'string') o.private_key = o.private_key.replace(/\\n/g, '\n'); if (o.client_email && o.private_key) return o; } catch {} }
  return null;
}

const DATABASE_URL = env('DATABASE_URL');
const SUPABASE_BACKUP_URL = env('SUPABASE_BACKUP_URL');
const ROOT = env('GOOGLE_DRIVE_DB_BACKUP_FOLDER_ID');
const sa = parseSA(txt.match(/^GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY=(.*)$/m)?.[1]);
const TABLES = ['User', 'Contact', 'CallLog', 'ContactMemo', 'SalesDocument', 'Payment', 'AffiliateSale'];
const date = new Date().toISOString().slice(0, 10);

const neon = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
const supa = new pg.Client({ connectionString: SUPABASE_BACKUP_URL, ssl: { rejectUnauthorized: false } });
await neon.connect(); await supa.connect();
await supa.query(`CREATE TABLE IF NOT EXISTS crm_backup(table_name TEXT,snapshot_date DATE,row_count INT,payload JSONB,backed_up_at TIMESTAMPTZ DEFAULT NOW(),PRIMARY KEY(table_name,snapshot_date))`);

console.log('=== 1단계 Neon → Supabase (' + date + ') ===');
for (const t of TABLES) {
  try {
    const { rows } = await neon.query(`SELECT * FROM "${t}"`);
    await supa.query(`INSERT INTO crm_backup(table_name,snapshot_date,row_count,payload) VALUES($1,$2,$3,$4) ON CONFLICT(table_name,snapshot_date) DO UPDATE SET row_count=$3,payload=$4,backed_up_at=NOW()`, [t, date, rows.length, JSON.stringify(rows)]);
    console.log(`  ✅ ${t.padEnd(16)} ${rows.length}행 → Supabase`);
  } catch (e) { console.log(`  ❌ ${t}: ${e.message.split('\n')[0]}`); }
}
await neon.end();

console.log('\n=== 2단계 Supabase → Google Drive ===');
const auth = new google.auth.GoogleAuth({ credentials: { client_email: sa.client_email, private_key: sa.private_key }, scopes: ['https://www.googleapis.com/auth/drive'] });
const drive = google.drive({ version: 'v3', auth });
async function foc(name, parent) {
  const r = await drive.files.list({ q: `mimeType='application/vnd.google-apps.folder' and name='${name}' and '${parent}' in parents and trashed=false`, fields: 'files(id)', corpora: 'allDrives', includeItemsFromAllDrives: true, supportsAllDrives: true });
  if (r.data.files?.[0]) return r.data.files[0].id;
  const c = await drive.files.create({ requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parent] }, fields: 'id', supportsAllDrives: true });
  return c.data.id;
}
const dateFolder = await foc(date, ROOT);
const { rows } = await supa.query(`SELECT table_name,row_count,payload FROM crm_backup WHERE snapshot_date=$1`, [date]);
for (const r of rows) {
  const content = JSON.stringify({ table: r.table_name, rowCount: r.row_count, snapshotDate: date, data: r.payload }, null, 2);
  const fn = `${r.table_name}.json`;
  const ex = await drive.files.list({ q: `name='${fn}' and '${dateFolder}' in parents and trashed=false`, fields: 'files(id)', corpora: 'allDrives', includeItemsFromAllDrives: true, supportsAllDrives: true });
  if (ex.data.files?.[0]) await drive.files.update({ fileId: ex.data.files[0].id, media: { mimeType: 'application/json', body: Readable.from(content) }, fields: 'id', supportsAllDrives: true });
  else await drive.files.create({ requestBody: { name: fn, parents: [dateFolder] }, media: { mimeType: 'application/json', body: Readable.from(content) }, fields: 'id', supportsAllDrives: true });
  console.log(`  ✅ Drive: ${fn} (${r.row_count}행)`);
}
const meta = await drive.files.get({ fileId: dateFolder, fields: 'webViewLink', supportsAllDrives: true });
console.log('\n📁 백업 폴더 링크:', meta.data.webViewLink);
await supa.end();
console.log('✅ 매일 백업 파이프라인 1회 실행 완료');
