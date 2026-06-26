/**
 * GmTraveler(@@map "Traveler") APIS 매니페스트 운영필드 추가 (2026-06-26)
 *   객실카테고리·항공·결제(일자/방법/금액). 멱등(ADD COLUMN IF NOT EXISTS).
 *   운영 적용: node --env-file=.env.local scripts/apply-apis-traveler-fields.mjs
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter, log: ['error'] });

const COLUMNS = [
  ['cabinCategory', 'TEXT'],
  ['airline', 'TEXT'],
  ['paymentDate', 'TEXT'],
  ['paymentMethod', 'TEXT'],
  ['paymentAmount', 'INTEGER'],
];

async function checkColumn(table, column) {
  const rows = await prisma.$queryRaw`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = ${table} AND column_name = ${column}
  `;
  return rows.length > 0;
}

async function run() {
  console.log('DB 연결 중...\n=== Traveler (APIS 매니페스트 필드) ===');
  for (const [col, type] of COLUMNS) {
    const has = await checkColumn('Traveler', col);
    console.log(`${col} (${type}): ${has ? '✅ 이미 존재' : '❌ 없음 → 추가'}`);
    if (!has) {
      try {
        // 컬럼명/타입은 화이트리스트(COLUMNS)에서만 오므로 식별자 인라인 안전
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "Traveler" ADD COLUMN IF NOT EXISTS "${col}" ${type}`,
        );
        console.log(`  ✅ ${col} 추가 완료`);
      } catch (e) {
        console.log('  ⚠️ ', e.message);
      }
    }
  }

  console.log('\n=== 최종 검증 ===');
  for (const [col] of COLUMNS) {
    const ok = await checkColumn('Traveler', col);
    console.log(`Traveler.${col}: ${ok ? '✅' : '❌ 실패'}`);
  }

  await prisma.$disconnect();
  console.log('\n완료.');
}

run().catch(async (e) => {
  console.error('❌ 오류:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
