// Phase3 런타임 검증 (읽기전용) — 수정한 코드가 쓰는 '실제 쿼리'를 Neon 실데이터에 돌려
// scan GET이 reservation을 반환할 수 있는지 + submit 토큰검증이 통과하는지 계약을 확인.
import { readFileSync } from 'node:fs';
import pg from 'pg';

function loadEnv(file) {
  try {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch {}
}
loadEnv('.env.local'); loadEnv('.env');
const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL 없음'); process.exit(1); }

const c = new pg.Client({ connectionString: url });
await c.connect();
try {
  // 0) 전체 카운트
  const counts = {};
  for (const [k, t] of [['submission','PassportSubmission'],['reservation','Reservation'],['traveler','Traveler'],['guest','PassportSubmissionGuest']]) {
    counts[k] = Number((await c.query(`SELECT COUNT(*)::int AS n FROM "${t}"`)).rows[0].n);
  }
  console.log('[데이터 현황]', JSON.stringify(counts));

  // 1) 미만료 submission 표본 (scan/submit이 보는 대상)
  const subs = (await c.query(`
    SELECT id, "userId", "tripId", token, "isSubmitted", "tokenExpiresAt"
    FROM "PassportSubmission"
    WHERE "tokenExpiresAt" > NOW()
    ORDER BY id DESC LIMIT 5
  `)).rows;
  console.log(`\n[미만료 submission ${subs.length}건 — scan/submit 검증]`);
  if (subs.length === 0) {
    console.log('  (미만료 submission 0건 — 실거래 토큰이 없어 실데이터 검증 스킵. 코드 계약은 TSC/쿼리형태로만 확인됨)');
  }

  let okCount = 0, noResv = 0;
  for (const s of subs) {
    // scan GET reservation 조회 (내 수정과 동일)
    const rRows = (await c.query(`
      SELECT id, "totalPeople", "passportStatus", "tripId", "mainUserId"
      FROM "Reservation"
      WHERE "mainUserId" = $1 AND ($2::int IS NULL OR "tripId" = $2)
      ORDER BY id DESC LIMIT 1
    `, [s.userId, s.tripId])).rows;

    if (rRows.length === 0) {
      noResv++;
      console.log(`  submission#${s.id} (userId=${s.userId},tripId=${s.tripId}) → ❌ 매칭 reservation 없음 → 고객 본인확인 실패 가능`);
      continue;
    }
    const r = rRows[0];
    const tCount = Number((await c.query(`SELECT COUNT(*)::int AS n FROM "Traveler" WHERE "reservationId"=$1`, [r.id])).rows[0].n);
    // submit SEC-2 토큰검증: submission.userId === reservation.mainUserId
    const secPass = s.userId === r.mainUserId;
    const tripOk = s.tripId == null || s.tripId === r.tripId;
    if (secPass) okCount++;
    console.log(`  submission#${s.id} → ✅ reservation#${r.id} (인원${r.totalPeople}, traveler${tCount}건) | SEC-2 토큰검증(userId==mainUserId): ${secPass ? 'PASS' : 'FAIL'} | tripId일치:${tripOk}`);
  }

  console.log('\n[결론]');
  console.log(`  scan GET이 reservation 반환 가능: ${okCount}/${subs.length}건`);
  if (noResv > 0) console.log(`  ⚠️ reservation 없는 submission ${noResv}건 — 해당 고객은 예약 생성 후에만 제출 가능(정상 데이터 의존)`);
  if (subs.length > 0 && okCount === subs.length) console.log('  ✅ 모든 표본에서 scan→reservation→submit 계약 성립 (고객 흐름 정상 작동 예상)');
} finally {
  await c.end();
}
