const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    console.log('🔍 ExecutionLog 테이블 확인...');
    
    // ExecutionLog 모델에 COUNT 쿼리
    const count = await prisma.executionLog.count();
    console.log(`✅ ExecutionLog 테이블 존재: ${count}개 레코드`);
    
    // ExecutionLog 스키마 정보
    console.log('\n✅ ExecutionLog 모델이 Prisma schema에 정의되어 있습니다.');
    
  } catch (err) {
    console.error('❌ 오류:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
