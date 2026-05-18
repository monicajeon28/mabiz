const { Pool } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_lAI4jQLnG1KN@ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=verify-full';

const pool = new Pool({
  connectionString: connectionString,
});

async function run() {
  try {
    console.log('=== _prisma_migrations 테이블 스키마 ===');
    const schema = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '_prisma_migrations' ORDER BY ordinal_position;`
    );
    schema.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type}`);
    });

    console.log('\n=== 전체 마이그레이션 상세 조회 (모두) ===');
    const allMigrations = await pool.query(
      'SELECT id, checksum, finished_at, rolled_back_at, started_at FROM "_prisma_migrations" ORDER BY started_at ASC;'
    );

    console.log(`전체 마이그레이션: ${allMigrations.rows.length}개\n`);

    allMigrations.rows.forEach((row, idx) => {
      const status = row.finished_at ? '✓ 완료' : '✗ 미완료';
      console.log(`${idx + 1}. [${status}] ID: ${row.id}`);
      console.log(`   Started: ${row.started_at}`);
      console.log(`   Finished: ${row.finished_at || '(미완료)'}`);
      console.log(`   Rolled Back: ${row.rolled_back_at || '(아니오)'}`);
      console.log(`   Checksum: ${row.checksum.substring(0, 16)}...\n`);
    });

    console.log('\n=== 특정 테이블 존재 여부 확인 ===');
    const testTables = ['CrmLandingView', 'CrmB2BLandingView', 'Organization', 'Contact'];

    for (const tableName of testTables) {
      const result = await pool.query(
        `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1) as exists`,
        [tableName]
      );
      console.log(`${tableName}: ${result.rows[0].exists ? '✓ 존재' : '✗ 없음'}`);
    }

    await pool.end();
  } catch (error) {
    console.error('오류:', error.message);
    process.exit(1);
  }
}

run();
