#!/usr/bin/env node

/**
 * Step 3: Migrate users from Supabase to Neon
 * - Copy admin/sales/presales users from Supabase
 * - Handle role value conversion if needed
 * - Insert with proper timestamp handling
 * - Skip users that already exist (by phone)
 */

import pg from 'pg';
import crypto from 'crypto';

const { Client } = pg;

const SUPABASE_URL = process.env.SUPABASE_BACKUP_URL;
const NEON_URL = process.env.DATABASE_URL;

if (!SUPABASE_URL || !NEON_URL) {
  console.error('❌ Missing SUPABASE_BACKUP_URL or DATABASE_URL in .env.local');
  process.exit(1);
}

const supabaseClient = new Client({ connectionString: SUPABASE_URL });
const neonClient = new Client({ connectionString: NEON_URL });

// Convert Supabase role to Neon UserRole enum if needed
// Currently both use string roles (admin, sales, presales)
function convertRole(supabaseRole) {
  const roleMap = {
    'admin': 'admin',
    'sales': 'sales',
    'presales': 'presales',
    'user': 'user',
  };
  return roleMap[supabaseRole] || 'user';
}

async function migrateUsers() {
  try {
    await supabaseClient.connect();
    await neonClient.connect();
    console.log('✓ Connected to both Supabase and Neon');

    // Get users from Supabase
    const supabaseUsersResult = await supabaseClient.query(`
      SELECT
        id,
        phone,
        password,
        name,
        role,
        "externalId",
        email,
        "mallUserId",
        "isLocked",
        "createdAt",
        "updatedAt"
      FROM "User"
      WHERE role IN ('admin', 'sales', 'presales')
      AND phone IS NOT NULL
      AND password IS NOT NULL
      ORDER BY id
    `);

    const supabaseUsers = supabaseUsersResult.rows;
    console.log(`\n📊 Found ${supabaseUsers.length} users to migrate from Supabase`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of supabaseUsers) {
      try {
        // Check if user already exists (by phone)
        const existsResult = await neonClient.query(
          'SELECT id FROM "User" WHERE phone = $1',
          [user.phone]
        );

        if (existsResult.rows.length > 0) {
          console.log(`⊘ Skipped ${user.phone} (already exists)`);
          skipped++;
          continue;
        }

        // Insert user into Neon
        const convertedRole = convertRole(user.role);
        const result = await neonClient.query(
          `INSERT INTO "User" (
            phone, password, name, role, "externalId", email,
            "mallUserId", "isLocked", "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (phone) DO NOTHING`,
          [
            user.phone,
            user.password,
            user.name || null,
            convertedRole,
            user.externalId || null,
            user.email || null,
            user.mallUserId || null,
            user.isLocked || false,
            user.createdAt || new Date(),
            user.updatedAt || new Date(),
          ]
        );

        if (result.rowCount > 0) {
          console.log(`✓ Migrated ${user.phone} (${convertedRole})`);
          migrated++;
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`❌ Error migrating ${user.phone}:`, error.message);
        errors++;
      }
    }

    console.log(`\n📈 Migration Summary:`);
    console.log(`   ✓ Migrated: ${migrated}`);
    console.log(`   ⊘ Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);

    // Verify final count
    const finalCount = await neonClient.query(
      `SELECT COUNT(*) as count FROM "User"
       WHERE role IN ('admin', 'sales', 'presales')`
    );
    console.log(`\n📊 Admin/Sales/Presales users in Neon: ${finalCount.rows[0].count}`);

    console.log('\n✅ Migration complete');
  } catch (error) {
    console.error('❌ Critical error:', error.message);
    process.exit(1);
  } finally {
    await supabaseClient.end();
    await neonClient.end();
  }
}

migrateUsers();
