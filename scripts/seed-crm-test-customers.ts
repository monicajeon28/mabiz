import prisma from '@/lib/prisma';

/**
 * 마비즈 CRM 테스트 고객 데이터 생성
 * - 20명의 심리학 렌즈별 테스트 고객
 * - 2개 조직 (test-organization, test-org-2)
 * - 각 렌즈별 시나리오 포함
 */

async function seedCustomers() {
  console.log('🔄 테스트 고객 데이터 생성 시작...\n');

  try {
    // 1. 테스트 조직 확인/생성
    const org1 = await prisma.organization.findUnique({
      where: { slug: 'test-org' },
    });

    const org2 = await prisma.organization.findUnique({
      where: { slug: 'test-org-slug' },
    });

    if (!org1 || !org2) {
      console.error('❌ 테스트 조직이 없습니다. 먼저 load-crm-test-data.ts를 실행하세요.');
      process.exit(1);
    }

    console.log(`✅ 조직 확인:`);
    console.log(`   • ${org1.name} (${org1.id})`);
    console.log(`   • ${org2.name} (${org2.id})\n`);

    // 2. 멤버 확인
    const member1 = await prisma.organizationMember.findFirst({
      where: { organizationId: org1.id, role: 'AGENT' },
    });

    if (!member1) {
      console.error('❌ 테스트 멤버가 없습니다.');
      process.exit(1);
    }

    console.log(`✅ 멤버 확인: ${member1.displayName}\n`);

    // 3. 고객 데이터 정의
    const testCustomers = [
      {
        phone: '01012345001',
        name: 'Customer 1 - L0 Reactivation',
        email: 'cust001@example.com',
        type: 'CUSTOMER',
        organizationId: org1.id,
        assignedUserId: member1.userId,
        reactivationSegment: '6-12m',
        reactivationLikelihood: 75,
        cruiseCount: 3,
        vipStatus: 'GOLD',
      },
      {
        phone: '01012345002',
        name: 'Customer 2 - L2 Anxiety',
        email: 'cust002@example.com',
        type: 'LEAD',
        organizationId: org1.id,
        assignedUserId: member1.userId,
        anxietyScore: 85,
        anxietyCategory: 'high',
        preparationStage: 'health_concern',
        visaRequired: false,
        healthConcerns: '배멀미,고혈압',
        firstTimeCruise: false,
        familyWithKids: true,
      },
      {
        phone: '01012345003',
        name: 'Customer 3 - L3 Differentiation',
        email: 'cust003@example.com',
        type: 'LEAD',
        organizationId: org1.id,
        assignedUserId: member1.userId,
        competitorMentioned: true,
        differentiationScore: 45,
      },
      {
        phone: '01012345004',
        name: 'Customer 4 - L5 Medical Trust',
        email: 'cust004@example.com',
        type: 'LEAD',
        organizationId: org1.id,
        assignedUserId: member1.userId,
        healthConcerns: '당뇨병',
        medicalTrust: 'medium',
      },
      {
        phone: '01012345005',
        name: 'Customer 5 - L6 Timing/Loss',
        email: 'cust005@example.com',
        type: 'PROSPECT',
        organizationId: org1.id,
        assignedUserId: member1.userId,
        timingSensitivity: 'high',
        lossAversion: 'very_high',
        budgetRange: '5000-10000',
      },
      {
        phone: '01012345006',
        name: 'Customer 6 - L7 Companion',
        email: 'cust006@example.com',
        type: 'LEAD',
        organizationId: org1.id,
        assignedUserId: member1.userId,
        decisionMaker: 'spouse',
        companionSentiment: 'positive',
        familyInfluence: 'high',
      },
      {
        phone: '01012345007',
        name: 'Customer 7 - L8 Repurchase',
        email: 'cust007@example.com',
        type: 'CUSTOMER',
        organizationId: org1.id,
        assignedUserId: member1.userId,
        repurchaseCount: 2,
        repurchaseIntent: 'high',
        loyaltyScore: 80,
      },
      {
        phone: '01012345008',
        name: 'Customer 8 - L9 Health Safety',
        email: 'cust008@example.com',
        type: 'LEAD',
        organizationId: org1.id,
        assignedUserId: member1.userId,
        healthConcerns: '고혈압,당뇨',
        safetyScore: 60,
        medicalNeeds: true,
      },
      {
        phone: '01012345009',
        name: 'Customer 9 - L10 Immediate',
        email: 'cust009@example.com',
        type: 'PROSPECT',
        organizationId: org1.id,
        assignedUserId: member1.userId,
        readinessScore: 95,
        urgencyLevel: 'very_high',
        buyingSignal: true,
      },
      {
        phone: '01012345010',
        name: 'Customer 10 - Price Sensitive',
        email: 'cust010@example.com',
        type: 'LEAD',
        organizationId: org1.id,
        assignedUserId: member1.userId,
        priceSensitivity: 'high',
        budgetRange: '2000-5000',
        lastObjection: '가격이 비싸요',
      },
      {
        phone: '01012345011',
        name: 'Customer 11 - Inactive 1Y+',
        email: 'cust011@example.com',
        type: 'CUSTOMER',
        organizationId: org1.id,
        assignedUserId: member1.userId,
        reactivationSegment: '1y+',
        reactivationLikelihood: 40,
        cruiseCount: 1,
      },
      {
        phone: '01012345012',
        name: 'Customer 12 - Preparation Anxiety',
        email: 'cust012@example.com',
        type: 'LEAD',
        organizationId: org1.id,
        assignedUserId: member1.userId,
        anxietyScore: 70,
        preparationStage: 'documents_needed',
        visaRequired: true,
      },
      {
        phone: '01012345013',
        name: 'Customer 13 - Competitor Aware',
        email: 'cust013@example.com',
        type: 'PROSPECT',
        organizationId: org1.id,
        assignedUserId: member1.userId,
        competitorMentioned: true,
        lastCompetitorName: 'Royal Caribbean',
        differentiationScore: 35,
      },
      {
        phone: '01012345014',
        name: 'Customer 14 - Family Decision',
        email: 'cust014@example.com',
        type: 'LEAD',
        organizationId: org1.id,
        assignedUserId: member1.userId,
        familyWithKids: true,
        familyInfluence: 'very_high',
        companionSentiment: 'neutral',
      },
      {
        phone: '01012345015',
        name: 'Customer 15 - VIP Gold Member',
        email: 'cust015@example.com',
        type: 'CUSTOMER',
        organizationId: org1.id,
        assignedUserId: member1.userId,
        vipStatus: 'GOLD',
        cruiseCount: 5,
        repurchaseIntent: 'very_high',
        loyaltyScore: 95,
      },
      {
        phone: '01012345016',
        name: 'Customer 16 - New Prospect',
        email: 'cust016@example.com',
        type: 'PROSPECT',
        organizationId: org1.id,
        assignedUserId: member1.userId,
        firstTimeCruise: true,
        readinessScore: 65,
      },
      {
        phone: '01012345017',
        name: 'Customer 17 - Hesitant Buyer',
        email: 'cust017@example.com',
        type: 'PROSPECT',
        organizationId: org1.id,
        assignedUserId: member1.userId,
        readinessScore: 45,
        lastObjection: '결정이 안 서요',
        buyingSignal: false,
      },
      {
        phone: '01012345018',
        name: 'Customer 18 - Seasonal Interest',
        email: 'cust018@example.com',
        type: 'LEAD',
        organizationId: org1.id,
        assignedUserId: member1.userId,
        timingSensitivity: 'high',
        cruiseInterest: 'Mediterranean',
      },
      {
        phone: '01012345019',
        name: 'Customer 19 - Budget Limited',
        email: 'cust019@example.com',
        type: 'LEAD',
        organizationId: org1.id,
        assignedUserId: member1.userId,
        budgetRange: '1000-3000',
        priceSensitivity: 'very_high',
      },
      {
        phone: '01012345020',
        name: 'Customer 20 - Multi-Trip',
        email: 'cust020@example.com',
        type: 'CUSTOMER',
        organizationId: org1.id,
        assignedUserId: member1.userId,
        cruiseCount: 8,
        repurchaseCount: 3,
        vipStatus: 'PLATINUM',
      },
    ];

    // 4. 기존 고객 데이터 확인
    const existingCount = await prisma.contact.count({
      where: { organizationId: org1.id },
    });

    if (existingCount > 0) {
      console.log(`⚠️  테스트 조직에 이미 ${existingCount}명의 고객이 있습니다.`);
      console.log('   기존 데이터를 유지합니다.\n');
    }

    // 5. 고객 데이터 생성
    console.log(`📊 ${testCustomers.length}명의 테스트 고객 생성 중...\n`);

    let created = 0;
    let skipped = 0;

    for (const customer of testCustomers) {
      try {
        const existing = await prisma.contact.findFirst({
          where: { phone: customer.phone, organizationId: org1.id },
        });

        if (existing) {
          skipped++;
          process.stdout.write('s');
          continue;
        }

        await prisma.contact.create({
          data: {
            ...customer,
            leadScore: Math.floor(Math.random() * 100),
          },
        });

        created++;
        process.stdout.write('.');
      } catch (err: any) {
        console.error(`\n❌ ${customer.name}: ${err.message.substring(0, 50)}`);
      }
    }

    console.log('\n');
    console.log('✅ 고객 생성 완료');
    console.log(`   생성됨: ${created}명`);
    console.log(`   스킵됨: ${skipped}명\n`);

    // 6. 최종 확인
    const finalCount = await prisma.contact.count({
      where: { organizationId: org1.id },
    });

    console.log('📋 최종 데이터 통계:');
    console.log(`   Contact: ${finalCount}명`);

    // 샘플 데이터 표시
    const samples = await prisma.contact.findMany({
      where: { organizationId: org1.id },
      select: {
        id: true,
        name: true,
        phone: true,
        type: true,
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    console.log('\n📌 로드된 고객 샘플:');
    samples.forEach((s) => {
      console.log(`   • ${s.name} (${s.phone}) - ${s.type}`);
    });

    console.log('\n✨ 모든 데이터 로드 완료!');

  } catch (err) {
    console.error('❌ 오류:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedCustomers();
