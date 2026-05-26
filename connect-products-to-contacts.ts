import { Client } from 'pg';

async function connectProductsToContacts() {
  const neonUrl = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_lAI4jQLnG1KN@ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
  const supabaseUrl = process.env.SUPABASE_BACKUP_URL || 'postgresql://postgres.cnynywuxapxvythbcagz:!Wjsgptjsdl2@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true';

  const neon = new Client({ connectionString: neonUrl, ssl: { rejectUnauthorized: false } });
  const supa = new Client({ connectionString: supabaseUrl, ssl: { rejectUnauthorized: false } });

  try {
    await neon.connect();
    await supa.connect();

    console.log('🔗 Contact ↔ CruiseProduct 연동 시작\n');

    // 1. Supabase에서 상품 목록 조회
    const products = await supa.query(`
      SELECT id, "packageName" FROM "CruiseProduct" LIMIT 10
    `);
    console.log(`✅ 조회된 상품: ${products.rows.length}개\n`);

    // 2. Neon에서 Contact 조회
    const contacts = await neon.query('SELECT id, name FROM "Contact" LIMIT 10');
    console.log(`✅ 조회된 고객: ${contacts.rows.length}명\n`);

    // 3. Contact에 상품 할당
    console.log('📋 Contact에 상품 할당 중...\n');
    let updated = 0;

    for (let i = 0; i < contacts.rows.length; i++) {
      const contact = contacts.rows[i];
      const product = products.rows[i % products.rows.length];

      try {
        await neon.query(`
          UPDATE "Contact"
          SET "productName" = $1,
              "cruiseInterest" = 'HIGH',
              "lensMetadata" = jsonb_set(
                COALESCE("lensMetadata", '{}'::jsonb),
                '{productId}',
                to_jsonb($2::text)
              ),
              "updatedAt" = NOW()
          WHERE id = $3
        `, [product.packageName, product.id, contact.id]);
        
        updated++;
        process.stdout.write('.');
      } catch (e: any) {
        process.stdout.write('x');
      }
    }

    console.log(`\n✅ ${updated}명 고객에 상품 할당 완료\n`);

    // 4. 가격 정보 조회 API 준비
    console.log('📊 Contact 상품 정보 통합 뷰\n');

    const sample = await neon.query(`
      SELECT 
        c.id,
        c.name,
        c.phone,
        c.type,
        c."productName",
        c."cruiseInterest",
        c."departureDate"
      FROM "Contact" c
      WHERE "productName" IS NOT NULL
      LIMIT 5
    `);

    console.log('📌 고객별 상품 할당 현황:');
    sample.rows.forEach((row, idx) => {
      console.log(`   ${idx + 1}. ${row.name.padEnd(15)} | ${row.phone} | 상품: ${row.productName} | 관심: ${row.cruiseInterest}`);
    });

    // 5. 가격 정보와 함께 조회 (교차 쿼리)
    console.log('\n🔍 상품 가격 정보:');

    const priceInfo = await supa.query(`
      SELECT 
        pp."cruiseProductId",
        pp.name as "pricePeriod",
        pp."startDate",
        pp."endDate",
        COUNT(DISTINCT cp.id) as "cabinTypeCount",
        MIN(cp."saleAmount") as "minPrice",
        MAX(cp."saleAmount") as "maxPrice"
      FROM "ProductPricePeriod" pp
      LEFT JOIN "ProductCabinPrice" cp ON cp."productPricePeriodId" = pp.id
      GROUP BY pp."cruiseProductId", pp.id, pp.name, pp."startDate", pp."endDate"
      LIMIT 5
    `);

    priceInfo.rows.forEach((row, idx) => {
      console.log(`   ${idx + 1}. ${row.pricePeriod}`);
      console.log(`      기간: ${row.startDate} ~ ${row.endDate}`);
      console.log(`      객실 타입: ${row.cabinTypeCount}가지 | 가격: ₩${row.minPrice} ~ ₩${row.maxPrice}`);
    });

    console.log('\n════════════════════════════════');
    console.log('✅ CRM 상품/가격 연동 완료!\n');
    console.log('🎯 다음 단계:');
    console.log('   1. API 엔드포인트 생성 (GET /api/contacts/:id/product-info)');
    console.log('   2. Dashboard에 상품/가격 표시');
    console.log('   3. SMS 자동화에 가격 정보 포함');

  } finally {
    await neon.end();
    await supa.end();
  }
}

connectProductsToContacts().catch(console.error);
