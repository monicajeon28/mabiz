import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!redisUrl || !redisToken) {
  throw new Error('Missing required Redis configuration: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
}

const redis = new Redis({
  url: redisUrl,
  token: redisToken,
});

interface SmsLogData {
  organizationId: string;
  contactId?: string | null;
  phone: string;
  msg: string;
  status: 'SENT' | 'FAILED' | 'BLOCKED';
  blockReason?: string | null;
  resultCode?: string | null;
  msgId?: string | null;
  channel: string;
  timestamp: number;
}

const SMS_QUEUE_KEY = 'sms:log:queue';
const SMS_QUEUE_PROCESSING = 'sms:log:processing';
const SMS_QUEUE_BATCH_SIZE = 50;
const SMS_QUEUE_BATCH_TIMEOUT_MS = 5000; // 5초마다 배치 처리

/**
 * SMS 로그를 Redis 큐에 추가
 * - 큐에 실패해도 발송에 영향 없음 (fire-and-forget)
 * - DB 오버로드 시 메모리 큐에서 안전하게 대기
 */
export async function addSmsLog(logData: Omit<SmsLogData, 'timestamp'>) {
  try {
    const data: SmsLogData = {
      ...logData,
      timestamp: Date.now(),
    };

    // Redis 리스트에 추가 (오른쪽에 push)
    await redis.rpush(SMS_QUEUE_KEY, JSON.stringify(data));
    logger.log('[SMS Queue] 로그 추가됨', { phone: logData.phone });
  } catch (err) {
    logger.error('[SMS Queue] 큐 추가 실패', { err });
    // 큐 실패 시 로깅만 하고 계속 진행
  }
}

/**
 * Redis 큐에서 SMS 로그를 읽어 DB에 일괄 저장
 * - 배치 처리로 DB 성능 최적화
 * - 실패 시 자동 재시도 로직 포함
 */
export async function processSmsQueue() {
  const { default: prisma } = await import('@/lib/prisma');

  try {
    // 이미 처리 중인지 확인
    const isProcessing = await redis.get(SMS_QUEUE_PROCESSING);
    if (isProcessing) {
      logger.log('[SMS Queue] 이미 처리 중입니다');
      return;
    }

    // 처리 중 플래그 설정
    await redis.setex(SMS_QUEUE_PROCESSING, 30, '1'); // 30초 타임아웃

    // 큐에서 배치 크기만큼 추출
    const items = await redis.lrange(SMS_QUEUE_KEY, 0, SMS_QUEUE_BATCH_SIZE - 1);

    if (items.length === 0) {
      logger.log('[SMS Queue] 처리할 로그가 없습니다');
      await redis.del(SMS_QUEUE_PROCESSING);
      return;
    }

    // 배치 DB 저장
    const logs = items.map((item) => {
      const parsed = JSON.parse(typeof item === 'string' ? item : String(item)) as SmsLogData;
      return {
        organizationId: parsed.organizationId,
        contactId: parsed.contactId ?? null,
        phone: parsed.phone,
        contentPreview: parsed.msg.slice(0, 30),
        status: parsed.status,
        blockReason: parsed.blockReason ?? null,
        resultCode: parsed.resultCode ?? null,
        msgId: parsed.msgId ?? null,
        channel: parsed.channel,
        sentAt: new Date(parsed.timestamp),
      };
    });

    // Prisma createMany로 일괄 저장
    const result = await prisma.smsLog.createMany({
      data: logs,
      skipDuplicates: false,
    });

    logger.log('[SMS Queue] 배치 저장 완료', {
      saved: result.count,
      total: items.length,
    });

    // 처리된 항목 큐에서 제거 (배치 크기만큼 왼쪽에서 pop)
    await redis.ltrim(SMS_QUEUE_KEY, items.length, -1);

    // 처리 중 플래그 제거
    await redis.del(SMS_QUEUE_PROCESSING);

  } catch (err) {
    logger.error('[SMS Queue] 처리 실패', { err });

    // 에러 발생 시에도 플래그 제거하여 다음 시도 가능하게
    try {
      await redis.del(SMS_QUEUE_PROCESSING);
    } catch {
      // 플래그 제거 실패는 무시 (30초 후 자동 해제)
    }
  }
}

/**
 * SMS 큐 상태 조회 (모니터링용)
 */
export async function getSmsQueueStatus() {
  try {
    const queueLength = await redis.llen(SMS_QUEUE_KEY);
    const isProcessing = await redis.get(SMS_QUEUE_PROCESSING);

    return {
      queueLength,
      isProcessing: !!isProcessing,
      batchSize: SMS_QUEUE_BATCH_SIZE,
      batchTimeoutMs: SMS_QUEUE_BATCH_TIMEOUT_MS,
    };
  } catch (err) {
    logger.error('[SMS Queue] 상태 조회 실패', { err });
    return {
      queueLength: -1,
      isProcessing: false,
      error: true,
    };
  }
}

/**
 * SMS 큐 비우기 (테스트/유지보수용)
 */
export async function clearSmsQueue() {
  try {
    await redis.del(SMS_QUEUE_KEY);
    await redis.del(SMS_QUEUE_PROCESSING);
    logger.log('[SMS Queue] 큐 초기화 완료');
  } catch (err) {
    logger.error('[SMS Queue] 큐 초기화 실패', { err });
  }
}
