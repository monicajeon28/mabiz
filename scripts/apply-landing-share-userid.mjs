/**
 * CrmLandingShare 지정공유 컬럼 (2026-06-28, 봇 업그레이드 Phase F)
 *   sharedToUserId TEXT DEFAULT '' — "" = 조직/전체 공유, 그 외 = 특정 담당자(지사/대리점장) 지정공유.
 *   유니크를 (landingPageId, sharedToOrgId) → (landingPageId, sharedToOrgId, sharedToUserId) 로 교체.
 *   순서: ①ADD COLUMN('' 백필) ②3컬럼 UNIQUE INDEX CONCURRENTLY(쓰기 무중단) ③보조 인덱스 ④구 유니크 제거.
 *   CONCURRENTLY는 트랜잭션 밖이어야 함(개별 실행). 운영 적용:
 *     node --env-file=.env.local scripts/apply-landing-share-userid.mjs
 *   ⚠️ Neon은 크루즈닷과 공유 DB — 저트래픽 시간 권장.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function checkColumn(table, column) {
  const rows = await prisma.$queryRaw`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = ${table} AND column_name = ${column}`;
  return rows.length > 0;
}
async function indexExists(name) {
  const rows = await prisma.$queryRaw`SELECT indexname FROM pg_indexes WHERE indexname = ${name}`;
  return rows.length > 0;
}

async function run() {
  console.log('DB 연결 중...\n=== CrmLandingShare 지정공유(sharedToUserId) ===');

  // 1) 컬럼 추가('' 백필 — 기존 행은 조직/전체 공유로 유지)
  const hasCol = await checkColumn('CrmLandingShare', 'sharedToUserId');
  console.log(`sharedToUserId: ${hasCol ? '✅ 이미 존재' : '❌ 없음 → 추가'}`);
  if (!hasCol) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "CrmLandingShare" ADD COLUMN IF NOT EXISTS "sharedToUserId" TEXT NOT NULL DEFAULT ''`,
    );
    console.log('  ✅ 컬럼 추가');
  }

  // 2) 신규 3컬럼 UNIQUE INDEX (CONCURRENTLY — 트랜잭션 밖). 기존행 모두 sharedToUserId='' 라 충돌 없음.
  const newIdx = 'CrmLandingShare_landingPageId_sharedToOrgId_sharedToUserId_key';
  if (!(await indexExists(newIdx))) {
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "${newIdx}" ON "CrmLandingShare"("landingPageId","sharedToOrgId","sharedToUserId")`,
    );
    console.log('  ✅ 3컬럼 UNIQUE INDEX 생성');
  } else console.log('  ✅ 3컬럼 UNIQUE INDEX 이미 존재');

  // 3) 보조 인덱스
  await prisma.$executeRawUnsafe(
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS "CrmLandingShare_sharedToUserId_idx" ON "CrmLandingShare"("sharedToUserId")`,
  );
  console.log('  ✅ sharedToUserId 인덱스 확인');

  // 4) 구 2컬럼 유니크 제거(신규 검증 후). constraint/index 양쪽 커버.
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "CrmLandingShare" DROP CONSTRAINT IF EXISTS "CrmLandingShare_landingPageId_sharedToOrgId_key"`,
  );
  await prisma.$executeRawUnsafe(
    `DROP INDEX IF EXISTS "CrmLandingShare_landingPageId_sharedToOrgId_key"`,
  );
  console.log('  ✅ 구 2컬럼 유니크 제거');

  console.log('\n=== 최종 검증 ===');
  console.log(`sharedToUserId 컬럼: ${(await checkColumn('CrmLandingShare', 'sharedToUserId')) ? '✅' : '❌'}`);
  console.log(`3컬럼 유니크: ${(await indexExists(newIdx)) ? '✅' : '❌'}`);

  await prisma.$disconnect();
  console.log('\n완료.');
}

run().catch(async (e) => {
  console.error('❌ 오류:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
