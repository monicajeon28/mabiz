import prisma from '@/lib/prisma';

async function main() {
  try {
    console.log('🔍 데이터베이스 검증 시작...\n');

    // Test 1: Check GmUser 12 exists
    const user = await prisma.gmUser.findUnique({ where: { id: 12 } });
    console.log('✓ GmUser 12:', user ? `${user.name} (${user.phone})` : 'NOT FOUND');

    // Test 2: Check GmTrip 2 exists
    const trip = await prisma.gmTrip.findUnique({ where: { id: 2 } });
    console.log('✓ GmTrip 2:', trip ? `${trip.shipName} (productCode: ${trip.productCode})` : 'NOT FOUND');

    // Test 3: Check GmReservation 2 exists
    const reservation = await prisma.gmReservation.findUnique({ where: { id: 2 } });
    console.log('✓ GmReservation 2:', reservation ? `status: ${reservation.status}, amount: ${reservation.paymentAmount}, mainUserId: ${reservation.mainUserId}` : 'NOT FOUND');

    console.log('\n🔍 Prisma 모델로 구매 고객 검색...\n');

    // Test 4: Run the WHERE condition using Prisma findMany
    const buyerUsers = await prisma.gmUser.findMany({
      where: {
        role: { not: 'admin' },
        reservations: {
          some: {
            status: 'CONFIRMED',
            paymentAmount: { gt: 0 }
          }
        }
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        reservations: {
          where: {
            status: 'CONFIRMED',
            paymentAmount: { gt: 0 }
          },
          select: {
            id: true,
            status: true,
            paymentAmount: true
          }
        }
      },
      take: 10
    });

    console.log(`✓ 구매 고객 검색 결과: ${buyerUsers.length}명`);
    buyerUsers.forEach(u => {
      console.log(`  - ${u.name} (ID: ${u.id}, role: ${u.role})`);
      console.log(`    예약: ${u.reservations.length}건`);
    });

  } catch (error) {
    console.error('❌ 오류:', error instanceof Error ? error.message : String(error));
  } finally {
    await prisma.$disconnect();
  }
}

main();
