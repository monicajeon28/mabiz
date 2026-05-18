const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const sql = fs.readFileSync('./fix_prisma_migrations_table.sql', 'utf8');

async function applyFix() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 APPLYING PRISMA MIGRATIONS TABLE FIX...\n');
    
    // Split by line and filter comments
    const statements = sql
      .split(';\n')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'))
      .filter(s => s.length > 0);
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i] + ';';
      console.log(`[STEP ${i + 1}] Executing...`);
      try {
        const result = await client.query(stmt);
        if (result.rows && result.rows.length > 0) {
          console.log('Result:', result.rows);
        }
        console.log('✅ Success\n');
      } catch (err) {
        console.error('❌ Failed:', err.message);
        throw err;
      }
    }
    
    // Final verification
    console.log('\n✨ VERIFICATION:');
    const verify = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = '_prisma_migrations'
      ORDER BY ordinal_position
    `);
    
    console.log('Table columns:', verify.rows.map(r => `${r.column_name}(${r.data_type})`).join(', '));
    
    const count = await client.query('SELECT COUNT(*) FROM _prisma_migrations');
    console.log('Restored records:', count.rows[0].count);
    
    console.log('\n✅ FIX APPLIED SUCCESSFULLY!');
    
  } catch (error) {
    console.error('\n❌ FIX FAILED:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applyFix();
