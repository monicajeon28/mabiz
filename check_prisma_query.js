const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkPrismaQuery() {
  try {
    // Prisma는 내부적으로 이 쿼리를 사용할 가능성이 있음
    console.log('=== Testing Prisma internal query patterns ===\n');
    
    // Pattern 1: Select with migration_name alias
    console.log('Pattern 1: SELECT with migration_name alias');
    try {
      const r1 = await pool.query(`
        SELECT 
          id,
          checksum,
          finished_at,
          execution_time,
          success,
          started_at,
          logs,
          rolled_back_at,
          started_by,
          finished_by,
          name as migration_name
        FROM _prisma_migrations
        LIMIT 1
      `);
      console.log('✅ Works: name AS migration_name');
    } catch (e) {
      console.log('❌ Failed:', e.message);
    }
    
    // Pattern 2: Direct migration_name column
    console.log('\nPattern 2: Direct migration_name column');
    try {
      const r2 = await pool.query(`
        SELECT migration_name FROM _prisma_migrations LIMIT 1
      `);
      console.log('✅ Works');
    } catch (e) {
      console.log('❌ Failed:', e.message);
    }
    
    // Pattern 3: Check Prisma's generated schema
    console.log('\nPattern 3: Prisma generated code');
    const schemaPath = './node_modules/@prisma/engines/schema-engine-windows.exe';
    console.log('Schema engine exists:', require('fs').existsSync(schemaPath));
    
  } finally {
    await pool.end();
  }
}

checkPrismaQuery();
