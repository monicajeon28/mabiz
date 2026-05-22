import pg from 'pg';
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// 이미 등록된 이름 목록 확인
const existing = await client.query(
  `SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = '20260521205239_add_sync_dlq'`
);

if (existing.rows.length > 0) {
  console.log('ℹ️  이미 migration 기록 존재 — 스킵');
} else {
  await client.query(`
    INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
    VALUES (gen_random_uuid()::text, 'manual_safe', NOW(), '20260521205239_add_sync_dlq', NULL, NULL, NOW(), 1)
  `);
  console.log('✅ Prisma migration 기록 완료: 20260521205239_add_sync_dlq');
}

await client.end();
