import { Client } from 'pg';

async function checkContactSchema() {
  const neonUrl = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_lAI4jQLnG1KN@ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

  const client = new Client({
    connectionString: neonUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    console.log('📋 Contact 테이블 구조\n');

    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Contact'
      ORDER BY ordinal_position
    `);

    columns.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? '✓' : '✗';
      console.log(`  • ${col.column_name.padEnd(25)} ${col.data_type.padEnd(15)} (nullable: ${nullable})`);
    });

    console.log('\n📋 관련 테이블 확인\n');

    // 상품 관련 테이블 확인
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE '%roduct%' OR table_name LIKE '%Cruise%'
      ORDER BY table_name
    `);

    console.log('상품 관련 테이블:');
    tables.rows.forEach(t => console.log(`  • ${t.table_name}`));

  } finally {
    await client.end();
  }
}

checkContactSchema().catch(console.error);
