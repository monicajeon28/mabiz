/**
 * ApisSyncQueue.batchId 컬럼 + 인덱스 추가
 * 실행: node --env-file=.env.local scripts/apply-batchid-migration.mjs
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function run() {
  console.log('DB 연결 중...');

  // batchId 컬럼 존재 여부 확인
  const colCheck = await prisma.$queryRaw`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'ApisSyncQueue' AND column_name = 'batchId'
  `;

  if (colCheck.length > 0) {
    console.log('✅ batchId 컬럼 이미 존재 — 스킵');
  } else {
    console.log('❌ batchId 컬럼 없음 → 추가 중...');
    await prisma.$executeRaw`ALTER TABLE "ApisSyncQueue" ADD COLUMN "batchId" TEXT`;
    console.log('✅ 컬럼 추가 완료');
  }

  // 인덱스 존재 여부 확인
  const idxCheck = await prisma.$queryRaw`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'ApisSyncQueue' AND indexname = 'ApisSyncQueue_batchId_idx'
  `;

  if (idxCheck.length > 0) {
    console.log('✅ 인덱스 이미 존재 — 스킵');
  } else {
    console.log('❌ 인덱스 없음 → 생성 중...');
    await prisma.$executeRaw`CREATE INDEX "ApisSyncQueue_batchId_idx" ON "ApisSyncQueue" ("batchId")`;
    console.log('✅ 인덱스 생성 완료');
  }

  console.log('\n완료.');
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error('실패:', e.message);
  process.exit(1);
});
