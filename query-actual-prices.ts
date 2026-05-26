import { Client } from 'pg';

async function queryActualPrices() {
  const supabaseUrl = process.env.SUPABASE_BACKUP_URL || 'postgresql://postgres.cnynywuxapxvythbcagz:!Wjsgptjsdl2@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true';

  const client = new Client({
    connectionString: supabaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    
    console.log('📊 CruiseDot 가격 데이터 현황\n');

    // 1. CruiseProduct 상품 개수
    const productRes = await client.query('SELECT COUNT(*) as cnt FROM "CruiseProduct"');
    const productCnt = productRes.rows[0].cnt;
    console.log(`✅ CruiseProduct: ${productCnt}개`);
    
    // 샘플 상품
    const productSample = await client.query(`
      SELECT id, packageName, basePrice, salePrice, availableCount
      FROM "CruiseProduct" 
      LIMIT 3
    `);
    if (productSample.rows.length > 0) {
      console.log('   샘플:');
      productSample.rows.forEach(r => {
        console.log(`     - #${r.id}: ${r.packageName} (정가: ₩${r.basePrice}, 판매가: ₩${r.salePrice}, 잔여: ${r.availableCount})`);
      });
    }

    console.log('');

    // 2. ProductPricePeriod
    const priceRes = await client.query('SELECT COUNT(*) as cnt FROM "ProductPricePeriod"');
    const priceCnt = priceRes.rows[0].cnt;
    console.log(`${priceCnt > 0 ? '✅' : '❌'} ProductPricePeriod: ${priceCnt}개`);
    
    if (priceCnt > 0) {
      const priceSample = await client.query(`
        SELECT id, "cruiseProductId", name, "startDate", "endDate", "discountRate"
        FROM "ProductPricePeriod" 
        LIMIT 3
      `);
      console.log('   샘플:');
      priceSample.rows.forEach(r => {
        console.log(`     - #${r.id}: 상품#${r.cruiseProductId} "${r.name}" (${r.startDate.split('T')[0]}~${r.endDate.split('T')[0]}, 할인율: ${r.discountRate}%)`);
      });
    }

    console.log('');

    // 3. ProductCabinPrice
    const cabinRes = await client.query('SELECT COUNT(*) as cnt FROM "ProductCabinPrice"');
    const cabinCnt = cabinRes.rows[0].cnt;
    console.log(`${cabinCnt > 0 ? '✅' : '❌'} ProductCabinPrice: ${cabinCnt}개`);
    
    if (cabinCnt > 0) {
      const cabinSample = await client.query(`
        SELECT id, "productPricePeriodId", "cabinType", "fareLabel", "saleAmount"
        FROM "ProductCabinPrice" 
        LIMIT 3
      `);
      console.log('   샘플:');
      cabinSample.rows.forEach(r => {
        console.log(`     - #${r.id}: 기간#${r.productPricePeriodId} (${r.cabinType} - ${r.fareLabel}: ₩${r.saleAmount})`);
      });
    }

    console.log('\n════════════════════════════════');
    console.log('📋 복원 상태:\n');
    if (productCnt > 0) console.log(`✅ 상품 기본정보: ${productCnt}개`);
    if (priceCnt > 0) console.log(`✅ 가격 기간: ${priceCnt}개`);
    if (cabinCnt > 0) console.log(`✅ 객실별 가격: ${cabinCnt}개`);
    
    if (priceCnt === 0) console.log(`❌ 가격 기간: 0개 (미복원)`);
    if (cabinCnt === 0) console.log(`❌ 객실별 가격: 0개 (미복원)`);

  } finally {
    await client.end();
  }
}

queryActualPrices().catch(console.error);
