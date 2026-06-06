// Phase 3 — T7: (reservationId, passportNo) 부분 UNIQUE 인덱스
// 동시 제출/재시도 시 같은 여권번호 중복행 폭증 차단.
// ⚠️ 사전 중복정리 선행 필수: 중복 있으면 인덱스 생성 실패 → 중단(서비스 영향 0).
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
  // 1) 중복 진단
  const dup = await client.query(`
    SELECT "reservationId", "passportNo", COUNT(*) AS cnt
    FROM "Traveler"
    WHERE "passportNo" IS NOT NULL AND "passportNo" <> ''
    GROUP BY "reservationId", "passportNo"
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT 50;
  `);
  if (dup.rows.length > 0) {
    console.error('ABORT — 기존 중복 발견 (관리자 병합 후 재실행):', JSON.stringify(dup.rows));
    process.exit(2);
  }
  console.log('중복 0건 확인 — 부분 UNIQUE 인덱스 생성 진행');

  // 2) 부분 UNIQUE 인덱스 (passportNo 있을 때만). raw partial index — Prisma @@unique로는 표현 불가.
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Traveler_reservation_passport_partial_uq"
    ON "Traveler" ("reservationId", "passportNo")
    WHERE "passportNo" IS NOT NULL AND "passportNo" <> '';
  `);

  // 3) 인덱스 확인
  const idx = await client.query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'Traveler' AND indexname = 'Traveler_reservation_passport_partial_uq';
  `);
  console.log('OK — 인덱스 확인:', JSON.stringify(idx.rows));
} finally {
  await client.end();
}
