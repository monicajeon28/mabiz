import { Client } from 'pg';

async function loadCustomers() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    // 조직 & 멤버 조회
    const orgRes = await client.query('SELECT id FROM "Organization" LIMIT 1');
    const memRes = await client.query('SELECT "userId" FROM "OrganizationMember" LIMIT 1');

    if (orgRes.rows.length === 0) {
      console.log('❌ 조직이 없습니다');
      return;
    }

    const orgId = orgRes.rows[0].id;
    const userId = memRes.rows[0]?.userId || 'user-default';

    console.log('✅ 조직: ' + orgId);
    console.log('✅ 사용자: ' + userId);
    console.log('');

    // 고객 20명 데이터
    const values = [];
    for (let i = 1; i <= 20; i++) {
      const id = `'cust-${String(i).padStart(3, '0')}'`;
      const phone = `'0101234${String(i).padStart(4, '0')}'`;
      const name = `'Customer ${i}'`;
      const email = `'cust${String(i).padStart(3, '0')}@example.com'`;
      const type = `'PROSPECT'`;
      const userId_str = `'${userId}'`;

      values.push(`(${id}, '${orgId}', ${phone}, ${name}, ${email}, ${type}, ${userId_str}, NOW(), NOW())`);
    }

    const sql = `INSERT INTO "Contact" (id, "organizationId", phone, name, email, type, "assignedUserId", "createdAt", "updatedAt") VALUES ${values.join(',')}`;

    console.log('▶️  고객 데이터 삽입 중...');
    await client.query(sql);

    console.log('✅ 20명 삽입 완료');
    console.log('');

    // 최종 확인
    const countRes = await client.query('SELECT COUNT(*)::int as cnt FROM "Contact"');
    console.log('📊 최종 결과:');
    console.log('   Contact (고객): ' + countRes.rows[0].cnt + '명');

    if (countRes.rows[0].cnt > 0) {
      const samples = await client.query(
        'SELECT id, name, phone FROM "Contact" ORDER BY "createdAt" DESC LIMIT 3'
      );
      console.log('');
      console.log('📌 샘플:');
      samples.rows.forEach((row) => {
        console.log(`   • ${row.name} (${row.phone})`);
      });
    }
  } finally {
    await client.end();
  }
}

loadCustomers().catch(console.error);
