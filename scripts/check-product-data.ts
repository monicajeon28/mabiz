import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkProductData() {
  try {
    console.log('\n========== PRODUCT DATA AUDIT ==========\n');

    // 1. CruiseProduct 통계
    const productStats = await prisma.cruiseProduct.aggregate({
      _count: { id: true },
      _min: { basePrice: true },
      _max: { basePrice: true },
      where: { isActive: true },
    });

    console.log('1. CruiseProduct 통계:');
    console.log(`   활성 상품: ${productStats._count.id}개`);
    console.log(
      `   가격 범위: ${productStats._min.basePrice || 0}원 ~ ${productStats._max.basePrice || 0}원`
    );

    // 2. ProductPricePeriod 통계
    const periods = await prisma.productPricePeriod.findMany({
      take: 5,
      orderBy: { startDate: 'desc' },
    });

    console.log('\n2. ProductPricePeriod (최근 5개):');
    periods.forEach((p) => {
      const isValid = p.startDate < p.endDate ? '✓' : '✗';
      console.log(
        `   ${isValid} ${p.name}: ${p.startDate.toISOString().split('T')[0]} ~ ${p.endDate.toISOString().split('T')[0]} (활성: ${p.isActive})`
      );
    });

    // 3. ProductCabinPrice 샘플
    const cabinPrices = await prisma.productCabinPrice.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    console.log(`\n3. ProductCabinPrice (샘플 ${cabinPrices.length}개):`);
    const invalidPrices = cabinPrices.filter((cp) => cp.costAmount > cp.saleAmount);
    console.log(`   정상 가격: ${cabinPrices.length - invalidPrices.length}개`);
    console.log(`   오류 가격 (원가 > 판매가): ${invalidPrices.length}개`);

    if (invalidPrices.length > 0) {
      console.log('   문제 항목:');
      invalidPrices.forEach((cp) => {
        console.log(`   - ID ${cp.id}: ${cp.cabinType} (원가: ${cp.costAmount}, 판매가: ${cp.saleAmount})`);
      });
    }

    // 4. Contact-Product 연동 현황
    const contactStats = await prisma.contact.groupBy({
      by: ['productName'],
      where: { organizationId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    console.log('\n4. Contact-Product 분배 (상위 10개):');
    contactStats.forEach((stat) => {
      console.log(`   ${stat.productName || '(미지정)'}: ${stat._count.id}명`);
    });

    // 5. Contact SMS 상태
    const smsCounts = await prisma.contact.aggregate({
      _count: { id: true },
      where: { organizationId: { not: null } },
    });

    const day0Count = await prisma.contact.count({
      where: { organizationId: { not: null }, smsDay0Sent: true },
    });
    const day1Count = await prisma.contact.count({
      where: { organizationId: { not: null }, smsDay1Sent: true },
    });

    console.log('\n5. SMS 발송 현황:');
    console.log(`   총 Contact: ${smsCounts._count.id}명`);
    console.log(`   Day 0 발송: ${day0Count}명 (${((day0Count / smsCounts._count.id) * 100).toFixed(1)}%)`);
    console.log(`   Day 1 발송: ${day1Count}명 (${((day1Count / smsCounts._count.id) * 100).toFixed(1)}%)`);

    // 6. Contact 메타데이터 품질
    const contactSample = await prisma.contact.findMany({
      where: { organizationId: { not: null }, productName: { not: null } },
      take: 5,
      select: {
        id: true,
        name: true,
        phone: true,
        productName: true,
        departureDate: true,
        lensMetadata: true,
      },
    });

    console.log('\n6. Contact 샘플 (상품 할당됨):');
    contactSample.forEach((c) => {
      const hasProductId = c.lensMetadata && typeof c.lensMetadata === 'object'
        ? 'productId' in c.lensMetadata
        : false;
      console.log(`   - ${c.name}: 상품=${c.productName}, 출발=${c.departureDate?.toISOString().split('T')[0] || 'null'}, 메타[productId]=${hasProductId}`);
    });

    console.log('\n========== END AUDIT ==========\n');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProductData();
