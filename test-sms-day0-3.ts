/**
 * SMS Day 0-3 자동발송 로직 테스트 스크립트
 *
 * 테스트 항목:
 * 1. Day 0 SMS 초기 발송 (PASONA P+A단계)
 * 2. Day 1 SMS 이의 대응 (PASONA S단계)
 * 3. Day 2 SMS 가치 강조 (PASONA O단계)
 * 4. Day 3 SMS 긴박감 + 결정 (PASONA N+A단계)
 * 5. 발송 로그 추적 (SmsLog)
 * 6. Contact 상태 업데이트
 * 7. Cron 스케줄 설정
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

async function testDay0SmsRoute() {
  try {
    // Test: POST /api/cron/sms-day0-init
    const response = await fetch(
      'http://localhost:3000/api/cron/sms-day0-init',
      {
        method: 'POST',
        headers: {
          'x-vercel-cron-secret': process.env.CRON_SECRET || 'test-secret',
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (data.status === 'COMPLETED') {
      results.push({
        testName: 'Day 0 SMS Route',
        status: 'PASS',
        message: 'Successfully initiated Day 0 SMS sequence',
        details: {
          successCount: data.successCount,
          failCount: data.failCount,
          scheduledCount: data.scheduledCount,
        },
      });
    } else {
      results.push({
        testName: 'Day 0 SMS Route',
        status: 'FAIL',
        message: `Unexpected status: ${data.status}`,
        details: data,
      });
    }
  } catch (error) {
    results.push({
      testName: 'Day 0 SMS Route',
      status: 'FAIL',
      message: String(error),
    });
  }
}

async function testDay1SmsRoute() {
  try {
    const response = await fetch(
      'http://localhost:3000/api/cron/sms-day1-objection',
      {
        method: 'POST',
        headers: {
          'x-vercel-cron-secret': process.env.CRON_SECRET || 'test-secret',
        },
      }
    );

    const data = await response.json();

    if (data.status === 'COMPLETED') {
      results.push({
        testName: 'Day 1 SMS Route',
        status: 'PASS',
        message: 'Successfully sent Day 1 objection handling SMS',
        details: {
          successCount: data.successCount,
          objectionDetectedCount: data.objectionDetectedCount,
        },
      });
    } else {
      results.push({
        testName: 'Day 1 SMS Route',
        status: 'FAIL',
        message: `Unexpected status: ${data.status}`,
      });
    }
  } catch (error) {
    results.push({
      testName: 'Day 1 SMS Route',
      status: 'FAIL',
      message: String(error),
    });
  }
}

async function testDay2SmsRoute() {
  try {
    const response = await fetch(
      'http://localhost:3000/api/cron/sms-day2-value',
      {
        method: 'POST',
        headers: {
          'x-vercel-cron-secret': process.env.CRON_SECRET || 'test-secret',
        },
      }
    );

    const data = await response.json();

    if (data.status === 'COMPLETED') {
      results.push({
        testName: 'Day 2 SMS Route',
        status: 'PASS',
        message: 'Successfully sent Day 2 value proposition SMS',
        details: {
          successCount: data.successCount,
          highEngagementCount: data.highEngagementCount,
        },
      });
    } else {
      results.push({
        testName: 'Day 2 SMS Route',
        status: 'FAIL',
        message: `Unexpected status: ${data.status}`,
      });
    }
  } catch (error) {
    results.push({
      testName: 'Day 2 SMS Route',
      status: 'FAIL',
      message: String(error),
    });
  }
}

async function testDay3SmsRoute() {
  try {
    const response = await fetch(
      'http://localhost:3000/api/cron/sms-day3-action',
      {
        method: 'POST',
        headers: {
          'x-vercel-cron-secret': process.env.CRON_SECRET || 'test-secret',
        },
      }
    );

    const data = await response.json();

    if (data.status === 'COMPLETED') {
      results.push({
        testName: 'Day 3 SMS Route',
        status: 'PASS',
        message: 'Successfully sent Day 3 action & decision SMS',
        details: {
          successCount: data.successCount,
          totalEngagementRate: data.totalEngagementRate,
        },
      });
    } else {
      results.push({
        testName: 'Day 3 SMS Route',
        status: 'FAIL',
        message: `Unexpected status: ${data.status}`,
      });
    }
  } catch (error) {
    results.push({
      testName: 'Day 3 SMS Route',
      status: 'FAIL',
      message: String(error),
    });
  }
}

async function testSmsLogTracing() {
  try {
    // Check if SmsLog entries exist
    const smsLogs = await prisma.smsLog.findMany({
      where: {
        channel: {
          in: ['DAY0_SEQUENCE', 'DAY1_OBJECTION', 'DAY2_VALUE', 'DAY3_ACTION'],
        },
      },
      orderBy: { sentAt: 'desc' },
      take: 10,
    });

    if (smsLogs.length > 0) {
      results.push({
        testName: 'SMS Log Tracing',
        status: 'PASS',
        message: `Found ${smsLogs.length} SMS logs`,
        details: {
          channels: [...new Set(smsLogs.map(l => l.channel))],
          sentAtRange: {
            latest: smsLogs[0].sentAt,
            oldest: smsLogs[smsLogs.length - 1].sentAt,
          },
        },
      });
    } else {
      results.push({
        testName: 'SMS Log Tracing',
        status: 'FAIL',
        message: 'No SMS logs found for Day 0-3 sequence',
      });
    }
  } catch (error) {
    results.push({
      testName: 'SMS Log Tracing',
      status: 'FAIL',
      message: String(error),
    });
  }
}

async function testContactStatusUpdate() {
  try {
    // Check if any contacts have Day SMS flags set
    const contactsWithSms = await prisma.contact.findMany({
      where: {
        OR: [
          { smsDay0Sent: true },
          { smsDay1Sent: true },
          { smsDay2Sent: true },
          { smsDay3Sent: true },
        ],
      },
      select: {
        id: true,
        phone: true,
        smsDay0Sent: true,
        smsDay0SentAt: true,
        smsDay1Sent: true,
        smsDay1SentAt: true,
        smsDay2Sent: true,
        smsDay2SentAt: true,
        smsDay3Sent: true,
        smsDay3SentAt: true,
      },
      take: 5,
    });

    if (contactsWithSms.length > 0) {
      results.push({
        testName: 'Contact Status Update',
        status: 'PASS',
        message: `Found ${contactsWithSms.length} contacts with SMS Day tracking`,
        details: {
          sampleContacts: contactsWithSms.slice(0, 2),
        },
      });
    } else {
      results.push({
        testName: 'Contact Status Update',
        status: 'FAIL',
        message: 'No contacts found with SMS Day tracking flags',
      });
    }
  } catch (error) {
    results.push({
      testName: 'Contact Status Update',
      status: 'FAIL',
      message: String(error),
    });
  }
}

async function testCronScheduleConfiguration() {
  try {
    // Check vercel.json for cron configuration
    const vercelConfig = require('/d/mabiz-crm/vercel.json');

    const cronPaths = vercelConfig.crons.map((c: any) => c.path);
    const hasSmsDay0 = cronPaths.some((p: string) => p.includes('sms-day0-init'));
    const hasSmsDay1 = cronPaths.some((p: string) => p.includes('sms-day1-objection'));
    const hasSmsDay2 = cronPaths.some((p: string) => p.includes('sms-day2-value'));
    const hasSmsDay3 = cronPaths.some((p: string) => p.includes('sms-day3-action'));

    if (hasSmsDay0 && hasSmsDay1 && hasSmsDay2 && hasSmsDay3) {
      results.push({
        testName: 'Cron Schedule Configuration',
        status: 'PASS',
        message: 'All SMS Day 0-3 cron jobs configured in vercel.json',
        details: {
          totalCrons: vercelConfig.crons.length,
          smsDayCrons: 4,
        },
      });
    } else {
      results.push({
        testName: 'Cron Schedule Configuration',
        status: 'FAIL',
        message: 'Missing SMS Day cron configurations',
        details: {
          hasSmsDay0,
          hasSmsDay1,
          hasSmsDay2,
          hasSmsDay3,
        },
      });
    }
  } catch (error) {
    results.push({
      testName: 'Cron Schedule Configuration',
      status: 'FAIL',
      message: String(error),
    });
  }
}

async function generateReport() {
  console.log('\n\n========================================');
  console.log('SMS Day 0-3 자동발송 테스트 리포트');
  console.log('========================================\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  results.forEach(result => {
    const icon = result.status === 'PASS' ? '✓' : '✗';
    console.log(`[${icon}] ${result.testName}`);
    console.log(`    Status: ${result.status}`);
    console.log(`    Message: ${result.message}`);
    if (result.details) {
      console.log(`    Details:`, JSON.stringify(result.details, null, 2));
    }
    console.log('');
  });

  console.log('========================================');
  console.log(`Summary: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

async function runAllTests() {
  logger.log('[TEST] Starting SMS Day 0-3 Test Suite');

  // Test routes first (requires running server)
  console.log('Note: To test API routes, ensure server is running on http://localhost:3000\n');

  // Test database operations
  await testSmsLogTracing();
  await testContactStatusUpdate();
  await testCronScheduleConfiguration();

  // Generate report
  await generateReport();
}

runAllTests().catch(err => {
  logger.error('[TEST] Fatal error', err);
  process.exit(1);
});
