const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function check() {
  try {
    const result = await pool.query(`
      SELECT id, name, started_at, finished_at, success
      FROM _prisma_migrations
      ORDER BY id ASC
    `);
    
    console.log('=== ALL RECORDED MIGRATIONS IN DB ===\n');
    result.rows.forEach(row => {
      console.log(`${row.id.toString().padStart(2)} | ${row.name} | ${row.success ? '✅' : '❌'}`);
    });
    
    console.log(`\nTotal: ${result.rows.length} migrations recorded`);
    
  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await pool.end();
  }
}

check();
