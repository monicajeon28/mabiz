const { Pool } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_lAI4jQLnG1KN@ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=verify-full';

const pool = new Pool({
  connectionString: connectionString,
});

async function run() {
  try {
    console.log('=== DB의 모든 마이그레이션 기록 (마이그레이션명 포함) ===\n');
    const allMigrations = await pool.query(
      'SELECT id, migration_name, finished_at, rolled_back_at, applied_steps_count FROM "_prisma_migrations" ORDER BY started_at ASC;'
    );

    console.log(`전체 마이그레이션: ${allMigrations.rows.length}개\n`);

    let completedCount = 0;
    let pendingCount = 0;

    allMigrations.rows.forEach((row, idx) => {
      const status = row.finished_at ? '✓' : '✗';
      const time = row.finished_at ? `(완료 ${new Date(row.finished_at).toLocaleString('ko-KR')})` : `(실패 ${new Date(row.rolled_back_at).toLocaleString('ko-KR')})`;

      console.log(`${idx + 1}. [${status}] ${row.migration_name}`);
      console.log(`   ID: ${row.id}`);
      console.log(`   ${time}`);
      console.log(`   Steps: ${row.applied_steps_count || 0}\n`);

      if (row.finished_at) {
        completedCount++;
      } else {
        pendingCount++;
      }
    });

    console.log(`\n=== 요약 ===`);
    console.log(`✓ 완료: ${completedCount}개`);
    console.log(`✗ 미완료 (롤백됨): ${pendingCount}개`);

    await pool.end();
  } catch (error) {
    console.error('오류:', error.message);
    process.exit(1);
  }
}

run();
