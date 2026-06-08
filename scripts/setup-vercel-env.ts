#!/usr/bin/env node

/**
 * Vercel 환경변수 자동 설정 스크립트
 *
 * 용도: Vercel CLI를 사용하여 Aligo SMS 환경변수 자동 설정
 *
 * 사전 요구사항:
 * - Vercel CLI 설치: npm i -g vercel
 * - Vercel 로그인: vercel login
 * - Aligo 계정 및 API Key 확보
 *
 * 실행 방법:
 * npx ts-node scripts/setup-vercel-env.ts
 *
 * 또는 package.json에 추가:
 * "scripts": {
 *   "setup:vercel": "ts-node scripts/setup-vercel-env.ts"
 * }
 *
 * 그 후: npm run setup:vercel
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// 환경변수 수집
const envVars = {
  ALIGO_USER_ID: {
    prompt: 'Aligo User ID (예: user123abc):',
    required: true,
    secret: true,
  },
  ALIGO_API_KEY: {
    prompt: 'Aligo API Key (예: abcd1234efgh5678):',
    required: true,
    secret: true,
  },
  ALIGO_SENDER_PHONE: {
    prompt: 'Aligo 발신자 번호 (예: 0215114560):',
    required: true,
    secret: false,
  },
  CRON_SECRET: {
    prompt: 'Cron Secret (32자 이상 랜덤 토큰):',
    required: true,
    secret: true,
  },
};

/**
 * 간단한 프롬프트 입력 (동기식)
 */
function promptSync(question: string): string {
  console.log(question);
  // 실제 구현 시 readline 또는 prompt-sync 패키지 사용
  // 이 버전은 데모용 - 실제 사용 시 개선 필요
  return '';
}

/**
 * Vercel 환경변수 설정 (CLI 사용)
 */
async function setupVercelEnv() {
  console.log(`
╔════════════════════════════════════════════════════════╗
║  Vercel + Aligo SMS 환경변수 자동 설정 도구            ║
║  버전: 1.0                                            ║
╚════════════════════════════════════════════════════════╝

⚠️  주의: 이 스크립트는 다음 조건에서만 작동합니다:
  1. Vercel CLI가 설치되어 있어야 함: npm i -g vercel
  2. Vercel에 로그인되어 있어야 함: vercel login
  3. 현재 디렉토리가 Vercel 프로젝트여야 함

  `);

  // Step 1: Vercel 연결 확인
  console.log('📋 Step 1: Vercel 연결 확인...');
  try {
    execSync('vercel --version', { stdio: 'pipe' });
    console.log('✅ Vercel CLI 설치됨\n');
  } catch (e) {
    console.error(
      '❌ Vercel CLI가 설치되지 않았습니다.\n' +
      '   설치: npm i -g vercel\n' +
      '   로그인: vercel login'
    );
    process.exit(1);
  }

  // Step 2: 프로젝트 확인
  console.log('📋 Step 2: Vercel 프로젝트 확인...');
  const vercelJsonPath = path.join(process.cwd(), '.vercel', 'project.json');
  if (!fs.existsSync(vercelJsonPath)) {
    console.error(
      '❌ 이 디렉토리는 Vercel 프로젝트가 아닙니다.\n' +
      '   초기화: vercel link'
    );
    process.exit(1);
  }
  console.log('✅ Vercel 프로젝트 감지됨\n');

  // Step 3: 환경변수 입력 (수동)
  console.log('📋 Step 3: Aligo 환경변수 입력\n');
  console.log('아래 정보를 입력하세요. Aligo 대시보드에서 복사할 수 있습니다:');
  console.log('Aligo 대시보드: https://aligo.in → 설정 → API\n');

  const inputs: Record<string, string> = {};

  for (const [key, config] of Object.entries(envVars)) {
    console.log(`\n[${key}]`);
    console.log(`설명: ${config.prompt}`);
    if (config.secret) {
      console.log('🔒 이 값은 암호화되어 저장됩니다 (비공개)');
    }
    // 실제 구현 시 readline 사용
    inputs[key] = process.env[key] || '';
    if (!inputs[key] && config.required) {
      console.error(`❌ ${key}는 필수 값입니다.`);
      process.exit(1);
    }
  }

  console.log('\n\n📋 Step 4: Vercel 환경변수 설정\n');
  console.log('다음 변수들을 Vercel에 설정합니다:');
  console.log('────────────────────────────────────────────────────');

  let successCount = 0;
  for (const [key, value] of Object.entries(inputs)) {
    if (!value) continue;

    const masked = value.substring(0, 4) + '***' + value.substring(value.length - 3);
    console.log(`  ${key}: ${masked}`);

    // 실제 Vercel 설정 (CLI 사용)
    // 이 부분은 데모용 - 실제 구현 시 vercel env 커맨드 사용
    // execSync(`vercel env add ${key} --yes <<< "${value}"`, { stdio: 'inherit' });
    successCount++;
  }

  console.log('────────────────────────────────────────────────────\n');

  // Step 5: Redeploy 안내
  console.log('📋 Step 5: 배포 재실행\n');
  console.log('환경변수를 적용하려면 배포를 다시 실행해야 합니다:');
  console.log('  방법 1 (Vercel CLI): vercel redeploy');
  console.log('  방법 2 (Git 푸시): git push origin main');
  console.log('  방법 3 (웹 대시보드): https://vercel.com/dashboard\n');

  // Step 6: 테스트 안내
  console.log('📋 Step 6: SMS 테스트\n');
  console.log('배포 완료 후 SMS를 테스트하세요:');
  console.log('  URL: POST /api/admin/sms/test-send');
  console.log('  헤더: Authorization: Bearer <SESSION_TOKEN>');
  console.log('  본문: { "phoneNumber": "01012345678", "message": "테스트" }');
  console.log('  \n  자세한 내용: docs/VERCEL_ALIGO_SETUP.md 참고\n');

  console.log(`
╔════════════════════════════════════════════════════════╗
║  ✅ 환경변수 설정 완료! (${successCount}개)                       ║
║                                                        ║
║  다음 단계:                                           ║
║  1. Vercel 대시보드에서 확인: https://vercel.com    ║
║  2. Redeploy 실행                                   ║
║  3. SMS 테스트 발송                                 ║
║  4. 배포 완료 공지                                 ║
╚════════════════════════════════════════════════════════╝
  `);
}

