import pg from 'pg';
const { Client } = pg;

const NEON_URL = process.env.DATABASE_URL;
if (!NEON_URL) { console.error('❌ DATABASE_URL 미설정'); process.exit(1); }

const client = new Client({ connectionString: NEON_URL });

async function run() {
  try {
    await client.connect();
    console.log('✅ Neon 연결 성공');

    // DLQ 테이블 존재 확인
    const check = await client.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'SyncDeadLetterQueue') AS exists`
    );

    if (check.rows[0].exists) {
      console.log('ℹ️  SyncDeadLetterQueue 테이블 이미 존재 — 스킵');
      return;
    }

    // 테이블 생성
    await client.query(`
      CREATE TABLE "SyncDeadLetterQueue" (
        "id"            TEXT NOT NULL,
        "syncType"      TEXT NOT NULL DEFAULT 'NEON_TO_SUPABASE',
        "operationType" TEXT NOT NULL,
        "tableName"     TEXT NOT NULL,
        "recordId"      TEXT NOT NULL,
        "data"          JSONB NOT NULL,
        "error"         TEXT NOT NULL,
        "retryCount"    INTEGER NOT NULL DEFAULT 0,
        "maxRetries"    INTEGER NOT NULL DEFAULT 5,
        "nextRetryAt"   TIMESTAMP(3) NOT NULL,
        "status"        TEXT NOT NULL DEFAULT 'PENDING',
        "resolvedAt"    TIMESTAMP(3),
        "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SyncDeadLetterQueue_pkey" PRIMARY KEY ("id")
      );
    `);

    await client.query(`CREATE INDEX "SyncDeadLetterQueue_status_idx" ON "SyncDeadLetterQueue"("status");`);
    await client.query(`CREATE INDEX "SyncDeadLetterQueue_nextRetryAt_idx" ON "SyncDeadLetterQueue"("nextRetryAt");`);
    await client.query(`CREATE INDEX "SyncDeadLetterQueue_createdAt_idx" ON "SyncDeadLetterQueue"("createdAt");`);

    // prisma _prisma_migrations 에 기록 (prisma가 이미 적용된 것으로 인식하도록)
    const alreadyRecorded = await client.query(
      `SELECT id FROM "_prisma_migrations" WHERE migration_name = '20260521205239_add_sync_dlq' LIMIT 1`
    );
    if (alreadyRecorded.rows.length === 0) {
      await client.query(`
        INSERT INTO "_prisma_migrations" (
          id, checksum, finished_at, migration_name, logs, rolled_back_at,
          started_at, applied_steps_count
        ) VALUES (
          gen_random_uuid()::text,
          'manual_dlq',
          NOW(),
          '20260521205239_add_sync_dlq',
          NULL, NULL, NOW(), 1
        )
      `);
      console.log('✅ Prisma migrations 기록 완료');
    } else {
      console.log('ℹ️  Prisma migrations 이미 기록됨 — 스킵');
    }

    console.log('✅ SyncDeadLetterQueue 테이블 생성 완료');
    console.log('✅ 인덱스 3개 생성 완료');
    console.log('✅ Prisma migrations 기록 완료');

  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
