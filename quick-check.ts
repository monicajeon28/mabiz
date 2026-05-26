import { Client } from 'pg';

async function quickCheck() {
  const sbUrl = process.env.SUPABASE_BACKUP_URL || 'postgresql://postgres.cnynywuxapxvythbcagz:!Wjsgptjsdl2@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true';
  const client = new Client({
    connectionString: sbUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  console.log('\n🔍 Supabase 데이터 복원 현황:\n');

  // 주요 테이블만 확인
  const tables = [
    { name: 'CruiseProduct', label: '🛍️ 여행 상품' },
    { name: 'ProductPricePeriod', label: '  ├ 가격 정보' },
    { name: 'ProductCabinPrice', label: '  ├ 객실 가격' },
    { name: 'ProductImage', label: '  └ 상품 이미지' },
    { name: 'News', label: '📰 크루즈닷뉴스' },
    { name: 'NewsCategory', label: '  └ 뉴스 카테고리' },
    { name: 'GmUser', label: '👥 사용자' },
    { name: 'GmReservation', label: '📝 예약 정보' },
    { name: 'GmTrip', label: '🗺️ 여행 정보' },
  ];

  for (const t of tables) {
    try {
      const result = await client.query(`SELECT COUNT(*)::int as cnt FROM "${t.name}"`);
      const count = result.rows[0]?.cnt || 0;
      const icon = count > 0 ? '✅' : '❌';
      console.log(`${icon} ${t.label.padEnd(20)}: ${count}건`);
    } catch (e) {
      console.log(`⚠️  ${t.label.padEnd(20)}: 테이블 없음`);
    }
  }

  console.log('\n');
  await client.end();
}

quickCheck().catch(console.error);
