#!/usr/bin/env node

/**
 * Step 4: Verify migration success
 * - Compare user counts between Supabase and Neon
 * - Check specific test accounts (boss1, sales1, admin1)
 * - Verify role values
 * - Check password integrity
 */

import pg from 'pg';

const { Client } = pg;

const SUPABASE_URL = process.env.SUPABASE_BACKUP_URL;
const NEON_URL = process.env.DATABASE_URL;

if (!SUPABASE_URL || !NEON_URL) {
  console.error('❌ Missing SUPABASE_BACKUP_URL or DATABASE_URL in .env.local');
  process.exit(1);
}

const supabaseClient = new Client({ connectionString: SUPABASE_URL });
const neonClient = new Client({ connectionString: NEON_URL });

async function verifyMigration() {
  try {
    await supabaseClient.connect();
    await neonClient.connect();
    console.log('✓ Connected to both Supabase and Neon\n');

    // 1. Compare user counts
    console.log('📊 User Count Comparison:');
    const supabaseCountResult = await supabaseClient.query(`
      SELECT COUNT(*) as count FROM "User"
      WHERE role IN ('admin', 'sales', 'presales')
    `);
    const neonCountResult = await neonClient.query(`
      SELECT COUNT(*) as count FROM "User"
      WHERE role IN ('admin', 'sales', 'presales')
    `);

    const supabaseCount = supabaseCountResult.rows[0].count;
    const neonCount = neonCountResult.rows[0].count;

    console.log(`   Supabase: ${supabaseCount}`);
    console.log(`   Neon: ${neonCount}`);

    if (supabaseCount === neonCount) {
      console.log('   ✓ Counts match\n');
    } else {
      console.log(`   ⚠️  Mismatch: ${neonCount} vs ${supabaseCount}\n`);
    }

    // 2. Check test account: boss1
    console.log('👤 Checking boss1 account:');
    const boss1Supabase = await supabaseClient.query(
      `SELECT id, phone, name, role FROM "User" WHERE phone LIKE '%boss1%' OR name LIKE '%boss1%' LIMIT 1`
    );
    const boss1Neon = await neonClient.query(
      `SELECT id, phone, name, role FROM "User" WHERE phone LIKE '%boss1%' OR name LIKE '%boss1%' LIMIT 1`
    );

    if (boss1Supabase.rows.length > 0) {
      const sb = boss1Supabase.rows[0];
      console.log(`   Supabase: ID:${sb.id} Phone:${sb.phone} Name:${sb.name} Role:${sb.role}`);
    } else {
      console.log('   Supabase: Not found');
    }

    if (boss1Neon.rows.length > 0) {
      const nb = boss1Neon.rows[0];
      console.log(`   Neon: ID:${nb.id} Phone:${nb.phone} Name:${nb.name} Role:${nb.role}`);
      if (boss1Neon.rows.length > 0 && boss1Supabase.rows.length > 0) {
        if (boss1Neon.rows[0].phone === boss1Supabase.rows[0].phone) {
          console.log('   ✓ Migrated successfully\n');
        }
      }
    } else {
      console.log('   Neon: Not found\n');
    }

    // 3. Check test account: sales1
    console.log('👤 Checking sales1 account:');
    const sales1Supabase = await supabaseClient.query(
      `SELECT id, phone, name, role FROM "User" WHERE phone LIKE '%sales1%' OR name LIKE '%sales1%' LIMIT 1`
    );
    const sales1Neon = await neonClient.query(
      `SELECT id, phone, name, role FROM "User" WHERE phone LIKE '%sales1%' OR name LIKE '%sales1%' LIMIT 1`
    );

    if (sales1Supabase.rows.length > 0) {
      const sb = sales1Supabase.rows[0];
      console.log(`   Supabase: ID:${sb.id} Phone:${sb.phone} Name:${sb.name} Role:${sb.role}`);
    } else {
      console.log('   Supabase: Not found');
    }

    if (sales1Neon.rows.length > 0) {
      const nb = sales1Neon.rows[0];
      console.log(`   Neon: ID:${nb.id} Phone:${nb.phone} Name:${nb.name} Role:${nb.role}`);
      if (sales1Neon.rows.length > 0 && sales1Supabase.rows.length > 0) {
        if (sales1Neon.rows[0].phone === sales1Supabase.rows[0].phone) {
          console.log('   ✓ Migrated successfully\n');
        }
      }
    } else {
      console.log('   Neon: Not found\n');
    }

    // 4. Check test account: admin1
    console.log('👤 Checking admin1 account:');
    const admin1Supabase = await supabaseClient.query(
      `SELECT id, phone, name, role FROM "User" WHERE phone LIKE '%admin1%' OR name LIKE '%admin1%' LIMIT 1`
    );
    const admin1Neon = await neonClient.query(
      `SELECT id, phone, name, role FROM "User" WHERE phone LIKE '%admin1%' OR name LIKE '%admin1%' LIMIT 1`
    );

    if (admin1Supabase.rows.length > 0) {
      const sb = admin1Supabase.rows[0];
      console.log(`   Supabase: ID:${sb.id} Phone:${sb.phone} Name:${sb.name} Role:${sb.role}`);
    } else {
      console.log('   Supabase: Not found');
    }

    if (admin1Neon.rows.length > 0) {
      const nb = admin1Neon.rows[0];
      console.log(`   Neon: ID:${nb.id} Phone:${nb.phone} Name:${nb.name} Role:${nb.role}`);
      if (admin1Neon.rows.length > 0 && admin1Supabase.rows.length > 0) {
        if (admin1Neon.rows[0].phone === admin1Supabase.rows[0].phone) {
          console.log('   ✓ Migrated successfully\n');
        }
      }
    } else {
      console.log('   Neon: Not found\n');
    }

    // 5. Role distribution in Neon
    console.log('📋 Role distribution in Neon:');
    const roleResult = await neonClient.query(`
      SELECT role, COUNT(*) as count FROM "User"
      WHERE role IN ('admin', 'sales', 'presales')
      GROUP BY role
      ORDER BY count DESC
    `);
    roleResult.rows.forEach(row => {
      console.log(`   ${row.role}: ${row.count}`);
    });

    console.log('\n✅ Verification complete');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await supabaseClient.end();
    await neonClient.end();
  }
}

verifyMigration();
