import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

try {
  const products = await prisma.cruiseProduct.findMany({
    where: { isActive: true },
    select: { 
      id: true, 
      productCode: true, 
      packageName: true, 
      refundPolicy: true 
    },
    take: 10,
  });
  
  console.log(`\n총 활성 상품 중 10개 샘플:\n`);
  let nullCount = 0;
  products.forEach((p, i) => {
    console.log(`[${i+1}] ${p.packageName}`);
    if (p.refundPolicy) {
      try {
        const policy = JSON.parse(String(p.refundPolicy));
        console.log(`    ✅ 환불정책 있음 (${policy.slots?.length || 0}개 구간)`);
      } catch(e) {
        console.log(`    ⚠️  파싱 실패`);
      }
    } else {
      console.log(`    ❌ NULL`);
      nullCount++;
    }
  });
  
  console.log(`\n결과: ${nullCount}/10 상품에 환불정책 없음`);
  
} catch(e) {
  console.error('에러:', e.message);
} finally {
  await prisma.$disconnect();
}
