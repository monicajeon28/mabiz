/**
 * Queue 테스트 유틸리티
 * - 개발/테스트 환경에서만 사용
 * - 큐 동작 검증용
 */

import { addSmsLog, processSmsQueue, getSmsQueueStatus } from './sms-queue';
import { addEmailLog, processEmailQueue, getEmailQueueStatus } from './email-queue';
import { logger } from './logger';

/**
 * SMS 로그 추가 및 처리 테스트
 */
export async function testSmsQueueFlow() {
  logger.log('[Queue Test] SMS 큐 테스트 시작');

  try {
    // 1. 큐 상태 초기 확인
    let status = await getSmsQueueStatus();
    logger.log('[Queue Test] SMS 초기 상태', status);

    // 2. 테스트 로그 5개 추가
    for (let i = 1; i <= 5; i++) {
      await addSmsLog({
        organizationId: 'test-org-123',
        contactId: `contact-${i}`,
        phone: `010${1000000 + i}`,
        msg: `Test SMS Message ${i}`,
        status: 'SENT',
        channel: 'TEST',
      });
    }
    logger.log('[Queue Test] SMS 로그 5개 추가 완료');

    // 3. 큐에 들어갔는지 확인
    status = await getSmsQueueStatus();
    logger.log('[Queue Test] SMS 추가 후 상태', status);

    if (status.queueLength !== 5) {
      logger.error('[Queue Test] SMS 큐 크기 오류', { expected: 5, actual: status.queueLength });
      return false;
    }

    // 4. 큐 처리 실행
    await processSmsQueue();
    logger.log('[Queue Test] SMS 큐 처리 완료');

    // 5. 큐가 비워졌는지 확인
    status = await getSmsQueueStatus();
    logger.log('[Queue Test] SMS 처리 후 상태', status);

    if (status.queueLength !== 0) {
      logger.error('[Queue Test] SMS 큐 비우기 실패', { remaining: status.queueLength });
      return false;
    }

    logger.log('[Queue Test] SMS 큐 테스트 통과');
    return true;
  } catch (err) {
    logger.error('[Queue Test] SMS 큐 테스트 실패', { err });
    return false;
  }
}

/**
 * Email 로그 추가 및 처리 테스트
 */
export async function testEmailQueueFlow() {
  logger.log('[Queue Test] Email 큐 테스트 시작');

  try {
    // 1. 큐 상태 초기 확인
    let status = await getEmailQueueStatus();
    logger.log('[Queue Test] Email 초기 상태', status);

    // 2. 테스트 로그 5개 추가
    for (let i = 1; i <= 5; i++) {
      await addEmailLog({
        organizationId: 'test-org-123',
        contactId: `contact-${i}`,
        email: `user${i}@example.com`,
        subject: `Test Email Subject ${i}`,
        status: 'SENT',
        channel: 'TEST',
      });
    }
    logger.log('[Queue Test] Email 로그 5개 추가 완료');

    // 3. 큐에 들어갔는지 확인
    status = await getEmailQueueStatus();
    logger.log('[Queue Test] Email 추가 후 상태', status);

    if (status.queueLength !== 5) {
      logger.error('[Queue Test] Email 큐 크기 오류', { expected: 5, actual: status.queueLength });
      return false;
    }

    // 4. 큐 처리 실행
    await processEmailQueue();
    logger.log('[Queue Test] Email 큐 처리 완료');

    // 5. 큐가 비워졌는지 확인
    status = await getEmailQueueStatus();
    logger.log('[Queue Test] Email 처리 후 상태', status);

    if (status.queueLength !== 0) {
      logger.error('[Queue Test] Email 큐 비우기 실패', { remaining: status.queueLength });
      return false;
    }

    logger.log('[Queue Test] Email 큐 테스트 통과');
    return true;
  } catch (err) {
    logger.error('[Queue Test] Email 큐 테스트 실패', { err });
    return false;
  }
}

/**
 * 전체 큐 테스트 실행
 */
export async function runAllQueueTests() {
  logger.log('[Queue Test] ========== 전체 큐 테스트 시작 ==========');

  const smsResult = await testSmsQueueFlow();
  logger.log('[Queue Test] SMS 테스트:', smsResult ? '통과' : '실패');

  const emailResult = await testEmailQueueFlow();
  logger.log('[Queue Test] Email 테스트:', emailResult ? '통과' : '실패');

  const allPassed = smsResult && emailResult;
  logger.log('[Queue Test] ========== 전체 테스트 결과:', allPassed ? '통과' : '실패', '==========');

  return {
    sms: smsResult,
    email: emailResult,
    passed: allPassed,
  };
}

/**
 * 대량 부하 테스트 (성능 검증용)
 */
export async function loadTestQueues(count: number = 1000) {
  logger.log(`[Queue Test] 대량 부하 테스트 시작 (${count}개)`);

  try {
    const startTime = Date.now();

    // SMS 대량 추가
    for (let i = 0; i < count; i++) {
      await addSmsLog({
        organizationId: 'load-test-org',
        phone: `010${(1000000 + (i % 9999999)).toString().slice(0, 8)}`,
        msg: `Load Test SMS ${i}`,
        status: 'SENT',
        channel: 'LOAD_TEST',
      });
    }

    const addTime = Date.now() - startTime;
    logger.log(`[Queue Test] SMS ${count}개 추가 완료 (${addTime}ms)`);

    // 큐 상태 확인
    const status = await getSmsQueueStatus();
    logger.log('[Queue Test] 큐 상태', { queueLength: status.queueLength, addTimeMs: addTime });

    // 처리
    const processStartTime = Date.now();
    await processSmsQueue();
    const processTime = Date.now() - processStartTime;

    logger.log(`[Queue Test] 큐 처리 완료 (${processTime}ms)`);

    return {
      count,
      addTimeMs: addTime,
      processTimeMs: processTime,
      avgAddTimePerLog: addTime / count,
      avgProcessTimePerLog: processTime / Math.ceil(count / 50),
    };
  } catch (err) {
    logger.error('[Queue Test] 부하 테스트 실패', { err });
    return null;
  }
}
