#!/usr/bin/env npx ts-node
/**
 * Aligo SMS API 테스트 스크립트
 *
 * 용도: Aligo SMS API 연동 검증
 * 실행: npx ts-node scripts/test-aligo-sms.ts
 *
 * 기능:
 * - Aligo API 연결 테스트
 * - 테스트 SMS 발송
 * - 메시지 상태 조회
 *
 * 완성: 2026-05-28 | Agent B
 */

import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(__dirname, '../.env.local') });
config({ path: path.resolve(__dirname, '../.env') });

// ─────────────────────────────────────────────────────────────────────────────
// Aligo 클라이언트 (src/lib/aligo/client.ts 참고)
// ─────────────────────────────────────────────────────────────────────────────

const ALIGO_API_BASE = 'https://apis.aligo.in';

interface AligoSendRequest {
  receiver: string;
  message: string;
  title?: string;
  messageType?: 'SMS' | 'LMS';
}

interface AligoSendResponse {
  resultCode: number;
  message: string;
  msgId?: string;
  failCount?: number;
}

async function sendAligoSms(
  request: AligoSendRequest,
  apiKey: string,
  userId: string,
  senderPhone: string
): Promise<AligoSendResponse> {
  const params = new URLSearchParams();
  params.append('key', apiKey);
  params.append('user_id', userId);
  params.append('sender', senderPhone);
  params.append('receiver', request.receiver);
  params.append('msg', request.message);
  params.append('msg_type', request.messageType || 'SMS');

  if (request.title) {
    params.append('title', request.title);
  }

  try {
    const response = await fetch(`${ALIGO_API_BASE}/send/`, {
      method: 'POST',
      body: params,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const text = await response.text();

    // Aligo 응답 파싱 (각 줄이 key=value)
    const result: any = {};
    text.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        if (key === 'result_code') {
          result.resultCode = parseInt(value, 10);
        } else if (key === 'message') {
          result.message = decodeURIComponent(value);
        } else if (key === 'msg_id') {
          result.msgId = value;
        } else if (key === 'fail_count') {
          result.failCount = parseInt(value, 10);
        }
      }
    });

    return result as AligoSendResponse;
  } catch (err) {
    console.error('❌ Aligo API 호출 실패:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 테스트
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n═════════════════════════════════════════════════════════════════');
  console.log('📱 Aligo SMS API 테스트');
  console.log('═════════════════════════════════════════════════════════════════\n');

  // 1. 환경변수 확인
  console.log('📋 Step 1: 환경변수 확인\n');

  const apiKey = process.env.ALIGO_API_KEY;
  const userId = process.env.ALIGO_USER_ID;
  const senderPhone = process.env.ALIGO_SENDER_PHONE;

  if (!apiKey || !userId || !senderPhone) {
    console.error('❌ 필수 환경변수 미설정');
    console.error('   - ALIGO_API_KEY:', apiKey ? '✓' : '✗');
    console.error('   - ALIGO_USER_ID:', userId ? '✓' : '✗');
    console.error('   - ALIGO_SENDER_PHONE:', senderPhone ? '✓' : '✗');
    console.error('\n.env 파일을 확인하고 다시 시도하세요.\n');
    process.exit(1);
  }

  console.log('✓ API Key:', `${apiKey.substring(0, 10)}...`);
  console.log('✓ User ID:', userId);
  console.log('✓ Sender Phone:', senderPhone);
  console.log();

  // 2. SMS 발송 테스트 (드라이런)
  console.log('📋 Step 2: SMS 발송 테스트\n');

  const testMessage = `[마비즈 CRM] Loop 5 SMS 테스트입니다.
Day 0: 초기 연락 + 문제 인식
폼 작성 유도를 위한 테스트 메시지입니다.`;

  const testRequest: AligoSendRequest = {
    receiver: '01012345678', // ⚠️  테스트 번호 (실제 번호로 변경 필요)
    message: testMessage,
    messageType: 'SMS',
  };

  console.log('테스트 메시지:');
  console.log(`  수신자: ${testRequest.receiver}`);
  console.log(`  메시지: ${testRequest.message}`);
  console.log(`  타입: ${testRequest.messageType}`);
  console.log();

  console.log('⚠️  주의: 실제 SMS를 발송하시겠습니까? (Y/n)');
  console.log('   • 실제 번호로 SMS가 발송됩니다');
  console.log('   • SMS 비용이 차감됩니다');
  console.log('   • 테스트는 개인 휴대폰 번호로만 추천\n');

  // 프로덕션이 아니거나 자동 테스트 시 건조 실행
  const isDryRun = process.env.NODE_ENV !== 'production' || process.argv.includes('--dry-run');

  if (isDryRun) {
    console.log('🔄 드라이런 모드: 실제 발송하지 않음\n');

    console.log('발송 예상 결과:');
    console.log('  resultCode: 1 (성공)');
    console.log('  message: "success"');
    console.log('  msgId: "20260528_xxxxxxxx"');
    console.log();

    console.log('✓ 건조 실행 완료\n');

  } else {
    try {
      console.log('📤 SMS 발송 중...\n');

      const response = await sendAligoSms(
        testRequest,
        apiKey,
        userId,
        senderPhone
      );

      console.log('📨 Aligo API 응답:\n');
      console.log(`  Result Code: ${response.resultCode}`);
      console.log(`  Message: ${response.message}`);
      console.log(`  Message ID: ${response.msgId || 'N/A'}`);
      console.log(`  Fail Count: ${response.failCount || 0}`);
      console.log();

      if (response.resultCode === 1) {
        console.log('✅ SMS 발송 성공!\n');

        console.log('다음 단계:');
        console.log('  1. 수신자 휴대폰에서 메시지 수신 확인');
        console.log('  2. CRM > Messages > SMS Logs 에서 발송 기록 조회');
        console.log('  3. Day 1-3 자동 발송 테스트\n');

      } else {
        console.log('❌ SMS 발송 실패\n');

        console.log('에러 코드별 대응:');
        console.log('  -1: 일시적 오류 (재시도 권장)');
        console.log('  -2: 잘못된 API 키');
        console.log('  -3: 잘못된 수신자 번호');
        console.log('  -4: 잔액 부족');
        console.log('  -10: 발신 번호 미인증\n');

        console.log('조치:');
        console.log('  1. Aligo 대시보드 확인: https://aligo.in');
        console.log('  2. API 키 재확인');
        console.log('  3. 발신 번호 승인 상태 확인');
        console.log('  4. 잔액 확인\n');
      }

    } catch (err) {
      console.error('❌ SMS 발송 오류:\n');
      console.error(err);
      console.error();
    }
  }

  // 3. Day 0-3 시퀀스 테스트 계획
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('📋 Day 0-3 SMS 자동화 시퀀스 테스트 계획');
  console.log('═════════════════════════════════════════════════════════════════\n');

  const schedule = [
    {
      day: 'Day 0',
      delay: '즉시',
      stage: 'PASONA P (Problem)',
      sample: '크루즈 여행, 혼자는 너무 외로워요. 가족/친구와 함께 가고 싶다면? (클릭)',
    },
    {
      day: 'Day 1',
      delay: '24시간 후',
      stage: 'PASONA S (Solution)',
      sample: '마비즈 크루즈: 최고의 가성비 + 맞춤형 일정. 지금 신청하면 10% 할인!',
    },
    {
      day: 'Day 2',
      delay: '48시간 후',
      stage: 'PASONA O (Offer)',
      sample: '한정 예약: 이번 달 마지막 6자리만 남았어요. 지금 확정 신청!',
    },
    {
      day: 'Day 3',
      delay: '72시간 후',
      stage: 'PASONA N (Now)',
      sample: '12시간만 더! 특가 종료. 지금 신청 → 즉시 확인 가능',
    },
  ];

  schedule.forEach(item => {
    console.log(`${item.day} (+${item.delay})`);
    console.log(`  Stage: ${item.stage}`);
    console.log(`  Sample: ${item.sample}`);
    console.log();
  });

  // 4. 배포 체크리스트
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('✅ 배포 전 체크리스트');
  console.log('═════════════════════════════════════════════════════════════════\n');

  console.log('[ ] 1. Aligo SMS API 설정 완료');
  console.log('     ├─ ALIGO_API_KEY: ✓');
  console.log('     ├─ ALIGO_USER_ID: ✓');
  console.log('     └─ ALIGO_SENDER_PHONE: ✓ (승인된 발신 번호)\n');

  console.log('[ ] 2. 데이터베이스 마이그레이션');
  console.log('     └─ npx prisma migrate deploy\n');

  console.log('[ ] 3. FormSubmission 테이블 확인');
  console.log('     └─ SELECT * FROM "FormSubmission" LIMIT 1\n');

  console.log('[ ] 4. Contact Form 테스트');
  console.log('     └─ npm run dev > http://localhost:3000 > 폼 제출\n');

  console.log('[ ] 5. SMS 자동 발송 테스트');
  console.log('     └─ npx prisma studio > ScheduledSms 레코드 생성\n');

  console.log('[ ] 6. 환경변수 Vercel 배포');
  console.log('     └─ Settings > Environment Variables > Production\n');

  console.log('[ ] 7. 빌드 & 배포');
  console.log('     └─ git push origin main\n');

  console.log('═════════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
