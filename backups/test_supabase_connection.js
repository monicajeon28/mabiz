const { Client } = require('pg');
const fs = require('fs');

const connectionString = 'postgresql://postgres:%21Wjsgptjsdl2@db.cnynywuxapxvythbcagz.supabase.co:5432/postgres';

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

client.connect((err) => {
  if (err) {
    console.error('연결 오류:', err.message);
    process.exit(1);
  }
  console.log('✓ Supabase 연결 성공');
  
  client.query('SELECT version();', (err, res) => {
    if (err) {
      console.error('쿼리 오류:', err);
    } else {
      console.log('PostgreSQL 버전:', res.rows[0].version.split(',')[0]);
    }
    client.end();
  });
});
