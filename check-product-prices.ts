import { Client } from 'pg';

async function checkProductPrices() {
  const supabaseUrl = process.env.SUPABASE_BACKUP_URL || 'postgresql://postgres.cnynywuxapxvythbcagz:!Wjsgptjsdl2@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true';

  const client = new Client({
    connectionString: supabaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('📦 CruiseDot 상품 가격 데이터 조회\n');

    // 1. CruiseProduct 확인
    const productRes = await client.query('SELECT COUNT(*) as cnt, id, name FROM "CruiseProduct" LIMIT 5');
    const productCount = productRes.rows[0]?.cnt || 0;
    console.log(`✅ CruiseProduct: ${productCount}건`);
    if (productRes.rows.length > 0) {
      console.log('   샘플:');
      productRes.rows.forEach(r => console.log(`     - ${r.id}: ${r.name}`));
    }
    console.log('');

    // 2. ProductPricePeriod 확인
    try {
      const priceRes = await client.query('SELECT COUNT(*) as cnt FROM "ProductPricePeriod" LIMIT 1');
      const priceCount = priceRes.rows[0]?.cnt || 0;
      console.log(`${priceCount > 0 ? '✅' : '❌'} ProductPricePeriod: ${priceCount}건`);
      
      if (priceCount > 0) {
        const samples = await client.query(`
          SELECT id, "productId", "startDate", "endDate", "basePrice"
          FROM "ProductPricePeriod"
          LIMIT 3
        `);
        console.log('   샘플:');
        samples.rows.forEach(r => {
          console.log(`     - ${r.productId}: ${r.startDate}~${r.endDate} ₩${r.basePrice}`);
        });
      }
    } catch (e: any) {
      console.log('❌ ProductPricePeriod: 테이블 없음');
    }
    console.log('');

    // 3. ProductCabinPrice 확인
    try {
      const cabinRes = await client.query('SELECT COUNT(*) as cnt FROM "ProductCabinPrice" LIMIT 1');
      const cabinCount = cabinRes.rows[0]?.cnt || 0;
      console.log(`${cabinCount > 0 ? '✅' : '❌'} ProductCabinPrice: ${cabinCount}건`);
      
      if (cabinCount > 0) {
        const samples = await client.query(`
          SELECT id, "productId", "cabinType", price, "availableRooms"
          FROM "ProductCabinPrice"
          LIMIT 3
        `);
        console.log('   샘플:');
        samples.rows.forEach(r => {
          console.log(`     - ${r.productId} (${r.cabinType}): ₩${r.price} (${r.availableRooms}실)`);
        });
      }
    } catch (e: any) {
      console.log('❌ ProductCabinPrice: 테이블 없음');
    }

  } finally {
    await client.end();
  }
}

checkProductPrices().catch(console.error);
