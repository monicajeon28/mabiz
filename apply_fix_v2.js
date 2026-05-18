const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function applyFix() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 APPLYING PRISMA V2 FIX (Add migration_name column)...\n');
    
    // 1. Add column
    console.log('[STEP 1] Adding migration_name column...');
    try {
      await client.query(`
        ALTER TABLE _prisma_migrations ADD COLUMN migration_name VARCHAR(255)
      `);
      console.log('✅ Column added\n');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('⚠️  Column already exists\n');
      } else {
        throw err;
      }
    }
    
    // 2. Populate from name
    console.log('[STEP 2] Populating migration_name from name column...');
    const result = await client.query(`
      UPDATE _prisma_migrations 
      SET migration_name = name 
      WHERE migration_name IS NULL
    `);
    console.log(`✅ Updated ${result.rowCount} rows\n`);
    
    // 3. Make NOT NULL
    console.log('[STEP 3] Making migration_name NOT NULL...');
    await client.query(`
      ALTER TABLE _prisma_migrations ALTER COLUMN migration_name SET NOT NULL
    `);
    console.log('✅ Column constraint set\n');
    
    // 4. Add unique constraint
    console.log('[STEP 4] Adding UNIQUE constraint...');
    try {
      await client.query(`
        ALTER TABLE _prisma_migrations 
        ADD CONSTRAINT _prisma_migrations_migration_name_unique 
        UNIQUE(migration_name)
      `);
      console.log('✅ Constraint added\n');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('⚠️  Constraint already exists\n');
      } else {
        throw err;
      }
    }
    
    // 5. Verify
    console.log('[STEP 5] Verification...');
    const verify = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = '_prisma_migrations' 
      AND column_name IN ('name', 'migration_name')
      ORDER BY column_name
    `);
    console.log('Columns found:', verify.rows.map(r => r.column_name).join(', '));
    
    const sampleData = await client.query(`
      SELECT id, name, migration_name FROM _prisma_migrations LIMIT 3
    `);
    console.log('\nSample data:');
    console.log(sampleData.rows);
    
    console.log('\n✅ FIX V2 APPLIED SUCCESSFULLY!');
    
  } catch (error) {
    console.error('\n❌ FIX FAILED:', error.message);
    console.error('Detail:', error.detail);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applyFix();
