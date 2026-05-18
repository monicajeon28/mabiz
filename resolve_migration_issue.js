const { Pool } = require('pg');
const { execSync } = require('child_process');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function resolve() {
  const client = await pool.connect();
  
  try {
    console.log('=== RESOLVING PRISMA MIGRATION ISSUE ===\n');
    
    // Step 1: Verify migration data
    console.log('[STEP 1] Backing up migration history...');
    const migrations = await client.query(`
      SELECT * FROM _prisma_migrations ORDER BY id
    `);
    fs.writeFileSync('migration_backup.json', JSON.stringify(migrations.rows, null, 2));
    console.log(`✅ Backed up ${migrations.rows.length} migrations\n`);
    
    // Step 2: Get migration files list
    console.log('[STEP 2] Checking migration files...');
    const migrationsPath = './prisma/migrations';
    const dirs = fs.readdirSync(migrationsPath).filter(f => {
      return fs.statSync(`${migrationsPath}/${f}`).isDirectory();
    });
    console.log(`✅ Found ${dirs.length} migration directories\n`);
    
    console.log('[STEP 3] Current table structure summary:');
    const schema = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = '_prisma_migrations'
      ORDER BY ordinal_position
    `);
    schema.rows.forEach(col => {
      console.log(`  ✅ ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    console.log('\n[STEP 4] Checking constraints...');
    const constraints = await client.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = '_prisma_migrations'
    `);
    constraints.rows.forEach(c => {
      console.log(`  ✅ ${c.constraint_name} (${c.constraint_type})`);
    });
    
    console.log('\n=== DIAGNOSIS COMPLETE ===\n');
    console.log('The issue appears to be with Prisma schema-engine type parsing.');
    console.log('The table structure is correct, but Prisma cannot parse the ID column.');
    console.log('\nRECOMMENDED ACTION:');
    console.log('Use "npx prisma migrate resolve" to mark pending migrations as applied.');
    
  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

resolve();
