const fs = require('fs');
const path = require('path');

// Read from env file
const envContent = fs.readFileSync('D:\\mabiz-crm\\.env.local', 'utf8');
const match = envContent.match(/SUPABASE_BACKUP_URL="([^"]+)"/);
const connectionString = match ? match[1] : null;

if (!connectionString) {
    console.error('❌ Supabase URL not found');
    process.exit(1);
}

console.log('📊 Supabase 데이터베이스 확인 시작');
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
        console.log('✓ PostgreSQL:', version.split(',')[0]);
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
        if (result.rows.length === 0) {
            console.log('  (테이블 없음)');
        } else {
            result.rows.slice(0, 10).forEach(row => {
                console.log('  ✓ ' + row.tablename);
            });
            if (result.rows.length > 10) {
                console.log('  ... 외 ' + (result.rows.length - 10) + '개');
            }
        }

        // Save info
        const backupInfo = {
            timestamp: new Date().toISOString(),
            status: 'connected_verified',
            tables: result.rows.length,
            tableList: result.rows.map(r => r.tablename)
        };

        fs.writeFileSync('D:\\mabiz-crm\\backups\\supabase_status.json', 
            JSON.stringify(backupInfo, null, 2));
        
        console.log('');
        console.log('✅ Supabase 연결 및 테이블 확인 완료!');

        return client.end();
    })
    .catch(err => {
        console.error('❌ 오류:', err.message);
        process.exit(1);
    });
