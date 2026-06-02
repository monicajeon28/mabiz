import pg from 'pg';
const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

// AffiliatePayslip 테이블 존재 확인
const t = await c.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_name ILIKE '%payslip%' OR table_name ILIKE '%affiliate%'
`);
console.log('Affiliate 관련 테이블:');
t.rows.forEach(r => console.log(' ', r.table_name));

// AffiliatePayslip 컬럼 (이름 대소문자 변형 포함)
for (const tname of ['AffiliatePayslip', 'affiliatepayslip', 'affiliate_payslip']) {
  const r = await c.query(`
    SELECT column_name FROM information_schema.columns WHERE table_name = $1
  `, [tname]);
  if (r.rows.length > 0) {
    console.log(`\n${tname} 컬럼:`, r.rows.map(x => x.column_name));
  }
}

// CommissionLedger saleId 타입 확인 (스키마와 실제가 다른지)
const saleId = await c.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='CommissionLedger' AND column_name='saleId'`);
console.log('\nCommissionLedger.saleId 정보:', saleId.rows);

// 오래된 마이그레이션 상태 확인
const mig = await c.query(`SELECT id, checksum FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 5`).catch(e => ({ rows: [], error: e.message }));
if (mig.error) {
  console.log('\n마이그레이션 테이블 없음:', mig.error);
} else {
  console.log('\n최근 마이그레이션:');
  mig.rows.forEach(r => console.log(' ', r.id?.substring(0,40)));
}

await c.end();
