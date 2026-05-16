import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

interface EmailLogData {
  organizationId: string;
  contactId?: string | null;
  email: string;
  subject: string;
  status: 'SENT' | 'FAILED' | 'BLOCKED';
  blockReason?: string | null;
  channel: string;
  timestamp: number;
}

const EMAIL_QUEUE_KEY = 'email:log:queue';
const EMAIL_QUEUE_PROCESSING = 'email:log:processing';
const EMAIL_QUEUE_BATCH_SIZE = 50;
const EMAIL_QUEUE_BATCH_TIMEOUT_MS = 5000; // 5초마다 배치 처리

/**
 * Email 로그를 Redis 큐에 추가
 * - 큐에 실패해도 발송에 영향 없음 (fire-and-forget)
 * - DB 오버로드 시 메모리 큐에서 안전하게 대기
 */
export async function addEmailLog(logData: Omit<EmailLogData, 'timestamp'>) {
  try {
    const data: EmailLogData = {
      ...logData,
      timestamp: Date.now(),
    };

    // Redis 리스트에 추가 (오른쪽에 push)
    await redis.rpush(EMAIL_QUEUE_KEY, JSON.stringify(data));
    logger.log('[Email Queue] 로그 추가됨', { email: logData.email });
  } catch (err) {
    logger.error('[Email Queue] 큐 추가 실패', { err });
    // 큐 실패 시 로깅만 하고 계속 진행
  }
}

/**
 * Redis 큐에서 Email 로그를 읽어 DB에 일괄 저장
 * - 배치 처리로 DB 성능 최적화
 * - 실패 시 자동 재시도 로직 포함
 */
export async function processEmailQueue() {
  const { default: prisma } = await import('@/lib/prisma');

  try {
    // 이미 처리 중인지 확인
    const isProcessing = await redis.get(EMAIL_QUEUE_PROCESSING);
    if (isProcessing) {
      logger.log('[Email Queue] 이미 처리 중입니다');
      return;
    }

    // 처리 중 플래그 설정
    await redis.setex(EMAIL_QUEUE_PROCESSING, 30, '1'); // 30초 타임아웃

    // 큐에서 배치 크기만큼 추출
    const items = await redis.lrange(EMAIL_QUEUE_KEY, 0, EMAIL_QUEUE_BATCH_SIZE - 1);

    if (items.length === 0) {
      logger.log('[Email Queue] 처리할 로그가 없습니다');
      await redis.del(EMAIL_QUEUE_PROCESSING);
      return;
    }

    // 배치 DB 저장
    const logs = items.map((item) => {
      const parsed = JSON.parse(typeof item === 'string' ? item : String(item)) as EmailLogData;
      return {
        organizationId: parsed.organizationId,
        contactId: parsed.contactId ?? null,
        email: parsed.email.slice(0, 5) + '***',
        subjectPreview: parsed.subject.slice(0, 50),
        status: parsed.status,
        blockReason: parsed.blockReason ?? null,
        channel: parsed.channel,
        sentAt: new Date(parsed.timestamp),
      };
    });

    // Prisma createMany로 일괄 저장
    const result = await prisma.emailLog.createMany({
      data: logs,
      skipDuplicates: false,
    });

    logger.log('[Email Queue] 배치 저장 완료', {
      saved: result.count,
      total: items.length,
    });

    // 처리된 항목 큐에서 제거 (배치 크기만큼 왼쪽에서 pop)
    await redis.ltrim(EMAIL_QUEUE_KEY, items.length, -1);

    // 처리 중 플래그 제거
    await redis.del(EMAIL_QUEUE_PROCESSING);

  } catch (err) {
    logger.error('[Email Queue] 처리 실패', { err });

    // 에러 발생 시에도 플래그 제거하여 다음 시도 가능하게
    try {
      await redis.del(EMAIL_QUEUE_PROCESSING);
    } catch {
      // 플래그 제거 실패는 무시 (30초 후 자동 해제)
    }
  }
}

/**
 * Email 큐 상태 조회 (모니터링용)
 */
export async function getEmailQueueStatus() {
  try {
    const queueLength = await redis.llen(EMAIL_QUEUE_KEY);
    const isProcessing = await redis.get(EMAIL_QUEUE_PROCESSING);

    return {
      queueLength,
      isProcessing: !!isProcessing,
      batchSize: EMAIL_QUEUE_BATCH_SIZE,
      batchTimeoutMs: EMAIL_QUEUE_BATCH_TIMEOUT_MS,
    };
  } catch (err) {
    logger.error('[Email Queue] 상태 조회 실패', { err });
    return {
      queueLength: -1,
      isProcessing: false,
      error: true,
    };
  }
}

/**
 * Email 큐 비우기 (테스트/유지보수용)
 */
export async function clearEmailQueue() {
  try {
    await redis.del(EMAIL_QUEUE_KEY);
    await redis.del(EMAIL_QUEUE_PROCESSING);
    logger.log('[Email Queue] 큐 초기화 완료');
  } catch (err) {
    logger.error('[Email Queue] 큐 초기화 실패', { err });
  }
}
