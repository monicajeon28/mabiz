/**
 * 누락된 스키마 변경사항 직접 적용 스크립트 (Prisma $executeRaw 사용)
 * node --env-file=.env.local scripts/apply-missing-schema.mjs
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function run() {
  console.log('DB 연결 중...');

  // 1. CommissionLedger.organizationId 존재 여부 확인
  const orgIdCheck = await prisma.$queryRaw`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'CommissionLedger' AND column_name = 'organizationId'
  `;
  console.log(`\nCommissionLedger.organizationId: ${orgIdCheck.length > 0 ? '✅ 이미 존재' : '❌ 없음 → 추가 필요'}`);

  if (orgIdCheck.length === 0) {
    console.log('  → organizationId 컬럼 추가 중...');
    try {
      await prisma.$executeRaw`ALTER TABLE "CommissionLedger" ADD COLUMN "organizationId" TEXT`;
      console.log('  ✅ 컬럼 추가 완료');

      // 기존 데이터 채우기
      await prisma.$executeRaw`
        UPDATE "CommissionLedger" cl
        SET "organizationId" = (
          SELECT af."organizationId" FROM "CrmAffiliateSale" af
          WHERE af.id = cl."saleId"::text LIMIT 1
        )
        WHERE cl."saleId" IS NOT NULL AND cl."organizationId" IS NULL
      `;

      const defaultOrg = await prisma.$queryRaw`
        SELECT id FROM "Organization" ORDER BY "createdAt" LIMIT 1
      `;
      if (defaultOrg.length > 0) {
        const orgId = defaultOrg[0].id;
        await prisma.$executeRaw`
          UPDATE "CommissionLedger" SET "organizationId" = ${orgId} WHERE "organizationId" IS NULL
        `;
        console.log(`  ✅ 기존 데이터 채움 (기본 org: ${orgId})`);
      }
    } catch (e) {
      console.log('  ⚠️ ', e.message);
    }
  }

  // 2. CommissionLedger.saleId nullable
  console.log('\nCommissionLedger.saleId nullable 확인...');
  try {
    const nullableCheck = await prisma.$queryRaw`
      SELECT is_nullable FROM information_schema.columns
      WHERE table_name = 'CommissionLedger' AND column_name = 'saleId'
    `;
    if (nullableCheck[0]?.is_nullable === 'YES') {
      console.log('  ✅ 이미 nullable');
    } else {
      await prisma.$executeRaw`ALTER TABLE "CommissionLedger" ALTER COLUMN "saleId" DROP NOT NULL`;
      await prisma.$executeRaw`ALTER TABLE "CommissionLedger" ALTER COLUMN "saleId" TYPE TEXT USING "saleId"::text`;
      console.log('  ✅ nullable + TEXT로 변경 완료');
    }
  } catch (e) {
    console.log('  ⚠️ ', e.message);
  }

  // 3. CommissionLedger 인덱스
  console.log('\nCommissionLedger 인덱스 추가...');
  try {
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "idx_commission_org_settled_date"
      ON "CommissionLedger"("organizationId", "isSettled", "createdAt" DESC)
    `;
    console.log('  ✅ 인덱스 완료');
  } catch (e) { console.log('  ⚠️ ', e.message); }

  // 4. AffiliatePayslip 테이블
  console.log('\nAffiliatePayslip 테이블 확인...');
  const tableCheck = await prisma.$queryRaw`
    SELECT table_name FROM information_schema.tables WHERE table_name = 'AffiliatePayslip'
  `;
  if (tableCheck.length > 0) {
    console.log('  ✅ 이미 존재');
  } else {
    console.log('  → 테이블 생성 중...');
    try {
      await prisma.$executeRaw`
        CREATE TABLE "AffiliatePayslip" (
          "id"               SERIAL PRIMARY KEY,
          "agentId"          INTEGER NOT NULL,
          "yearMonth"        TEXT NOT NULL,
          "baseCommission"   BIGINT NOT NULL,
          "bonus"            BIGINT,
          "deduction"        BIGINT,
          "netAmount"        BIGINT NOT NULL,
          "status"           TEXT NOT NULL DEFAULT 'PENDING',
          "paidAt"           TIMESTAMPTZ,
          "note"             TEXT,
          "agentDisplayName" TEXT,
          "agentMallUserId"  TEXT,
          "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE("agentId", "yearMonth")
        )
      `;
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "AffiliatePayslip_agentId_idx" ON "AffiliatePayslip"("agentId")`;
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "AffiliatePayslip_yearMonth_idx" ON "AffiliatePayslip"("yearMonth")`;
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "AffiliatePayslip_status_idx" ON "AffiliatePayslip"("status")`;
      console.log('  ✅ 테이블 + 인덱스 생성 완료');
    } catch (e) { console.error('  ❌', e.message); }
  }

  // 최종 검증
  console.log('\n=== 최종 검증 ===');
  const v1 = await prisma.$queryRaw`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'CommissionLedger' AND column_name = 'organizationId'
  `;
  console.log(`CommissionLedger.organizationId: ${v1.length > 0 ? '✅' : '❌'}`);

  const v2 = await prisma.$queryRaw`
    SELECT table_name FROM information_schema.tables WHERE table_name = 'AffiliatePayslip'
  `;
  console.log(`AffiliatePayslip 테이블: ${v2.length > 0 ? '✅' : '❌'}`);

  const v3 = await prisma.$queryRaw`
    SELECT is_nullable FROM information_schema.columns
    WHERE table_name = 'CommissionLedger' AND column_name = 'saleId'
  `;
  console.log(`CommissionLedger.saleId nullable: ${v3[0]?.is_nullable === 'YES' ? '✅' : '❌ ' + v3[0]?.is_nullable}`);

  await prisma.$disconnect();
  console.log('\n완료.');
}

run().catch(async e => {
  console.error('❌ 오류:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
