#!/usr/bin/env node

/**
 * Step 2: Clean junk data from Neon
 * - Delete test/junk users (keep existing production users)
 * - Only delete users that don't have proper phone/role
 * - Preserve all real data
 */

import pg from 'pg';
import readline from 'readline';

const { Client } = pg;

const NEON_URL = process.env.DATABASE_URL;
if (!NEON_URL) {
  console.error('❌ DATABASE_URL not set in .env.local');
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

const client = new Client({ connectionString: NEON_URL });

async function cleanJunkUsers() {
  try {
    await client.connect();
    console.log('✓ Connected to Neon');

    // Check current state
    const beforeCount = await client.query('SELECT COUNT(*) as count FROM "User"');
    console.log(`\n📊 Current user count in Neon: ${beforeCount.rows[0].count}`);

    // Identify test/junk users (those without phone or with test patterns)
    const junkResult = await client.query(`
      SELECT id, phone, password, name, role FROM "User"
      WHERE phone IS NULL OR phone = '' OR phone LIKE '%test%'
      ORDER BY id DESC
    `);

    if (junkResult.rows.length === 0) {
      console.log('\n✓ No junk users found');
      return;
    }

    console.log(`\n🗑️  Found ${junkResult.rows.length} potential junk records:`);
    junkResult.rows.forEach(row => {
      console.log(`   ID:${row.id} | Phone:${row.phone ?? 'NULL'} | Name:${row.name}`);
    });

    const confirm = await question(
      `\n⚠️  Delete these ${junkResult.rows.length} junk records? (yes/no): `
    );

    if (confirm.toLowerCase() !== 'yes') {
      console.log('\n❌ Cancelled');
      return;
    }

    // Delete junk records
    const deleteResult = await client.query(`
      DELETE FROM "User"
      WHERE phone IS NULL OR phone = '' OR phone LIKE '%test%'
    `);

    console.log(`\n✓ Deleted ${deleteResult.rowCount} junk records`);

    const afterCount = await client.query('SELECT COUNT(*) as count FROM "User"');
    console.log(`📊 User count after cleanup: ${afterCount.rows[0].count}`);

    console.log('\n✅ Cleanup complete');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    await client.end();
  }
}

cleanJunkUsers();
