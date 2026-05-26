/**
 * Seed Script: Create sample Day 0-3 sequences for testing
 * Run: npx ts-node scripts/seed-day0-3-sequences.ts
 */

import { prisma } from '@/lib/prisma';

async function main() {
  console.log('🌱 Seeding Day 0-3 sequences...');

  // Find first organization
  const org = await prisma.organization.findFirst();

  if (!org) {
    console.error('❌ No organization found. Please create one first.');
    process.exit(1);
  }

  console.log(`📍 Using organization: ${org.name}`);

  // Seed 1: 크루즈 골드 Day 0-3 (L6 타이밍)
  const cruiseGoldSequence = await prisma.smsSequenceTemplate.create({
    data: {
      organizationId: org.id,
      name: '크루즈 골드 Day 0-3',
      description: 'L6 타이밍/손실회피 렌즈 적용 - 프리미엘 크루즈 구매고객 대상',
      productCode: 'CRUISE_GOLD',
      psychologyLens: 'L6',
      sequenceType: 'DAY_0_3',
      day0Delay: 0,
      day1Delay: 1440,
      day2Delay: 2880,
      day3Delay: 4320,
      triggerOn: 'PURCHASE',
      conditions: {
        productCode: ['CRUISE_GOLD'],
        lens: ['L6', 'L10'],
        minValue: 5000000,
        triggerOn: 'PURCHASE'
      },
      status: 'ACTIVE',
      isSystem: false,
      totalSent: 5430,
      totalOpened: 1715,
      totalClicked: 487,
      totalConverted: 271
    }
  });

  // Create variants for Day 0
  await Promise.all([
    prisma.smsSequenceVariant.create({
      data: {
        sequenceId: cruiseGoldSequence.id,
        variantCode: 'A',
        day: 0,
        messageContent:
          '프리미엘 크루즈 경험이 시작됩니다! 배 내부 투어 영상 + 특식 메뉴 확인 → [링크]',
        psychology: 'PASONA_PA',
        lensName: 'L6 타이밍',
        pasonaStage: 'P',
        sentCount: 1815,
        openCount: 573,
        clickCount: 145,
        convertCount: 72,
        isWinner: true
      }
    }),
    prisma.smsSequenceVariant.create({
      data: {
        sequenceId: cruiseGoldSequence.id,
        variantCode: 'B',
        day: 0,
        messageContent: '크루즈 내부 투어 영상, 지금 바로 확인! 24시간 후 공개 마감',
        psychology: 'URGENCY',
        lensName: 'L6 타이밍',
        pasonaStage: 'A',
        sentCount: 1808,
        openCount: 567,
        clickCount: 142,
        convertCount: 68,
        isWinner: false
      }
    }),
    prisma.smsSequenceVariant.create({
      data: {
        sequenceId: cruiseGoldSequence.id,
        variantCode: 'C',
        day: 0,
        messageContent: '600명 골드멤버가 선택한 프리미엘 크루즈 - 특제 가이드북 무료 다운',
        psychology: 'SOCIAL_PROOF',
        lensName: 'L6 타이밍',
        pasonaStage: 'P',
        sentCount: 1809,
        openCount: 542,
        clickCount: 125,
        convertCount: 58,
        isWinner: false
      }
    })
  ]);

  // Create variants for Day 1
  await Promise.all([
    prisma.smsSequenceVariant.create({
      data: {
        sequenceId: cruiseGoldSequence.id,
        variantCode: 'A',
        day: 1,
        messageContent: '골드멤버 100명 특제 가이드북 + 의료 자격증 확인. 이제 안심하고 예약 가능',
        psychology: 'TRUST_BUILDING',
        lensName: 'L6 타이밍',
        pasonaStage: 'S',
        sentCount: 1650,
        openCount: 371,
        clickCount: 93,
        convertCount: 42,
        isWinner: true
      }
    })
  ]);

  // Create variants for Day 2
  await Promise.all([
    prisma.smsSequenceVariant.create({
      data: {
        sequenceId: cruiseGoldSequence.id,
        variantCode: 'A',
        day: 2,
        messageContent: '가격 우려? 3가지 옵션 제공: 분할결제 / 할인쿠폰 / 번들패키지',
        psychology: 'OBJECTION_HANDLING',
        lensName: 'L6 타이밍',
        pasonaStage: 'O',
        sentCount: 1485,
        openCount: 226,
        clickCount: 57,
        convertCount: 25,
        isWinner: true
      }
    })
  ]);

  // Create variants for Day 3
  await Promise.all([
    prisma.smsSequenceVariant.create({
      data: {
        sequenceId: cruiseGoldSequence.id,
        variantCode: 'A',
        day: 3,
        messageContent:
          '마지막 제안: 이번주 결정 시 추가 혜택 50% 할인권! 놓치면 정가 구매됩니다.',
        psychology: 'FINAL_URGENCY',
        lensName: 'L6 타이밍',
        pasonaStage: 'N',
        sentCount: 1680,
        openCount: 315,
        clickCount: 85,
        convertCount: 36,
        isWinner: true
      }
    })
  ]);

  console.log(`✅ Created sequence: ${cruiseGoldSequence.name}`);

  // Seed 2: 렌탈 Day 0-3 (DRAFT status)
  const rentalSequence = await prisma.smsSequenceTemplate.create({
    data: {
      organizationId: org.id,
      name: '렌탈 Day 0-3',
      description: '렌탈 상품 구매고객 Day 0-3 자동화 (DRAFT)',
      productCode: 'RENTAL',
      psychologyLens: 'L6',
      sequenceType: 'DAY_0_3',
      day0Delay: 30,
      day1Delay: 1440,
      day2Delay: 2880,
      day3Delay: 4320,
      triggerOn: 'PURCHASE',
      conditions: {
        productCode: ['RENTAL'],
        minValue: 1000000
      },
      status: 'DRAFT',
      isSystem: false,
      totalSent: 0,
      totalOpened: 0,
      totalClicked: 0,
      totalConverted: 0
    }
  });

  // Create basic variants
  await Promise.all([
    prisma.smsSequenceVariant.create({
      data: {
        sequenceId: rentalSequence.id,
        variantCode: 'A',
        day: 0,
        messageContent: '렌탈 준비 완료! 픽업 시간/장소 및 24시간 콜센터 번호 확인 → [링크]',
        psychology: 'ACTION_READY',
        lensName: '렌탈 안내',
        pasonaStage: 'P',
        isWinner: true
      }
    }),
    prisma.smsSequenceVariant.create({
      data: {
        sequenceId: rentalSequence.id,
        variantCode: 'A',
        day: 1,
        messageContent: '렌탈 고객 만족도 98% - 품질 보증 증서 및 환불 정책 확인',
        psychology: 'TRUST_BUILDING',
        lensName: '렌탈 안내',
        pasonaStage: 'S',
        isWinner: true
      }
    }),
    prisma.smsSequenceVariant.create({
      data: {
        sequenceId: rentalSequence.id,
        variantCode: 'A',
        day: 2,
        messageContent: '렌탈료 할인 쿠폰 + 추가 옵션 (GPS, 아기 좌석) 10% 할인',
        psychology: 'OFFER',
        lensName: '렌탈 안내',
        pasonaStage: 'O',
        isWinner: true
      }
    }),
    prisma.smsSequenceVariant.create({
      data: {
        sequenceId: rentalSequence.id,
        variantCode: 'A',
        day: 3,
        messageContent: '오늘 예약 시 배송료 무료! 내일부터 배송료 5,000원 부과',
        psychology: 'FINAL_URGENCY',
        lensName: '렌탈 안내',
        pasonaStage: 'N',
        isWinner: true
      }
    })
  ]);

  console.log(`✅ Created sequence: ${rentalSequence.name}`);

  // Seed 3: 부재중 고객 재활성화 (L0)
  const reactivationSequence = await prisma.smsSequenceTemplate.create({
    data: {
      organizationId: org.id,
      name: '부재중 고객 재활성화',
      description: '3-6개월 이상 거래 없는 고객 대상 Day 0-3 자동화',
      productCode: null,
      psychologyLens: 'L0',
      sequenceType: 'DAY_0_3',
      day0Delay: 0,
      day1Delay: 1440,
      day2Delay: 2880,
      day3Delay: 4320,
      triggerOn: 'PURCHASE',
      conditions: {
        segment: ['L0_INACTIVE'],
        minInactiveDays: 90
      },
      status: 'ACTIVE',
      isSystem: false,
      totalSent: 2180,
      totalOpened: 436,
      totalClicked: 87,
      totalConverted: 44
    }
  });

  // Create variants
  await Promise.all([
    prisma.smsSequenceVariant.create({
      data: {
        sequenceId: reactivationSequence.id,
        variantCode: 'A',
        day: 0,
        messageContent:
          '오랜만입니다! 지난달 신상품 20가지 추가 + 가격 30% 인하 중 → [보러가기]',
        psychology: 'REACTIVATION',
        lensName: 'L0 부재중',
        pasonaStage: 'P',
        sentCount: 582,
        openCount: 116,
        clickCount: 23,
        convertCount: 12,
        isWinner: true
      }
    }),
    prisma.smsSequenceVariant.create({
      data: {
        sequenceId: reactivationSequence.id,
        variantCode: 'A',
        day: 1,
        messageContent: '신규 고객 이벤트: 첫 구매 시 무조건 20% 할인쿠폰 제공',
        psychology: 'NEW_OFFER',
        lensName: 'L0 부재중',
        pasonaStage: 'S',
        sentCount: 524,
        openCount: 105,
        clickCount: 21,
        convertCount: 11,
        isWinner: true
      }
    }),
    prisma.smsSequenceVariant.create({
      data: {
        sequenceId: reactivationSequence.id,
        variantCode: 'A',
        day: 2,
        messageContent: '단 48시간만! 신상품 구매 시 배송료 무료 + 사은품 증정',
        psychology: 'TIME_LIMITED',
        lensName: 'L0 부재중',
        pasonaStage: 'O',
        sentCount: 468,
        openCount: 93,
        clickCount: 19,
        convertCount: 9,
        isWinner: true
      }
    }),
    prisma.smsSequenceVariant.create({
      data: {
        sequenceId: reactivationSequence.id,
        variantCode: 'A',
        day: 3,
        messageContent: '마지막 인사: 오늘이 마지막날입니다. 무료배송 + 사은품 혜택 마감',
        psychology: 'FINAL_CALL',
        lensName: 'L0 부재중',
        pasonaStage: 'N',
        sentCount: 606,
        openCount: 122,
        clickCount: 24,
        convertCount: 12,
        isWinner: true
      }
    })
  ]);

  console.log(`✅ Created sequence: ${reactivationSequence.name}`);

  console.log('\n✅ Seeding complete!');
  console.log(`📊 Created 3 sequences in organization: ${org.name}`);
  console.log(`   - 크루즈 골드 Day 0-3 (ACTIVE)`);
  console.log(`   - 렌탈 Day 0-3 (DRAFT)`);
  console.log(`   - 부재중 고객 재활성화 (ACTIVE)`);
}

main()
  .catch(e => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
