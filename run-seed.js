#!/usr/bin/env node
/**
 * Seed 스크립트 실행 헬퍼
 * .env.local 파일을 읽고 환경변수에 로드한 후 실제 seed 스크립트 실행
 */

const fs = require('fs');
const path = require('path');

// .env.local 파일 읽기
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // 주석이나 빈 줄 건너뛰기
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();

      // 따옴표 제거
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      // 이미 설정되지 않은 경우에만 설정
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }

  console.log('✅ Environment variables loaded from .env.local');
} else {
  console.warn('⚠️ .env.local not found');
}

// 실제 seed 스크립트 로드 및 실행
require('./src/lib/seed/funnel-lens-templates.ts');
