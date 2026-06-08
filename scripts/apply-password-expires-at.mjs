/**
 * OrganizationMember.passwordExpiresAt 컬럼 추가 스크립트
 * 실행: node --env-file=.env.local scripts/apply-password-expires-at.mjs
 * (dev 서버 실행 중 prisma db push가 EBUSY로 실패할 경우 이 스크립트로 직접 적용)
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function run() {
  console.log('DB 연결 중...');

  // 컬럼 존재 여부 확인
  const check = await prisma.$queryRaw`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'OrganizationMember' AND column_name = 'passwordExpiresAt'
  `;

  if (check.length > 0) {
    console.log('✅ OrganizationMember.passwordExpiresAt 컬럼이 이미 존재합니다.');
  } else {
    console.log('→ passwordExpiresAt 컬럼 추가 중...');
    await prisma.$executeRaw`
      ALTER TABLE "OrganizationMember"
      ADD COLUMN IF NOT EXISTS "passwordExpiresAt" TIMESTAMP WITH TIME ZONE
    `;
    console.log('✅ 컬럼 추가 완료: OrganizationMember.passwordExpiresAt');
  }

  await prisma.$disconnect();
  console.log('\n마이그레이션 완료.');
}

run().catch((err) => {
  console.error('❌ 마이그레이션 실패:', err);
  process.exit(1);
});
