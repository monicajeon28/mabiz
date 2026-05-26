#!/usr/bin/env npx ts-node

/**
 * SMS Day 0-3 자동화 테스트 스크립트
 *
 * 실행 방법:
 * npx ts-node scripts/test-sms-automation.ts
 *
 * 또는 npm 스크립트 추가:
 * "scripts": {
 *   "test:sms-automation": "npx ts-node scripts/test-sms-automation.ts"
 * }
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testSmsAutomation() {
  console.log('🚀 SMS Day 0-3 자동화 테스트 시작...\n');

  try {
    // Step 1: 테스트 조직 및 고객 생성
    console.log('📝 Step 1: 테스트 조직 및 고객 생성...');

    // 기존 테스트 조직 확인 또는 새로 생성
    let organization = await prisma.organization.findFirst({
      where: { slug: 'test-sms-automation' }
    });

    if (!organization) {
      organization = await prisma.organization.create({
        data: {
          name: 'SMS 자동화 테스트 조직',
          slug: 'test-sms-automation',
          plan: 'FREE'
        }
      });
      console.log(`✅ 조직 생성: ${organization.id}`);
    } else {
      console.log(`✅ 기존 조직 사용: ${organization.id}`);
    }

    // 테스트 고객 생성
    const testContact = await prisma.contact.create({
      data: {
        phone: '+82101234567',
        name: '테스트 고객',
        organizationId: organization.id,
        segment: 'newlywed',
        email: 'test@example.com'
      }
    });
    console.log(`✅ 테스트 고객 생성: ${testContact.id}`);

    // Step 2: Day 0-3 메시지 스케줄 API 호출
    console.log('\n📅 Step 2: Day 0-3 메시지 스케줄링 API 호출...');

    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    const scheduleResponse = await fetch(
      `${apiBaseUrl}/api/sms/automation/schedule-day0-3`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: testContact.id,
          organizationId: organization.id,
          segment: 'newlywed',
          callTime: new Date().toISOString(),
          firstName: '김태희'
        })
      }
    );

    if (!scheduleResponse.ok) {
      throw new Error(`API error: ${scheduleResponse.statusText}`);
    }

    const scheduleResult = await scheduleResponse.json();
    console.log(`✅ ${scheduleResult.messagesScheduled}개 메시지 스케줄 완료`);

    // Step 3: 스케줄된 메시지 조회
    console.log('\n📬 Step 3: 스케줄된 메시지 확인...');

    const messages = await prisma.crmMarketingMessage.findMany({
      where: { contactId: testContact.id },
      orderBy: { scheduledTime: 'asc' }
    });

    console.log(`\n📋 스케줄된 메시지 목록:\n`);
    messages.forEach((msg, index) => {
      console.log(`${index + 1}. Day ${msg.day} - ${msg.templateId}`);
      console.log(`   상태: ${msg.status}`);
      console.log(`   스케줄: ${msg.scheduledTime.toLocaleString('ko-KR')}`);
      console.log(`   심리학: ${msg.psychologyLenses?.join(', ') || 'N/A'}`);
      console.log(`   A/B 그룹: ${msg.abTestGroup}`);
      console.log(`   예상 전환율: ${msg.expectedResponseRate?.toFixed(1)}%\n`);
    });

    // Step 4: 메트릭 API 호출
    console.log('📊 Step 4: 메트릭 확인...');

    const metricsResponse = await fetch(
      `${apiBaseUrl}/api/sms/automation/metrics?organizationId=${organization.id}`,
      { method: 'GET' }
    );

    if (metricsResponse.ok) {
      const metrics = await metricsResponse.json();
      console.log(`✅ 메트릭 조회 성공`);
      console.log(`\n📈 메트릭 요약:`);
      console.log(`   총 발송: ${metrics.totalSent}건`);
      console.log(`   총 클릭: ${metrics.totalClicked}건`);
      console.log(`   클릭율: ${metrics.clickRate}`);
      console.log(`   전환율: ${metrics.conversionRate}\n`);
    }

    // Step 5: 데이터 정합성 검증
    console.log('✅ Step 5: 데이터 정합성 검증...');

    const contactCheck = await prisma.contact.findUnique({
      where: { id: testContact.id }
    });

    if (contactCheck?.smsDay0Sent === false) {
      console.log(`✅ Contact 플래그 정상: smsDay0Sent = false (아직 발송 전)`);
    }

    const messageCount = await prisma.crmMarketingMessage.count({
      where: { contactId: testContact.id }
    });

    if (messageCount === 3) {
      console.log(`✅ 메시지 개수 정상: Day 0, 1, 3 = 3개`);
    }

    console.log('\n✨ SMS 자동화 테스트 완료!\n');
    console.log('📝 다음 단계:');
    console.log('1. vercel.json에서 Cron이 15분마다 실행되도록 설정됨');
    console.log('2. Day 0 메시지는 콜 후 2시간 뒤에 자동 발송');
    console.log('3. Day 1 메시지는 다음날 10시에 발송');
    console.log('4. Day 3 메시지는 3일 후 14시에 발송');
    console.log('\n💡 메시지 content에는 {{firstName}}이 자동 치환됨');
    console.log('💡 A/B 테스트는 50%/50% 비율로 자동 분배됨');

  } catch (error) {
    console.error('❌ 테스트 실패:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
testSmsAutomation();
