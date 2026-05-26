import { Client } from 'pg';

async function verifyCruisedotData() {
  // Supabase connection string (CruiseDot backup)
  const supabaseUrl = 'postgresql://postgres:4kx1cJ9P7q6L2mNv@db.dnvmxupfxwqkttwxxfiq.supabase.co:5432/cruisedot';
  const supabaseClient = new Client({
    connectionString: supabaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await supabaseClient.connect();

  console.log('\n════════════════════════════════════════════════');
  console.log('✅ CruiseDot 백업 데이터 확인 (Supabase)');
  console.log('════════════════════════════════════════════════\n');

  try {
    // Check what tables exist in Supabase
    const tableRes = await supabaseClient.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📊 Supabase의 테이블 목록:\n');
    tableRes.rows.forEach((row) => {
      console.log(`  • ${row.table_name}`);
    });
    console.log('\n');

    // Check GmUser (purchase customers)
    try {
      const userRes = await supabaseClient.query(`
        SELECT COUNT(*)::int as cnt FROM "GmUser" LIMIT 1
      `);
      console.log(`✅ 구매 고객 (GmUser): ${userRes.rows[0]?.cnt || 0}명\n`);
    } catch (e) {
      console.log(`❌ GmUser 테이블 없음\n`);
    }

    // Check Inquiry (product inquiries)
    try {
      const inquiryRes = await supabaseClient.query(`
        SELECT COUNT(*)::int as cnt FROM "Inquiry" LIMIT 1
      `);
      console.log(`✅ 상품 문의 (Inquiry): ${inquiryRes.rows[0]?.cnt || 0}명\n`);
    } catch (e) {
      console.log(`❌ Inquiry 테이블 없음\n`);
    }

    // Check GoldMemberConsultation
    try {
      const goldRes = await supabaseClient.query(`
        SELECT COUNT(*)::int as cnt FROM "GoldMemberConsultation" LIMIT 1
      `);
      console.log(`✅ 골드문의 (GoldMemberConsultation): ${goldRes.rows[0]?.cnt || 0}명\n`);
    } catch (e) {
      console.log(`❌ GoldMemberConsultation 테이블 없음\n`);
    }

    // Check GmReservation (booking/reservation data)
    try {
      const resRes = await supabaseClient.query(`
        SELECT COUNT(*)::int as cnt FROM "GmReservation" LIMIT 1
      `);
      console.log(`✅ 예약 데이터 (GmReservation): ${resRes.rows[0]?.cnt || 0}건\n`);
    } catch (e) {
      console.log(`❌ GmReservation 테이블 없음\n`);
    }

    // Check product pricing
    try {
      const priceRes = await supabaseClient.query(`
        SELECT COUNT(*)::int as cnt FROM "ProductPricePeriod" LIMIT 1
      `);
      console.log(`✅ 상품-가격 (ProductPricePeriod): ${priceRes.rows[0]?.cnt || 0}건\n`);
    } catch (e) {
      console.log(`❌ ProductPricePeriod 테이블 없음\n`);
    }

  } catch (e) {
    console.error('❌ Supabase 연결 실패:', (e as any).message);
  } finally {
    await supabaseClient.end();
  }

  console.log('════════════════════════════════════════════════\n');
}

verifyCruisedotData().catch(console.error);
