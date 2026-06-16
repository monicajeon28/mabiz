/**
 * AiCallLog / AiCallAnalysis 누락 컬럼 추가
 * node --env-file=.env.local scripts/apply-calllog-missing-columns.mjs
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
  console.log('DB 연결 중...\n');

  // ── AiCallLog ─────────────────────────────────────────────
  console.log('=== AiCallLog ===');

  // driveFileId TEXT
  const hasDriveFileId = await checkColumn('AiCallLog', 'driveFileId');
  console.log(`driveFileId: ${hasDriveFileId ? '✅ 이미 존재' : '❌ 없음 → 추가'}`);
  if (!hasDriveFileId) {
    try {
      await prisma.$executeRaw`ALTER TABLE "AiCallLog" ADD COLUMN IF NOT EXISTS "driveFileId" TEXT`;
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "AiCallLog_driveFileId_idx" ON "AiCallLog"("driveFileId")`;
      console.log('  ✅ driveFileId 추가 + 인덱스 완료');
    } catch (e) { console.log('  ⚠️ ', e.message); }
  }

  // agentLastName TEXT
  const hasAgentLastName = await checkColumn('AiCallLog', 'agentLastName');
  console.log(`agentLastName: ${hasAgentLastName ? '✅ 이미 존재' : '❌ 없음 → 추가'}`);
  if (!hasAgentLastName) {
    try {
      await prisma.$executeRaw`ALTER TABLE "AiCallLog" ADD COLUMN IF NOT EXISTS "agentLastName" TEXT`;
      console.log('  ✅ agentLastName 추가 완료');
    } catch (e) { console.log('  ⚠️ ', e.message); }
  }

  // ── AiCallAnalysis ────────────────────────────────────────
  console.log('\n=== AiCallAnalysis ===');

  // customerSegmentDetected TEXT
  const hasCSD = await checkColumn('AiCallAnalysis', 'customerSegmentDetected');
  console.log(`customerSegmentDetected: ${hasCSD ? '✅ 이미 존재' : '❌ 없음 → 추가'}`);
  if (!hasCSD) {
    try {
      await prisma.$executeRaw`ALTER TABLE "AiCallAnalysis" ADD COLUMN IF NOT EXISTS "customerSegmentDetected" TEXT`;
      console.log('  ✅ customerSegmentDetected 추가 완료');
    } catch (e) { console.log('  ⚠️ ', e.message); }
  }

  // spinActionsPerSegment JSONB
  const hasSAPS = await checkColumn('AiCallAnalysis', 'spinActionsPerSegment');
  console.log(`spinActionsPerSegment: ${hasSAPS ? '✅ 이미 존재' : '❌ 없음 → 추가'}`);
  if (!hasSAPS) {
    try {
      await prisma.$executeRaw`ALTER TABLE "AiCallAnalysis" ADD COLUMN IF NOT EXISTS "spinActionsPerSegment" JSONB`;
      console.log('  ✅ spinActionsPerSegment 추가 완료');
    } catch (e) { console.log('  ⚠️ ', e.message); }
  }

  // relatedSuccessCases JSONB
  const hasRSC = await checkColumn('AiCallAnalysis', 'relatedSuccessCases');
  console.log(`relatedSuccessCases: ${hasRSC ? '✅ 이미 존재' : '❌ 없음 → 추가'}`);
  if (!hasRSC) {
    try {
      await prisma.$executeRaw`ALTER TABLE "AiCallAnalysis" ADD COLUMN IF NOT EXISTS "relatedSuccessCases" JSONB`;
      console.log('  ✅ relatedSuccessCases 추가 완료');
    } catch (e) { console.log('  ⚠️ ', e.message); }
  }

  // ── 최종 검증 ─────────────────────────────────────────────
  console.log('\n=== 최종 검증 ===');
  const checks = [
    ['AiCallLog', 'driveFileId'],
    ['AiCallLog', 'agentLastName'],
    ['AiCallAnalysis', 'customerSegmentDetected'],
    ['AiCallAnalysis', 'spinActionsPerSegment'],
    ['AiCallAnalysis', 'relatedSuccessCases'],
  ];
  for (const [table, col] of checks) {
    const ok = await checkColumn(table, col);
    console.log(`${table}.${col}: ${ok ? '✅' : '❌ 실패'}`);
  }

  await prisma.$disconnect();
  console.log('\n완료.');
}

run().catch(async e => {
  console.error('❌ 오류:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
