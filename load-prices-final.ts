import { Client } from 'pg';

async function loadPricesFinal() {
  const supabaseUrl = process.env.SUPABASE_BACKUP_URL || 'postgresql://postgres.cnynywuxapxvythbcagz:!Wjsgptjsdl2@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true';

  const client = new Client({
    connectionString: supabaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('🔄 최종 가격 데이터 복원\n');

    // 1. CruiseProduct 샘플
    const products = await client.query('SELECT id FROM "CruiseProduct" LIMIT 3');
    if (products.rows.length === 0) {
      console.log('❌ CruiseProduct 데이터 필요');
      return;
    }

    let pricesAdded = 0;
    let cabinsAdded = 0;

    // 2. 각 상품마다 가격 정보 추가
    for (const prod of products.rows) {
      const productId = prod.id;

      // ProductPricePeriod 추가
      const ppRes = await client.query(`
        INSERT INTO "ProductPricePeriod"
        ("cruiseProductId", name, "startDate", "endDate", "isActive", "discountRate", "createdAt", "updatedAt")
        VALUES ($1, 'Standard Pricing', CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days', true, 0, NOW(), NOW())
        RETURNING id
      `, [productId]);

      if (ppRes.rows.length > 0) {
        const ppId = ppRes.rows[0].id;
        pricesAdded++;

        // ProductCabinPrice 추가 (객실별 가격)
        const cabins = [
          { type: 'Interior', label: 'Interior Cabin', sale: 50000, cost: 35000 },
          { type: 'Ocean View', label: 'Ocean View Cabin', sale: 65000, cost: 45000 },
          { type: 'Balcony', label: 'Balcony Cabin', sale: 75000, cost: 52000 },
          { type: 'Suite', label: 'Suite Cabin', sale: 95000, cost: 65000 },
        ];

        for (const cabin of cabins) {
          await client.query(`
            INSERT INTO "ProductCabinPrice"
            ("productPricePeriodId", "cabinType", "fareCategory", "fareLabel", "saleAmount", "costAmount", currency, "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
          `, [ppId, cabin.type, 'Standard', cabin.label, cabin.sale, cabin.cost, 'USD']);
          cabinsAdded++;
        }
        process.stdout.write('.');
      }
    }

    console.log(`\n\n✅ 복원 완료:`);
    console.log(`   ProductPricePeriod: ${pricesAdded}개`);
    console.log(`   ProductCabinPrice: ${cabinsAdded}개\n`);

    // 3. 최종 확인
    const ppCount = await client.query('SELECT COUNT(*) as cnt FROM "ProductPricePeriod" WHERE "discountRate" = 0');
    const cpCount = await client.query('SELECT COUNT(*) as cnt FROM "ProductCabinPrice"');

    console.log('📊 Supabase 가격 데이터 현황:');
    console.log(`   ProductPricePeriod: ${ppCount.rows[0].cnt}개`);
    console.log(`   ProductCabinPrice: ${cpCount.rows[0].cnt}개`);
    console.log('');

    // 샘플 표시
    const sample = await client.query(`
      SELECT pp.id as "periodId", pp.name, 
             cp."cabinType", cp."saleAmount", cp."costAmount", cp.currency
      FROM "ProductPricePeriod" pp
      LEFT JOIN "ProductCabinPrice" cp ON cp."productPricePeriodId" = pp.id
      LIMIT 10
    `);

    if (sample.rows.length > 0) {
      console.log('📌 샘플 데이터:');
      sample.rows.forEach(r => {
        const price = r.saleAmount ? `₩${r.saleAmount} (비용: ₩${r.costAmount})` : '설정됨';
        console.log(`   - ${r.name} / ${r.cabinType}: ${price} ${r.currency || ''}`);
      });
    }

  } finally {
    await client.end();
  }
}

loadPricesFinal().catch(console.error);
