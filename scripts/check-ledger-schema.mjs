import pg from 'pg';
const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

// AffiliateLedger 컬럼
const al = await c.query(`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns WHERE table_name = 'AffiliateLedger'
  ORDER BY ordinal_position
`);
console.log('AffiliateLedger 컬럼:');
al.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

// CommissionLedger 컬럼 전체 (실제 DB)
const cl = await c.query(`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns WHERE table_name = 'CommissionLedger'
  ORDER BY ordinal_position
`);
console.log('\nCommissionLedger 컬럼 (실제 DB):');
cl.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type}, null=${r.is_nullable})`));

// CommissionLedger 행 수
const cnt = await c.query(`SELECT COUNT(*) FROM "CommissionLedger"`);
console.log('\nCommissionLedger 행 수:', cnt.rows[0].count);

// CommissionLedger 샘플 (있으면)
const sample = await c.query(`SELECT * FROM "CommissionLedger" LIMIT 2`);
if (sample.rows.length > 0) {
  console.log('\nCommissionLedger 샘플:');
  sample.rows.forEach(r => console.log(' ', JSON.stringify(r)));
} else {
  console.log('\nCommissionLedger 데이터 없음');
}

// 현재 Prisma 스키마의 CommissionLedger 마이그레이션 적용 여부 확인
// organizationId 칼럼 있는지
const orgCol = await c.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'CommissionLedger' AND column_name = 'organizationId'
`);
console.log('\nCommissionLedger.organizationId 존재:', orgCol.rows.length > 0 ? 'YES' : 'NO');

await c.end();
