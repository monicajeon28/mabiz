/**
 * Contact 목록 성능 인덱스 2종 추가 (2026-06-26)
 *   - idx_contact_org_deleted_id         : 조직격리+소프트삭제 후 기본(id) 정렬·페이지네이션
 *   - idx_contact_org_deleted_purchased  : 구매(purchasedAt) 정렬
 *   CONCURRENTLY로 운영 테이블 락 최소화(트랜잭션 밖에서 단일 실행). 멱등(IF NOT EXISTS).
 *   ⚠️ Neon은 크루즈닷과 공유 DB — 가급적 저트래픽 시간에 1회 실행.
 *   운영 적용: node --env-file=.env.local scripts/apply-contact-list-indexes.mjs
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter, log: ['error'] });

const INDEXES = [
  ['idx_contact_org_deleted_id', '"organizationId", "deletedAt", "id"'],
  ['idx_contact_org_deleted_purchased', '"organizationId", "deletedAt", "purchasedAt"'],
];

async function exists(name) {
  const rows = await prisma.$queryRaw`
    SELECT indexname FROM pg_indexes WHERE tablename = 'Contact' AND indexname = ${name}
  `;
  return rows.length > 0;
}

async function run() {
  console.log('DB 연결 중...\n=== Contact 목록 인덱스 ===');
  for (const [name, cols] of INDEXES) {
    if (await exists(name)) {
      console.log(`${name}: ✅ 이미 존재`);
      continue;
    }
    console.log(`${name}: ❌ 없음 → 생성(CONCURRENTLY)`);
    try {
      // CONCURRENTLY는 트랜잭션 밖에서만 — $executeRawUnsafe 단일 실행
      await prisma.$executeRawUnsafe(
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${name}" ON "Contact" (${cols})`,
      );
      console.log(`  ✅ ${name} 생성 완료`);
    } catch (e) {
      console.log(`  ⚠️ CONCURRENTLY 실패(${e.message}) → 일반 생성 재시도`);
      try {
        await prisma.$executeRawUnsafe(
          `CREATE INDEX IF NOT EXISTS "${name}" ON "Contact" (${cols})`,
        );
        console.log(`  ✅ ${name} 생성 완료(일반)`);
      } catch (e2) {
        console.log('  ❌ ', e2.message);
      }
    }
  }

  console.log('\n=== 최종 검증 ===');
  for (const [name] of INDEXES) {
    console.log(`${name}: ${(await exists(name)) ? '✅' : '❌ 실패'}`);
  }

  await prisma.$disconnect();
  console.log('\n완료.');
}

run().catch(async (e) => {
  console.error('❌ 오류:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
