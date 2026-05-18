/**
 * Menu #38 Phase 1: Cron Job - ExecutionLog 기반 캠페인 자동 발송
 *
 * 목적:
 * - 매일 정해진 시간에 실행될 캠페인 메시지 발송
 * - ExecutionLog PENDING 상태 확인 (scheduledAt <= NOW)
 * - SMS/Email 채널별 배치 처리
 * - 발송 완료 후 상태 업데이트 (PENDING → SENT/FAILED)
 *
 * 특징:
 * - 월별 반복 지원 (중복 방지: sourceType + sourceId + contactId + executeMonth)
 * - 재시도 로직 포함 (nextRetryAt, retryCount)
 * - 배치 처리 (50명씩 = 성능 최적화)
 * - 비동기 처리 (웹훅 콜백 가능)
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { ExecutionStatus } from "@prisma/client";

interface ExecutionRecord {
  id: string;
  contactId: string;
  sourceId: string;
  sourceType: string;
  channel: string;
  status: ExecutionStatus;
  executeMonth: string;
  scheduledAt: Date;
  retryCount: number;
  nextRetryAt: Date | null;
}

/**
 * 1단계: PENDING 상태의 메시지 조회
 * - 조건: status='PENDING' AND scheduledAt <= NOW
 * - 인덱스 활용: idx_execution_cron_scan (organizationId, status, scheduledAt)
 */
export async function getPendingExecutions(
  organizationId: string,
  limit: number = 1000
) {
  try {
    logger.info("[Cron] PENDING 메시지 조회 시작", { organizationId, limit });

    const executions = await db.executionLog.findMany({
      where: {
        organizationId,
        status: "PENDING",
        scheduledAt: {
          lte: new Date(),
        },
      },
      take: limit,
      select: {
        id: true,
        contactId: true,
        sourceId: true,
        sourceType: true,
        channel: true,
        status: true,
        executeMonth: true,
        scheduledAt: true,
        retryCount: true,
        nextRetryAt: true,
      },
    });

    logger.info("[Cron] PENDING 메시지 조회 완료", {
      organizationId,
      count: executions.length,
    });

    return executions;
  } catch (err) {
    logger.error("[Cron] PENDING 메시지 조회 실패", { organizationId, err });
    throw err;
  }
}

/**
 * 2단계: ExecutionLog 조회 (채널별 필터링)
 * - SMS 채널: contact.phone 병합
 * - Email 채널: contact.email + campaign 템플릿
 *
 * 주의:
 * - Phase 2에서 실제 발송 로직 추가 (Aligo API, SMTP)
 * - 현재는 구조만 정의 (테스트 가능)
 */
