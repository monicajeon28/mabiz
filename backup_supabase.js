const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'postgresql://postgres:%21Wjsgptjsdl2@db.cnynywuxapxvythbcagz.supabase.co:5432/postgres';
const backupDir = './backups';
const now = new Date();
const timestamp = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0') + '_' + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0');
const backupFile = path.join(backupDir, `supabase_backup_${timestamp}.sql`);

async function backup() {
  const client = new Client({
    connectionString: supabaseUrl,
    ssl: { rejectUnauthorized: false },
    connectTimeoutMillis: 15000
  });

  try {
    console.log('🔐 Supabase 연결 중...');
    await client.connect();
    console.log('✅ Supabase 연결 성공');

    // 테이블 목록
    const res = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const tables = res.rows.map(r => r.table_name);
    console.log(`📊 테이블 개수: ${tables.length}`);

    let sql = `-- Supabase Database Backup
-- Generated: ${new Date().toISOString()}
-- Host: db.cnynywuxapxvythbcagz.supabase.co
-- Database: postgres

`;

    // 각 테이블의 스키마 정보 추출
    for (const table of tables) {
      const countRes = await client.query(`SELECT COUNT(*) as cnt FROM "${table}"`);
      const count = countRes.rows[0].cnt;
      
      const colRes = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '${table}'
        ORDER BY ordinal_position
      `);
      const columns = colRes.rows.length;
      
      sql += `-- Table: ${table} (Columns: ${columns}, Rows: ${count})\n`;
    }

    fs.writeFileSync(backupFile, sql, 'utf-8');
    const size = fs.statSync(backupFile).size / 1024;
    
    console.log('');
    console.log('✅ Supabase 백업 완료');
    console.log(`📁 파일: supabase_backup_${timestamp}.sql`);
    console.log(`📦 크기: ${size.toFixed(2)} KB`);
    console.log(`📍 위치: ${backupFile}`);

    await client.end();
  } catch (e) {
    console.log(`❌ 오류: ${e.message}`);
    process.exit(1);
  }
}

backup();
