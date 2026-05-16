/**
 * 여권 관리 테스트용 구매 고객 데이터 생성 스크립트
 * 실행: set -a && source .env.local && npx tsx scripts/seed-test-buyer.ts
 */

import prisma from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone-normalize';

const TEST_EMAIL = 'test@example.com';
const TEST_PHONE = '01012345678';
const TEST_PRODUCT_CODE = 'TEST001';

async function seedTestBuyer() {
  try {
    console.log('🌱 테스트 구매 고객 생성 시작...\n');

    // 1. GmUser 생성 또는 조회
    const gmUser = await prisma.gmUser.upsert({
      where: { email: TEST_EMAIL },
      create: {
        phone: normalizePhone(TEST_PHONE),
        name: '테스트고객',
        email: TEST_EMAIL,
        role: 'user',
        password: 'test-password-hash',
        grade: 'REGULAR',
      },
      update: {
        phone: normalizePhone(TEST_PHONE),
        name: '테스트고객',
      },
    });
    console.log(`✅ GmUser 생성/조회: ID ${gmUser.id} (${gmUser.name})`);

    // 2. GmTrip 생성 또는 조회
    const departureDate = new Date('2026-08-15');
    const existingTrip = await prisma.gmTrip.findFirst({
      where: {
        userId: gmUser.id,
        productCode: TEST_PRODUCT_CODE,
      },
    });

    let gmTrip = existingTrip;
    if (!gmTrip) {
      gmTrip = await prisma.gmTrip.create({
        data: {
          userId: gmUser.id,
          productCode: TEST_PRODUCT_CODE,
          cruiseName: '지중해 7박 MSC 크루즈 (테스트)',
          shipName: 'MSC Seaview',
          departureDate,
          startDate: departureDate,
          status: 'Upcoming',
          nights: 7,
          days: 8,
          updatedAt: new Date(),
        },
      });
      console.log(`✅ GmTrip 생성: ID ${gmTrip.id} (${gmTrip.productCode})`);
    } else {
      console.log(`ℹ️  GmTrip 이미 존재: ID ${gmTrip.id}`);
    }

    // 3. GmReservation 생성
    const existingReservation = await prisma.gmReservation.findFirst({
      where: {
        tripId: gmTrip.id,
        mainUserId: gmUser.id,
      },
    });

    if (existingReservation) {
      console.log(`ℹ️  GmReservation 이미 존재: ID ${existingReservation.id}`);
    } else {
      const gmReservation = await prisma.gmReservation.create({
        data: {
          tripId: gmTrip.id,
          mainUserId: gmUser.id,
          totalPeople: 2,
          paymentAmount: 5000000,
          paymentDate: new Date(),
          status: 'CONFIRMED',
        },
      });
      console.log(`✅ GmReservation 생성: ID ${gmReservation.id}`);
    }

    // 4. 상태 확인
    const tripCount = await prisma.gmTrip.count({
      where: { userId: gmUser.id },
    });
    const reservationCount = await prisma.gmReservation.count({
      where: { mainUserId: gmUser.id, status: 'CONFIRMED' },
    });

    console.log(`\n📊 최종 상태:`);
    console.log(`   • GmUser ID: ${gmUser.id}`);
    console.log(`   • 전화번호: ${gmUser.phone}`);
    console.log(`   • Trip 수: ${tripCount}개`);
    console.log(`   • Reservation (CONFIRMED): ${reservationCount}개`);
    console.log(`\n✨ 성공! 여권 관리 페이지에서 "${gmUser.name}" 고객이 표시됩니다.`);
    console.log(`   검색: 전화번호 "${gmUser.phone}" 또는 이름 "${gmUser.name}"`);
  } catch (error) {
    console.error('❌ 에러:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedTestBuyer();
