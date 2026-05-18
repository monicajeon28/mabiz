const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function nukeAndReset() {
  const client = await pool.connect();
  
  try {
    console.log('⚠️  WARNING: COMPLETE RESET OF PRISMA MIGRATIONS TABLE\n');
    
    // Backup all migration data
    console.log('[STEP 1] Backing up all migration records...');
    const allMigrations = await client.query(`
      SELECT * FROM "_prisma_migrations" ORDER BY id
    `);
    
    const backup = {
      timestamp: new Date().toISOString(),
      count: allMigrations.rows.length,
      records: allMigrations.rows
    };
    
    fs.writeFileSync('prisma_migrations_full_backup.json', JSON.stringify(backup, null, 2));
    console.log(`✅ Backed up ${allMigrations.rows.length} migrations to prisma_migrations_full_backup.json\n`);
    
    // Drop table
    console.log('[STEP 2] Dropping _prisma_migrations table...');
    await client.query('DROP TABLE IF EXISTS "_prisma_migrations" CASCADE');
    console.log('✅ Table dropped\n');
    
    // Drop sequence
    console.log('[STEP 3] Dropping associated sequences...');
    try {
      await client.query('DROP SEQUENCE IF EXISTS "_prisma_migrations_id_seq" CASCADE');
      console.log('✅ Sequence dropped\n');
    } catch (e) {
      console.log('⚠️  Sequence not found (already dropped)\n');
    }
    
    console.log('✅ RESET COMPLETE');
    console.log('\nNext step: Run "npx prisma migrate deploy" to restore schema');
    console.log('This will recreate _prisma_migrations with correct schema.');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

nukeAndReset();
