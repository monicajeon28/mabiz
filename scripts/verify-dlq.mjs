import pg from 'pg';
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL });

await client.connect();

const t = await client.query(
  `SELECT table_name FROM information_schema.tables WHERE table_name = 'SyncDeadLetterQueue'`
);
console.log('테이블 존재:', t.rows.length > 0 ? '✅ 있음' : '❌ 없음');

const i = await client.query(
  `SELECT indexname FROM pg_indexes WHERE tablename = 'SyncDeadLetterQueue'`
);
console.log('인덱스:', i.rows.map(r => r.indexname).join(', ') || '없음');

const c = await client.query(
  `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'SyncDeadLetterQueue' ORDER BY ordinal_position`
);
console.log('컬럼 수:', c.rows.length);
c.rows.forEach(r => console.log(' -', r.column_name, ':', r.data_type));

const m = await client.query(
  `SELECT migration_name, finished_at FROM "_prisma_migrations" WHERE migration_name LIKE '%dlq%' LIMIT 3`
);
console.log('\nPrisma migration 기록:');
m.rows.forEach(r => console.log(' -', r.migration_name, ':', r.finished_at));

await client.end();
