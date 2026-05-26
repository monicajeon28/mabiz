import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

const dbUrl = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_lAI4jQLnG1KN@ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sqlFile = path.join(process.cwd(), 'CRM_TEST_DATA_SETUP.sql');

async function main() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Neon 데이터베이스 연결됨\n');

    // SQL 파일 읽기
    if (!fs.existsSync(sqlFile)) {
      console.error(`❌ SQL 파일 없음: ${sqlFile}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(sqlFile, 'utf-8');
    console.log(`📄 SQL 파일 로드: ${path.basename(sqlFile)}`);
    console.log(`   크기: ${Math.round(sql.length / 1024)} KB\n`);

    // SQL 실행
    console.log('▶️  SQL 실행 중...\n');

    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    console.log(`📊 ${statements.length}개 SQL 문장\n`);

    let executed = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < statements.length; i++) {
      try {
        await client.query(statements[i]);
        executed++;
        if (statements[i].includes('INSERT') || statements[i].includes('CREATE')) {
          process.stdout.write('.');
        }
      } catch (e: any) {
        if (e.message.includes('already exists')) {
          skipped++;
        } else {
          errors++;
          console.error(`\n❌ [${i}] ${e.message.substring(0, 80)}`);
        }
      }
    }

    console.log(`\n\n✅ SQL 실행 완료`);
    console.log(`   실행: ${executed}`);
    console.log(`   스킵: ${skipped}`);
    if (errors > 0) console.log(`   에러: ${errors}`);
    console.log('');

    // 결과 확인
    console.log('📊 로드된 데이터:');

    const contactResult = await client.query('SELECT COUNT(*)::int as cnt FROM "Contact"');
    const orgResult = await client.query('SELECT COUNT(*)::int as cnt FROM "Organization"');
    const memberResult = await client.query('SELECT COUNT(*)::int as cnt FROM "OrganizationMember"');
    const adminResult = await client.query('SELECT COUNT(*)::int as cnt FROM "GlobalAdmin"');

    const contactCount = contactResult.rows[0]?.cnt || 0;
    const orgCount = orgResult.rows[0]?.cnt || 0;
    const memberCount = memberResult.rows[0]?.cnt || 0;
    const adminCount = adminResult.rows[0]?.cnt || 0;

    console.log(`   ✓ Contact: ${contactCount}명`);
    console.log(`   ✓ Organization: ${orgCount}개`);
    console.log(`   ✓ OrganizationMember: ${memberCount}명`);
    console.log(`   ✓ GlobalAdmin: ${adminCount}명`);

    if (contactCount > 0) {
      console.log('\n✨ 고객 데이터 로드 성공!');

      // 샘플 고객 표시
      const samples = await client.query(
        'SELECT id, name, phone, type, "assignedUserId" FROM "Contact" LIMIT 5 ORDER BY "createdAt" DESC'
      );
      console.log('\n📋 로드된 고객 샘플:');
      samples.rows.forEach((row) => {
        console.log(`   • ${row.name} (${row.phone}) - ${row.type}`);
      });
    }

  } finally {
    await client.end();
  }
}

main().catch(console.error);
