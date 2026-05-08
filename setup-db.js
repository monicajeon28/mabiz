const { Client } = require('pg');

const dbUrl = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_lAI4jQLnG1KN@ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require';

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

const sql = `
CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL UNIQUE,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_sub_userId ON "PushSubscription"("userId");

CREATE TABLE IF NOT EXISTS "UserPushSettings" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL UNIQUE,
  "notifyEnabled" BOOLEAN NOT NULL DEFAULT true,
  "notifyAtHour" SMALLINT NOT NULL DEFAULT 9,
  "lastPushedAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);
`;

(async () => {
  try {
    await client.connect();
    console.log('✅ Neon 데이터베이스 연결 성공');
    
    await client.query(sql);
    console.log('✅ 테이블 생성 완료');
    
    const result = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('PushSubscription', 'UserPushSettings')
      ORDER BY table_name
    `);
    
    console.log('\n📋 생성된 테이블:');
    result.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
    await client.end();
    console.log('\n✨ 데이터베이스 셋업 완료!');
  } catch (err) {
    console.error('❌ 오류:', err.message);
    console.error('스택:', err.stack);
    process.exit(1);
  }
})();
