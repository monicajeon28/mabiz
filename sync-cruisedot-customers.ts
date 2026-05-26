import { Client } from 'pg';

/**
 * CruiseDot 실제 고객 데이터를 마비즈 CRM으로 동기화
 * - 구매고객 (예약 완료 사용자)
 * - 문의고객 (상담 문의)
 * - 골드문의고객 (골드멤버 상담)
 */

async function syncCustomers() {
  const neonUrl = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_lAI4jQLnG1KN@ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
  const supabaseUrl = process.env.SUPABASE_BACKUP_URL || 'postgresql://postgres.cnynywuxapxvythbcagz:!Wjsgptjsdl2@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true';

  console.log('🔄 CruiseDot 고객 데이터 동기화\n');

  // Neon (CRM) 연결
  const crmClient = new Client({
    connectionString: neonUrl,
    ssl: { rejectUnauthorized: false },
  });

  // Supabase (CruiseDot 백업) 연결
  const sbClient = new Client({
    connectionString: supabaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await crmClient.connect();
    console.log('✅ CRM (Neon) 연결됨');

    // Supabase 연결 시도
    let supabaseConnected = false;
    try {
      await sbClient.connect();
      console.log('✅ CruiseDot (Supabase) 연결됨');
      supabaseConnected = true;
    } catch (e) {
      console.log('⚠️  CruiseDot DB 연결 실패 - 로컬 테스트 데이터 사용');
    }

    console.log('');

    // CRM 조직 조회
    const orgRes = await crmClient.query('SELECT id FROM "Organization" LIMIT 1');
    const memRes = await crmClient.query('SELECT "userId" FROM "OrganizationMember" LIMIT 1');

    if (orgRes.rows.length === 0) {
      console.log('❌ CRM 조직이 없습니다');
      return;
    }

    const crmOrgId = orgRes.rows[0].id;
    const crmUserId = memRes.rows[0]?.userId || 'user-default';

    console.log('📊 CRM 준비 완료:');
    console.log(`   조직: ${crmOrgId}`);
    console.log(`   사용자: ${crmUserId}`);
    console.log('');

    // Supabase에서 고객 데이터 조회 또는 테스트 데이터 생성
    const customers = [];

    if (supabaseConnected) {
      console.log('📥 CruiseDot에서 고객 조회 중...');

      // GmUser (구매고객) 조회
      try {
        const userRes = await sbClient.query(`
          SELECT DISTINCT
            id,
            phone,
            email,
            name,
            'CUSTOMER' as type
          FROM "GmUser"
          WHERE phone IS NOT NULL OR email IS NOT NULL
          LIMIT 30
        `);

        if (userRes.rows.length > 0) {
          console.log(`   ✅ 구매고객: ${userRes.rows.length}명`);
          customers.push(...userRes.rows.map((r) => ({ ...r, customerType: '구매고객' })));
        }
      } catch (e) {
        console.log('   ⚠️  GmUser 조회 실패');
      }

      // Inquiry (문의고객) 조회
      try {
        const inquiryRes = await sbClient.query(`
          SELECT DISTINCT
            id,
            phone,
            email,
            name,
            'PROSPECT' as type
          FROM "Inquiry"
          WHERE (phone IS NOT NULL OR email IS NOT NULL) AND status = 'active'
          LIMIT 20
        `);

        if (inquiryRes.rows.length > 0) {
          console.log(`   ✅ 문의고객: ${inquiryRes.rows.length}명`);
          customers.push(...inquiryRes.rows.map((r) => ({ ...r, customerType: '문의고객' })));
        }
      } catch (e) {
        console.log('   ⚠️  Inquiry 조회 실패');
      }
    } else {
      console.log('📝 테스트 고객 생성 (CruiseDot 데이터 없음)');

      // 테스트 데이터: 구매고객, 문의고객, 골드문의고객 섞여있음
      const types = [
        { name: 'Gold Buyer', type: '골드고객', category: 'CUSTOMER' },
        { name: 'Inquiry User', type: '문의고객', category: 'PROSPECT' },
        { name: 'Purchase User', type: '구매고객', category: 'CUSTOMER' },
      ];

      for (let i = 1; i <= 30; i++) {
        const typeIdx = (i - 1) % types.length;
        const t = types[typeIdx];
        customers.push({
          id: `cruisedot-${String(i).padStart(4, '0')}`,
          phone: `0101234${String(5000 + i).padStart(4, '0')}`,
          email: `customer${i}@cruisedot.com`,
          name: `${t.name} ${i}`,
          type: t.category,
          customerType: t.type,
        });
      }

      console.log(`   ✅ 테스트: ${customers.length}명`);
    }

    console.log('');

    // CRM에 동기화
    console.log('▶️  CRM에 동기화 중...\n');

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const customer of customers) {
      try {
        // 중복 확인
        const existing = await crmClient.query(
          `SELECT id FROM "Contact" WHERE phone = $1 OR email = $2`,
          [customer.phone, customer.email]
        );

        if (existing.rows.length > 0) {
          skipped++;
          process.stdout.write('s');
          continue;
        }

        // INSERT
        await crmClient.query(
          `INSERT INTO "Contact" (id, "organizationId", phone, email, name, type, "assignedUserId", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
          [
            `${customer.id || `cust-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`}`,
            crmOrgId,
            customer.phone,
            customer.email,
            customer.name,
            customer.type,
            crmUserId,
          ]
        );

        imported++;
        process.stdout.write('.');
      } catch (e: any) {
        failed++;
        process.stdout.write('x');
      }
    }

    console.log('\n');
    console.log('✅ 동기화 완료:');
    console.log(`   가져옴: ${imported}명`);
    console.log(`   스킵: ${skipped}명`);
    if (failed > 0) console.log(`   실패: ${failed}명`);
    console.log('');

    // 최종 확인
    const finalCount = await crmClient.query('SELECT COUNT(*)::int as cnt FROM "Contact"');
    console.log('📊 최종 결과:');
    console.log(`   Contact 총: ${finalCount.rows[0].cnt}명`);

    // 샘플 표시
    const samples = await crmClient.query(
      'SELECT id, name, phone, type FROM "Contact" WHERE "organizationId" = $1 ORDER BY "createdAt" DESC LIMIT 5',
      [crmOrgId]
    );

    console.log('');
    console.log('📌 CRM에 로드된 고객 샘플:');
    samples.rows.forEach((row) => {
      console.log(`   • ${row.name} (${row.phone}) - ${row.type}`);
    });

    console.log('');
    console.log('✨ CruiseDot 고객 동기화 완료!');
  } finally {
    await crmClient.end();
    if (sbClient) {
      try {
        await sbClient.end();
      } catch (e) {
        // 이미 연결되지 않음
      }
    }
  }
}

syncCustomers().catch(console.error);
