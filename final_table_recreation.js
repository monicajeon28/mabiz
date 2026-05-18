const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function recreate() {
  const client = await pool.connect();
  
  try {
    console.log('=== FINAL TABLE RECREATION (Prisma v7.7.0) ===\n');
    
    // Step 1: Backup all data
    console.log('[STEP 1] Backing up migration data...');
    const backup = await client.query('SELECT * FROM _prisma_migrations ORDER BY id');
    console.log(`✅ Backed up ${backup.rows.length} records\n`);
    
    // Step 2: Drop table completely
    console.log('[STEP 2] Dropping old table...');
    await client.query('DROP TABLE IF EXISTS _prisma_migrations CASCADE');
    console.log('✅ Table dropped\n');
    
    // Step 3: Recreate with exact Prisma v7 schema
    console.log('[STEP 3] Creating new table with Prisma v7 exact schema...');
    await client.query(`
      CREATE TABLE "_prisma_migrations" (
        "id"                    SERIAL      PRIMARY KEY NOT NULL,
        "checksum"              VARCHAR(64) NOT NULL,
        "finished_at"           TIMESTAMP,
        "execution_time"        BIGINT      NOT NULL,
        "success"               BOOLEAN     NOT NULL DEFAULT true,
        "started_at"            TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "logs"                  TEXT,
        "rolled_back_at"        TIMESTAMP,
        "started_by"            VARCHAR(255),
        "finished_by"           VARCHAR(255),
        "migration_name"        VARCHAR(255) NOT NULL UNIQUE,
        "applied_steps_count"   INTEGER     NOT NULL DEFAULT 1
      );
      
      CREATE UNIQUE INDEX "_prisma_migrations_checksum_key" ON "_prisma_migrations"("checksum");
    `);
    console.log('✅ New table created\n');
    
    // Step 4: Restore data
    console.log('[STEP 4] Restoring migration data...');
    for (const row of backup.rows) {
      await client.query(`
        INSERT INTO "_prisma_migrations"
        (id, checksum, finished_at, execution_time, success, started_at, logs, rolled_back_at, started_by, finished_by, migration_name, applied_steps_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        row.id,
        row.checksum,
        row.finished_at,
        row.execution_time,
        row.success,
        row.started_at,
        row.logs,
        row.rolled_back_at,
        row.started_by,
        row.finished_by,
        row.migration_name || row.name,
        row.applied_steps_count || 1
      ]);
    }
    console.log(`✅ Restored ${backup.rows.length} records\n`);
    
    // Step 5: Verify
    console.log('[STEP 5] Verification...');
    const schema = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = '_prisma_migrations'
      ORDER BY ordinal_position
    `);
    
    console.log('Table columns:');
    schema.rows.forEach(col => console.log(`  ✅ ${col.column_name}`));
    
    const count = await client.query('SELECT COUNT(*) FROM "_prisma_migrations"');
    console.log(`\nTotal records: ${count.rows[0].count}`);
    
    const sample = await client.query('SELECT id, migration_name FROM "_prisma_migrations" LIMIT 3');
    console.log('\nSample records:');
    sample.rows.forEach(row => console.log(`  ${row.id}: ${row.migration_name}`));
    
    console.log('\n✅ TABLE RECREATION SUCCESSFUL!');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Detail:', error.detail);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

recreate();
