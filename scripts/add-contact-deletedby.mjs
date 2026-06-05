// Contact 휴지통 기능: 삭제자 기록 컬럼 추가 (deletedBy, deletedByName)
// nullable TEXT 추가 — 기존 데이터/동작에 영향 없음. IF NOT EXISTS 로 멱등 보장.
// 실행: npx dotenvx run -- node scripts/add-contact-deletedby.mjs
import pg from 'pg';
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query(`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;`);
  await client.query(`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "deletedByName" TEXT;`);
  console.log('✅ Contact.deletedBy / deletedByName 컬럼 추가 완료');

  // 검증
  const { rows } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'Contact' AND column_name IN ('deletedBy','deletedByName')
    ORDER BY column_name
  `);
  console.log('확인된 컬럼:', rows.map((r) => r.column_name).join(', '));
} catch (e) {
  console.error('❌ 마이그레이션 실패:', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
