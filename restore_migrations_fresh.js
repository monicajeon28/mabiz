const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const crypto = require('crypto');

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function restore() {
  const client = await pool.connect();
  
  try {
    console.log('=== RESTORING MIGRATIONS (Fresh Start) ===\n');
    
    // Step 1: Create _prisma_migrations table from scratch
    console.log('[STEP 1] Creating _prisma_migrations table...');
    await client.query(`
      CREATE TABLE "_prisma_migrations" (
        id SERIAL NOT NULL PRIMARY KEY,
        checksum VARCHAR(64) NOT NULL,
        finished_at TIMESTAMP,
        execution_time BIGINT NOT NULL,
        success BOOLEAN NOT NULL DEFAULT true,
        started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        logs TEXT,
        rolled_back_at TIMESTAMP,
        started_by VARCHAR(255),
        finished_by VARCHAR(255),
        migration_name VARCHAR(255) NOT NULL,
        applied_steps_count INTEGER NOT NULL DEFAULT 1,
        UNIQUE(checksum),
        UNIQUE(migration_name)
      )
    `);
    console.log('✅ Table created\n');
    
    // Step 2: Load backup
    console.log('[STEP 2] Loading migration backup...');
    const backup = JSON.parse(fs.readFileSync('prisma_migrations_full_backup.json', 'utf8'));
    console.log(`✅ Loaded ${backup.count} migration records\n`);
    
    // Step 3: Restore all migrations
    console.log('[STEP 3] Restoring migration records...');
    for (const migration of backup.records) {
      try {
        const checksum = migration.checksum || crypto.randomBytes(32).toString('hex').substring(0, 64);
        
        await client.query(`
          INSERT INTO "_prisma_migrations"
          (checksum, finished_at, execution_time, success, started_at, logs, rolled_back_at, started_by, finished_by, migration_name, applied_steps_count)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          checksum,
          migration.finished_at || new Date(),
          migration.execution_time || 1000,
          migration.success !== false,
          migration.started_at || new Date(),
          migration.logs || null,
          migration.rolled_back_at || null,
          migration.started_by || null,
          migration.finished_by || null,
          migration.migration_name || migration.name,
          migration.applied_steps_count || 1
        ]);
      } catch (err) {
        console.error(`  ❌ Failed to insert ${migration.migration_name}:`, err.message);
      }
    }
    console.log(`✅ Restored ${backup.count} records\n`);
    
    // Step 4: Verify
    console.log('[STEP 4] Verification...');
    const count = await client.query('SELECT COUNT(*) FROM "_prisma_migrations"');
    console.log(`Total records in DB: ${count.rows[0].count}`);
    
    const sample = await client.query(`
      SELECT id, migration_name FROM "_prisma_migrations" ORDER BY id LIMIT 5
    `);
    console.log('Sample records:');
    sample.rows.forEach(r => console.log(`  ${r.id}: ${r.migration_name}`));
    
    console.log('\n✅ RESTORATION COMPLETE!');
    console.log('\nNext: Run "npx prisma migrate status" to verify');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Detail:', error.detail);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

restore();
