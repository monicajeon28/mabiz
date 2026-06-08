// 백업 동기화 실제 동작 검증 (읽기 전용)
// 실행: npx dotenvx run -- node scripts/check-backup-status.mjs
import pg from 'pg';
const { Client } = pg;

function mask(v) {
  if (!v) return '❌ 미설정';
  return `✅ 설정됨 (${String(v).length}자)`;
}

console.log('═══════════════════════════════════════════════');
console.log(' 1) 필수 환경변수 설정 여부 (로컬 .env 기준)');
console.log('═══════════════════════════════════════════════');
const envs = [
  'DATABASE_URL',
  'SUPABASE_BACKUP_URL',
  'CRON_SECRET',
  'GOOGLE_DRIVE_CALL_LOG_FOLDER_ID',
  'GOOGLE_DRIVE_CRM_BACKUP_FOLDER_ID',
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
  'GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY',
  'GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY',
];
for (const e of envs) console.log(`  ${e.padEnd(40)} ${mask(process.env[e])}`);

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  console.log('\n═══════════════════════════════════════════════');
  console.log(' 2) BackupJob 큐 상태 (Drive 백업 처리 현황)');
  console.log('═══════════════════════════════════════════════');
  const exists = await client.query(`SELECT to_regclass('"BackupJob"') AS t`);
  if (!exists.rows[0].t) {
    console.log('  ❌ BackupJob 테이블이 없습니다.');
  } else {
    const byStatus = await client.query(`
      SELECT status, COUNT(*)::int AS cnt, MAX("updatedAt") AS latest
      FROM "BackupJob" GROUP BY status ORDER BY status`);
    if (byStatus.rows.length === 0) {
      console.log('  ℹ️  BackupJob 레코드가 0건 (백업 작업이 한 번도 등록된 적 없음)');
    } else {
      for (const r of byStatus.rows) {
        console.log(`  ${String(r.status).padEnd(16)} ${String(r.cnt).padStart(5)}건  최근: ${r.latest ? new Date(r.latest).toLocaleString('ko-KR') : '-'}`);
      }
    }

    // 가장 오래된 PENDING (cron이 처리 못하고 쌓이는지)
    const oldestPending = await client.query(`
      SELECT id, "createdAt", "retryCount", "maxRetries"
      FROM "BackupJob" WHERE status='PENDING'
      ORDER BY "createdAt" ASC LIMIT 1`);
    if (oldestPending.rows[0]) {
      const p = oldestPending.rows[0];
      const ageHours = Math.round((Date.now() - new Date(p.createdAt).getTime()) / 3600000);
      console.log(`\n  ⚠️ 가장 오래된 PENDING: ${ageHours}시간 전 등록 (재시도 ${p.retryCount}/${p.maxRetries})`);
      if (ageHours > 25) console.log('     → 매일 09:00 cron이 처리했다면 PENDING이 25시간+ 남아있을 수 없음 = cron 미작동 의심');
    }

    // 최근 FAILED 사유
    const failed = await client.query(`
      SELECT "lastError", "updatedAt" FROM "BackupJob"
      WHERE status='FAILED' AND "lastError" IS NOT NULL
      ORDER BY "updatedAt" DESC LIMIT 5`);
    if (failed.rows.length) {
      console.log('\n  ❌ 최근 실패 사유 (Top 5):');
      for (const f of failed.rows) console.log(`     [${new Date(f.updatedAt).toLocaleString('ko-KR')}] ${f.lastError}`);
    }

    // 최근 7일 등록/처리 추이
    const recent = await client.query(`
      SELECT status, COUNT(*)::int AS cnt FROM "BackupJob"
      WHERE "createdAt" >= NOW() - INTERVAL '7 days' GROUP BY status`);
    console.log('\n  📊 최근 7일 등록된 작업:', recent.rows.length ? recent.rows.map(r => `${r.status}=${r.cnt}`).join(', ') : '없음');
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log(' 3) Supabase(User 백업) 연결 확인');
  console.log('═══════════════════════════════════════════════');
  if (!process.env.SUPABASE_BACKUP_URL) {
    console.log('  ❌ SUPABASE_BACKUP_URL 미설정 → Neon→Supabase User 동기화 비활성');
  } else {
    try {
      const sb = new Client({ connectionString: process.env.SUPABASE_BACKUP_URL });
      await sb.connect();
      const neonUsers = await client.query(`SELECT COUNT(*)::int AS c FROM "User"`);
      const sbUsers = await sb.query(`SELECT COUNT(*)::int AS c FROM "User"`);
      console.log(`  Neon User: ${neonUsers.rows[0].c}명  /  Supabase User: ${sbUsers.rows[0].c}명`);
      const diff = neonUsers.rows[0].c - sbUsers.rows[0].c;
      console.log(diff === 0 ? '  ✅ User 수 일치 (동기화 정상)' : `  ⚠️ 차이 ${diff}명 (동기화 누락 의심)`);
      await sb.end();
    } catch (e) {
      console.log(`  ❌ Supabase 연결 실패: ${e.message}`);
    }
  }
} catch (e) {
  console.error('조회 오류:', e.message);
} finally {
  await client.end();
}
