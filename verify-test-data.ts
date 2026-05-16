import prisma from '@/lib/prisma';

async function main() {
  console.log('🔍 테스트 데이터 검증 시작...\n');

  try {
    // 1. 가장 최근 사용자 확인
    const recentUsers = await prisma.gmUser.findMany({
      where: { role: { not: 'admin' } },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        name: true,
        phone: true,
        createdAt: true,
      },
    });

    console.log('📋 최근 사용자 (role != admin):');
    recentUsers.forEach((u) => {
      console.log(`  ID ${u.id}: ${u.name} (${u.phone})`);
    });

    if (recentUsers.length === 0) {
      console.log('  ⚠️  사용자가 없습니다!\n');
      return;
    }

    // 2. 각 사용자별 Trip, Reservation 확인
    console.log('\n🎫 여행 & 예약 정보:');
    for (const user of recentUsers) {
      const trips = await prisma.gmTrip.findMany({
        where: { userId: user.id },
        select: { id: true, shipName: true, productCode: true },
      });

      const reservations = await prisma.gmReservation.findMany({
        where: { mainUserId: user.id },
        select: { id: true, tripId: true, status: true, paymentAmount: true },
      });

      console.log(`\n  👤 User ${user.id} (${user.name}):`);
      console.log(`    Trip: ${trips.length}개`);
      trips.forEach((t) => console.log(`      - Trip ${t.id}: ${t.shipName} (${t.productCode})`));
      console.log(`    Reservation: ${reservations.length}개`);
      reservations.forEach((r) =>
        console.log(`      - Res ${r.id}: Trip ${r.tripId}, Status ${r.status}, Amount ${r.paymentAmount}`)
      );
    }

    // 3. 관리자 확인
    console.log('\n👨‍💼 관리자 정보:');
    const admin = await prisma.gmUser.findFirst({
      where: { role: 'GLOBAL_ADMIN' },
      select: { id: true, name: true, role: true },
    });

    if (admin) {
      console.log(`  ✓ Found: ID ${admin.id} (${admin.name})`);
    } else {
      console.log(`  ❌ No GLOBAL_ADMIN found!`);
    }

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
  } finally {
    await prisma.$disconnect();
  }
}

main();
