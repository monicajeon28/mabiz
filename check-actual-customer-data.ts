import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkCustomerData() {
  const backupUrl = process.env.SUPABASE_BACKUP_URL;
  const client = new Client({
    connectionString: backupUrl,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n════════════════════════════════════════════════');
  console.log('✅ CruiseDot 고객 데이터 세부 확인');
  console.log('════════════════════════════════════════════════\n');

  try {
    await client.connect();

    // Check each customer-related table
    const tables = [
      { name: 'User', label: '구매/가입 고객' },
      { name: 'CruiseProductInquiry', label: '상품 문의' },
      { name: 'GoldMember', label: '골드 멤버' },
      { name: 'Prospect', label: '잠재고객' },
      { name: 'Reservation', label: '예약 데이터' },
      { name: 'LandingPageRegistration', label: '랜딩페이지 신청' },
      { name: 'AffiliateLead', label: '어필리에이트 리드' },
    ];

    for (const table of tables) {
      try {
        const countRes = await client.query(
          `SELECT COUNT(*)::int as cnt FROM "${table.name}"`
        );
        const count = countRes.rows[0]?.cnt || 0;

        if (count > 0) {
          console.log(`📊 ${table.label} (${table.name}): ${count}건`);

          // Get sample
          const sampleRes = await client.query(
            `SELECT * FROM "${table.name}" LIMIT 1`
          );

          if (sampleRes.rows.length > 0) {
            const row = sampleRes.rows[0];
            console.log(`   📋 샘플 필드: ${Object.keys(row).slice(0, 5).join(', ')}`);
          }
          console.log('');
        }
      } catch (e) {
        // Table might not exist
      }
    }

    // Check ProductPricePeriod and ProductCabinPrice
    console.log('📊 상품 정가 데이터:\n');

    const productRes = await client.query(`
      SELECT COUNT(DISTINCT "cruiseProductId") as cnt FROM "ProductPricePeriod"
    `);
    console.log(`  상품 수: ${productRes.rows[0]?.cnt || 0}개`);

    const priceRes = await client.query(`
      SELECT COUNT(*) as cnt FROM "ProductPricePeriod"
    `);
    console.log(`  상품-가격 조합: ${priceRes.rows[0]?.cnt || 0}건\n`);

  } catch (e) {
    console.error('❌ 오류:', (e as any).message);
  } finally {
    await client.end();
  }

  console.log('════════════════════════════════════════════════\n');
}

checkCustomerData().catch(console.error);
