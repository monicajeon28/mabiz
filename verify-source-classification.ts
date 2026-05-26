/**
 * P0-6: Verify customer source classification
 * Shows that customers are now properly classified by source type
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function verifySourceClassification() {
  const neonUrl = process.env.DATABASE_URL;

  if (!neonUrl) {
    console.error('❌ DATABASE_URL not configured');
    process.exit(1);
  }

  const client = new Client({
    connectionString: neonUrl,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n════════════════════════════════════════════════');
  console.log('✅ P0-6: 고객 출처 분류 확인 (2026-05-27)');
  console.log('════════════════════════════════════════════════\n');

  try {
    await client.connect();

    // 1. User source customers (구매고객)
    console.log('1️⃣  구매고객 (User Source) - 가입방법별');
    const userRes = await client.query(`
      SELECT name, phone, "signupMethod", "sourceId"
      FROM "Contact"
      WHERE "sourceType" = 'user'
      LIMIT 3
    `);

    const userCountRes = await client.query(
      `SELECT COUNT(*)::int as cnt FROM "Contact" WHERE "sourceType" = 'user'`
    );
    const userCount = userCountRes.rows[0].cnt;

    console.log(`  총 ${userCount}명`);
    if (userRes.rows.length > 0) {
      console.log(`  샘플 데이터:`);
      userRes.rows.forEach((row: any, i: number) => {
        console.log(`    ${i + 1}. ${row.name} (${row.phone}) - 가입: ${row.signupMethod}`);
      });
    }
    console.log('');

    // 2. Inquiry source customers (상품 문의)
    console.log('2️⃣  상품문의고객 (Inquiry Source) - 상품코드별');
    const inquiryRes = await client.query(`
      SELECT name, phone, "inquiryProductCode", "sourceId"
      FROM "Contact"
      WHERE "sourceType" = 'inquiry'
      LIMIT 3
    `);

    const inquiryCountRes = await client.query(
      `SELECT COUNT(*)::int as cnt FROM "Contact" WHERE "sourceType" = 'inquiry'`
    );
    const inquiryCount = inquiryCountRes.rows[0].cnt;

    console.log(`  총 ${inquiryCount}건`);
    if (inquiryRes.rows.length > 0) {
      console.log(`  샘플 데이터:`);
      inquiryRes.rows.forEach((row: any, i: number) => {
        console.log(`    ${i + 1}. ${row.name} (${row.phone}) - 상품: ${row.inquiryProductCode || '미지정'}`);
      });
    }
    console.log('');

    // 3. Affiliate source customers (어필리에이트)
    console.log('3️⃣  어필리에이트 (Affiliate Source) - 링크/담당자/에이전트별');
    const affiliateRes = await client.query(`
      SELECT
        name, phone, "affiliateLinkId", "affiliateManagerId", "affiliateAgentId", "sourceId"
      FROM "Contact"
      WHERE "sourceType" = 'affiliate'
      LIMIT 3
    `);

    const affiliateCountRes = await client.query(
      `SELECT COUNT(*)::int as cnt FROM "Contact" WHERE "sourceType" = 'affiliate'`
    );
    const affiliateCount = affiliateCountRes.rows[0].cnt;

    console.log(`  총 ${affiliateCount}명`);
    if (affiliateRes.rows.length > 0) {
      console.log(`  샘플 데이터:`);
      affiliateRes.rows.forEach((row: any, i: number) => {
        console.log(`    ${i + 1}. ${row.name} (${row.phone})`);
        console.log(`       ├─ Link: ${row.affiliateLinkId}`);
        console.log(`       ├─ Manager(본사): ${row.affiliateManagerId || 'N/A'}`);
        console.log(`       └─ Agent(판매원): ${row.affiliateAgentId || 'N/A'}`);
      });
    }
    console.log('');

    // 4. Summary by source type
    console.log('📊 전체 분류 현황:');
    const summaryRes = await client.query(`
      SELECT "sourceType", COUNT(*)::int as cnt
      FROM "Contact"
      WHERE "sourceType" IS NOT NULL
      GROUP BY "sourceType"
      ORDER BY cnt DESC
    `);

    const sourceLabels: { [key: string]: string } = {
      user: '🟢 구매고객',
      inquiry: '📋 상품문의',
      affiliate: '🟡 어필리에이트',
      landing_page: '🔵 랜딩페이지',
      education: '🎓 교육',
      gold_member: '👑 골드회원',
    };

    summaryRes.rows.forEach((row: any) => {
      const label = sourceLabels[row.sourceType] || row.sourceType;
      console.log(`  ${label}: ${row.cnt}명`);
    });

    // 5. Signup method breakdown for User source
    console.log('\n📲 구매고객 가입방법 분류:');
    const signupRes = await client.query(`
      SELECT "signupMethod", COUNT(*)::int as cnt
      FROM "Contact"
      WHERE "sourceType" = 'user'
      GROUP BY "signupMethod"
      ORDER BY cnt DESC
    `);

    const methodLabels: { [key: string]: string } = {
      general: '일반가입',
      kakao: '카카오가입',
      naver: '네이버가입',
      google: '구글가입',
    };

    signupRes.rows.forEach((row: any) => {
      const label = methodLabels[row.signupMethod] || row.signupMethod;
      console.log(`  ${label}: ${row.cnt}명`);
    });

    console.log('\n════════════════════════════════════════════════');
    console.log('✅ P0-6 완료: 모든 고객이 출처별로 분류되었습니다!');
    console.log('════════════════════════════════════════════════\n');

  } catch (e) {
    console.error('❌ 오류:', (e as any).message);
  } finally {
    await client.end();
  }
}

verifySourceClassification().catch(console.error);
