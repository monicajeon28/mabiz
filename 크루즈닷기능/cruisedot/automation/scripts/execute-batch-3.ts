#!/usr/bin/env node

/**
 * 배치 3/4 실행 스크립트
 * 로컬 개발 또는 Vercel 프로덕션에서 병렬 배치 3 (1760-2640) 업로드 실행
 *
 * 사용법:
 * npx ts-node scripts/execute-batch-3.ts
 */

import 'dotenv/config';
import fetch from 'node-fetch';

const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

function log(msg: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function section(title: string) {
  log('\n' + '━'.repeat(70), 'cyan');
  log(`  ${title}`, 'cyan');
  log('━'.repeat(70), 'cyan');
}

async function executeBatchUpload(batchNumber: number, endpoint: string): Promise<any> {
  const cronSecret = process.env.CRON_SECRET;
  const apiBase = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  if (!cronSecret) {
    log('❌ CRON_SECRET이 설정되지 않았습니다', 'red');
    process.exit(1);
  }

  const url = `${apiBase}${endpoint}`;
  const startTime = Date.now();

  log(`\n🔄 배치 ${batchNumber}/4 실행 중...`, 'blue');
  log(`📍 엔드포인트: ${endpoint}`, 'blue');

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    const data = (await response.json()) as any;

    if (data.ok) {
      log(`\n✅ 배치 ${batchNumber}/4 완료`, 'green');
      log(`  ✓ 업로드: ${data.uploaded}/${data.totalProcessed}개`, 'green');
      log(`  ✗ 실패: ${data.failed}개`, data.failed > 0 ? 'red' : 'green');
      log(`  📊 성공률: ${data.successRate}`, 'blue');
      log(`  ⏱️  소요 시간: ${elapsed}초`, 'blue');

      if (data.failedImages && data.failedImages.length > 0) {
        log(`\n⚠️  실패한 이미지 (상위 5개):`, 'yellow');
        data.failedImages.slice(0, 5).forEach((img: any) => {
          log(`  • ${img.fileName}: ${img.errorMessage}`, 'red');
        });
        if (data.failedImages.length > 5) {
          log(`  ... 외 ${data.failedImages.length - 5}개`, 'yellow');
        }
      }

      return { success: true, data, elapsed };
    } else {
      throw new Error(data.error || '알 수 없는 오류');
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    log(`\n❌ 배치 ${batchNumber}/4 실패`, 'red');
    log(`  에러: ${errorMsg}`, 'red');
    log(`  ⏱️  소요 시간: ${elapsed}초`, 'red');

    return { success: false, error: errorMsg, elapsed };
  }
}

async function main() {
  section('🚀 배치 3/4 이미지 업로드 실행');

  log(`📋 설정:`, 'blue');
  log(`  배치 3: offset=1760, limit=880 (약 880개 이미지)`, 'blue');
  log(`  동시 업로드: 10개 병렬`, 'blue');
  log('', 'reset');

  const startTime = Date.now();

  // 배치 3 실행
  const result3 = await executeBatchUpload(3, '/api/admin/images/upload-batch-3');

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

  section('📊 최종 결과');

  if (result3.success) {
    const totalUploaded = result3.data.uploaded;
    const totalFailed = result3.data.failed;

    log(`✓ 총 업로드: ${totalUploaded}개`, 'green');
    log(`✗ 총 실패: ${totalFailed}개`, totalFailed > 0 ? 'red' : 'green');
    log(`⏱️  총 소요 시간: ${totalTime}초`, 'blue');

    if (totalFailed === 0) {
      log(`\n🎉 배치 3/4 업로드가 완료되었습니다!`, 'green');
    }
  } else {
    log(`❌ 배치 3/4 실행에 실패했습니다`, 'red');
    process.exit(1);
  }

  log('', 'reset');
}

main().catch(err => {
  log(`\n❌ 예상치 못한 오류: ${err.message}`, 'red');
  process.exit(1);
});
