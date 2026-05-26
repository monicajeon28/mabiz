/**
 * CruiseDot to CRM Data Sync
 * Syncs customer data from Supabase backup to Neon CRM
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function syncData() {
  const neonUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.SUPABASE_BACKUP_URL;

  if (!neonUrl || !supabaseUrl) {
    console.error('❌ DATABASE_URL or SUPABASE_BACKUP_URL not configured');
    process.exit(1);
  }

  const neonClient = new Client({
    connectionString: neonUrl,
    ssl: { rejectUnauthorized: false },
  });

  const supabaseClient = new Client({
    connectionString: supabaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n════════════════════════════════════════════════');
  console.log('🔄 CruiseDot → CRM 데이터 동기화 시작');
  console.log('════════════════════════════════════════════════\n');

  try {
    await neonClient.connect();
    await supabaseClient.connect();
    console.log('✅ 데이터베이스 연결 성공\n');

    // Get default organization
    const orgRes = await neonClient.query(
      'SELECT id FROM "Organization" ORDER BY id ASC LIMIT 1'
    );

    if (orgRes.rows.length === 0) {
      console.error('❌ 조직이 없습니다. 먼저 조직을 만드세요.');
      process.exit(1);
    }

    const orgId = orgRes.rows[0].id;
    console.log(`📍 동기화 대상 조직: ${orgId}\n`);

    // 1. Sync Users (구매 고객)
    console.log('📊 1️⃣  구매 고객 동기화 중...');
    const userRes = await supabaseClient.query(`
      SELECT id, email, phone, name
      FROM "User"
      WHERE phone IS NOT NULL
      ORDER BY id DESC
      LIMIT 100
    `);

    let userCount = 0;
    for (const user of userRes.rows) {
      try {
        await neonClient.query(
          `INSERT INTO "Contact"
           (id, "organizationId", name, phone, email, channel, type, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, 'cruisedot', 'CUSTOMER', NOW(), NOW())
           ON CONFLICT ("phone", "organizationId")
           DO UPDATE SET email = $5, channel = 'cruisedot', "updatedAt" = NOW()`,
          [
            `contact_user_${user.id}`,
            orgId,
            user.name || '크루즈닷 고객',
            user.phone,
            user.email || null,
          ]
        );
        userCount++;
      } catch (e) {
        // Ignore duplicate key errors
      }
    }
    console.log(`   ✅ ${userCount}명 동기화\n`);

    // 2. Sync Inquiries (상품 문의)
    console.log('📊 2️⃣  상품 문의 동기화 중...');
    const inquiryRes = await supabaseClient.query(`
      SELECT id, phone, name, "productCode"
      FROM "CruiseProductInquiry"
      WHERE phone IS NOT NULL
      ORDER BY id DESC
      LIMIT 100
    `);

    let inquiryCount = 0;
    for (const inq of inquiryRes.rows) {
      try {
        await neonClient.query(
          `INSERT INTO "Contact"
           (id, "organizationId", name, phone, channel, type, "adminMemo", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, 'inquiry', 'PROSPECT', $5, NOW(), NOW())
           ON CONFLICT ("phone", "organizationId")
           DO UPDATE SET channel = 'inquiry', "adminMemo" = $5, "updatedAt" = NOW()`,
          [
            `contact_inquiry_${inq.id}`,
            orgId,
            inq.name || '상품문의 고객',
            inq.phone,
            `상품 문의: ${inq.productCode || '미지정'}`,
          ]
        );
        inquiryCount++;
      } catch (e) {
        // Ignore duplicate key errors
      }
    }
    console.log(`   ✅ ${inquiryCount}건 동기화\n`);

    // 3. Sync Affiliate Leads
    console.log('📊 3️⃣  어필리에이트 리드 동기화 중...');
    const affiliateRes = await supabaseClient.query(`
      SELECT id, "customerName" as name, "customerPhone" as phone, "agentId", "linkId"
      FROM "AffiliateLead"
      WHERE "customerPhone" IS NOT NULL
      ORDER BY id DESC
      LIMIT 100
    `);

    let affiliateCount = 0;
    for (const aff of affiliateRes.rows) {
      try {
        await neonClient.query(
          `INSERT INTO "Contact"
           (id, "organizationId", name, phone, channel, type, "affiliateCode", "adminMemo", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, 'affiliate', 'PROSPECT', $5, $6, NOW(), NOW())
           ON CONFLICT ("phone", "organizationId")
           DO UPDATE SET channel = 'affiliate', "adminMemo" = $6, "updatedAt" = NOW()`,
          [
            `contact_affiliate_${aff.id}`,
            orgId,
            aff.name || '어필리에이트 고객',
            aff.phone,
            aff.linkId || null,
            `어필리에이트 (Agent: ${aff.agentId || 'N/A'})`,
          ]
        );
        affiliateCount++;
      } catch (e) {
        // Ignore duplicate key errors
      }
    }
    console.log(`   ✅ ${affiliateCount}명 동기화\n`);

    // Get final count
    const finalRes = await neonClient.query(
      'SELECT COUNT(*)::int as cnt FROM "Contact"'
    );

    console.log('════════════════════════════════════════════════');
    console.log('✅ 동기화 완료!\n');
    console.log('📊 최종 현황:');
    console.log(`  구매 고객: ${userCount}명`);
    console.log(`  상품 문의: ${inquiryCount}건`);
    console.log(`  어필리에이트: ${affiliateCount}명`);
    console.log(`  총 고객 수: ${finalRes.rows[0].cnt}명\n`);
    console.log('════════════════════════════════════════════════\n');

  } catch (e) {
    console.error('❌ 오류:', (e as any).message);
    process.exit(1);
  } finally {
    await neonClient.end();
    await supabaseClient.end();
  }
}

syncData().catch(console.error);
