import { Client } from 'pg';

async function insertPrices() {
  const supabaseUrl = process.env.SUPABASE_BACKUP_URL || 'postgresql://postgres.cnynywuxapxvythbcagz:!Wjsgptjsdl2@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true';

  const client = new Client({
    connectionString: supabaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('🔄 가격 데이터 삽입 시작\n');

    // 1. 먼저 일부 CruiseProduct 확인
    const checkProduct = await client.query('SELECT id FROM "CruiseProduct" LIMIT 1');
    if (checkProduct.rows.length === 0) {
      console.log('❌ CruiseProduct가 없습니다');
      return;
    }
    const productId = checkProduct.rows[0].id;
    console.log(`✅ CruiseProduct #${productId} 확인됨\n`);

    // 2. ProductPricePeriod 삽입 (간단한 버전)
    console.log('📋 ProductPricePeriod 삽입...');
    try {
      const ppInsert = await client.query(`
        INSERT INTO "ProductPricePeriod"
        ("cruiseProductId", name, "startDate", "endDate", "isActive", "createdAt", "updatedAt")
        VALUES
        ($1, 'Price Period 1', '2026-11-30', '2026-12-04', true, NOW(), NOW()),
        ($1, 'Price Period 2', '2026-10-16', '2026-10-19', true, NOW(), NOW()),
        ($1, 'Price Period 3', '2026-05-30', '2026-06-06', true, NOW(), NOW())
      `, [productId]);
      console.log(`✅ 3개 기간 삽입 완료\n`);
    } catch (e: any) {
      console.log(`❌ 삽입 오류: ${e.message}\n`);
    }

    // 3. ProductPricePeriod ID 조회
    const ppRes = await client.query(
      'SELECT id FROM "ProductPricePeriod" WHERE "cruiseProductId" = $1 LIMIT 1',
      [productId]
    );

    if (ppRes.rows.length === 0) {
      console.log('❌ ProductPricePeriod를 찾을 수 없습니다');
      return;
    }

    const ppId = ppRes.rows[0].id;
    console.log(`✅ ProductPricePeriod #${ppId} 확인됨\n`);

    // 4. ProductCabinPrice 삽입
    console.log('📋 ProductCabinPrice 삽입...');
    try {
      const cpInsert = await client.query(`
        INSERT INTO "ProductCabinPrice"
        ("productPricePeriodId", "cabinType", "fareCategory", "fareLabel", "saleAmount", currency, "createdAt", "updatedAt")
        VALUES
        ($1, 'Interior', 'Standard', 'Interior', 49800, 'USD', NOW(), NOW()),
        ($1, 'Ocean View', 'Standard', 'Ocean View', 66100, 'USD', NOW(), NOW()),
        ($1, 'Balcony', 'Standard', 'Balcony', 65800, 'USD', NOW(), NOW()),
        ($1, 'Suite', 'Standard', 'Suite', 94300, 'USD', NOW(), NOW())
      `, [ppId]);
      console.log(`✅ 4개 객실 가격 삽입 완료\n`);
    } catch (e: any) {
      console.log(`❌ 삽입 오류: ${e.message}\n`);
    }

    // 5. 최종 확인
    const ppCount = await client.query('SELECT COUNT(*) as cnt FROM "ProductPricePeriod"');
    const cpCount = await client.query('SELECT COUNT(*) as cnt FROM "ProductCabinPrice"');

    console.log('════════════════════════════════');
    console.log('✅ 가격 데이터 복원 완료\n');
    console.log(`💰 ProductPricePeriod: ${ppCount.rows[0].cnt}개`);
    console.log(`💰 ProductCabinPrice: ${cpCount.rows[0].cnt}개`);
    console.log('════════════════════════════════\n');

    // 샘플 조회
    const samples = await client.query(`
      SELECT pp.id, pp.name, pp."startDate", pp."endDate",
             cp."cabinType", cp."saleAmount", cp.currency
      FROM "ProductPricePeriod" pp
      LEFT JOIN "ProductCabinPrice" cp ON cp."productPricePeriodId" = pp.id
      WHERE pp."cruiseProductId" = $1
      LIMIT 5
    `, [productId]);

    console.log('📌 샘플 데이터:');
    samples.rows.forEach(r => {
      console.log(`  - ${r.name}: ${r.cabinType} ₩${r.saleAmount} ${r.currency}`);
    });

  } finally {
    await client.end();
  }
}

insertPrices().catch(console.error);
