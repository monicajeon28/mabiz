const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function auditProductData() {
  try {
    console.log('\n========== PRODUCT DATA AUDIT REPORT ==========\n');

    // 1. CruiseProduct 데이터 완전성
    console.log('1. CruiseProduct 데이터 완전성:');
    const products = await prisma.cruiseProduct.findMany({
      take: 25,
      orderBy: { createdAt: 'desc' },
    });

    console.log(`   총 상품 수: ${products.length}`);
    const activeProducts = products.filter((p) => p.isActive).length;
    console.log(`   활성 상품: ${activeProducts}`);

    const missingBasePrice = products.filter((p) => !p.basePrice).length;
    const missingDesc = products.filter((p) => !p.description).length;
    const missingSaleStatus = products.filter((p) => !p.saleStatus).length;

    console.log(`   basePrice 누락: ${missingBasePrice}`);
    console.log(`   description 누락: ${missingDesc}`);
    console.log(`   saleStatus 누락: ${missingSaleStatus}`);

    console.log('\n   샘플 상품 (최근 5개):');
    products.slice(0, 5).forEach((p) => {
      console.log(`   - ${p.packageName}: ${p.basePrice}원 (상태: ${p.saleStatus}, 활성: ${p.isActive})`);
    });

    // 2. ProductPricePeriod 검사
    console.log('\n2. ProductPricePeriod (가격 기간) 검사:');
    const pricePeriods = await prisma.productPricePeriod.findMany({
      take: 10,
      orderBy: { startDate: 'desc' },
      include: {
        productCabinPrices: true,
      },
    });

    console.log(`   총 가격 기간: ${pricePeriods.length}`);

    const invalidPeriods = pricePeriods.filter((p) => p.startDate >= p.endDate).length;
    console.log(`   유효하지 않은 기간 (시작 >= 종료): ${invalidPeriods}`);

    const inactivePeriods = pricePeriods.filter((p) => !p.isActive).length;
    console.log(`   비활성 기간: ${inactivePeriods}`);

    console.log('\n   샘플 가격 기간 (최근 5개):');
    pricePeriods.slice(0, 5).forEach((p) => {
      console.log(`   - ${p.name}: ${p.startDate.toISOString().split('T')[0]} ~ ${p.endDate.toISOString().split('T')[0]} (활성: ${p.isActive}, 객실가격: ${p.productCabinPrices.length}개)`);
    });

    // 3. ProductCabinPrice 검사
    console.log('\n3. ProductCabinPrice (객실 가격) 검사:');
    const cabinPrices = await prisma.productCabinPrice.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    console.log(`   총 객실 가격 항목: ${cabinPrices.length}`);

    const invalidPricing = cabinPrices.filter((cp) => cp.costAmount > cp.saleAmount).length;
    console.log(`   원가 > 판매가 (잘못된 가격): ${invalidPricing}`);

    console.log('\n   가격 범위:');
    const minPrice = Math.min(...cabinPrices.map((cp) => cp.saleAmount));
    const maxPrice = Math.max(...cabinPrices.map((cp) => cp.saleAmount));
    console.log(`   최저 판매가: ${minPrice}원`);
    console.log(`   최고 판매가: ${maxPrice}원`);

    const cabinTypes = [...new Set(cabinPrices.map((cp) => cp.cabinType))];
    console.log(`   객실 타입: ${cabinTypes.join(', ')}`);

    // 4. Contact-Product 연동 확인
    console.log('\n4. Contact-Product 연동 상태:');
    const contacts = await prisma.contact.findMany({
      where: { organizationId: { not: null } },
      take: 20,
      select: {
        id: true,
        phone: true,
        name: true,
        productName: true,
        departureDate: true,
        cruiseInterest: true,
        lensMetadata: true,
      },
    });

    console.log(`   총 Contact 수: ${contacts.length}`);

    const withProduct = contacts.filter((c) => c.productName).length;
    const withDepartureDate = contacts.filter((c) => c.departureDate).length;
    const withInterest = contacts.filter((c) => c.cruiseInterest).length;

    console.log(`   상품 할당됨: ${withProduct}/${contacts.length}`);
    console.log(`   출발일 있음: ${withDepartureDate}/${contacts.length}`);
    console.log(`   크루즈 관심사 있음: ${withInterest}/${contacts.length}`);

    console.log('\n   샘플 Contact (최근 5개):');
    contacts.slice(0, 5).forEach((c) => {
      const metadata = c.lensMetadata ? JSON.stringify(c.lensMetadata) : 'null';
      console.log(`   - ${c.name} (${c.phone}): 상품=${c.productName}, 출발=${c.departureDate?.toISOString().split('T')[0] || 'null'}`);
    });

    // 5. 상품별 Contact 분배
    console.log('\n5. 상품별 Contact 분배:');
    const contactsByProduct = await prisma.contact.groupBy({
      by: ['productName'],
      where: { organizationId: { not: null } },
      _count: { id: true },
    });

    console.log(`   할당된 상품 종류: ${contactsByProduct.length}`);
    contactsByProduct.forEach((c) => {
      console.log(`   - ${c.productName || 'NULL'}: ${c._count.id}명`);
    });

    // 6. Product Image 상태
    console.log('\n6. Product Image 상태:');
    const productsWithImages = await prisma.cruiseProduct.findMany({
      where: { isActive: true },
      take: 10,
      include: {
        _count: {
          select: { images: true },
        },
      },
    });

    const withImages = productsWithImages.filter((p) => p._count?.images > 0).length;
    console.log(`   이미지 있는 상품: ${withImages}/${productsWithImages.length}`);

    // 7. SMS 자동화 준비 상태
    console.log('\n7. SMS 자동화 준비 상태:');
    const smsStatus = await prisma.contact.groupBy({
      by: [],
      where: { organizationId: { not: null } },
      _count: { id: true },
      _sum: {
        smsDay0Sent: true,
        smsDay1Sent: true,
        smsDay2Sent: true,
        smsDay3Sent: true,
      },
    });

    if (smsStatus.length > 0) {
      const totals = smsStatus[0];
      console.log(`   Day 0 발송됨: ${totals._sum?.smsDay0Sent || 0}/${totals._count.id}`);
      console.log(`   Day 1 발송됨: ${totals._sum?.smsDay1Sent || 0}/${totals._count.id}`);
      console.log(`   Day 2 발송됨: ${totals._sum?.smsDay2Sent || 0}/${totals._count.id}`);
      console.log(`   Day 3 발송됨: ${totals._sum?.smsDay3Sent || 0}/${totals._count.id}`);
    }

    // 8. Contact 메타데이터 품질
    console.log('\n8. Contact 메타데이터 품질:');
    const contactsWithMetadata = await prisma.contact.findMany({
      where: {
        organizationId: { not: null },
        lensMetadata: { not: null },
      },
      take: 10,
      select: { id: true, lensMetadata: true },
    });

    console.log(`   메타데이터 있는 Contact: ${contactsWithMetadata.length}`);

    // 9. Price 정책 활성화 상태
    console.log('\n9. 가격 정책 활성화 상태:');
    const activePolicies = await prisma.productPricePeriod.groupBy({
      by: ['isActive'],
      _count: { id: true },
    });

    activePolicies.forEach((p) => {
      console.log(`   활성=${p.isActive}: ${p._count.id}개`);
    });

    console.log('\n========== ISSUES & RECOMMENDATIONS ==========\n');

    const issues = [];

    if (missingBasePrice > 0) {
      issues.push(`⚠️ ${missingBasePrice}개 상품에 basePrice 누락`);
    }
    if (missingDesc > 0) {
      issues.push(`⚠️ ${missingDesc}개 상품에 description 누락`);
    }
    if (invalidPricing > 0) {
      issues.push(`⚠️ ${invalidPricing}개 객실 가격 항목에서 원가 > 판매가 오류`);
    }
    if (invalidPeriods > 0) {
      issues.push(`⚠️ ${invalidPeriods}개 가격 기간에서 시작일 >= 종료일 오류`);
    }
    if (withProduct < contacts.length * 0.8) {
      issues.push(`⚠️ Contact 중 ${((1 - withProduct / contacts.length) * 100).toFixed(0)}%가 상품 미할당`);
    }
    if (withImages < productsWithImages.length * 0.5) {
      issues.push(`⚠️ 상품 중 ${((1 - withImages / productsWithImages.length) * 100).toFixed(0)}%가 이미지 없음`);
    }

    if (issues.length === 0) {
      console.log('✅ 주요 문제점 없음');
    } else {
      issues.forEach((issue) => console.log(issue));
    }

    console.log('\n========== RECOMMENDATIONS ==========\n');

    const recommendations = [
      '1. Contact productName을 실제 CruiseProduct.packageName으로 정규화',
      '2. Day 0-3 SMS 발송 현황을 대시보드에 표시',
      '3. ProductCabinPrice 가격 순서 검증 로직 추가 (Interior < OceanView < Balcony < Suite)',
      '4. 모든 상품에 대한 고품질 이미지 추가 (최소 3장)',
      '5. Contact.lensMetadata에 productId 정규화 및 자동 업데이트',
      '6. ProductPricePeriod 유효성 검사 (startDate < endDate)',
      '7. SMS 자동화 일정 설정 및 추적 체계 구축',
      '8. Contact.departureDa te를 필수 필드로 설정',
    ];

    recommendations.forEach((rec) => console.log(rec));

    console.log('\n=========================================\n');
  } catch (error) {
    console.error('Audit Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

auditProductData();
