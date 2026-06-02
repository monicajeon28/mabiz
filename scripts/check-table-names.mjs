import pg from 'pg';
const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

const t = await c.query("SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%commission%' OR table_name ILIKE '%payslip%' OR table_name ILIKE '%organization%'");
console.log('테이블 목록:');
t.rows.forEach(r => console.log(' ', r.table_name));

// CommissionLedger 칼럼 확인
const cols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name ILIKE '%commissionledger%' OR table_name = 'CommissionLedger' LIMIT 30");
console.log('\nCommissionLedger 칼럼 후보:');
cols.rows.forEach(r => console.log(' ', r.column_name));

// 실제 대소문자 테이블명으로 시도
const cols2 = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'CommissionLedger'`);
console.log('\nCommissionLedger (대소문자 정확) 칼럼:');
cols2.rows.forEach(r => console.log(' ', r.column_name));

await c.end();
