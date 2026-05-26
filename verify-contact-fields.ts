import { Client } from 'pg';

async function verifyContactFields() {
  const neonUrl = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_lAI4jQLnG1KN@ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
  const client = new Client({
    connectionString: neonUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  console.log('\n════════════════════════════════════════════════');
  console.log('✅ Contact 테이블 필드 확인');
  console.log('════════════════════════════════════════════════\n');

  try {
    // Check if the new product-related fields exist
    const fieldsToCheck = [
      'cruiseProductId',
      'reservationId',
      'preferredCabinType',
      'quotedPrice',
      'priceAcceptedAt'
    ];

    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'Contact'
      AND column_name IN (${fieldsToCheck.map(f => `'${f}'`).join(', ')})
      ORDER BY ordinal_position
    `);

    console.log('🔍 추가된 필드 확인:\n');
    if (result.rows.length === 0) {
      console.log('❌ 추가된 필드가 없습니다. 마이그레이션이 필요합니다.\n');
    } else {
      result.rows.forEach((row) => {
        console.log(`  ✅ ${row.column_name} (${row.data_type})`);
      });
      console.log('\n');
    }

    // Sample contacts with product data
    console.log('📊 상품 데이터가 있는 고객 확인:\n');
    const sampleRes = await client.query(`
      SELECT
        id,
        name,
        phone,
        "cruiseProductId" AS product_id,
        "preferredCabinType" AS cabin_type,
        "quotedPrice" AS quoted_price
      FROM "Contact"
      WHERE "cruiseProductId" IS NOT NULL
      OR "preferredCabinType" IS NOT NULL
      OR "quotedPrice" IS NOT NULL
      LIMIT 10
    `);

    if (sampleRes.rows.length === 0) {
      console.log('  고객-상품 연결이 아직 없습니다.\n');
    } else {
      sampleRes.rows.forEach((row) => {
        console.log(`  ${row.name} | ${row.phone}`);
        if (row.product_id) console.log(`    - Product ID: ${row.product_id}`);
        if (row.cabin_type) console.log(`    - Cabin Type: ${row.cabin_type}`);
        if (row.quoted_price) console.log(`    - Quoted Price: $${row.quoted_price}`);
      });
      console.log('\n');
    }

    // Check data sources
    console.log('📍 고객 출처 분석:\n');
    const sourceRes = await client.query(`
      SELECT
        channel,
        COUNT(*)::int as count
      FROM "Contact"
      GROUP BY channel
      ORDER BY count DESC
    `);

    sourceRes.rows.forEach((row) => {
      console.log(`  ${row.channel}: ${row.count}명`);
    });
    console.log('\n');

  } finally {
    await client.end();
  }

  console.log('════════════════════════════════════════════════\n');
}

verifyContactFields().catch(console.error);
