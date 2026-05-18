const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function check() {
  try {
    console.log('=== CHECKING DATA INTEGRITY ===\n');
    
    // Check id column type
    const idCol = await pool.query(`
      SELECT data_type, column_default FROM information_schema.columns
      WHERE table_name = '_prisma_migrations' AND column_name = 'id'
    `);
    console.log('ID column info:', idCol.rows[0]);
    
    // Check data
    const data = await pool.query('SELECT * FROM _prisma_migrations LIMIT 5');
    console.log('\nSample rows:');
    data.rows.forEach(row => {
      console.log(`  ID: ${row.id} (type: ${typeof row.id}) | ${row.migration_name}`);
    });
    
    // Check for NULL or invalid IDs
    const nullCheck = await pool.query(`
      SELECT COUNT(*) FROM _prisma_migrations WHERE id IS NULL
    `);
    console.log('\nNULL IDs:', nullCheck.rows[0].count);
    
    // Try raw Prisma query
    console.log('\n=== Testing Prisma query pattern ===');
    const testQuery = await pool.query(`
      SELECT 
        id::text,
        checksum,
        finished_at,
        execution_time,
        success,
        started_at,
        logs,
        rolled_back_at,
        started_by,
        finished_by,
        migration_name,
        applied_steps_count
      FROM _prisma_migrations
      LIMIT 1
    `);
    console.log('Query result:', testQuery.rows[0]);
    
  } finally {
    await pool.end();
  }
}

check();
