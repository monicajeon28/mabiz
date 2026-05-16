/**
 * 여권 관리 테스트용 구매 고객 데이터 생성 스크립트
 * 실행: npx tsx scripts/seed-test-buyer.ts
 */

import prisma from '@/lib/prisma';

async function main() {
  console.log('🌱 테스트 구매 고객 데이터 생성 중...');

  try {
    // 1. GmUser 테스트 고객 생성
    const timestamp = Date.now();
    const user = await prisma.gmUser.create({
      data: {
        name: '테스트 구매자',
        phone: `0101111${timestamp.toString().slice(-4)}`, // 고유 전화번호
        email: `test-buyer-${timestamp}@example.com`, // 고유 이메일
        password: 'test123456', // 테스트용 비밀번호
        role: 'user',
        customerStatus: null,
        tripCount: 1,
        createdAt: new Date(),
      },
    });
    console.log(`✓ GmUser 생성: ${user.name} (ID: ${user.id})`);

    // 2. GmTrip 생성 (productCode='TEST001' 포함)
    const trip = await prisma.gmTrip.create({
      data: {
        userId: user.id,
        productCode: 'TEST001',
        shipName: '테스트크루즈',
        departureDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30일 뒤
        cruiseName: '테스트크루즈 알래스카',
        startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000),
        nights: 7,
        days: 8,
        status: 'Upcoming',
        updatedAt: new Date(),
      },
    });
    console.log(`✓ GmTrip 생성: ${trip.shipName} (ID: ${trip.id})`);

    // 3. GmReservation 생성 (status='CONFIRMED', paymentAmount > 0)
    const reservation = await prisma.gmReservation.create({
      data: {
        tripId: trip.id,
        mainUserId: user.id,
        totalPeople: 2,
        paymentDate: new Date(),
        paymentMethod: 'CREDIT_CARD',
        paymentAmount: 1000000, // 100만원
        status: 'CONFIRMED',
        passportStatus: 'PENDING',
        pnrStatus: 'PENDING',
        finalConfirmStatus: 'PENDING',
      },
    });
    console.log(`✓ GmReservation 생성: ${reservation.paymentAmount.toLocaleString()}원 (ID: ${reservation.id})`);

    console.log('\n✅ 테스트 데이터 생성 완료!');
    console.log(`\n📋 생성된 데이터:`);
    console.log(`  - 고객: ${user.name} (${user.phone})`);
    console.log(`  - 여행: ${trip.shipName} (${trip.productCode})`);
    console.log(`  - 예약: ${reservation.paymentAmount.toLocaleString()}원 (CONFIRMED)`);
    console.log(`\n🧪 여권 관리 페이지에서 확인할 수 있습니다.`);
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
