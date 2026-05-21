import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function validateBefore() {
  console.log('=== Step 5 Phase A: Before 데이터 수집 ===\n');
  
  try {
    const orphaned = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM "Contact" c
      WHERE c."userId" IS NOT NULL
        AND c."deletedAt" IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM "GoldMember" gm WHERE gm."userId" = c."userId"
        )
    `;
    console.log('✅ Query 1-1. 고아 Contact 개수:', Number(orphaned[0].count));
    
    const duplicates = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM (
        SELECT phone, "organizationId"
        FROM "Contact"
        WHERE "deletedAt" IS NULL
        GROUP BY phone, "organizationId"
        HAVING COUNT(*) > 1
      ) t
    `;
    console.log('✅ Query 1-2. 중복 Contact 개수:', Number(duplicates[0].count));
    
    const calllogAffected = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM "CallLog" cl
      WHERE EXISTS (
        SELECT 1 FROM "Contact" c
        WHERE c.id = cl."contactId"
          AND c."deletedAt" IS NULL
          AND EXISTS (
            SELECT 1 FROM (
              SELECT phone, "organizationId"
              FROM "Contact"
              WHERE "deletedAt" IS NULL
              GROUP BY phone, "organizationId"
              HAVING COUNT(*) > 1
            ) t
            WHERE t.phone = c.phone
              AND t."organizationId" = c."organizationId"
          )
      )
    `;
    console.log('✅ Query 1-3. 중복 Contact의 CallLog 영향도:', Number(calllogAffected[0].count));
    
    const inconsistent = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM (
        SELECT phone, "organizationId"
        FROM "Contact"
        WHERE "deletedAt" IS NULL AND "userId" IS NOT NULL
        GROUP BY phone, "organizationId"
        HAVING COUNT(DISTINCT "userId") > 1
      ) t
    `;
    console.log('✅ Query 1-4. 다중 userId Contact 개수:', Number(inconsistent[0].count));
    
    const stats = await prisma.$queryRaw`
      SELECT
        COUNT(*) as total_active,
        COUNT(CASE WHEN "userId" IS NOT NULL THEN 1 END) as with_userid,
        COUNT(CASE WHEN "userId" IS NULL THEN 1 END) as without_userid,
        COUNT(DISTINCT phone) as unique_phones
      FROM "Contact"
      WHERE "deletedAt" IS NULL
    `;
    const s = stats[0];
    console.log('✅ Query 1-5. 전체 통계:');
    console.log('   - 총 활성 Contact:', Number(s.total_active));
    console.log('   - userId 있음:', Number(s.with_userid));
    console.log('   - userId 없음:', Number(s.without_userid));
    console.log('   - 고유 phone:', Number(s.unique_phones));
    
    console.log('\n🎯 Before 데이터 수집 완료!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

validateBefore();
