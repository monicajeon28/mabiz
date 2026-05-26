import { Client } from 'pg';

async function checkSchema() {
  const supabaseUrl = process.env.SUPABASE_BACKUP_URL || 'postgresql://postgres.cnynywuxapxvythbcagz:!Wjsgptjsdl2@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true';

  const client = new Client({
    connectionString: supabaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    
    // CruiseProduct 컬럼 확인
    console.log('📋 CruiseProduct 구조:\n');
    const productCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'CruiseProduct'
      ORDER BY ordinal_position
    `);
    
    productCols.rows.forEach(r => {
      console.log(`  - ${r.column_name}: ${r.data_type}`);
    });

    console.log('\n📋 ProductPricePeriod 구조:\n');
    const priceCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ProductPricePeriod'
      ORDER BY ordinal_position
    `);
    
    if (priceCols.rows.length === 0) {
      console.log('  ❌ 테이블 없음');
    } else {
      priceCols.rows.forEach(r => {
        console.log(`  - ${r.column_name}: ${r.data_type}`);
      });
    }

    console.log('\n📋 ProductCabinPrice 구조:\n');
    const cabinCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ProductCabinPrice'
      ORDER BY ordinal_position
    `);
    
    if (cabinCols.rows.length === 0) {
      console.log('  ❌ 테이블 없음');
    } else {
      cabinCols.rows.forEach(r => {
        console.log(`  - ${r.column_name}: ${r.data_type}`);
      });
    }

  } finally {
    await client.end();
  }
}

checkSchema().catch(console.error);
