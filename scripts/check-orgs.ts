import { Client } from 'pg';

async function checkOrgs() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    const result = await client.query(
      'SELECT id, name, slug FROM "Organization" ORDER BY "createdAt" DESC LIMIT 10'
    );

    console.log('\n📊 현재 Neon 조직 목록:');
    if (result.rows.length === 0) {
      console.log('   (없음 - 새로 생성 필요)\n');
    } else {
      result.rows.forEach((row) => {
        console.log(`   • ${row.name} (${row.slug})`);
      });
      console.log('');
    }

    // 최신 조직 확인
    if (result.rows.length > 0) {
      const latest = result.rows[0];
      console.log(`✅ 최신 조직: ${latest.name}`);
      console.log(`   ID: ${latest.id}`);
      console.log(`   Slug: ${latest.slug}\n`);
    }
  } finally {
    await client.end();
  }
}

checkOrgs();
