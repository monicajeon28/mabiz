import { Client } from 'pg';

async function loadPrices() {
  const supabaseUrl = process.env.SUPABASE_BACKUP_URL || 'postgresql://postgres.cnynywuxapxvythbcagz:!Wjsgptjsdl2@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true';

  const client = new Client({
    connectionString: supabaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  // 가격 데이터
  const pricePeriods = [
    { cruiseProductId: "wonder_wn4bh355_2026-11-30", name: "Wonder Wn4Bh355 2026-11-30 - Asia", startDate: "2026-11-30", endDate: "2026-12-04", isActive: true, discountRate: 0 },
    { cruiseProductId: "wonder_wn3bh177_2026-10-16", name: "Wonder Wn3Bh177 2026-10-16 - Asia", startDate: "2026-10-16", endDate: "2026-10-19", isActive: true, discountRate: 0 },
    { cruiseProductId: "icon_ic07e479_2026-05-30", name: "Icon Ic07E479 2026-05-30 - Asia", startDate: "2026-05-30", endDate: "2026-06-06", isActive: true, discountRate: 0 },
    { cruiseProductId: "freedom_fr05e070_2026-10-17", name: "Freedom Fr05E070 2026-10-17 - Asia", startDate: "2026-10-17", endDate: "2026-10-22", isActive: true, discountRate: 0 },
    { cruiseProductId: "freedom_fr05e069_2026-08-22", name: "Freedom Fr05E069 2026-08-22 - Asia", startDate: "2026-08-22", endDate: "2026-08-27", isActive: true, discountRate: 0 },
  ];

  const cabinPrices = [
    { periodId: "wonder_wn4bh355_2026-11-30", cabinType: "Interior", fareLabel: "Interior", saleAmount: 49800 },
    { periodId: "wonder_wn4bh355_2026-11-30", cabinType: "Ocean View", fareLabel: "Ocean View", saleAmount: 66100 },
    { periodId: "wonder_wn4bh355_2026-11-30", cabinType: "Balcony", fareLabel: "Balcony", saleAmount: 65800 },
    { periodId: "wonder_wn4bh355_2026-11-30", cabinType: "Suite", fareLabel: "Suite", saleAmount: 94300 },
    { periodId: "wonder_wn3bh177_2026-10-16", cabinType: "Interior", fareLabel: "Interior", saleAmount: 44800 },
    { periodId: "wonder_wn3bh177_2026-10-16", cabinType: "Ocean View", fareLabel: "Ocean View", saleAmount: 62900 },
    { periodId: "wonder_wn3bh177_2026-10-16", cabinType: "Balcony", fareLabel: "Balcony", saleAmount: 71500 },
  ];

  try {
    await client.connect();
    console.log('🔄 Supabase 가격 데이터 로드 시작\n');

    // 1. ProductPricePeriod 삽입
    console.log('📋 ProductPricePeriod 삽입 중...');
    let insertedPrices = 0;

    for (const pp of pricePeriods) {
      try {
        await client.query(`
          INSERT INTO "ProductPricePeriod" 
          (name, "cruiseProductId", "startDate", "endDate", "isActive", "discountRate", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
          ON CONFLICT DO NOTHING
        `, [
          pp.name,
          pp.cruiseProductId,
          pp.startDate,
          pp.endDate,
          pp.isActive,
          pp.discountRate
        ]);
        insertedPrices++;
        process.stdout.write('.');
      } catch (e: any) {
        process.stdout.write('x');
      }
    }

    console.log(`\n✅ ${insertedPrices}개 가격 기간 삽입 완료\n`);

    // 2. ProductCabinPrice 삽입
    console.log('📋 ProductCabinPrice 삽입 중...');
    let insertedCabins = 0;

    // 먼저 ProductPricePeriod ID 조회
    for (const cp of cabinPrices) {
      try {
        const ppRes = await client.query(
          `SELECT id FROM "ProductPricePeriod" WHERE "cruiseProductId" = $1 LIMIT 1`,
          [cp.periodId]
        );

        if (ppRes.rows.length === 0) {
          process.stdout.write('-');
          continue;
        }

        const ppId = ppRes.rows[0].id;

        await client.query(`
          INSERT INTO "ProductCabinPrice"
          ("productPricePeriodId", "cabinType", "fareCategory", "fareLabel", "saleAmount", currency, "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
          ON CONFLICT DO NOTHING
        `, [
          ppId,
          cp.cabinType,
          'Standard',
          cp.fareLabel,
          cp.saleAmount,
          'USD'
        ]);
        insertedCabins++;
        process.stdout.write('.');
      } catch (e: any) {
        process.stdout.write('x');
      }
    }

    console.log(`\n✅ ${insertedCabins}개 객실 가격 삽입 완료\n`);

    // 3. 최종 확인
    const ppCount = await client.query('SELECT COUNT(*) as cnt FROM "ProductPricePeriod"');
    const cpCount = await client.query('SELECT COUNT(*) as cnt FROM "ProductCabinPrice"');

    console.log('════════════════════════════════');
    console.log('✅ 가격 데이터 로드 완료\n');
    console.log(`📊 ProductPricePeriod: ${ppCount.rows[0].cnt}개`);
    console.log(`📊 ProductCabinPrice: ${cpCount.rows[0].cnt}개`);
    console.log('════════════════════════════════');

  } finally {
    await client.end();
  }
}

loadPrices().catch(console.error);
