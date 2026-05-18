const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function applyFinalFix() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 APPLYING FINAL FIX (Add applied_steps_count column)...\n');
    
    // Add applied_steps_count column
    console.log('[STEP 1] Adding applied_steps_count column...');
    try {
      await client.query(`
        ALTER TABLE _prisma_migrations ADD COLUMN applied_steps_count INTEGER DEFAULT 1 NOT NULL
      `);
      console.log('✅ Column added\n');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('⚠️  Column already exists\n');
      } else {
        throw err;
      }
    }
    
    // Verify all required columns
    console.log('[STEP 2] Verification - checking all Prisma v7 columns...');
    const columns = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = '_prisma_migrations'
      ORDER BY column_name
    `);
    
    const requiredCols = [
      'applied_steps_count',
      'checksum',
      'execution_time',
      'finished_at',
      'finished_by',
      'id',
      'logs',
      'migration_name',
      'name',
      'rolled_back_at',
      'started_at',
      'started_by',
      'success'
    ];
    
    const found = columns.rows.map(r => r.column_name);
    console.log('\nRequired columns status:');
    requiredCols.forEach(col => {
      console.log(`  ${found.includes(col) ? '✅' : '❌'} ${col}`);
    });
    
    console.log('\n✅ FINAL FIX APPLIED SUCCESSFULLY!');
    
  } catch (error) {
    console.error('\n❌ FIX FAILED:', error.message);
    console.error('Detail:', error.detail);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applyFinalFix();
