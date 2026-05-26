import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function verifySourceStructure() {
  const backupUrl = process.env.SUPABASE_BACKUP_URL;
  const client = new Client({
    connectionString: backupUrl,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n════════════════════════════════════════════════');
  console.log('📊 각 고객 출처별 데이터 구조 확인');
  console.log('════════════════════════════════════════════════\n');

  try {
    await client.connect();

    // 1. 구매고객 (User)
    console.log('1️⃣  구매고객 (User) - 회원가입 경로별');
    const userRes = await client.query(`
      SELECT
        id, email, phone, name,
        CASE
          WHEN "externalId" LIKE '%kakao%' THEN '카카오가입'
          WHEN "externalId" LIKE '%naver%' THEN '네이버가입'
          WHEN "externalId" LIKE '%google%' THEN '구글가입'
          ELSE '일반가입'
        END as signup_method,
        "createdAt", "updatedAt"
      FROM "User"
      LIMIT 3
    `);

    if (userRes.rows.length > 0) {
      console.log(`  총 ${(await client.query('SELECT COUNT(*) FROM "User"')).rows[0].count}명`);
      console.log(`  샘플 필드: ${Object.keys(userRes.rows[0]).join(', ')}`);
      userRes.rows.forEach((row, idx) => {
        console.log(`    ${idx+1}. ${row.name} (${row.phone}) - ${row.signup_method}`);
      });
    }
    console.log('');

    // 2. 상품 문의 (CruiseProductInquiry)
    console.log('2️⃣  상품 문의고객 (CruiseProductInquiry)');
    const inquiryRes = await client.query(`
      SELECT
        id, phone, name, "productCode",
        "createdAt"
      FROM "CruiseProductInquiry"
      LIMIT 3
    `);

    if (inquiryRes.rows.length > 0) {
      console.log(`  총 ${(await client.query('SELECT COUNT(*) FROM "CruiseProductInquiry"')).rows[0].count}건`);
      console.log(`  샘플 필드: ${Object.keys(inquiryRes.rows[0]).join(', ')}`);
      inquiryRes.rows.forEach((row, idx) => {
        console.log(`    ${idx+1}. ${row.name} (${row.phone}) - 상품: ${row.productCode}`);
      });
    }
    console.log('');

    // 3. 어필리에이트 리드 (AffiliateLead)
    console.log('3️⃣  어필리에이트 리드 (AffiliateLead) - 링크별');
    const affiliateRes = await client.query(`
      SELECT
        id, "customerName" as name, "customerPhone" as phone,
        "linkId", "managerId", "agentId",
        "createdAt"
      FROM "AffiliateLead"
      LIMIT 3
    `);

    if (affiliateRes.rows.length > 0) {
      console.log(`  총 ${(await client.query('SELECT COUNT(*) FROM "AffiliateLead"')).rows[0].count}명`);
      console.log(`  샘플 필드: ${Object.keys(affiliateRes.rows[0]).join(', ')}`);
      affiliateRes.rows.forEach((row, idx) => {
        console.log(`    ${idx+1}. ${row.name} (${row.phone})`);
        console.log(`       ├─ Link: ${row.linkId}`);
        console.log(`       ├─ Manager: ${row.managerId}`);
        console.log(`       └─ Agent: ${row.agentId}`);
      });
    }
    console.log('');

    // 4. 예약 정보 (Reservation)
    console.log('4️⃣  구매/예약 정보 (Reservation)');
    const reservationRes = await client.query(`
      SELECT
        id, "tripId", "mainUserId", "totalPeople",
        "cabinType", "totalPrice",
        "createdAt"
      FROM "Reservation"
      LIMIT 3
    `);

    if (reservationRes.rows.length > 0) {
      console.log(`  총 ${(await client.query('SELECT COUNT(*) FROM "Reservation"')).rows[0].count}건`);
      console.log(`  샘플 필드: ${Object.keys(reservationRes.rows[0]).join(', ')}`);
      reservationRes.rows.forEach((row, idx) => {
        console.log(`    ${idx+1}. Trip: ${row.tripId} - User: ${row.mainUserId}`);
        console.log(`       ├─ Cabin: ${row.cabinType}`);
        console.log(`       ├─ People: ${row.totalPeople}`);
        console.log(`       └─ Price: $${row.totalPrice}`);
      });
    }
    console.log('');

    // 5. 상품 정보 (CruiseProduct)
    console.log('5️⃣  상품 정보 (CruiseProduct)');
    const productRes = await client.query(`
      SELECT
        id, name, "shipName", "departureDate",
        "createdAt"
      FROM "CruiseProduct"
      LIMIT 3
    `);

    if (productRes.rows.length > 0) {
      console.log(`  총 ${(await client.query('SELECT COUNT(*) FROM "CruiseProduct"')).rows[0].count}개`);
      productRes.rows.forEach((row, idx) => {
        console.log(`    ${idx+1}. ${row.name}`);
        console.log(`       ├─ Ship: ${row.shipName}`);
        console.log(`       └─ Departure: ${row.departureDate}`);
      });
    }
    console.log('');

  } catch (e) {
    console.error('❌ 오류:', (e as any).message);
  } finally {
    await client.end();
  }

  console.log('════════════════════════════════════════════════\n');
}

verifySourceStructure().catch(console.error);
