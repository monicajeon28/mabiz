const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function check() {
  try {
    // 1. Exact table definition
    console.log('=== EXACT TABLE DEFINITION ===\n');
    const tableInfo = await pool.query(`
      SELECT 
        t.typname as type_name,
        t.typlen as type_length,
        t.typbyval as passed_by_value,
        t.typtype as type_type,
        a.attname as column_name,
        a.atttypid as type_oid,
        a.attlen,
        a.attnotnull as not_null,
        a.atthasdef as has_default
      FROM pg_class c
      JOIN pg_namespace n ON c.relnamespace = n.oid
      LEFT JOIN pg_attribute a ON c.oid = a.attrelid
      LEFT JOIN pg_type t ON a.atttypid = t.oid
      WHERE n.nspname = 'public' AND c.relname = '_prisma_migrations'
      ORDER BY a.attnum
    `);
    console.log(tableInfo.rows);
    
    // 2. Check for any hidden columns
    console.log('\n=== ALL COLUMNS (including hidden) ===\n');
    const allCols = await pool.query(`
      SELECT attname, attnum, attisdropped
      FROM pg_attribute
      WHERE attrelid = '_prisma_migrations'::regclass
      ORDER BY attnum
    `);
    console.log(allCols.rows);
    
    // 3. Check table constraints
    console.log('\n=== CONSTRAINTS ===\n');
    const constraints = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = '_prisma_migrations'
    `);
    console.log(constraints.rows);
    
  } catch (error) {
    console.error('ERROR:', error.message);
    console.error('Detail:', error.detail);
  } finally {
    await pool.end();
  }
}

check();
