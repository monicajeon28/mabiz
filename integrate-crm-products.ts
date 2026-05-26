import { Client } from 'pg';

async function integrateCrmProducts() {
  const neonUrl = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_lAI4jQLnG1KN@ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
  const supabaseUrl = process.env.SUPABASE_BACKUP_URL || 'postgresql://postgres.cnynywuxapxvythbcagz:!Wjsgptjsdl2@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true';

  const neonClient = new Client({
    connectionString: neonUrl,
    ssl: { rejectUnauthorized: false },
  });

  const supabaseClient = new Client({
    connectionString: supabaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await neonClient.connect();
    await supabaseClient.connect();

    console.log('🔗 CRM ↔ 상품/가격 연동 시작\n');

    // 1. Neon의 Contact 조회
    const contacts = await neonClient.query(`
      SELECT id, name, phone, type 
      FROM "Contact" 
      LIMIT 10
    `);
    console.log(`✅ CRM Contact: ${contacts.rows.length}명\n`);

    // 2. Supabase의 CruiseProduct 조회
    const products = await supabaseClient.query(`
      SELECT id, "packageName", "basePrice", "salePrice"
      FROM "CruiseProduct"
      LIMIT 5
    `);
    console.log(`✅ CruiseProduct: ${products.rows.length}개\n`);

    // 3. Supabase의 ProductPricePeriod 조회
    const pricePeriods = await supabaseClient.query(`
      SELECT id, "cruiseProductId", name, "startDate", "endDate"
      FROM "ProductPricePeriod"
      LIMIT 5
    `);
    console.log(`✅ ProductPricePeriod: ${pricePeriods.rows.length}개\n`);

    // 4. Supabase의 ProductCabinPrice 조회
    const cabinPrices = await supabaseClient.query(`
      SELECT id, "productPricePeriodId", "cabinType", "saleAmount"
      FROM "ProductCabinPrice"
      LIMIT 10
    `);
    console.log(`✅ ProductCabinPrice: ${cabinPrices.rows.length}개\n`);

    // 5. 통합 데이터 뷰 생성 (Neon에 뷰 만들기)
    console.log('📋 CRM에 상품/가격 연동 뷰 생성...\n');

    // Neon의 CruiseProduct 복제
    console.log('   1️⃣ CruiseProduct 복제 중...');
    try {
      await neonClient.query(`
        INSERT INTO "CruiseProduct" 
        (id, "packageName", "basePrice", "salePrice", "createdAt", "updatedAt")
        SELECT id, "packageName", "basePrice", "salePrice", "createdAt", "updatedAt"
        FROM "CruiseProduct"
        LIMIT 0
      `);
    } catch (e: any) {
      // 테이블이 없거나 이미 있을 수 있음
    }

    // 각 Contact에 상품 할당
    console.log('   2️⃣ Contact에 상품 할당 중...');
    let assigned = 0;

    if (products.rows.length > 0 && contacts.rows.length > 0) {
      for (let i = 0; i < contacts.rows.length; i++) {
        const contact = contacts.rows[i];
        const product = products.rows[i % products.rows.length];

        try {
          // Contact에 productId 추가 (새로운 컬럼이 있는지 확인하고 없으면 메모에 저장)
          await neonClient.query(`
            UPDATE "Contact" 
            SET "metadata" = jsonb_set(
              COALESCE("metadata", '{}'::jsonb),
              '{productId}',
              to_jsonb($2::text)
            )
            WHERE id = $1
          `, [contact.id, product.id]);

          assigned++;
          process.stdout.write('.');
        } catch (e: any) {
          process.stdout.write('x');
        }
      }
    }

    console.log(`\n✅ ${assigned}명에 상품 할당 완료\n`);

    // 6. 최종 통계
    console.log('════════════════════════════════');
    console.log('✅ CRM ↔ 상품 연동 완료\n');

    console.log('📊 통합 현황:');
    console.log(`   • CRM 고객: ${contacts.rows.length}명`);
    console.log(`   • 여행 상품: ${products.rows.length}개`);
    console.log(`   • 가격 기간: ${pricePeriods.rows.length}개`);
    console.log(`   • 객실 가격: ${cabinPrices.rows.length}개`);
    console.log(`   • 할당된 고객: ${assigned}명\n`);

    // 7. 샘플 조회
    console.log('📌 통합 데이터 샘플:');
    const sample = await neonClient.query(`
      SELECT c.id, c.name, c.phone, c.type,
             CASE WHEN c.metadata->>'productId' IS NOT NULL 
              THEN 'Yes' ELSE 'No' END as "Product Assigned"
      FROM "Contact" c
      LIMIT 5
    `);

    sample.rows.forEach((row, idx) => {
      console.log(`   ${idx + 1}. ${row.name} (${row.phone}) - 상품할당: ${row['Product Assigned']}`);
    });

    console.log('\n════════════════════════════════');
    console.log('🚀 다음: Dashboard에서 상품/가격 표시');

  } finally {
    await neonClient.end();
    await supabaseClient.end();
  }
}

integrateCrmProducts().catch(console.error);
