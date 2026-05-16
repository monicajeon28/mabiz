import prisma from '@/lib/prisma';

async function main() {
  console.log('🔍 여권 토큰 확인 중...\n');

  const token = '42aqEKgE8dE2il8xRK0zGP';

  try {
    const submission = await prisma.gmPassportSubmission.findFirst({
      where: { token },
      include: {
        trip: {
          select: {
            id: true,
            cruiseName: true,
            reservationCode: true,
            status: true
          }
        }
      }
    });

    if (!submission) {
      console.log(`❌ 토큰을 찾을 수 없습니다: ${token}\n`);
      console.log('확인사항:');
      console.log('1. CRM /passport 페이지에서 올바르게 요청 발송했는가?');
      console.log('2. 토큰 생성 API가 정상 작동했는가?');
      console.log('3. DB에 데이터가 저장되었는가?');
      return;
    }

    console.log('✅ 토큰을 찾았습니다!\n');
    console.log('📋 여권 제출 정보:');
    console.log(`  ID: ${submission.id}`);
    console.log(`  Token: ${submission.token}`);
    console.log(`  Trip ID: ${submission.tripId}`);
    console.log(`  만료 시간: ${submission.tokenExpiresAt}`);
    console.log(`  지금 시간: ${new Date().toISOString()}`);
    console.log(`  유효한가?: ${new Date() < new Date(submission.tokenExpiresAt) ? '✅ YES' : '❌ NO (만료됨)'}`);
    console.log(`  제출 완료: ${submission.isSubmitted ? '✅ 완료' : '❌ 미완료'}`);

    if (submission.trip) {
      console.log('\n🎫 여행 정보:');
      console.log(`  Trip ID: ${submission.trip.id}`);
      console.log(`  크루즈: ${submission.trip.cruiseName || '없음'}`);
      console.log(`  예약코드: ${submission.trip.reservationCode}`);
      console.log(`  상태: ${submission.trip.status}`);
    }

  } catch (err) {
    console.error('❌ DB 조회 에러:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
