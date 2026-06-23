import 'dotenv/config.js';
import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL 환경변수 없음');
  process.exit(1);
}

const prisma = new PrismaClient();

async function seedScheduledMessages() {
  console.log('🌱 테스트 메시지 생성 시작...');

  try {
    // 1. ACTIVE 조직 조회
    const orgs = await prisma.organization.findMany({
      where: { status: 'ACTIVE' },
      take: 1,
    });

    if (!orgs.length) {
      console.error('❌ ACTIVE 조직 없음');
      return;
    }

    const org = orgs[0];
    console.log(`📌 대상 조직: ${org.id} (${org.name})`);

    // 2. Contact 조회
    const contact = await prisma.contact.findFirst({
      where: { organizationId: org.id },
    });

    if (!contact) {
      console.error('❌ Contact 없음 - 먼저 Contact를 생성하세요');
      process.exit(1);
    }

    console.log(`👤 대상 Contact: ${contact.id} (${contact.name})`);

    // 3. 현재 시간 기준 ScheduledSms 생성 (Day 0-3)
    const now = new Date();
    const testMessages = [];

    for (let day = 0; day < 4; day++) {
      const scheduledAt = new Date(now);
      scheduledAt.setDate(scheduledAt.getDate() + day);
      scheduledAt.setHours(10, 0, 0, 0); // 매일 10:00 발송

      const msg = {
        organizationId: org.id,
        contactId: contact.id,
        groupId: null, // 그룹 없이 개별 발송
        message: `[테스트 Day ${day}] {{고객명}}님, 이것은 자동화 메시지 테스트입니다. 응답 금지.`,
        status: 'PENDING',
        scheduledAt,
        channel: 'SMS',
        senderUserId: null,
        createdAt: now,
      };
      testMessages.push(msg);
    }

    // 4. 일괄 삽입
    const created = await prisma.scheduledSms.createMany({
      data: testMessages,
      skipDuplicates: true,
    });

    console.log(`✅ ScheduledSms ${created.count}개 생성 완료`);

    // 5. 검증
    const count = await prisma.scheduledSms.count({
      where: { organizationId: org.id },
    });
    console.log(`📊 조직 내 총 ScheduledSms: ${count}개`);

    // 6. Email도 생성
    const emailMsgs = [];
    for (let day = 0; day < 4; day++) {
      const scheduledAt = new Date(now);
      scheduledAt.setDate(scheduledAt.getDate() + day);
      scheduledAt.setHours(10, 5, 0, 0); // 이메일은 5분 뒤

      emailMsgs.push({
        organizationId: org.id,
        contactId: contact.id,
        groupId: null,
        subject: `[테스트 Day ${day}] 자동 이메일`,
        htmlContent: `<p>안녕하세요 {{고객명}}님</p><p>이것은 자동화 테스트 이메일입니다.</p>`,
        textContent: `Hello {{고객명}}, this is a test email for Day ${day}.`,
        status: 'PENDING',
        scheduledAt,
        channel: 'EMAIL',
        senderUserId: null,
        createdAt: now,
      });
    }

    const emailCreated = await prisma.scheduledEmailMessage.createMany({
      data: emailMsgs,
      skipDuplicates: true,
    });

    console.log(`✅ ScheduledEmailMessage ${emailCreated.count}개 생성 완료`);

    console.log('✨ 테스트 데이터 준비 완료!');
    console.log('💡 다음 Cron 호출:');
    console.log('   POST /api/cron/send-scheduled-messages?day=0&type=sms');
    console.log('   POST /api/cron/send-scheduled-messages?day=0&type=email');
  } catch (error) {
    console.error('❌ 오류:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedScheduledMessages();
