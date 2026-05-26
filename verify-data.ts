import { Client } from 'pg';

async function verify() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  console.log('📊 마비즈 CRM 실제 데이터:\n');

  const tables = [
    'Organization',
    'OrganizationMember',
    'GlobalAdmin',
    'Contact',
    'ContactGroup',
    'CallLog',
    'SmsLog',
  ];

  for (const table of tables) {
    try {
      const result = await client.query(`SELECT COUNT(*)::int as cnt FROM "${table}"`);
      const count = result.rows[0]?.cnt || 0;
      const icon = count > 0 ? '✅' : '❌';
      console.log(`${icon} ${table.padEnd(25)}: ${String(count).padStart(5)}건`);
    } catch (e) {
      console.log(`⚠️  ${table.padEnd(25)}: 테이블 없음`);
    }
  }

  await client.end();
  console.log('');
}

verify();
