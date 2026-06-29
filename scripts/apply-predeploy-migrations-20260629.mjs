/**
 * 배포 전 운영DB 마이그레이션 3종 (2026-06-29) — 모두 멱등(IF NOT EXISTS).
 *   ① 상품연동: CruiseProduct + salePrice/isGold/roomInventory
 *   ② 커뮤니티 Q&A: CrmLandingComment + parentId/authorRole/likeCount/status + 자기참조FK + 인덱스
 *   ③ 지정공유: CrmLandingShare + sharedToUserId + 3컬럼 UNIQUE + 보조인덱스
 *      ⚠️ 구 2컬럼 유니크 DROP은 **배포 결합**(라이브 구버전 share upsert를 깨뜨림) → 여기서 하지 않음.
 *         배포 시점에 scripts/apply-landing-share-userid.mjs(전체)로 마무리.
 *
 *   ①②는 순수 컬럼 추가라 현재 배포된(구) 코드와 호환 — 배포 전 적용해도 안전(추가 컬럼은 미사용).
 *
 * 운영 적용:  node --env-file=.env.local scripts/apply-predeploy-migrations-20260629.mjs
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
async function constraintExists(name) {
  const rows = await prisma.$queryRaw`
    SELECT constraint_name FROM information_schema.table_constraints WHERE constraint_name = ${name}`;
  return rows.length > 0;
}
const mark = (b) => (b ? '✅' : '❌');

async function run() {
  // DB 호스트 확인(자격증명 제외) — 운영 DB 맞는지 육안 확인용
  let host = '(알수없음)';
  try { host = new URL(process.env.DATABASE_URL).host; } catch {}
  console.log(`DB 연결: ${host}\n`);

  // ───────────────────────────────────────────────────────────
  console.log('=== ① 상품연동: CruiseProduct ===');
  await prisma.$executeRawUnsafe(`ALTER TABLE "CruiseProduct" ADD COLUMN IF NOT EXISTS "salePrice" INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "CruiseProduct" ADD COLUMN IF NOT EXISTS "isGold" BOOLEAN NOT NULL DEFAULT false`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "CruiseProduct" ADD COLUMN IF NOT EXISTS "roomInventory" JSONB`);
  const p1 = await checkColumn('CruiseProduct', 'salePrice');
  const p2 = await checkColumn('CruiseProduct', 'isGold');
  const p3 = await checkColumn('CruiseProduct', 'roomInventory');
  console.log(`  salePrice ${mark(p1)} / isGold ${mark(p2)} / roomInventory ${mark(p3)}`);

  // ───────────────────────────────────────────────────────────
  console.log('\n=== ② 커뮤니티 Q&A: CrmLandingComment ===');
  await prisma.$executeRawUnsafe(`ALTER TABLE "CrmLandingComment" ADD COLUMN IF NOT EXISTS "parentId" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "CrmLandingComment" ADD COLUMN IF NOT EXISTS "authorRole" TEXT NOT NULL DEFAULT 'visitor'`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "CrmLandingComment" ADD COLUMN IF NOT EXISTS "likeCount" INTEGER NOT NULL DEFAULT 0`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "CrmLandingComment" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'visible'`);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'CrmLandingComment_parentId_fkey'
      ) THEN
        ALTER TABLE "CrmLandingComment"
          ADD CONSTRAINT "CrmLandingComment_parentId_fkey"
          FOREIGN KEY ("parentId") REFERENCES "CrmLandingComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CrmLandingComment_landingPageId_parentId_idx" ON "CrmLandingComment" ("landingPageId","parentId")`);
  const c1 = await checkColumn('CrmLandingComment', 'parentId');
  const c2 = await checkColumn('CrmLandingComment', 'authorRole');
  const c3 = await checkColumn('CrmLandingComment', 'likeCount');
  const c4 = await checkColumn('CrmLandingComment', 'status');
  const cfk = await constraintExists('CrmLandingComment_parentId_fkey');
  const cidx = await indexExists('CrmLandingComment_landingPageId_parentId_idx');
  console.log(`  parentId ${mark(c1)} / authorRole ${mark(c2)} / likeCount ${mark(c3)} / status ${mark(c4)}`);
  console.log(`  자기참조 FK ${mark(cfk)} / (landingPageId,parentId) 인덱스 ${mark(cidx)}`);

  // ───────────────────────────────────────────────────────────
  console.log('\n=== ③ 지정공유: CrmLandingShare (추가분만 — 구 유니크 DROP은 배포 때) ===');
  await prisma.$executeRawUnsafe(`ALTER TABLE "CrmLandingShare" ADD COLUMN IF NOT EXISTS "sharedToUserId" TEXT NOT NULL DEFAULT ''`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "CrmLandingShare_landingPageId_sharedToOrgId_sharedToUserId_key" ON "CrmLandingShare"("landingPageId","sharedToOrgId","sharedToUserId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CrmLandingShare_sharedToUserId_idx" ON "CrmLandingShare"("sharedToUserId")`);
  const s1 = await checkColumn('CrmLandingShare', 'sharedToUserId');
  const s2 = await indexExists('CrmLandingShare_landingPageId_sharedToOrgId_sharedToUserId_key');
  const oldUq = (await constraintExists('CrmLandingShare_landingPageId_sharedToOrgId_key'))
            || (await indexExists('CrmLandingShare_landingPageId_sharedToOrgId_key'));
  console.log(`  sharedToUserId ${mark(s1)} / 신규 3컬럼 유니크 ${mark(s2)}`);
  console.log(`  구 2컬럼 유니크 잔존: ${oldUq ? '있음(배포 때 DROP 예정 — 정상)' : '없음(이미 제거됨)'}`);

  // ───────────────────────────────────────────────────────────
  const allOk = p1 && p2 && p3 && c1 && c2 && c3 && c4 && cfk && cidx && s1 && s2;
  console.log(`\n=== 최종: ${allOk ? '✅ 추가 마이그레이션 모두 적용됨' : '❌ 일부 누락 — 위 로그 확인'} ===`);
  await prisma.$disconnect();
}

run().catch(async (e) => {
  console.error('❌ 오류:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
