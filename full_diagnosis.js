const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function diagnose() {
  try {
    console.log('=== FULL TABLE DIAGNOSIS ===\n');
    
    const columns = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = '_prisma_migrations'
      ORDER BY ordinal_position
    `);
    
    console.log('Current columns:');
    columns.rows.forEach(c => console.log(`  - ${c.column_name} (${c.data_type})`));
    
    console.log('\n=== EXPECTED PRISMA v7.7.0 SCHEMA ===\n');
    const expected = [
      'id (SERIAL)',
      'checksum (VARCHAR)',
      'finished_at (TIMESTAMP)',
      'execution_time (BIGINT)',
      'success (BOOLEAN)',
      'started_at (TIMESTAMP)',
      'logs (TEXT)',
      'rolled_back_at (TIMESTAMP)',
      'started_by (VARCHAR)',
      'finished_by (VARCHAR)',
      'migration_name (VARCHAR)',
      'applied_steps_count (INTEGER)'  // <- MISSING!
    ];
    
    expected.forEach(col => console.log(`  - ${col}`));
    
    // Check what Prisma actually queries
    console.log('\n=== CHECKING PRISMA SCHEMA LOOKUPS ===\n');
    
    const missingCols = [
      'applied_steps_count',
      'rolled_back_by',
      'finished_by'
    ];
    
    for (const col of missingCols) {
      const result = await pool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = '_prisma_migrations' AND column_name = $1
      `, [col]);
      console.log(`${col}: ${result.rows.length > 0 ? '✅' : '❌'}`);
    }
    
  } finally {
    await pool.end();
  }
}

diagnose();
