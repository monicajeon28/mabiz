const { Pool } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_lAI4jQLnG1KN@ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=verify-full';

const pool = new Pool({
  connectionString: connectionString,
});

async function run() {
  try {
    console.log('=== 1. 현재 DB 스키마의 모든 테이블 목록 ===');
    const tables = await pool.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\' ORDER BY table_name;'
    );
    console.log('테이블 개수:', tables.rows.length);
    tables.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.table_name}`);
    });

    console.log('\n=== 2. _prisma_migrations 테이블의 현재 상태 ===');
    const migrations = await pool.query(
      'SELECT id, checksum, finished_at FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 10;'
    );
    console.log('최근 10개 마이그레이션:');
    migrations.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ID: ${row.id}, Finished: ${row.finished_at}`);
    });

    console.log('\n=== 3. 전체 마이그레이션 개수 및 완료 상태 ===');
    const migrationCount = await pool.query(
      'SELECT COUNT(*) as total, COUNT(finished_at) as completed FROM "_prisma_migrations";'
    );
    console.log('전체:', migrationCount.rows[0].total);
    console.log('완료:', migrationCount.rows[0].completed);
    console.log('미완료:', migrationCount.rows[0].total - migrationCount.rows[0].completed);

    await pool.end();
  } catch (error) {
    console.error('오류:', error.message);
    process.exit(1);
  }
}

run();
