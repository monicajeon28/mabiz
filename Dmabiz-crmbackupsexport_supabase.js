const fs = require('fs');
const path = require('path');

// Read from env file
const envPath = 'D:\mabiz-crm\.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/SUPABASE_BACKUP_URL="([^"]+)"/);
const connectionString = match ? match[1] : null;

if (!connectionString) {
    console.error('❌ Supabase URL not found');
    process.exit(1);
}

console.log('📊 Supabase 데이터베이스 백업 시작');
console.log('연결:', connectionString.substring(0, 50) + '...');
console.log('');

const { Client } = require('pg');

const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
});

client.connect()
    .then(() => {
        console.log('✓ Supabase 연결 성공!');
        return client.query('SELECT version()');
    })
    .then(result => {
        const version = result.rows[0].version;
        console.log('PostgreSQL:', version.split(',')[0]);
        console.log('');

        // List tables
        return client.query(`
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);
    })
    .then(result => {
        console.log('📋 테이블 목록 (' + result.rows.length + '개):');
        result.rows.forEach(row => {
            console.log('  ✓ ' + row.tablename);
        });

        // Generate backup info
        const backupDir = 'D:\mabiz-crm\backups';
        const backupInfo = {
            timestamp: new Date().toISOString(),
            database: 'supabase (backup)',
            host: 'db.cnynywuxapxvythbcagz.supabase.co',
            tables: result.rows.length,
            tableList: result.rows.map(r => r.tablename),
            status: 'connected_and_verified'
        };

        const infoFile = path.join(backupDir, 'supabase_connection_verified.json');
        fs.writeFileSync(infoFile, JSON.stringify(backupInfo, null, 2));

        console.log('');
        console.log('✓ Supabase 연결 확인 완료!');
        console.log('✓ 백업 정보 저장:', infoFile);

        return client.end();
    })
    .catch(err => {
        console.error('❌ 오류:', err.message);
        console.log('');
        console.log('⚠️  네트워크 연결 불가능');
        process.exit(1);
    });
