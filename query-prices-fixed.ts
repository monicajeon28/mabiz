import { Client } from 'pg';

async function queryPrices() {
  const supabaseUrl = process.env.SUPABASE_BACKUP_URL || 'postgresql://postgres.cnynywuxapxvythbcagz:!Wjsgptjsdl2@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true';

  const client = new Client({
    connectionString: supabaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    
    console.log('📊 CruiseDot 가격 데이터 현황\n');

    const productRes = await client.query('SELECT COUNT(*) as cnt FROM "CruiseProduct"');
    const pricRes = await client.query('SELECT COUNT(*) as cnt FROM "ProductPricePeriod"');
    const cabinRes = await client.query('SELECT COUNT(*) as cnt FROM "ProductCabinPrice"');

    const pCnt = productRes.rows[0].cnt;
    const prCnt = pricRes.rows[0].cnt;
    const cCnt = cabinRes.rows[0].cnt;

    console.log(`${pCnt > 0 ? '✅' : '❌'} CruiseProduct: ${pCnt}개`);
    console.log(`${prCnt > 0 ? '✅' : '❌'} ProductPricePeriod: ${prCnt}개`);
    console.log(`${cCnt > 0 ? '✅' : '❌'} ProductCabinPrice: ${cCnt}개`);

    console.log('\n════════════════════════════════');
    if (prCnt === 0) {
      console.log('\n⚠️  상품 가격 데이터 미복원 상태');
      console.log('   - ProductPricePeriod: 0개 (가격 구간 정보 필요)');
      console.log('   - ProductCabinPrice: 0개 (객실별 가격 필요)');
    } else {
      console.log('\n✅ 상품 가격 데이터 복원 완료');
    }

  } finally {
    await client.end();
  }
}

queryPrices().catch(console.error);
