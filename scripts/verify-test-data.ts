import prisma from '@/lib/prisma';

async function main() {
  console.log('🔍 테스트 데이터 검증 시작...\n');

  try {
    // 1. 사용자 11, 12 확인
    const users = await prisma.gmUser.findMany({
      where: { id: { in: [11, 12] } },
      select: {
        id: true,
        name: true,
        phone: true,
        createdAt: true,
      },
    });

    console.log('📋 사용자:');
    users.forEach((u) => {
      console.log(`  ID ${u.id}: ${u.name} (${u.phone})`);
    });

    if (users.length === 0) {
      console.log('  ⚠️  사용자가 없습니다!\n');
      return;
    }

    // 2. 각 사용자별 Trip 확인
    console.log('\n🎫 여행 정보:');
    for (const user of users) {
      const trips = await prisma.gmTrip.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          shipName: true,
          productCode: true,
          cruiseName: true,
          startDate: true,
        },
      });

      console.log(`\n  👤 User ${user.id} (${user.name}):`);
      console.log(`    Trip: ${trips.length}개`);
      trips.forEach((t) =>
        console.log(`      - Trip ID ${t.id}: ${t.shipName} (${t.productCode}), 출발: ${t.startDate}`)
      );

      // 3. Reservation 확인
      const reservations = await prisma.gmReservation.findMany({
        where: { tripId: { in: trips.map((t) => t.id) } },
        select: {
          id: true,
          tripId: true,
          mainUserId: true,
          status: true,
          paymentAmount: true,
        },
      });

      console.log(`    Reservation: ${reservations.length}개`);
      reservations.forEach((r) =>
        console.log(`      - Res ID ${r.id}: Trip ${r.tripId}, User ${r.mainUserId}, Status ${r.status}, Amount ${r.paymentAmount}`)
      );
    }

    // 4. PassportSubmission 확인
    console.log('\n📄 PassportSubmission:');
    const submissions = await prisma.gmPassportSubmission.findMany({
      where: { userId: { in: [11, 12] } },
      select: {
        id: true,
        userId: true,
        tripId: true,
        isSubmitted: true,
        token: true,
      },
    });

    submissions.forEach((s) =>
      console.log(`  ID ${s.id}: User ${s.userId}, Trip ${s.tripId}, Submitted: ${s.isSubmitted}`)
    );

    // 5. Trip 존재 확인
    if (submissions.length > 0) {
      const tripIds = submissions.map((s) => s.tripId).filter((id): id is number => id !== null && id !== undefined);
      if (tripIds.length > 0) {
        console.log(`\n🔗 FK 검증: Trip ID ${tripIds.join(', ')} 존재 여부:`, );
        const foundTrips = await prisma.gmTrip.findMany({
          where: { id: { in: tripIds } },
          select: { id: true },
        });
        console.log(`  찾음: ${foundTrips.length}/${tripIds.length}`);
        if (foundTrips.length !== tripIds.length) {
          console.log(`  ❌ 일부 Trip ID가 없습니다!`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
  } finally {
    await prisma.$disconnect();
  }
}

main();
