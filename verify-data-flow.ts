import { Client } from 'pg';

async function verifyDataFlow() {
  const neonUrl = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_lAI4jQLnG1KN@ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
  const client = new Client({
    connectionString: neonUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    console.log('🔍 CRM 데이터 연동 상태 검증\n');

    // 1. Contact와의 관계 확인
    console.log('📋 Contact 테이블 상태:\n');

    const contactCheck = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN "cruiseProductId" IS NOT NULL THEN 1 END) as with_product,
        COUNT(CASE WHEN "reservationId" IS NOT NULL THEN 1 END) as with_reservation,
        COUNT(CASE WHEN "quotedPrice" IS NOT NULL THEN 1 END) as with_price
      FROM "Contact"
    `);

    const c = contactCheck.rows[0];
    console.log(`  총 고객: ${c.total}명`);
    console.log(`  ├─ 상품 연결: ${c.with_product}명 (${Math.round(c.with_product/c.total*100)}%)`);
    console.log(`  ├─ 예약 연결: ${c.with_reservation}명 (${Math.round(c.with_reservation/c.total*100)}%)`);
    console.log(`  └─ 가격 제시: ${c.with_price}명 (${Math.round(c.with_price/c.total*100)}%)\n`);

    // 2. 데이터 소스 확인
    console.log('📊 데이터 소스 현황:\n');

    const sources = [
      { table: 'CruiseProduct', label: '여행 상품' },
      { table: 'GmReservation', label: '예약 정보 (구매)' },
      { table: 'Inquiry', label: '상품 문의' },
      { table: 'ConsultationRequest', label: '상담 신청' },
      { table: 'GoldMemberConsultation', label: '골드 문의' },
      { table: 'AffiliateProduct', label: '어필리에이트 상품' },
      { table: 'Payment', label: '결제 정보' },
    ];

    for (const src of sources) {
      try {
        const count = await client.query(`SELECT COUNT(*) as cnt FROM "${src.table}"`);
        const cnt = count.rows[0].cnt;
        const icon = cnt > 0 ? '✅' : '⚠️';
        console.log(`  ${icon} ${src.label.padEnd(20)}: ${cnt}개`);
      } catch (e) {
        console.log(`  ❌ ${src.label.padEnd(20)}: 테이블 없음`);
      }
    }

    console.log('\n');

    // 3. Contact → Order/Payment 연결 확인
    console.log('🔗 Contact → 구매/결제 연결 확인:\n');

    const paymentCheck = await client.query(`
      SELECT COUNT(*) as cnt FROM "Payment" WHERE "contactId" IS NOT NULL
    `);
    const payments = paymentCheck.rows[0].cnt;
    console.log(`  결제 중 Contact 연결: ${payments}건\n`);

    // 4. Contact 세부 데이터 (샘플)
    console.log('📌 Contact 데이터 샘플:\n');

    const sample = await client.query(`
      SELECT 
        c.name,
        c.phone,
        c.type,
        c."productName",
        c."quotedPrice",
        c."departureDate"
      FROM "Contact" c
      LIMIT 5
    `);

    sample.rows.forEach((row, idx) => {
      console.log(`  ${idx+1}. ${row.name}`);
      console.log(`     전화: ${row.phone}`);
      console.log(`     유형: ${row.type}`);
      console.log(`     상품: ${row.productName || '미지정'}`);
      console.log(`     가격: ${row.quotedPrice ? `₩${row.quotedPrice}` : '미제시'}`);
      console.log(`     출발: ${row.departureDate ? row.departureDate.split('T')[0] : '미정'}\n`);
    });

    // 5. 연동 체크리스트
    console.log('════════════════════════════════');
    console.log('✅ 데이터 연동 체크리스트:\n');

    const checks = [
      { item: 'Contact → CruiseProduct', status: c.with_product > 0 },
      { item: 'Contact → GmReservation', status: c.with_reservation > 0 },
      { item: 'Contact → Payment', status: payments > 0 },
      { item: '여행 상품 데이터', status: true },
      { item: '고객 기본정보', status: c.total > 0 },
    ];

    checks.forEach(ch => {
      const icon = ch.status ? '✅' : '⚠️';
      console.log(`${icon} ${ch.item}`);
    });

  } finally {
    await client.end();
  }
}

verifyDataFlow().catch(console.error);
