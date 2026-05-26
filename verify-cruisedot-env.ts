import { Client } from 'pg';
import * as dotenv from 'dotenv';

// Load .env.local
dotenv.config({ path: '.env.local' });

async function verifyCruisedotDataEnv() {
  const backupUrl = process.env.SUPABASE_BACKUP_URL;

  if (!backupUrl) {
    console.log('❌ SUPABASE_BACKUP_URL 환경 변수가 없습니다.\n');
    return;
  }

  const client = new Client({
    connectionString: backupUrl,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n════════════════════════════════════════════════');
  console.log('✅ CruiseDot 백업 데이터 확인 (Supabase Seoul)');
  console.log('════════════════════════════════════════════════\n');

  try {
    await client.connect();
    console.log('✅ Supabase 연결 성공\n');

    // Check what tables exist
    const tableRes = await client.query(`
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

    // Count each relevant table
    const tables = [
      { name: 'GmUser', label: '구매 고객' },
      { name: 'Inquiry', label: '상품 문의' },
      { name: 'GoldMemberConsultation', label: '골드 문의' },
      { name: 'GmReservation', label: '예약 데이터' },
      { name: 'ProductPricePeriod', label: '상품-가격' },
      { name: 'ProductCabinPrice', label: '객실-가격' },
    ];

    console.log('📊 고객 데이터 현황:\n');

    for (const table of tables) {
      try {
        const countRes = await client.query(
          `SELECT COUNT(*)::int as cnt FROM "${table.name}"`
        );
        const count = countRes.rows[0]?.cnt || 0;
        console.log(`  ✅ ${table.label} (${table.name}): ${count}건`);
      } catch (e) {
        console.log(`  ❌ ${table.label} (${table.name}): 테이블 없음`);
      }
    }

    console.log('\n');

    // Sample data from GmUser
    try {
      const userRes = await client.query(`
        SELECT id, email, phone, name, createdAt
        FROM "GmUser"
        ORDER BY id DESC
        LIMIT 5
      `);

      if (userRes.rows.length > 0) {
        console.log('📋 구매 고객 샘플 (GmUser):\n');
        userRes.rows.forEach((row, idx) => {
          console.log(`  ${idx + 1}. ${row.name} | ${row.phone || row.email}`);
        });
        console.log('\n');
      }
    } catch (e) {
      // Table might not exist
    }

  } catch (e) {
    console.error('❌ 연결 또는 쿼리 실패:', (e as any).message);
  } finally {
    await client.end();
  }

  console.log('════════════════════════════════════════════════\n');
}

verifyCruisedotDataEnv().catch(console.error);
