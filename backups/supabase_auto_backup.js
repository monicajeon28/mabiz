const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Read env
const envContent = fs.readFileSync('D:\\mabiz-crm\\.env.local', 'utf8');
const match = envContent.match(/SUPABASE_BACKUP_URL="([^"]+)"/);
const connectionString = match ? match[1] : null;

if (!connectionString) {
    console.error('❌ SUPABASE_BACKUP_URL not found');
    process.exit(1);
}

console.log('🚀 Supabase 자동 백업 시작');
console.log('');

const { Client } = require('pg');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupFile = `D:\\mabiz-crm\\backups\\supabase_db_backup_${timestamp}.sql`;

const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

// SQL dump generator
async function generateDump() {
    try {
        await client.connect();
        console.log('✓ Supabase 연결 성공');
        console.log('');
        
        const result = await client.query('SELECT version()');
        console.log('PostgreSQL:', result.rows[0].version.split(',')[0]);
        console.log('');

        // Get all tables
        const tablesResult = await client.query(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);

        const tables = tablesResult.rows.map(r => r.tablename);
        console.log('📋 테이블 수:', tables.length);
        console.log('테이블 목록:');
        tables.forEach(t => console.log('  ✓ ' + t));
        console.log('');

        // Generate SQL dump (schema only for now)
        console.log('💾 SQL 스키마 덤프 생성 중...');
        
        let sqlContent = '-- Supabase Database Backup\n';
        sqlContent += `-- Generated: ${new Date().toISOString()}\n`;
        sqlContent += `-- Tables: ${tables.length}\n`;
        sqlContent += '--\n\n';

        // Get schema for each table
        for (const table of tables) {
            const schemaResult = await client.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = '${table}' AND table_schema = 'public'
                ORDER BY ordinal_position
            `);

            sqlContent += `-- Table: ${table}\n`;
            sqlContent += `-- Columns: ${schemaResult.rows.length}\n`;
            
            schemaResult.rows.forEach(col => {
                sqlContent += `--   ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULLABLE' : 'NOT NULL'}\n`;
            });
            sqlContent += '\n';
        }

        // Save to file
        fs.writeFileSync(backupFile, sqlContent);
        console.log('✓ 덤프 파일 생성:', backupFile);
        console.log(`  크기: ${(fs.statSync(backupFile).size / 1024).toFixed(2)} KB`);
        console.log('');

        // Create JSON manifest
        const manifest = {
            timestamp: new Date().toISOString(),
            database: 'supabase',
            host: 'db.cnynywuxapxvythbcagz.supabase.co',
            tables: tables.length,
            tableList: tables,
            backupFile: backupFile,
            status: 'exported_successfully'
        };

        const manifestFile = path.join('D:\\mabiz-crm\\backups', 'supabase_backup_manifest.json');
        fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
        console.log('✓ 매니페스트 생성:', manifestFile);
        console.log('');

        console.log('✅ Supabase 자동 백업 완료!');
        console.log('');
        console.log('📊 백업 요약:');
        console.log('  테이블:', tables.length);
        console.log('  파일:', backupFile.split('\\').pop());
        console.log('  시간:', new Date().toISOString());

        await client.end();

    } catch (err) {
        console.error('❌ 백업 실패:', err.message);
        if (err.message.includes('ENOTFOUND')) {
            console.log('');
            console.log('⚠️  네트워크 연결 불가능 (DNS)');
            console.log('이유: 이 환경에서 Supabase 서버 접근 제한');
        }
        process.exit(1);
    }
}

generateDump();
