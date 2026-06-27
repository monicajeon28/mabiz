/**
 * BotConversation 핫DB 컬럼 추가 (2026-06-28, 봇 업그레이드 Phase D)
 *   source TEXT DEFAULT 'chat' — 출처(chat | button_gate)
 *   qualifiers JSONB — 자격검증 {when,who} (버튼 플로우 BANT)
 *   objectionTags JSONB — 누적 반론 태그(판매원 공략 설계도)
 *   버튼 A/B 플로우 신청 → BotConversation(intentScore=heat + 위 컬럼) 생성 → 기존
 *   notifyAgentHotLead·/api/bot/leads heat정렬 대시보드 합류 = "핫 DB".
 *   멱등(ADD COLUMN IF NOT EXISTS). unique 제약 없음(chat 다중대화 보존). 운영 적용:
 *     node --env-file=.env.local scripts/apply-botconversation-hotdb.mjs
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
  console.log('DB 연결 중...\n=== BotConversation 핫DB 컬럼 ===');

  const cols = [
    { name: 'source', ddl: `ALTER TABLE "BotConversation" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'chat'` },
    { name: 'qualifiers', ddl: `ALTER TABLE "BotConversation" ADD COLUMN IF NOT EXISTS "qualifiers" JSONB` },
    { name: 'objectionTags', ddl: `ALTER TABLE "BotConversation" ADD COLUMN IF NOT EXISTS "objectionTags" JSONB` },
  ];

  for (const c of cols) {
    const has = await checkColumn('BotConversation', c.name);
    console.log(`${c.name}: ${has ? '✅ 이미 존재' : '❌ 없음 → 추가'}`);
    if (!has) {
      await prisma.$executeRawUnsafe(c.ddl);
      console.log(`  ✅ ${c.name} 추가 완료`);
    }
  }

  console.log('\n=== 최종 검증 ===');
  for (const c of cols) {
    const ok = await checkColumn('BotConversation', c.name);
    console.log(`BotConversation.${c.name}: ${ok ? '✅' : '❌ 실패'}`);
  }

  await prisma.$disconnect();
  console.log('\n완료.');
}

run().catch(async (e) => {
  console.error('❌ 오류:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
