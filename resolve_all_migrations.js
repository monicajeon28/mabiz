const { execSync } = require('child_process');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const migrationsDir = './prisma/migrations';
const migrations = fs.readdirSync(migrationsDir)
  .filter(d => fs.statSync(`${migrationsDir}/${d}`).isDirectory())
  .sort();

async function resolveAll() {
  console.log(`🔧 RESOLVING ALL ${migrations.length} MIGRATIONS\n`);
  
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < migrations.length; i++) {
    const name = migrations[i];
    console.log(`[${i + 1}/${migrations.length}] ${name}...`);
    
    try {
      execSync(
        `npx prisma migrate resolve --applied "${name}"`,
        {
          stdio: 'pipe',
          env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
        }
      );
      console.log('  ✅\n');
      success++;
    } catch (err) {
      console.log('  ❌ Already resolved or error\n');
      failed++;
    }
  }
  
  console.log(`\n=== SUMMARY ===`);
  console.log(`✅ Resolved: ${success}`);
  console.log(`⚠️  Skipped: ${failed}`);
  console.log(`Total: ${migrations.length}`);
}

resolveAll();
