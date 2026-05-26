import { Client } from 'pg';

/**
 * 전체 데이터 복원 상태 확인
 * 1. CRM 데이터 (Neon)
 * 2. CruiseDot 상품/뉴스 데이터 (Supabase)
 */

async function checkAllData() {
  const neonUrl = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_lAI4jQLnG1KN@ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
  const supabaseUrl = process.env.SUPABASE_BACKUP_URL || 'postgresql://postgres.cnynywuxapxvythbcagz:!Wjsgptjsdl2@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true';

  const crmClient = new Client({
    connectionString: neonUrl,
    ssl: { rejectUnauthorized: false },
  });

  const sbClient = new Client({
    connectionString: supabaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // ========== CRM 데이터 ==========
    await crmClient.connect();
    console.log('📊 마비즈 CRM (Neon) 데이터:\n');

    const crmTables = [
      'Organization',
      'OrganizationMember',
      'Contact',
      'ContactGroup',
      'CallLog',
      'SmsLog',
      'CrmLandingPage',
    ];

    for (const table of crmTables) {
      try {
        const result = await crmClient.query(`SELECT COUNT(*)::int as cnt FROM "${table}"`);
        const count = result.rows[0]?.cnt || 0;
        const icon = count > 0 ? '✅' : '❌';
        console.log(`${icon} ${table.padEnd(25)}: ${String(count).padStart(5)}건`);
      } catch (e) {
        console.log(`⚠️  ${table.padEnd(25)}: 테이블 없음`);
      }
    }

    console.log('\n');

    // ========== CruiseDot 상품/뉴스 데이터 ==========
    let sbConnected = false;
    try {
      await sbClient.connect();
      sbConnected = true;
      console.log('📊 CruiseDot (Supabase) 데이터:\n');

      const sbTables = [
        'CruiseProduct',
        'ProductPricePeriod',
        'ProductCabinPrice',
        'ProductImage',
        'GmTrip',
        'GmReservation',
        'GmTraveler',
        'GmUser',
        'News',
        'NewsCategory',
        'Comment',
        'Inquiry',
        'ConsultationRequest',
        'GoldMembership',
      ];

      const results = [];
      for (const table of sbTables) {
        try {
          const result = await sbClient.query(`SELECT COUNT(*)::int as cnt FROM "${table}"`);
          const count = result.rows[0]?.cnt || 0;
          if (count > 0) {
            results.push({ table, count });
          }
        } catch (e) {
          // 테이블 없음
        }
      }

      if (results.length === 0) {
        console.log('⚠️  Supabase에 데이터가 없습니다.');
        console.log('   (Google Drive 백업 파일이 다운로드 또는 복원되지 않았습니다)\n');
      } else {
        results.sort((a, b) => b.count - a.count);
        for (const r of results) {
          const icon = '✅';
          console.log(`${icon} ${r.table.padEnd(25)}: ${String(r.count).padStart(5)}건`);
        }
        console.log('\n');
      }

    } catch (e: any) {
      console.log('⚠️  Supabase 연결 실패');
      console.log('   (CruiseDot 데이터 조회 불가)\n');
    }

    // ========== 복원 상태 요약 ==========
    console.log('════════════════════════════════════════');
    console.log('📋 복원 상태 요약:\n');

    if (sbConnected && sbClient) {
      try {
        const productCount = await sbClient.query('SELECT COUNT(*)::int as cnt FROM "CruiseProduct"');
        const newsCount = await sbClient.query('SELECT COUNT(*)::int as cnt FROM "News"');

        const products = productCount.rows[0]?.cnt || 0;
        const news = newsCount.rows[0]?.cnt || 0;

        console.log('✅ 여행 상품: ' + products + '개');
        console.log('✅ 크루즈닷뉴스: ' + news + '개');
      } catch (e) {
        console.log('❌ 여행 상품: 미복원');
        console.log('❌ 크루즈닷뉴스: 미복원');
      }
    } else {
      console.log('❌ 여행 상품: 미복원');
      console.log('❌ 크루즈닷뉴스: 미복원');
    }

    const crmContactRes = await crmClient.query('SELECT COUNT(*)::int as cnt FROM "Contact"');
    console.log('✅ CRM 고객: ' + (crmContactRes.rows[0]?.cnt || 0) + '명');

  } finally {
    await crmClient.end();
    if (sbConnected && sbClient) {
      try {
        await sbClient.end();
      } catch (e) {
        // 이미 닫힘
      }
    }
  }
}

checkAllData().catch(console.error);
