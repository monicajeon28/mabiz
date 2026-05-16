const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser11Trips() {
  try {
    // User 11 조회
    const user11 = await prisma.gmUser.findUnique({
      where: { id: 11 },
      include: { trips: { orderBy: { createdAt: 'desc' } } }
    });
    
    console.log('\n=== User 11 정보 ===');
    console.log(`ID: ${user11?.id}`);
    console.log(`Name: ${user11?.name}`);
    console.log(`Trip Count: ${user11?.tripCount}`);
    console.log(`Total Trip Count: ${user11?.totalTripCount}`);
    
    // GmTrip 테이블의 모든 데이터 조회
    const allTrips = await prisma.gmTrip.findMany();
    console.log(`\n=== GmTrip 테이블 전체 데이터 ===`);
    console.log(`전체 Trip 개수: ${allTrips.length}`);
    console.log('Trip IDs:');
    allTrips.forEach(t => console.log(`  - ID: ${t.id}, userId: ${t.userId}`));
    
    // User 11의 Trip 상세
    if (user11 && user11.trips && user11.trips.length > 0) {
      console.log(`\n=== User 11이 가진 Trip (${user11.trips.length}개) ===`);
      user11.trips.forEach(t => {
        console.log(`  - Trip ID: ${t.id}, 생성: ${t.createdAt.toISOString()}`);
      });
      
      const lastTrip = user11.trips[0];
      console.log(`\n=== User 11의 가장 최신 Trip (ID: ${lastTrip.id}) ===`);
      console.log(`Trip ID: ${lastTrip.id}`);
      console.log(`User ID: ${lastTrip.userId}`);
      console.log(`Created: ${lastTrip.createdAt}`);
      
      // GmTrip 테이블에서 정말 존재하는지 확인
      const tripExists = allTrips.find(t => t.id === lastTrip.id);
      console.log(`\nGmTrip 테이블에 존재? ${tripExists ? 'YES' : 'NO'}`);
    } else {
      console.log('\n=== User 11이 Trip을 가지고 있지 않음 ===');
    }
  } catch (error) {
    console.error('에러:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser11Trips();
