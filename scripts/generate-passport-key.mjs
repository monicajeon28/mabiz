#!/usr/bin/env node

/**
 * 여권 암호화 키 생성 스크립트
 * 사용: node scripts/generate-passport-key.mjs
 * 출력: PASSPORT_ENCRYPTION_KEY=<32바이트 hex 문자열>
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

function generatePassportKey() {
  // 32바이트 = 256비트 (AES-256)
  const key = crypto.randomBytes(32).toString('hex');
  return key;
}

function main() {
  const key = generatePassportKey();

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 여권 암호화 키 생성 완료');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📋 .env.local에 다음 라인을 추가하세요:');
  console.log('');
  console.log(`PASSPORT_ENCRYPTION_KEY=${key}`);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('🔐 키 정보:');
  console.log(`   길이: 32바이트 (256비트)`);
  console.log(`   형식: Hex 문자열 (64자)`);
  console.log(`   암호화: AES-256-CBC`);
  console.log('');
  console.log('🚀 배포 시:');
  console.log('   1. Vercel 대시보드에서 Settings > Environment Variables');
  console.log('   2. Add New: PASSPORT_ENCRYPTION_KEY = <위 값 붙여넣기>');
  console.log('   3. Preview, Production 모두 체크');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // 선택사항: .env.local에 자동 추가
  const envLocalPath = path.join(process.cwd(), '.env.local');
  try {
    if (fs.existsSync(envLocalPath)) {
      const content = fs.readFileSync(envLocalPath, 'utf-8');
      if (content.includes('PASSPORT_ENCRYPTION_KEY')) {
        console.log('⚠️  .env.local에 이미 PASSPORT_ENCRYPTION_KEY가 있습니다.');
        console.log('   기존값을 새 값으로 교체할까요? (y/n)');
        console.log('');
        console.log('   지금 하지 않으려면, 위 값을 수동으로 복사하세요.');
      } else {
        const newContent = content.endsWith('\n')
          ? `${content}PASSPORT_ENCRYPTION_KEY=${key}\n`
          : `${content}\nPASSPORT_ENCRYPTION_KEY=${key}\n`;

        fs.writeFileSync(envLocalPath, newContent);
        console.log('✅ .env.local에 자동 추가되었습니다!');
        console.log('');
      }
    } else {
      const newContent = `PASSPORT_ENCRYPTION_KEY=${key}\n`;
      fs.writeFileSync(envLocalPath, newContent);
      console.log('✅ .env.local 파일이 생성되었습니다!');
      console.log('');
    }
  } catch (error) {
    console.log('⚠️  .env.local 자동 추가 실패. 수동으로 추가하세요.');
    console.log(`    오류: ${error.message}`);
    console.log('');
  }
}

main();
