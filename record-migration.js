const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function recordMigration() {
  try {
    await client.connect();
    
    const migrationName = '20260527000001_add_customer_source_fields';
    const migrationPath = path.join('prisma', 'migrations', migrationName, 'migration.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    // Prisma stores checksum as SHA256 hash of migration file
    const crypto = require('crypto');
    const checksum = crypto.createHash('sha256').update(migrationSql).digest('hex');
    
    const now = new Date().toISOString();
    
    await client.query(
      `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES ($1, $2, $3, $4, $5, NULL, $6, 1)`,
      [migrationName, checksum, now, migrationName, null, now]
    );
    
    console.log('✅ Migration recorded in Prisma history');
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log('ℹ️  Migration already recorded');
    } else {
      console.error('❌ Error recording migration:', e.message);
    }
  } finally {
    await client.end();
  }
}

recordMigration();
