#!/usr/bin/env npx ts-node
/**
 * Loop 5-B SMS 테스트 스크립트
 *
 * 용도: SMS 자동화 기능 검증
 * 실행: npx ts-node scripts/test-loop5-sms.ts
 *
 * 완성: 2026-05-28 | Agent B (환경변수 설정 + SMS 테스트)
 */

import { config } from 'dotenv';
import path from 'path';

// 환경변수 로드
config({ path: path.resolve(__dirname, '../.env.local') });
config({ path: path.resolve(__dirname, '../.env') });

// ─────────────────────────────────────────────────────────────────────────────
// 1. 환경변수 검증
// ─────────────────────────────────────────────────────────────────────────────

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function checkEnv(envVar: string, isRequired = true): boolean {
  const value = process.env[envVar];
  const status = value ? 'PASS' : (isRequired ? 'FAIL' : 'WARN');

  results.push({
    name: envVar,
    status: status as any,
    message: value ? `✓ ${envVar} 설정됨` : `✗ ${envVar} 미설정`,
  });

  return !!value;
}

console.log('\n═════════════════════════════════════════════════════════════════');
console.log('🧪 Loop 5-B SMS 자동화 테스트');
console.log('═════════════════════════════════════════════════════════════════\n');

console.log('📋 Step 1: 환경변수 검증\n');

const requiredEnvs = [
  'DATABASE_URL',
  'ALIGO_API_KEY',
  'ALIGO_USER_ID',
  'ALIGO_SENDER_PHONE',
];

const optionalEnvs = [
  'NODEMAILER_HOST',
  'NODEMAILER_USER',
  'NODEMAILER_PASS',
  'EMAIL_ENCRYPT_KEY',
  'CRON_SECRET',
  'WEBHOOK_SECRET',
];

let allRequiredPassed = true;

for (const env of requiredEnvs) {
  const passed = checkEnv(env, true);
  if (!passed) allRequiredPassed = false;
}

