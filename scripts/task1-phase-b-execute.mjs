import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function phaseB() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('무한루프 Step 5 Phase B: SCRIPT 1/2/3 순차 실행');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  try {
    // ===== SCRIPT 1 실행 =====
    console.log('📝 SCRIPT 1: 고아 Contact 정정...');
    const result1 = await prisma.$executeRaw`
      UPDATE "Contact" c
      SET "userId" = NULL, "updatedAt" = NOW()
      WHERE c."userId" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = c."userId")
    `;
    console.log(`   → ${result1}행 업데이트\n`);
    
    // ===== 분석쿼리 1 검증 =====
    console.log('🔍 분석쿼리 1: 고아 Contact 개수 (정정 후)...');
    const analysis1 = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM "Contact" c
      WHERE c."userId" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = c."userId")
    `;
    const orphaned_after = Number(analysis1[0].count);
    console.log(`   → ${orphaned_after}개 (기대값: 0) ${orphaned_after === 0 ? '✅' : '❌'}\n`);
    
    // ===== SCRIPT 2 실행 =====
    console.log('📝 SCRIPT 2: 중복 Contact 정정 + CallLog 재지정...');
    
    // 단계 1: 중복 Contact 소프트 삭제
    const result2a = await prisma.$executeRaw`
      WITH duplicate_groups AS (
        SELECT
          phone, "organizationId",
          ARRAY_AGG(id ORDER BY "createdAt") as ids,
          (ARRAY_AGG(id ORDER BY "createdAt" DESC))[1] as latest_id
        FROM "Contact"
        WHERE "deletedAt" IS NULL
        GROUP BY phone, "organizationId"
        HAVING COUNT(*) > 1
      ),
      old_contacts AS (
        SELECT unnest(ids[1:array_length(ids, 1) - 1]) as id
        FROM duplicate_groups
      )
      UPDATE "Contact" c
      SET "deletedAt" = NOW(), "updatedAt" = NOW()
      FROM old_contacts
      WHERE c.id = old_contacts.id
    `;
    console.log(`   → 단계 1: ${result2a}행 소프트 삭제`);
    
    // 단계 2: CallLog 재지정
    const result2b = await prisma.$executeRaw`
      WITH duplicate_groups AS (
        SELECT
          phone, "organizationId",
          ARRAY_AGG(id ORDER BY "createdAt") as ids,
          (ARRAY_AGG(id ORDER BY "createdAt" DESC))[1] as latest_id
        FROM "Contact"
        WHERE "deletedAt" IS NULL
        GROUP BY phone, "organizationId"
        HAVING COUNT(*) > 1
      ),
      old_contact_ids AS (
        SELECT unnest(ids[1:array_length(ids, 1) - 1]) as old_id, latest_id
        FROM duplicate_groups
      )
      UPDATE "CallLog" cl
      SET "contactId" = old_contact_ids.latest_id
      FROM old_contact_ids
      WHERE cl."contactId" = old_contact_ids.old_id
    `;
    console.log(`   → 단계 2: ${result2b}행 CallLog 재지정\n`);
    
    // ===== 분석쿼리 2 검증 =====
    console.log('🔍 분석쿼리 2: 중복 Contact 개수 (정정 후)...');
    const analysis2 = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM (
        SELECT phone, "organizationId"
        FROM "Contact"
        WHERE "deletedAt" IS NULL
        GROUP BY phone, "organizationId"
        HAVING COUNT(*) > 1
      ) t
    `;
    const duplicates_after = Number(analysis2[0].count);
    console.log(`   → ${duplicates_after}개 (기대값: 0) ${duplicates_after === 0 ? '✅' : '❌'}\n`);
    
    // ===== SCRIPT 3 실행 =====
    console.log('📝 SCRIPT 3: 다중 userId 표준화...');
    const result3 = await prisma.$executeRaw`
      WITH multi_user_contacts AS (
        SELECT
          c.id,
          c.phone,
          c."userId",
          c."createdAt",
          (
            SELECT u.id
            FROM "User" u
            WHERE u.id IN (
              SELECT DISTINCT "userId"
              FROM "Contact"
              WHERE "deletedAt" IS NULL
                AND "userId" IS NOT NULL
                AND phone = c.phone
            )
            ORDER BY ABS(EXTRACT(EPOCH FROM (u."createdAt" - c."createdAt"))) ASC
            LIMIT 1
          ) as closest_userId
        FROM "Contact" c
        WHERE "deletedAt" IS NULL
          AND "userId" IS NOT NULL
      ),
      multi_user_groups AS (
        SELECT phone
        FROM multi_user_contacts
        GROUP BY phone
        HAVING COUNT(DISTINCT "userId") > 1
      )
      UPDATE "Contact" c
      SET "userId" = m.closest_userId, "updatedAt" = NOW()
      FROM multi_user_contacts m
      WHERE c.id = m.id
        AND c.phone IN (SELECT phone FROM multi_user_groups)
        AND c."userId" != m.closest_userId
    `;
    console.log(`   → ${result3}행 userId 표준화\n`);
    
    // ===== 분석쿼리 6 검증 =====
    console.log('🔍 분석쿼리 6: 다중 userId Contact 개수 (정정 후)...');
    const analysis6 = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM (
        SELECT phone, "organizationId"
        FROM "Contact"
        WHERE "deletedAt" IS NULL AND "userId" IS NOT NULL
        GROUP BY phone, "organizationId"
        HAVING COUNT(DISTINCT "userId") > 1
      ) t
    `;
    const inconsistent_after = Number(analysis6[0].count);
    console.log(`   → ${inconsistent_after}개 (기대값: 0) ${inconsistent_after === 0 ? '✅' : '❌'}\n`);
    
    // ===== Final 검증 =====
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎯 Final 검증: FK 무결성 확인');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const finalCheck = await prisma.$queryRaw`
      SELECT COUNT(*) as invalid_fk
      FROM "Contact" c
      WHERE c."userId" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = c."userId")
    `;
    const invalid_fk = Number(finalCheck[0].count);
    console.log(`FK 무결성 검증: ${invalid_fk}개 (기대값: 0) ${invalid_fk === 0 ? '✅' : '❌'}\n`);
    
    // ===== 요약 =====
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Phase B 완료!\n');
    console.log('결과 요약:');
    console.log(`  - SCRIPT 1 (고아 정정): ${result1}행`);
    console.log(`  - SCRIPT 2 (중복 정정): ${result2a}행 삭제 + ${result2b}행 CallLog 재지정`);
    console.log(`  - SCRIPT 3 (userId 표준화): ${result3}행`);
    console.log(`  - 최종 FK 무결성: ${invalid_fk}개 오류`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

phaseB();
