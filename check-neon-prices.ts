import { Client } from 'pg';

async function checkNeonPrices() {
  const neonUrl = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_lAI4jQLnG1KN@ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
  const client = new Client({
    connectionString: neonUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    
    console.log('🔍 Neon 가격 데이터 조회\n');

    // 1. CruiseProduct
    const productRes = await client.query('SELECT COUNT(*) as cnt FROM "CruiseProduct"');
    const pCnt = productRes.rows[0].cnt;

    // 2. ProductPricePeriod
    const priceRes = await client.query('SELECT COUNT(*) as cnt FROM "ProductPricePeriod"');
    const prCnt = priceRes.rows[0].cnt;

    // 3. ProductCabinPrice
    const cabinRes = await client.query('SELECT COUNT(*) as cnt FROM "ProductCabinPrice"');
    const cCnt = cabinRes.rows[0].cnt;

    // 4. ProductMaxPrice
    const maxRes = await client.query('SELECT COUNT(*) as cnt FROM "ProductMaxPrice"');
    const mCnt = maxRes.rows[0].cnt;

    // 5. ProductImage
    const imgRes = await client.query('SELECT COUNT(*) as cnt FROM "ProductImage"');
    const iCnt = imgRes.rows[0].cnt;

    console.log(`${pCnt > 0 ? '✅' : '❌'} CruiseProduct: ${pCnt}개`);
    console.log(`${prCnt > 0 ? '✅' : '❌'} ProductPricePeriod: ${prCnt}개`);
    console.log(`${cCnt > 0 ? '✅' : '❌'} ProductCabinPrice: ${cCnt}개`);
    console.log(`${mCnt > 0 ? '✅' : '❌'} ProductMaxPrice: ${mCnt}개`);
    console.log(`${iCnt > 0 ? '✅' : '❌'} ProductImage: ${iCnt}개`);

    // 샘플 데이터 확인
    if (prCnt > 0) {
      console.log('\n📋 ProductPricePeriod 샘플:');
      const sample = await client.query('SELECT id, "cruiseProductId", name, "startDate", "discountRate" FROM "ProductPricePeriod" LIMIT 3');
      sample.rows.forEach(r => {
        console.log(`  - #${r.id}: 상품#${r.cruiseProductId} "${r.name}"`);
      });
    }

    if (cCnt > 0) {
      console.log('\n📋 ProductCabinPrice 샘플:');
      const sample = await client.query('SELECT id, "productPricePeriodId", "cabinType", "fareLabel", "saleAmount" FROM "ProductCabinPrice" LIMIT 3');
      sample.rows.forEach(r => {
        console.log(`  - #${r.id}: 기간#${r.productPricePeriodId} (${r.cabinType} - ${r.fareLabel}: ₩${r.saleAmount})`);
      });
    }

  } finally {
    await client.end();
  }
}

checkNeonPrices().catch(console.error);
