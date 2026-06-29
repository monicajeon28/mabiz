/**
 * 부산 왕복(130만원대) 상품의 저장된 refundPolicy 실측 — 증서 환불규정 자동연결 진단(#14).
 * 실행: node --env-file=.env.local scripts/check-refund-policy.mjs
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function run() {
  const rows = await prisma.$queryRaw`
    SELECT "productCode", "packageName", "basePrice", "salePrice", "refundPolicy"
    FROM "CruiseProduct"
    WHERE "packageName" ILIKE '%부산%' OR "basePrice" BETWEEN 1200000 AND 1400000
    ORDER BY "updatedAt" DESC NULLS LAST
    LIMIT 10`;
  console.log(`매칭 상품 ${rows.length}건\n`);
  for (const r of rows) {
    console.log('────────────────────────────────────');
    console.log(`productCode: ${r.productCode}`);
    console.log(`packageName: ${r.packageName}`);
    console.log(`base/sale:   ${r.basePrice} / ${r.salePrice}`);
    console.log(`refundPolicy: ${JSON.stringify(r.refundPolicy)}`);
  }
  await prisma.$disconnect();
}
run().catch(async (e) => { console.error('❌', e.message); await prisma.$disconnect(); process.exit(1); });
