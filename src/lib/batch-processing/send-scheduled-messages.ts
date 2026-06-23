/**
 * Jeff Bezos: Email Batch Processing + SMS 병렬 처리
 * Day 0-3 SMS/Email 자동 발송 배치 처리 엔진
 *
 * 성능 목표:
 * - SMS 1M: <10초 (병렬도 10)
 * - Email 1M: <40초 (병렬도 5)
 * - 최대 병렬: 200초 (순차: 50초)
 */

import { prisma } from "@/lib/prisma";
import { sendEmailViaProvider } from "@/lib/email/send-email";
import { logger } from "@/lib/logger";
import { sendSmsWithAligoPublic } from "@/lib/aligo-sms-service";

/**
 * 배치 처리 설정
 */
interface BatchConfig {
  batchSize: number;      // 한 배치 크기
  parallelBatches: number; // 동시 처리 배치 수
  maxRetries: number;     // 실패 시 최대 재시도
}

const SMS_BATCH_CONFIG: BatchConfig = {
  batchSize: 1000,
  parallelBatches: 10,
  maxRetries: 3,
};

const EMAIL_BATCH_CONFIG: BatchConfig = {
  batchSize: 500,
  parallelBatches: 5,
  maxRetries: 3,
};

/**
 * Day 0-3 스케줄 메시지 발송 (SMS/Email 병렬)
 *
 * Cron Job 호출:
 * POST /api/cron/send-scheduled-messages?day=0&type=sms
 * POST /api/cron/send-scheduled-messages?day=0&type=email (5분 뒤)
 *
 * @param organizationId 조직 ID
 * @param day 발송 일차 (0-3)
 * @param type 채널 타입 ("sms" | "email")
 */
export async function sendScheduledMessages(
  organizationId: string,
  day: number,
  type: "sms" | "email"
): Promise<{
  successCount: number;
  failCount: number;
  duration: number;
  batchExecutionId: string;
}> {
  const startTime = Date.now();
  const config = type === "sms" ? SMS_BATCH_CONFIG : EMAIL_BATCH_CONFIG;

  try {
    // 1단계: 배치 크기 결정 (병렬도 고려)
    const BATCH_SIZE = config.batchSize;
    const PARALLEL_COUNT = config.parallelBatches;
    const LIMIT = BATCH_SIZE * PARALLEL_COUNT;

    // 2단계: 발송 대상 쿼리 (인덱스로 빠르게)
    logger.info(`[Batch] ${type.toUpperCase()} Day ${day} 시작`, {
      organizationId,
      limit: LIMIT,
    });

    // 야간 차단 로직 (KST 기준)
    const now = new Date();
    const kstHour = (now.getUTCHours() + 9) % 24;
    const canProcessNightBlocked = kstHour >= 8; // 08:00 이후 처리 가능

    const messages =
      type === "sms"
        ? await prisma.scheduledSms.findMany({
            where: {
              organizationId,
              status: canProcessNightBlocked
                ? { in: ["PENDING", "NIGHT_BLOCKED"] }  // 아침에는 NIGHT_BLOCKED도 처리
                : "PENDING",                             // 밤에는 PENDING만
              scheduledAt: { lte: now },
            },
            select: {
              id: true,
              contactId: true,
              groupId: true,
              message: true,
              organizationId: true,
            },
            take: LIMIT,
            orderBy: { scheduledAt: "asc" },
          })
        : await prisma.scheduledEmailMessage.findMany({
            where: {
              organizationId,
              day,
              status: canProcessNightBlocked
                ? { in: ["PENDING", "NIGHT_BLOCKED"] }  // 아침에는 NIGHT_BLOCKED도 처리
                : "PENDING",                             // 밤에는 PENDING만
              scheduledAt: { lte: now },
            },
            select: {
              id: true,
              contactId: true,
              groupId: true,
              subject: true,
              htmlContent: true,
              textContent: true,
              variables: true,
              organizationId: true,
              senderUserId: true,
            },
            take: LIMIT,
            orderBy: { scheduledAt: "asc" },
          });

    if (messages.length === 0) {
      logger.info(`[Batch] ${type.toUpperCase()} Day ${day} 발송 대상 없음`);

      // 메시지 0개일 때도 로그 생성
      const batchLog = await prisma.batchExecutionLog.create({
        data: {
          organizationId,
          batchType: `${type.toUpperCase()}_DAY${day}`,
          totalCount: 0,
          successCount: 0,
          failCount: 0,
          startedAt: new Date(startTime),
          completedAt: new Date(),
          duration: 0,
          errorRate: 0,
        },
      });

      return {
        successCount: 0,
        failCount: 0,
        duration: 0,
        batchExecutionId: batchLog.id,
      };
    }

    // 3단계: 배치 분할
    const batches = [];
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      batches.push(messages.slice(i, i + BATCH_SIZE));
    }

    logger.info(
      `[Batch] ${type.toUpperCase()} Day ${day} ${batches.length}개 배치로 분할`,
      { messageCount: messages.length, batchSize: BATCH_SIZE }
    );

    // 4단계: 병렬 처리 (Promise.allSettled 사용)
    const results = await Promise.allSettled(
      batches.map((batch, idx) => sendBatch(batch, type, organizationId, idx))
    );

    // 5단계: 결과 집계
    let successCount = 0,
      failCount = 0;
    for (const result of results) {
      if (result.status === "fulfilled") {
        successCount += result.value.success;
        failCount += result.value.fail;
      } else {
        failCount += BATCH_SIZE;
        logger.error(`[Batch] 배치 처리 중 오류:`, result.reason);
      }
    }

    // 6단계: 로그 기록
    const duration = Date.now() - startTime;
    const errorRate = messages.length > 0 ? (failCount / messages.length) * 100 : 0;

    const batchLog = await prisma.batchExecutionLog.create({
      data: {
        organizationId,
        batchType: `${type.toUpperCase()}_DAY${day}`,
        totalCount: messages.length,
        successCount,
        failCount,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        duration,
        averageLatency: duration / messages.length,
        peakQueueSize: PARALLEL_COUNT,
        errorRate,
        errorSummary: JSON.stringify({
          failCount,
          errorRate: `${errorRate.toFixed(2)}%`,
          timestamp: new Date().toISOString(),
        }),
      },
    });

    logger.info(`[Batch] ${type.toUpperCase()} Day ${day} 완료`, {
      successCount,
      failCount,
      duration,
      errorRate: `${errorRate.toFixed(2)}%`,
    });

    return {
      successCount,
      failCount,
      duration,
      batchExecutionId: batchLog.id,
    };
  } catch (error) {
    logger.error(`[Batch] ${type.toUpperCase()} Day ${day} 오류:`, error);

    // 에러 발생 시에도 로그 생성
    const duration = Date.now() - startTime;
    const batchLog = await prisma.batchExecutionLog.create({
      data: {
        organizationId,
        batchType: `${type.toUpperCase()}_DAY${day}`,
        totalCount: 0,
        successCount: 0,
        failCount: 0,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        duration,
        errorRate: 0,
        errorSummary: JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        }),
      },
    });

    // 원본 에러는 여전히 throw (상위 핸들러에서 처리)
    throw error;
  }
}

