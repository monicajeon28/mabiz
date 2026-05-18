#!/usr/bin/env node

/**
 * E2E Test Runner: 3회 연속 실행 및 검증
 *
 * 사용: npm run test:e2e:groups:3x
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// 색상 정의
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('');
  log('blue', '========================================');
  log('blue', title);
  log('blue', '========================================');
  console.log('');
}

async function main() {
  logSection('E2E Test Runner: Group Management (3회 연속)');

  const TOTAL_RUNS = 3;
  const results = [];
  const logDir = path.join(process.cwd(), '.cypress-logs');

  // 로그 디렉토리 생성
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  log('yellow', '⏳ 서버 상태 확인 중...');
  try {
    execSync('curl -s -f http://localhost:3000/api/health > /dev/null', { stdio: 'ignore' });
    log('green', '✅ 서버 실행 중');
  } catch {
    log('red', '❌ 서버가 실행 중이 아닙니다. (http://localhost:3000)');
    log('yellow', '다음 명령으로 서버를 시작하세요:');
    log('yellow', '  npm run dev');
    process.exit(1);
  }

  console.log('');

  // 3회 실행
  for (let i = 1; i <= TOTAL_RUNS; i++) {
    logSection(`E2E Test Run #${i} / ${TOTAL_RUNS}`);

    const logFile = path.join(logDir, `run-${i}.log`);
    const startTime = Date.now();

    try {
      log('cyan', '실행 중...');
      execSync(
        'cypress run --spec "cypress/e2e/group-management.cy.ts" --headless --browser=chrome',
        {
          stdio: 'inherit',
          cwd: process.cwd(),
        }
      );

      const duration = Math.round((Date.now() - startTime) / 1000);
      results.push({
        run: i,
        status: 'PASS',
        duration,
      });

      log('green', `✅ Run #${i} 완료 (${duration}초)`);
    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      results.push({
        run: i,
        status: 'FAIL',
        duration,
        error: error.message,
      });

      log('red', `❌ Run #${i} 실패 (${duration}초)`);
    }

    console.log('');

    // 다음 실행 전 대기
    if (i < TOTAL_RUNS) {
      log('yellow', '📌 3초 대기 중...');
      await new Promise((resolve) => setTimeout(resolve, 3000));
      console.log('');
    }
  }

  // 최종 결과
  logSection('최종 결과');

  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  results.forEach((result) => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    const statusColor = result.status === 'PASS' ? 'green' : 'red';
    log(
      statusColor,
      `${icon} Run #${result.run}: ${result.status} (${result.duration}초)`
    );
  });

  console.log('');
  log('blue', '통계:');
  log('green', `  ✅ PASS: ${passCount}/${TOTAL_RUNS}`);
  log('red', `  ❌ FAIL: ${failCount}/${TOTAL_RUNS}`);
  log('cyan', `  ⏱️  총 소요시간: ${totalDuration}초`);

  console.log('');

  if (passCount === TOTAL_RUNS) {
    logSection('🎉 모든 E2E 테스트 3회 연속 PASS!');
    log('green', '✅ Track C Phase 5 배포 준비 완료');
    console.log('');
    log('cyan', '다음 단계:');
    log('cyan', '  1. git add . && git commit -m "feat(phase5): Track C 완료"');
    log('cyan', '  2. git push origin main');
    console.log('');
    process.exit(0);
  } else {
    logSection('❌ E2E 테스트 실패');
    log('red', '재실행이 필요합니다:');
    log('red', '  npm run test:e2e:groups:3x');
    console.log('');
    process.exit(1);
  }
}

main().catch((err) => {
  log('red', `❌ 실행 중 오류 발생: ${err.message}`);
  process.exit(1);
});
