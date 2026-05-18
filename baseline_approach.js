const { Pool } = require('pg');
const { execSync } = require('child_process');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function baselineApproach() {
  const client = await pool.connect();
  
  try {
    console.log('=== BASELINE APPROACH ===\n');
    console.log('This approach:');
    console.log('1. Drop _prisma_migrations table');
    console.log('2. Use prisma migrate resolve to mark migrations as applied');
    console.log('3. Recreate table properly\n');
    
    // Step 1: Check which migrations exist as files
    console.log('[STEP 1] Checking migration files...');
    const migrationsDir = './prisma/migrations';
    const migrations = fs.readdirSync(migrationsDir)
      .filter(d => fs.statSync(`${migrationsDir}/${d}`).isDirectory())
      .sort();
    console.log(`✅ Found ${migrations.length} migration directories\n`);
    
    // Step 2: Drop table
    console.log('[STEP 2] Dropping _prisma_migrations...');
    await client.query('DROP TABLE IF EXISTS "_prisma_migrations" CASCADE');
    console.log('✅ Table dropped\n');
    
    // Step 3: Let Prisma recreate it
    console.log('[STEP 3] Running prisma migrate resolve for first migration...');
    try {
      execSync('npx prisma migrate resolve --applied 20260415000001_add_sms_log', {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
      });
    } catch (err) {
      console.log('Info:', err.message);
    }
    
  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

baselineApproach();
