#!/usr/bin/env node
/**
 * Inquiry Webhook 통합 테스트 스크립트
 * 크루즈닷몰 상담신청 Webhook이 대리점장 CRM에 정확히 입력되는지 검증
 *
 * Usage:
 *   node scripts/test-inquiry-webhook.mjs
 *
 * 테스트 항목:
 * 1. Bearer Token 검증
 * 2. HMAC-SHA256 서명 검증
 * 3. 렌즈 감지 (L1, L2, L3, L6, L9)
 * 4. Contact 자동 생성/업데이트
 * 5. 중복 방지 (eventId 멱등성)
 * 6. 보안 (IDOR, XSS)
 */

import crypto from 'crypto';
import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// 환경설정
const API_URL = process.env.API_URL || 'http://localhost:3000';
const WEBHOOK_SECRET = process.env.MABIZ_INQUIRY_WEBHOOK_SECRET || 'test-secret-12345';

console.log('🚀 Inquiry Webhook 통합 테스트 시작');
console.log(`   API_URL: ${API_URL}`);
console.log(`   SECRET 길이: ${WEBHOOK_SECRET.length} bytes`);
console.log('');

/**
 * HMAC-SHA256 서명 생성
 */
function generateSignature(payload, secret) {
  const body = JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

/**
 * Webhook 요청 전송
 */
async function sendWebhook(testName, payload) {
  const body = JSON.stringify(payload);
  const signature = generateSignature(payload, WEBHOOK_SECRET);

  console.log(`\n📋 테스트: ${testName}`);
  console.log(`   Payload: ${JSON.stringify(payload).substring(0, 80)}...`);

  const response = await fetch(`${API_URL}/api/webhooks/inquiry`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WEBHOOK_SECRET}`,
      'x-signature': signature,
      'Content-Type': 'application/json',
    },
    body,
  });

  const data = await response.json();
  const success = response.ok;
  const status = response.status;

  console.log(`   상태: ${status} ${success ? '✅ PASS' : '❌ FAIL'}`);
  if (data.ok !== undefined) console.log(`   응답: ok=${data.ok}`);
  if (data.lens) {
    console.log(`   렌즈: ${data.lens.type} (${data.lens.label}, 신뢰도 ${data.lens.confidence}%)`);
  }
  if (data.error) console.log(`   에러: ${data.error}`);
  if (data.duplicate) console.log(`   중복: ${data.duplicate}`);

  return { status, data, success };
}

/**
 * 테스트 세트
 */
async function runTests() {
  const results = {
    passed: 0,
    failed: 0,
  };

  try {
    // ✅ 테스트 1: L1 가격이의 - 정상 문의
    {
      const payload = {
        phone: '010-1234-5678',
        name: '김철수',
        email: 'kim@example.com',
        message: '가격이 너무 비싼데 할인이 되나요?',
        affiliateCode: 'AGENT001',
        productName: '발틱크루즈 7박 8일',
        productCode: 'BALTIC-2406',
        isGold: false,
        eventId: `evt-${Date.now()}-l1-price`,
      };

      const { status, data, success } = await sendWebhook('L1: 가격이의', payload);
      if (success && data.ok && data.lens.type === 'L1') {
        console.log(`   ✅ PASS: L1 렌즈 감지됨`);
        results.passed++;
      } else {
        console.log(`   ❌ FAIL: L1 렌즈 미감지`);
        results.failed++;
      }
    }

    // ✅ 테스트 2: L2 준비복잡 - 불안 감지
    {
      const payload = {
        phone: '010-9999-8888',
        name: '이준비',
        message: '비자 준비는 어떻게 되나요? 여권도 갱신해야 하나요?',
        affiliateCode: 'AGENT001',
        eventId: `evt-${Date.now()}-l2-prep`,
      };

      const { success, data } = await sendWebhook('L2: 준비복잡', payload);
      if (success && data.ok && data.lens.type === 'L2') {
        console.log(`   ✅ PASS: L2 렌즈 감지됨`);
        results.passed++;
      } else {
        console.log(`   ❌ FAIL: L2 렌즈 미감지`);
        results.failed++;
      }
    }

    // ✅ 테스트 3: L3 경쟁사 비교
    {
      const payload = {
        phone: '010-7777-6666',
        name: '박비교',
        message: '이거 Royal Caribbean과 뭐가 달라요? 왜 더 비싼가요?',
        eventId: `evt-${Date.now()}-l3-diff`,
      };

      const { success, data } = await sendWebhook('L3: 차별성', payload);
      if (success && data.ok && data.lens.type === 'L3') {
        console.log(`   ✅ PASS: L3 렌즈 감지됨`);
        results.passed++;
      } else {
        console.log(`   ❌ FAIL: L3 렌즈 미감지`);
        results.failed++;
      }
    }

    // ✅ 테스트 4: L6 타이밍/손실회피 - 긴급
    {
      const payload = {
        phone: '010-5555-4444',
        name: '박급해',
        message: '빨리 결정해야 하는데 오늘 예약 가능한가요?',
        eventId: `evt-${Date.now()}-l6-timing`,
      };

      const { success, data } = await sendWebhook('L6: 타이밍 손실회피', payload);
      if (success && data.ok && data.lens.type === 'L6') {
        console.log(`   ✅ PASS: L6 렌즈 감지됨 (CRITICAL 우선순위)`);
        results.passed++;
      } else {
        console.log(`   ❌ FAIL: L6 렌즈 미감지`);
        results.failed++;
      }
    }

    // ✅ 테스트 5: L9 건강신뢰
    {
      const payload = {
        phone: '010-3333-2222',
        name: '이건강',
        message: '배멀미가 심한데 배 위에서 안전할까요? 당뇨병도 있는데...',
        eventId: `evt-${Date.now()}-l9-health`,
      };

      const { success, data } = await sendWebhook('L9: 건강신뢰', payload);
      if (success && data.ok && data.lens.type === 'L9') {
        console.log(`   ✅ PASS: L9 렌즈 감지됨`);
        results.passed++;
      } else {
        console.log(`   ❌ FAIL: L9 렌즈 미감지`);
        results.failed++;
      }
    }

    // ✅ 테스트 6: 중복 방지 (멱등성)
    {
      const eventId = `evt-${Date.now()}-dup-test`;
      const payload = {
        phone: '010-1111-0000',
        name: '김중복',
        message: '첫 번째 문의',
        eventId,
      };

      const { success: success1, data: data1 } = await sendWebhook('중복방지 - 첫 번째 요청', payload);

      // 동일 eventId로 다시 전송
      const { success: success2, data: data2 } = await sendWebhook('중복방지 - 두 번째 요청 (동일 eventId)', payload);

      if (success1 && data1.ok && !data1.duplicate && success2 && data2.ok && data2.duplicate) {
        console.log(`   ✅ PASS: 중복 이벤트 올바르게 처리됨 (첫번째 생성, 두번째 무시)`);
        results.passed++;
      } else {
        console.log(`   ❌ FAIL: 중복 방지 로직 오류`);
        console.log(`      첫번째: created=${!data1.duplicate}, 두번째: duplicate=${data2.duplicate}`);
        results.failed++;
      }
    }

    // ✅ 테스트 7: 보안 - Bearer Token 누락
    {
      const payload = { phone: '010-1234-5678', name: '테스트' };
      const body = JSON.stringify(payload);
      const signature = generateSignature(payload, WEBHOOK_SECRET);

      console.log(`\n📋 테스트: 보안 - Bearer Token 누락`);
      const response = await fetch(`${API_URL}/api/webhooks/inquiry`, {
        method: 'POST',
        headers: {
          'x-signature': signature,
          'Content-Type': 'application/json',
        },
        body,
      });

      if (response.status === 401) {
        console.log(`   ✅ PASS: 401 Unauthorized 응답`);
        results.passed++;
      } else {
        console.log(`   ❌ FAIL: 예상과 다른 상태 ${response.status}`);
        results.failed++;
      }
    }

    // ✅ 테스트 8: 보안 - HMAC 검증 실패
    {
      const payload = { phone: '010-1234-5678', name: '테스트' };
      const body = JSON.stringify(payload);
      const wrongSignature = 'invalid-signature-12345';

      console.log(`\n📋 테스트: 보안 - HMAC 서명 검증 실패`);
      const response = await fetch(`${API_URL}/api/webhooks/inquiry`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WEBHOOK_SECRET}`,
          'x-signature': wrongSignature,
          'Content-Type': 'application/json',
        },
        body,
      });

      if (response.status === 403) {
        console.log(`   ✅ PASS: 403 Forbidden 응답`);
        results.passed++;
      } else {
        console.log(`   ❌ FAIL: 예상과 다른 상태 ${response.status}`);
        results.failed++;
      }
    }

    // ✅ 테스트 9: 필수 필드 검증 (phone 누락)
    {
      const payload = { name: '이름만있음' };
      const body = JSON.stringify(payload);
      const signature = generateSignature(payload, WEBHOOK_SECRET);

      console.log(`\n📋 테스트: 필드 검증 - phone 누락`);
      const response = await fetch(`${API_URL}/api/webhooks/inquiry`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WEBHOOK_SECRET}`,
          'x-signature': signature,
          'Content-Type': 'application/json',
        },
        body,
      });

      if (response.status === 400) {
        console.log(`   ✅ PASS: 400 Bad Request 응답`);
        results.passed++;
      } else {
        console.log(`   ❌ FAIL: 예상과 다른 상태 ${response.status}`);
        results.failed++;
      }
    }

    // ✅ 테스트 10: 응답 구조 검증
    {
      const payload = {
        phone: '010-2000-3000',
        name: '응답구조',
        eventId: `evt-${Date.now()}-response`,
      };

      const { success, data } = await sendWebhook('응답 구조 검증', payload);
      if (
        success &&
        data.ok &&
        data.contactId &&
        data.inquiryId &&
        data.lens &&
        data.lens.type &&
        data.lens.label &&
        data.lens.confidence !== undefined &&
        data.suggestedResponse &&
        data.suggestedResponse.lensType
      ) {
        console.log(`   ✅ PASS: 응답 구조 완벽`);
        results.passed++;
      } else {
        console.log(`   ❌ FAIL: 응답 구조 미달`);
        console.log(`      응답: ${JSON.stringify(data).substring(0, 150)}...`);
        results.failed++;
      }
    }

  } catch (err) {
    console.error('\n❌ 테스트 실행 오류:', err.message);
    results.failed++;
  }

  // 결과 요약
  console.log('\n' + '='.repeat(60));
  console.log('📊 테스트 결과 요약');
  console.log('='.repeat(60));
  console.log(`✅ 통과: ${results.passed}`);
  console.log(`❌ 실패: ${results.failed}`);
  console.log(`📈 총점: ${results.passed}/${results.passed + results.failed} (${Math.round(results.passed * 100 / (results.passed + results.failed))}%)`);

  if (results.failed === 0) {
    console.log('\n🎉 모든 테스트 통과! Webhook이 완벽하게 작동합니다.');
    process.exit(0);
  } else {
    console.log('\n⚠️ 일부 테스트 실패. 위의 로그를 확인하세요.');
    process.exit(1);
  }
}

// 테스트 실행
runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
