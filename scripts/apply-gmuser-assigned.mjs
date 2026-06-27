/**
 * GmUser(@@map "User") 담당자 컬럼 추가 (2026-06-27)
 *   assignedUserId TEXT — 회원 담당자(OrganizationMember.id, CUID). 각자 자기 고객 관리.
 *   과거 assign 라우트가 담당자 CUID를 affiliateCode(VarChar4·unique)에 잘못 기록 →
 *   런타임 500 + 수당코드 손상. 전용 컬럼으로 분리.
 *   멱등(ADD COLUMN IF NOT EXISTS) + 인덱스. 운영 적용:
 *     node --env-file=.env.local scripts/apply-gmuser-assigned.mjs
 *   ⚠️ Neon은 크루즈닷과 공유 DB — 저트래픽 시간 권장.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function checkColumn(table, column) {
  const rows = await prisma.$queryRaw`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = ${table} AND column_name = ${column}
  `;
  return rows.length > 0;
}

async function run() {
  console.log('DB 연결 중...\n=== User.assignedUserId (회원 담당자) ===');

  const has = await checkColumn('User', 'assignedUserId');
  console.log(`assignedUserId (TEXT): ${has ? '✅ 이미 존재' : '❌ 없음 → 추가'}`);
  if (!has) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "assignedUserId" TEXT`,
    );
    console.log('  ✅ assignedUserId 추가 완료');
  }

  // 담당자별 조회 인덱스 (멱등)
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "User_assignedUserId_idx" ON "User" ("assignedUserId")`,
  );
  console.log('  ✅ 인덱스 User_assignedUserId_idx 확인');

  console.log('\n=== 최종 검증 ===');
  const ok = await checkColumn('User', 'assignedUserId');
  console.log(`User.assignedUserId: ${ok ? '✅' : '❌ 실패'}`);

  await prisma.$disconnect();
  console.log('\n완료.');
}

run().catch(async (e) => {
  console.error('❌ 오류:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