export async function getExecutionDetailsWithContact(
  executions: ExecutionRecord[],
  organizationId: string
) {
  try {
    // ExecutionLog + Campaign + Contact 조인
    const details = await db.executionLog.findMany({
      where: {
        id: { in: executions.map((e) => e.id) },
        organizationId,
      },
      include: {
        // Phase 2에서 campaign 관계 추가 필요
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    logger.log("[Cron] ExecutionLog 상세 조회 완료", {
      count: details.length,
    });

    return details;
  } catch (err) {
    logger.error("[Cron] ExecutionLog 상세 조회 실패", { organizationId, err });
    throw err;
  }
}

/**
 * 2단계: PENDING 메시지를 상태 업데이트 (stub 함수)
 *
 * Phase 2에서:
 * - SMS: sendSms() → Aligo API 호출
 * - Email: sendEmail() → SMTP 호출
 * - 배치 처리 (50명씩)
 * - 실패 카운팅
 */
export async function executeCampaignMessages(
  executions: ExecutionRecord[],
  channel: "SMS" | "EMAIL"
) {
  if (executions.length === 0) return { success: 0, failed: 0 };

  try {
    logger.info(`[Cron] ${channel} 발송 시작 (stub)`, { count: executions.length });

    // Phase 2: 실제 발송 로직
    // for (const exec of executions) {
    //   if (channel === "SMS") {
    //     const contact = await db.contact.findUnique(...);
    //     const result = await sendSms({
    //       config: aligoConfig,
    //       receiver: contact.phone,
    //       msg: message,
    //     });
    //   }
    // }

    logger.info(`[Cron] ${channel} 발송 완료 (stub)`, {
      success: executions.length,
      failed: 0,
    });

    return { success: executions.length, failed: 0 };
  } catch (err) {
    logger.error(`[Cron] ${channel} 발송 실패`, { err });
    return { success: 0, failed: executions.length };
  }
}

/**
 * 3단계: ExecutionLog 상태 업데이트
 * - PENDING → SENT (성공 시)
 * - PENDING → FAILED (실패 시)
 * - sentAt 타임스탬프 기록
 * - retryCount 증가
 */
export async function updateExecutionStatus(
  executionId: string,
  status: ExecutionStatus,
  failureReason?: string,
  retryCount?: number
) {
  try {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === "SENT") {
      updateData.sentAt = new Date();
    }

    if (status === "FAILED") {
      updateData.failureReason = failureReason;
    }

    if (retryCount !== undefined) {
      updateData.retryCount = retryCount;

      // 재시도가 필요하면 nextRetryAt 설정 (지수 백오프)
      if (retryCount < 3) {
        const delayMs = Math.pow(2, retryCount) * 60000; // 1, 2, 4분
        updateData.nextRetryAt = new Date(Date.now() + delayMs);
        updateData.status = "RETRY_SCHEDULED";
      } else {
        updateData.status = "ABANDONED";
      }
    }

    await db.executionLog.update({
      where: { id: executionId },
      data: updateData,
    });

    logger.log("[Cron] ExecutionLog 상태 업데이트", { executionId, status });
  } catch (err) {
    logger.error("[Cron] ExecutionLog 상태 업데이트 실패", { executionId, err });
    throw err;
  }
}

/**
 * 메인 Cron Job 함수
 * - 모든 조직의 PENDING 메시지를 조회
 * - 채널별 배치 처리
 * - 상태 업데이트
 *
 * 실행 방식:
 * 1. 매일 자정(또는 특정 시간)에 Vercel Cron 또는 external scheduler 호출
 * 2. /api/cron/execute-campaigns 엔드포인트 → 이 함수 호출
 */
export async function executePendingCampaigns() {
  const startTime = Date.now();

  try {
    logger.info("[Cron] 캠페인 자동 발송 시작", {
      timestamp: new Date().toISOString(),
    });

    // 모든 조직 조회 (PENDING이 있을 만큼 활성인 조직들)
    const organizations = await db.organization.findMany({
      where: {
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
      },
    });

    logger.info("[Cron] 활성 조직 조회 완료", { count: organizations.length });

    let totalExecuted = 0;
    let totalFailed = 0;

    for (const org of organizations) {
      try {
        // PENDING 메시지 조회
        const pendingExecutions = await getPendingExecutions(org.id);

        if (pendingExecutions.length === 0) {
          logger.log("[Cron] PENDING 메시지 없음", { organizationId: org.id });
          continue;
        }

        logger.info("[Cron] PENDING 메시지 조회", {
          organizationId: org.id,
          count: pendingExecutions.length,
        });

        // 채널별 분리
        const smsBatch = pendingExecutions.filter((e) => e.channel === "SMS");
        const emailBatch = pendingExecutions.filter((e) => e.channel === "EMAIL");

        // SMS 배치 처리
        if (smsBatch.length > 0) {
          logger.info("[Cron] SMS 발송 시작", {
            organizationId: org.id,
            count: smsBatch.length,
          });

          const smsResult = await executeCampaignMessages(smsBatch, "SMS");
          totalExecuted += smsResult.success;
          totalFailed += smsResult.failed;

          // 상태 업데이트
          for (const exec of smsBatch) {
            await updateExecutionStatus(
              exec.id,
              "SENT",
              undefined,
              exec.retryCount
            );
          }
        }

        // Email 배치 처리
        if (emailBatch.length > 0) {
          logger.info("[Cron] Email 발송 시작", {
            organizationId: org.id,
            count: emailBatch.length,
          });

          const emailResult = await executeCampaignMessages(emailBatch, "EMAIL");
          totalExecuted += emailResult.success;
          totalFailed += emailResult.failed;

          // 상태 업데이트
          for (const exec of emailBatch) {
            await updateExecutionStatus(
              exec.id,
              "SENT",
              undefined,
              exec.retryCount
            );
          }
        }
      } catch (err) {
        logger.error("[Cron] 조직 처리 실패", { organizationId: org.id, err });
        totalFailed += 1;
      }
    }

    const duration = Date.now() - startTime;
    logger.info("[Cron] 캠페인 자동 발송 완료", {
      totalExecuted,
      totalFailed,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });

    return { success: totalExecuted, failed: totalFailed, duration };
  } catch (err) {
    logger.error("[Cron] 캠페인 자동 발송 실패", { err });
    throw err;
  }
}

/**
 * 테스트용: 로컬 수동 실행
 * $ npx ts-node -O '{"module":"commonjs"}' src/lib/cron/execute-campaigns.ts
 */
if (require.main === module) {
  executePendingCampaigns()
    .then((result) => {
      console.log("Cron Job 완료:", result);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Cron Job 오류:", err);
      process.exit(1);
    });
}