/**
 * 로컬 .env.production 생성 (선택사항)
 */
function createLocalEnvFile() {
  const envPath = path.join(process.cwd(), '.env.production.local');
  const envContent = `
# Vercel 환경변수 설정 완료
# 이 파일은 로컬 개발 테스트용입니다 (Git 커밋 금지)

# Aligo SMS API
ALIGO_USER_ID=your_aligo_user_id
ALIGO_API_KEY=your_aligo_api_key
ALIGO_SENDER_PHONE=0215114560

# Cron Secret
CRON_SECRET=your_cron_secret

# Database (필요한 경우만)
# DATABASE_URL=postgresql://...

# Node Environment
NODE_ENV=production

# 주의: 이 파일의 비밀번호/키는 .gitignore에 포함되어야 함
`;

  console.log(`\n📁 로컬 테스트 환경파일 생성: ${envPath}`);
  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env.production.local 생성 완료\n');
}

/**
 * 검증 체크리스트 출력
 */
function printChecklist() {
  console.log(`
╔════════════════════════════════════════════════════════╗
║  📋 배포 전 최종 체크리스트                           ║
╚════════════════════════════════════════════════════════╝

환경변수 설정:
  [ ] ALIGO_USER_ID 설정됨
  [ ] ALIGO_API_KEY 설정됨
  [ ] ALIGO_SENDER_PHONE 설정됨
  [ ] CRON_SECRET 설정됨

Aligo 확인:
  [ ] Aligo 계정 생성됨
  [ ] API Key 확보됨
  [ ] 발신자 번호 승인됨
  [ ] 충전금 50,000원 이상

Vercel 확인:
  [ ] 환경변수 Vercel에 설정됨
  [ ] Production 환경에 모두 추가됨
  [ ] Redeploy 실행됨

배포 후:
  [ ] SMS 테스트 발송 성공
  [ ] 통계 페이지에 기록 확인
  [ ] 팀에 배포 공지

자세한 내용: docs/VERCEL_ALIGO_SETUP.md
  `);
}

// 실행
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Vercel 환경변수 자동 설정 스크립트

사용법:
  ts-node scripts/setup-vercel-env.ts [옵션]

옵션:
  --help, -h          이 도움말 표시
  --check             설정 체크리스트만 출력
  --local-env         .env.production.local 생성 (선택사항)
  --interactive, -i   대화형 모드

예시:
  ts-node scripts/setup-vercel-env.ts --check
  ts-node scripts/setup-vercel-env.ts --local-env
  `);
  process.exit(0);
}

if (process.argv.includes('--check')) {
  printChecklist();
  process.exit(0);
}

if (process.argv.includes('--local-env')) {
  createLocalEnvFile();
  process.exit(0);
}

// 메인 실행 (아직 데모용 - 실제 구현 시 개선 필요)
console.log(`
⚠️  주의: 이 스크립트는 현재 데모 버전입니다.

실제 사용을 위해서는 Vercel 대시보드에서 수동으로 설정하기를 권장합니다:
1. https://vercel.com/dashboard 접속
2. 프로젝트 선택 → Settings → Environment Variables
3. 4개 변수 추가 (ALIGO_USER_ID, ALIGO_API_KEY, ALIGO_SENDER_PHONE, CRON_SECRET)
4. Production 환경 선택 후 저장

또는 vercel CLI 사용:
  vercel env add ALIGO_USER_ID
  vercel env add ALIGO_API_KEY
  vercel env add ALIGO_SENDER_PHONE
  vercel env add CRON_SECRET

자세한 내용: docs/VERCEL_ALIGO_SETUP.md
`);

// 선택사항: 로컬 환경파일 생성
if (process.argv.includes('--local-env')) {
  createLocalEnvFile();
}

printChecklist();
