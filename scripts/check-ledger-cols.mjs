import pg from 'pg';
const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

// CommissionLedger 전체 컬럼 (information_schema)
const cols = await c.query(`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'CommissionLedger'
  ORDER BY ordinal_position
`);
console.log('CommissionLedger 모든 컬럼:');
cols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type}, nullable=${r.is_nullable})`));

// AffiliatePayslip 전체 컬럼
const cols2 = await c.query(`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'AffiliatePayslip'
  ORDER BY ordinal_position
`);
console.log('\nAffiliatePayslip 모든 컬럼:');
cols2.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type}, nullable=${r.is_nullable})`));

// 샘플 데이터 1건
const sample = await c.query(`SELECT * FROM "CommissionLedger" LIMIT 1`);
if (sample.rows.length > 0) {
  console.log('\nCommissionLedger 샘플 데이터 키:', Object.keys(sample.rows[0]));
}

await c.end();
