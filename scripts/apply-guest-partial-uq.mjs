// Phase 3 검토수정 — F2: GmPassportSubmissionGuest (submissionId, passportNumber) 부분 UNIQUE
// 표시 미러 테이블 중복행 방지. passportNumber 있을 때만.
// ⚠️ 기존 중복(과거 이름매칭 결과) 있으면 생성 실패 → 진단 후 중단.
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
  const dup = await client.query(`
    SELECT "submissionId", "passportNumber", COUNT(*) AS cnt
    FROM "PassportSubmissionGuest"
    WHERE "passportNumber" IS NOT NULL AND "passportNumber" <> ''
    GROUP BY "submissionId", "passportNumber"
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC LIMIT 50;
  `);
  if (dup.rows.length > 0) {
    console.error('ABORT — 기존 게스트 중복 발견 (병합 후 재실행):', JSON.stringify(dup.rows));
    process.exit(2);
  }
  console.log('게스트 중복 0건 확인 — 부분 UNIQUE 인덱스 생성');
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "guest_submission_passport_partial_uq"
    ON "PassportSubmissionGuest" ("submissionId", "passportNumber")
    WHERE "passportNumber" IS NOT NULL AND "passportNumber" <> '';
  `);
  const idx = await client.query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'PassportSubmissionGuest' AND indexname = 'guest_submission_passport_partial_uq';
  `);
  console.log('OK — 인덱스 확인:', JSON.stringify(idx.rows));
} finally {
  await client.end();
}
