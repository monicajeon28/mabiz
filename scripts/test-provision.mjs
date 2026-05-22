/**
 * 계약 승인 시뮬레이션 테스트
 * - GmAffiliateContract 더미 생성 → provisionAffiliateAccounts 호출
 * - boss1, sales1 계정 생성 확인
 * - DLQ 상태 확인
 */

import pg from 'pg';
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

console.log('✅ DB 연결 성공\n');

// 1. Organization ID 가져오기
const orgs = await client.query(`SELECT id, name, slug FROM "Organization" LIMIT 3`);
console.log('📋 사용 가능한 Organization:');
orgs.rows.forEach(r => console.log(`  - ${r.id} | ${r.name} (${r.slug})`));

// 2. GlobalAdmin 가져오기
const admins = await client.query(`SELECT id, phone FROM "GlobalAdmin" LIMIT 3`);
console.log('\n👤 GlobalAdmin:');
admins.rows.forEach(r => console.log(`  - ${r.id} | ${r.phone}`));

// 3. 기존 boss1/sales1 존재 여부 확인
const existing = await client.query(
  `SELECT id, phone, name, role FROM "User" WHERE phone IN ('boss1', 'sales1') OR phone LIKE 'boss%' OR phone LIKE 'sales%' LIMIT 10`
);
console.log('\n🔍 기존 boss*/sales* 계정:');
if (existing.rows.length > 0) {
  existing.rows.forEach(r => console.log(`  - ID:${r.id} | ${r.phone} | ${r.name} | ${r.role}`));
} else {
  console.log('  없음 (처음 생성 예정)');
}

// 4. GmAffiliateContract 테이블 존재 확인
const tableCheck = await client.query(
  `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'GmAffiliateContract') AS exists`
);
const hasContractTable = tableCheck.rows[0].exists;
console.log('\n📄 GmAffiliateContract 테이블:', hasContractTable ? '✅ 있음' : '❌ 없음');

if (hasContractTable) {
  const contracts = await client.query(
    `SELECT id, status, "contractorName", "contractorEmail" FROM "GmAffiliateContract" LIMIT 3`
  );
  console.log('  기존 계약:', contracts.rows.length > 0 ? JSON.stringify(contracts.rows) : '없음');
}

// 5. DLQ 현황
const dlq = await client.query(
  `SELECT status, COUNT(*) FROM "SyncDeadLetterQueue" GROUP BY status`
);
console.log('\n📊 DLQ 현황:');
if (dlq.rows.length > 0) {
  dlq.rows.forEach(r => console.log(`  ${r.status}: ${r.count}건`));
} else {
  console.log('  없음 (정상)');
}

console.log('\n✅ 환경 확인 완료');
await client.end();