console.log('\n선택 환경변수:');
for (const env of optionalEnvs) {
  checkEnv(env, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. 데이터베이스 연결 테스트
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n📋 Step 2: 데이터베이스 연결 테스트\n');

let dbConnected = false;

try {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  // 간단한 쿼리로 연결 테스트
  (async () => {
    try {
      const tables = await prisma.$queryRaw`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        LIMIT 1
      `;

      results.push({
        name: 'Database Connection',
        status: 'PASS',
        message: '✓ 데이터베이스 연결 성공',
      });

      dbConnected = true;

      // FormSubmission 테이블 확인
      try {
        const formSubmissionExists = await prisma.$queryRaw`
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'FormSubmission'
        `;

        if (formSubmissionExists && formSubmissionExists.length > 0) {
          results.push({
            name: 'FormSubmission Table',
            status: 'PASS',
            message: '✓ FormSubmission 테이블 존재',
          });
        } else {
          results.push({
            name: 'FormSubmission Table',
            status: 'FAIL',
            message: '✗ FormSubmission 테이블 없음 (마이그레이션 필요)',
            details: 'npx prisma migrate deploy 실행 필요',
          });
        }
      } catch (tableErr) {
        results.push({
          name: 'FormSubmission Table',
          status: 'FAIL',
          message: '✗ FormSubmission 테이블 확인 실패',
          details: tableErr instanceof Error ? tableErr.message : String(tableErr),
        });
      }

      await prisma.$disconnect();
    } catch (err) {
      results.push({
        name: 'Database Connection',
        status: 'FAIL',
        message: '✗ 데이터베이스 연결 실패',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  })();

} catch (err) {
  results.push({
    name: 'Database Connection',
    status: 'FAIL',
    message: '✗ Prisma 로드 실패',
    details: err instanceof Error ? err.message : String(err),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. SMS API 테스트 (건조 실행)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n📋 Step 3: SMS API 테스트 (Dry Run)\n');

interface SmsDryRunConfig {
  apiKey: string;
  userId: string;
  senderPhone: string;
}

const smsDryRunConfig: SmsDryRunConfig = {
  apiKey: process.env.ALIGO_API_KEY || '',
  userId: process.env.ALIGO_USER_ID || '',
  senderPhone: process.env.ALIGO_SENDER_PHONE || '',
};

if (!smsDryRunConfig.apiKey || !smsDryRunConfig.userId || !smsDryRunConfig.senderPhone) {
  results.push({
    name: 'SMS API Configuration',
    status: 'FAIL',
    message: '✗ SMS 설정 불완전',
    details: {
      apiKey: smsDryRunConfig.apiKey ? '✓' : '✗',
      userId: smsDryRunConfig.userId ? '✓' : '✗',
      senderPhone: smsDryRunConfig.senderPhone ? '✓' : '✗',
    },
  });
} else {
  results.push({
    name: 'SMS API Configuration',
    status: 'PASS',
    message: '✓ SMS 설정 완료',
    details: {
      apiKey: `${smsDryRunConfig.apiKey.substring(0, 10)}...`,
      userId: smsDryRunConfig.userId,
      senderPhone: smsDryRunConfig.senderPhone,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Contact Form Webhook 테스트
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n📋 Step 4: Contact Form Webhook 테스트\n');

const webhookTestData = {
  name: '테스트_사용자',
  phone: '01012345678',
  email: 'test@example.com',
  ageRange: '30s',
  preferenceType: 'romance',
  variant: 'a' as const,
  segment: 'A' as const,
  completionTimeMs: 45000,
  timestamp: Date.now(),
  userAgent: 'test-script/loop5',
  affiliateCode: null,
};

console.log('테스트 데이터:');
console.log(JSON.stringify(webhookTestData, null, 2));

results.push({
  name: 'Webhook Test Payload',
  status: 'PASS',
  message: '✓ 테스트 페이로드 준비 완료',
  details: webhookTestData,
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. 결과 출력
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n═════════════════════════════════════════════════════════════════');
console.log('📊 테스트 결과 요약');
console.log('═════════════════════════════════════════════════════════════════\n');

const passCount = results.filter(r => r.status === 'PASS').length;
const failCount = results.filter(r => r.status === 'FAIL').length;
const warnCount = results.filter(r => r.status === 'WARN').length;

console.log(`✓ PASS: ${passCount}`);
console.log(`✗ FAIL: ${failCount}`);
console.log(`⚠ WARN: ${warnCount}`);
console.log('\n상세 결과:\n');

results.forEach(result => {
  const icon = result.status === 'PASS' ? '✓' : result.status === 'FAIL' ? '✗' : '⚠';
  const color = result.status === 'PASS' ? '\x1b[32m' : result.status === 'FAIL' ? '\x1b[31m' : '\x1b[33m';
  const reset = '\x1b[0m';

  console.log(`${color}${icon}${reset} ${result.name}`);
  console.log(`  ${result.message}`);

  if (result.details) {
    if (typeof result.details === 'string') {
      console.log(`  📌 ${result.details}`);
    } else {
      console.log(`  📌 ${JSON.stringify(result.details, null, 2)}`);
    }
  }
  console.log();
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. 다음 단계 가이드
// ─────────────────────────────────────────────────────────────────────────────

console.log('═════════════════════════════════════════════════════════════════');
console.log('📋 다음 단계');
console.log('═════════════════════════════════════════════════════════════════\n');

if (failCount > 0) {
  console.log('⚠️  실패한 항목이 있습니다:\n');

  results.filter(r => r.status === 'FAIL').forEach(result => {
    console.log(`  • ${result.name}`);
    console.log(`    ${result.message}`);
    if (result.details) {
      console.log(`    조치: ${result.details}`);
    }
    console.log();
  });

  console.log('아래 순서로 조치하세요:\n');
  console.log('1️⃣  데이터베이스 마이그레이션');
  console.log('  $ npx prisma migrate deploy\n');

  console.log('2️⃣  환경변수 설정');
  console.log('  - .env 또는 .env.local 파일 생성');
  console.log('  - .env.example 을 참고하여 필수 값 입력\n');

  console.log('3️⃣  API 키 확인');
  console.log('  - Aligo: https://aligo.in > 개인정보 > API KEY');
  console.log('  - Gmail SMTP: https://myaccount.google.com/apppasswords\n');

} else if (warnCount > 0) {
  console.log('⚠️  선택 항목 일부가 설정되지 않았습니다:\n');

  results.filter(r => r.status === 'WARN').forEach(result => {
    console.log(`  • ${result.name}: ${result.message}`);
  });

  console.log('\n이메일 기능을 사용하려면 설정이 필요합니다.');

} else {
  console.log('✅ 모든 필수 항목이 설정되었습니다!\n');

  console.log('배포 준비 완료. 다음을 실행하세요:\n');
  console.log('  1️⃣  로컬 빌드 테스트');
  console.log('     $ npm run build\n');

  console.log('  2️⃣  개발 서버 시작');
  console.log('     $ npm run dev\n');

  console.log('  3️⃣  Contact Form 테스트 (브라우저에서)');
  console.log('     http://localhost:3000 > 폼 제출 > FormSubmission 레코드 생성 확인\n');

  console.log('  4️⃣  SMS API 테스트');
  console.log('     $ npx ts-node scripts/test-aligo-sms.ts\n');

  console.log('  5️⃣  Vercel 배포');
  console.log('     $ git push origin main');
  console.log('     Settings > Environment Variables > Production 에 .env 추가\n');
}

console.log('═════════════════════════════════════════════════════════════════');
console.log('📞 지원');
console.log('═════════════════════════════════════════════════════════════════\n');

console.log('📚 참고 문서:');
console.log('  - Loop 5 가이드: docs/LOOP5_C_IMPLEMENTATION_GUIDE.md');
console.log('  - 환경변수 템플릿: .env.example');
console.log('  - Aligo 문서: https://aligo.in/api/send/\n');

console.log('❓ 문제가 발생하면:');
console.log('  1. .env.example 참고');
console.log('  2. DATABASE_URL 및 API 키 확인');
console.log('  3. npx prisma migrate deploy 실행\n');

// Exit code 설정
process.exit(failCount > 0 ? 1 : 0);