/**
 * 개별 배치 전송
 */
async function sendBatch(
  messages: any[],
  type: "sms" | "email",
  organizationId: string,
  batchIndex: number
): Promise<{ success: number; fail: number }> {
  let success = 0,
    fail = 0;

  for (const msg of messages) {
    try {
      if (type === "sms") {
        // SMS 발송 (Contact에서 전화번호 조회)
        const contact = await prisma.contact.findUnique({
          where: { id: msg.contactId },
          select: { phone: true },
        });

        if (!contact || !contact.phone) {
          throw new Error(`Contact ${msg.contactId} has no phone`);
        }

        // 조직의 SMS 설정 조회
        const smsConfig = await prisma.orgSmsConfig.findUnique({
          where: { organizationId },
        });

        if (!smsConfig) {
          throw new Error(`SMS config not found for org ${organizationId}`);
        }

        // Aligo API로 SMS 발송
        await sendSmsWithAligoPublic(
          smsConfig.aligoUserId,
          smsConfig.aligoKey,
          smsConfig.senderPhone,
          contact.phone,
          msg.message
        );

        // ScheduledSms 상태 업데이트
        await prisma.scheduledSms.update({
          where: { id: msg.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
            sentCount: { increment: 1 },
          },
        });
      } else {
        // Email 발송 (Contact에서 이메일 조회)
        const contact = await prisma.contact.findUnique({
          where: { id: msg.contactId },
          select: { email: true },
        });

        if (!contact || !contact.email) {
          throw new Error(`Contact ${msg.contactId} has no email`);
        }

        await sendEmailViaProvider({
          organizationId,
          contactId: msg.contactId,
          subject: msg.subject,
          htmlContent: msg.htmlContent,
          textContent: msg.textContent,
          variables: msg.variables,
          email: contact.email,
          senderUserId: msg.senderUserId ?? undefined,
          groupId: msg.groupId ?? undefined,
        });

        // ScheduledEmailMessage 상태 업데이트
        await prisma.scheduledEmailMessage.update({
          where: { id: msg.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
          },
        });
      }

      success++;
    } catch (error) {
      fail++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(
        `[Batch] ${type.toUpperCase()} 메시지 발송 실패:`,
        {
          messageId: msg.id,
          error: errorMsg,
        }
      );

      // 실패 기록
      if (type === "sms") {
        await prisma.scheduledSms.update({
          where: { id: msg.id },
          data: {
            status: "FAILED",
            failureReason: errorMsg,
            failedCount: { increment: 1 },
          },
        });
      } else {
        await prisma.scheduledEmailMessage.update({
          where: { id: msg.id },
          data: {
            status: "FAILED",
            failureReason: errorMsg,
          },
        });
      }
    }
  }

  logger.info(
    `[Batch] Batch #${batchIndex} 완료: ${success} 성공, ${fail} 실패`
  );
  return { success, fail };
}
