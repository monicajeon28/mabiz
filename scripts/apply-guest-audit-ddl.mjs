// Phase 3 — T5 DDL 적용 (additive nullable, 라이브 안전)
// .env.local의 DATABASE_URL(Neon)로 직접 ALTER + 컬럼 확인
import { readFileSync } from 'node:fs';
import pg from 'pg';

function loadEnv(file) {
  try {
    const txt = readFileSync(file, 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch {}
}
loadEnv('.env.local');
loadEnv('.env');

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(`
    ALTER TABLE "PassportSubmissionGuest"
      ADD COLUMN IF NOT EXISTS "submittedBy" INTEGER,
      ADD COLUMN IF NOT EXISTS "source" TEXT,
      ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);
  `);
  const { rows } = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'PassportSubmissionGuest'
      AND column_name IN ('submittedBy','source','submittedAt')
    ORDER BY column_name;
  `);
  console.log('OK — 컬럼 확인:', JSON.stringify(rows));
} finally {
  await client.end();
}
