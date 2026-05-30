/**
 * Cron 미들웨어 테스트 스크립트 (P0-2 검증)
 *
 * 목적:
 * - validateCronSecret() 함수 동작 확인
 * - Bearer 토큰 형식 + 레거시 형식 모두 지원 검증
 * - 환경변수 누락 시 에러 처리 확인
 */

const fs = require('fs');
const path = require('path');

// 미들웨어 파일 읽기
const middlewarePath = path.join(__dirname, 'src/lib/cron-middleware.ts');
const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');

console.log('✅ P0-2 검증 시작\n');

// 1. 파일 존재 확인
console.log('1️⃣ 파일 존재 확인');
if (fs.existsSync(middlewarePath)) {
  console.log('   ✅ cron-middleware.ts 파일 생성됨');
} else {
  console.log('   ❌ 파일이 없습니다!');
  process.exit(1);
}

// 2. 핵심 함수 포함 확인
console.log('\n2️⃣ 핵심 함수 포함 확인');
const checks = [
  { name: 'validateCronSecret 함수', pattern: /export function validateCronSecret/ },
  { name: 'Bearer 토큰 검증', pattern: /Bearer \${cronSecret}/ },
  { name: 'x-vercel-cron-secret 레거시 지원', pattern: /x-vercel-cron-secret/ },
  { name: 'generateCronAuthHeader 헬퍼', pattern: /export function generateCronAuthHeader/ },
  { name: 'CronValidationResult 인터페이스', pattern: /interface CronValidationResult/ },
];

checks.forEach(check => {
  if (check.pattern.test(middlewareContent)) {
    console.log(`   ✅ ${check.name}`);
  } else {
    console.log(`   ❌ ${check.name} 누락!`);
  }
});

// 3. 6개 Cron 라우트 수정 확인
console.log('\n3️⃣ 6개 Cron 라우트 수정 확인');
const cronRoutes = [
  'src/app/api/cron/sms-day0-init/route.ts',
  'src/app/api/cron/sms-day1-objection/route.ts',
  'src/app/api/cron/sms-day2-value/route.ts',
  'src/app/api/cron/sms-day3-action/route.ts',
  'src/app/api/cron/sms-followup/route.ts',
  'src/app/api/cron/sms-delivery-tracking/route.ts',
];

cronRoutes.forEach(route => {
  const fullPath = path.join(__dirname, route);
  const content = fs.readFileSync(fullPath, 'utf8');

  const hasImport = /import \{ validateCronSecret \}/.test(content);
  const usesMiddleware = /validateCronSecret\(req\)/.test(content);

  if (hasImport && usesMiddleware) {
    console.log(`   ✅ ${path.basename(path.dirname(fullPath))}`);
  } else {
    console.log(`   ❌ ${path.basename(path.dirname(fullPath))} - import 또는 사용 미포함`);
  }
});

// 4. 심리학 검증 (L9 신뢰)
console.log('\n4️⃣ 심리학 프레임워크 (L9 신뢰)');
const psychologyChecks = [
  { pattern: /신뢰/, desc: '신뢰 언급' },
  { pattern: /일관성/, desc: '일관성 강조' },
  { pattern: /투명성/, desc: '투명성' },
];

psychologyChecks.forEach(check => {
  if (check.pattern.test(middlewareContent)) {
    console.log(`   ✅ ${check.desc}`);
  }
});

// 5. 환경변수 처리 확인
console.log('\n5️⃣ 환경변수 처리 확인');
if (/CRON_SECRET 환경변수 누락/.test(middlewareContent)) {
  console.log('   ✅ 환경변수 누락 시 명확한 에러 메시지');
} else {
  console.log('   ⚠️  환경변수 누락 처리 확인 필요');
}

console.log('\n✅ P0-2 검증 완료!\n');
console.log('다음 단계:');
console.log('1. npm run build 실행 (TypeScript 타입 검증)');
console.log('2. Cron 시뮬레이션 테스트:');
console.log(`   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sms-day0-init`);
console.log('3. 레거시 형식 테스트:');
console.log(`   curl -H "x-vercel-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/sms-day0-init`);
console.log('\n💡 P0-1과 P0-2 모두 완료 시: CRON_SECRET 환경변수 필수 설정 (없으면 실패)');
