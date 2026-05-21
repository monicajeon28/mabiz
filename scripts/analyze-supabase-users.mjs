#!/usr/bin/env node

/**
 * Step 1: Analyze Supabase users
 * - Count total users
 * - List admin/sales users
 * - Check for missing phone/password fields
 * - Verify role values
 */

import pg from 'pg';

const { Client } = pg;

const SUPABASE_URL = process.env.SUPABASE_BACKUP_URL;
if (!SUPABASE_URL) {
  console.error('❌ SUPABASE_BACKUP_URL not set in .env.local');
  process.exit(1);
}

const client = new Client({ connectionString: SUPABASE_URL });

async function analyzeUsers() {
  try {
    await client.connect();
    console.log('✓ Connected to Supabase');

    // Total users
    const totalResult = await client.query('SELECT COUNT(*) as count FROM "User"');
    const totalUsers = totalResult.rows[0].count;
    console.log(`\n📊 Total users in Supabase: ${totalUsers}`);

    // Check role distribution
    const roleResult = await client.query(`
      SELECT role, COUNT(*) as count FROM "User"
      GROUP BY role
      ORDER BY count DESC
    `);
    console.log('\n📋 Role distribution:');
    roleResult.rows.forEach(row => {
      console.log(`   ${row.role}: ${row.count}`);
    });

    // Admin/Sales users (with phone & password)
    const adminSalesResult = await client.query(`
      SELECT id, phone, name, password, role FROM "User"
      WHERE role IN ('admin', 'sales', 'presales')
      AND phone IS NOT NULL
      AND password IS NOT NULL
      ORDER BY role, id
    `);
    console.log(`\n👥 Admin/Sales/Presales users (with phone & password): ${adminSalesResult.rows.length}`);
    adminSalesResult.rows.forEach(row => {
      console.log(`   ID:${row.id} | ${row.role.padEnd(10)} | Phone:${row.phone} | Name:${row.name}`);
    });

    // Check for incomplete records
    const incompleteResult = await client.query(`
      SELECT id, phone, password, role FROM "User"
      WHERE (phone IS NULL OR password IS NULL)
      AND role IN ('admin', 'sales', 'presales')
    `);
    if (incompleteResult.rows.length > 0) {
      console.log(`\n⚠️  Incomplete records (missing phone/password): ${incompleteResult.rows.length}`);
      incompleteResult.rows.forEach(row => {
        console.log(`   ID:${row.id} | Phone:${row.phone ?? 'NULL'} | Password:${row.password ? '✓' : 'NULL'}`);
      });
    } else {
      console.log('\n✓ No incomplete records for admin/sales/presales users');
    }

    console.log('\n✅ Analysis complete');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

analyzeUsers();
