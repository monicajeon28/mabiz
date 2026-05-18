const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');

// Load env
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function diagnose() {
  try {
    console.log('=== DIAGNOSE: _prisma_migrations TABLE ===\n');
    
    // 1. 테이블 존재 여부
    console.log('1. TABLE EXISTENCE:');
    const tableExists = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name = '_prisma_migrations' AND table_schema = 'public'
    `);
    console.log('EXISTS:', tableExists.rows.length > 0 ? 'YES' : 'NO');
    console.log();
    
    if (tableExists.rows.length === 0) {
      console.log('ERROR: _prisma_migrations table does not exist!\n');
      process.exit(1);
    }
    
    // 2. 컬럼 구조
    console.log('2. TABLE STRUCTURE:');
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = '_prisma_migrations' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log(columns.rows);
    console.log();
    
    // 3. migration_name 컬럼 존재 여부
    console.log('3. COLUMN "migration_name" CHECK:');
    const hasMigrationNameCol = columns.rows.some(col => col.column_name === 'migration_name');
    console.log('EXISTS:', hasMigrationNameCol ? 'YES' : 'NO ⚠️');
    console.log();
    
    // 4. 테이블 데이터 개수
    console.log('4. MIGRATION RECORDS:');
    const records = await pool.query('SELECT COUNT(*) FROM _prisma_migrations');
    console.log('Total records:', records.rows[0].count);
    console.log();
    
    // 5. 최근 마이그레이션들
    console.log('5. RECENT MIGRATIONS:');
    const latestMigrations = await pool.query(`
      SELECT * FROM _prisma_migrations 
      ORDER BY started_at DESC LIMIT 5
    `);
    console.log(latestMigrations.rows);
    console.log();
    
    // 6. Prisma 버전 확인
    console.log('6. PRISMA VERSION:');
    const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    console.log('Prisma version:', pkg.dependencies['@prisma/client']);
    
  } catch (error) {
    console.error('ERROR:', error.message);
    console.error('DETAIL:', error.detail);
    console.error('CODE:', error.code);
  } finally {
    await pool.end();
  }
}

diagnose();
