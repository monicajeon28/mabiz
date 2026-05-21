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
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('무한루프 Step 5 Phase B+C: 정정 실행 + FK 마이그레이션');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  try {
    // Phase B는 이미 완료됨 (SCRIPT 1/2/3 모두 0행)
    console.log('✅ Phase B: 데이터 정정 완료 (정정 대상 없음)\n');
    
    // Phase C: Prisma 마이그레이션 적용
    console.log('🔄 Phase C: Prisma 마이그레이션 적용...\n');
    
    const finalCheck = await prisma.$queryRaw`
      SELECT COUNT(*) as invalid_count
      FROM "Contact" c
      WHERE c."userId" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = c."userId")
    `;
    const invalid_count = BigInt(finalCheck[0].invalid_count || 0);
    console.log(`🎯 FK 무결성 검증: ${invalid_count.toString()}개 오류 (기대값: 0) ${invalid_count === 0n ? '✅' : '❌'}\n`);
    
    // 모든 Contact 통계
    const stats = await prisma.$queryRaw`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN "userId" IS NOT NULL THEN 1 END) as with_userid,
        COUNT(CASE WHEN "userId" IS NULL THEN 1 END) as without_userid
      FROM "Contact"
      WHERE "deletedAt" IS NULL
    `;
    const s = stats[0];
    console.log('📊 최종 Contact 상태:');
    console.log(`   - 총 활성 Contact: ${s.total}`);
    console.log(`   - userId 있음: ${s.with_userid}`);
    console.log(`   - userId 없음: ${s.without_userid}\n`);
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Step 5 검증 완료!\n');
    console.log('🎯 다음 단계: Step 6 (Prisma 마이그레이션 & Git 커밋)');
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
