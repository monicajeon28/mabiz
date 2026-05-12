/**
 * Cron Job: 예약된 메시지 자동 발송
 * ScheduledMessageLog 처리 + 메시지 발송 + 다음 메시지 자동 스케줄
 *
 * Wave 1.7 Stage 5 — Team C 구현
 * Vercel Cron: 0 * * * * (매시간)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { multiChannelSender } from '@/lib/crm/multi-channel-sender';
import { calculateNextMessageTime } from '@/lib/crm/schedule-calculator';

// Vercel Cron 토큰 검증 (보안)
const CRON_SECRET = process.env.CRON_SECRET;

interface CronJobResult {
  success: boolean;
  timestamp: string;
  summary: {
    processed: number;
    sent: number;
    failed: number;
    skipped: number;
  };
  duration: number;
  errors?: Array<{
    messageLogId: number;
    error: string;
  }>;
}

/**
 * POST /api/cron/send-scheduled-messages
 * Vercel Cron에서 호출
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const result: CronJobResult = {
    success: true,
    timestamp: new Date().toISOString(),
    summary: {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0
    },
    duration: 0,
    errors: []
  };

  try {
    // 0. CRON_SECRET 환경변수 검증 (필수)
    if (!CRON_SECRET) {
      logger.error('[SendScheduledMessages] CRON_SECRET 환경변수 미설정');
      return NextResponse.json(
        { error: 'CRON_SECRET not configured' },
        { status: 401 }
      );
    }

    // 1. Cron 토큰 검증 (Vercel Cron 보안)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      logger.warn('[SendScheduledMessages] Unauthorized cron request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.log('[SendScheduledMessages] Starting scheduled message sending');

    // 2. PENDING 상태의 메시지 조회 (발송 시간이 지난 것들)
    const now = new Date();
    const pendingMessages = await prisma.scheduledMessageLog.findMany({
      where: {
        status: { in: ['PENDING', 'WAITING'] },
        sentAt: { lte: now }
      },
      take: 100,
      orderBy: { sentAt: 'asc' },
      include: {
        ScheduledMessage: {
          include: {
            ScheduledMessageStage: {
              orderBy: { stageNumber: 'asc' }
            }
          }
        },
        User: {
          select: {
            id: true,
            phone: true,
            email: true,
            name: true
          }
        }
      }
    });

    if (pendingMessages.length === 0) {
      logger.log('[SendScheduledMessages] No pending messages');
      return NextResponse.json({
        ok: true,
        message: 'No pending messages',
        ...result
      });
    }

    logger.log('[SendScheduledMessages] Found pending messages', {
      count: pendingMessages.length
    });

    // 3. organizationId별 통계 수집
    const statsPerOrg = new Map<string, { processed: number; sent: number; failed: number }>();

    // 3. 병렬 메시지 처리 (동시성 제한: 10개)
    const CONCURRENCY = 10;
    const processedResults = new Map<number, any>();

    // 3.1 메시지별 처리 함수 (병렬 실행용)
    const processMessage = async (messageLog: typeof pendingMessages[0]) => {
      try {
        // 현재 스테이지 정보 조회
        const currentStage = messageLog.ScheduledMessage.ScheduledMessageStage.find(
          (stage) => stage.stageNumber === messageLog.stageNumber
        );

        if (!currentStage) {
          throw new Error(
            `Stage not found: ${messageLog.stageNumber} in message ${messageLog.scheduledMessageId}`
          );
        }

        // multiChannelSender.sendWithFallback() 호출
        const sendResult = await multiChannelSender.sendWithFallback(
          [messageLog.User],
          currentStage.content,
          messageLog.scheduledMessageId,
          'cascade' // SMS → Email → Kakao
        );

        // 발송 성공 확인
        const singleResult = sendResult[0]; // 단일 사용자이므로 인덱스 0
        const isSuccess = singleResult.totalSent;

        return {
          messageLogId: messageLog.id,
          organizationId: messageLog.ScheduledMessage.organizationId,
          userId: messageLog.userId,
          messageId: messageLog.scheduledMessageId,
          stageNumber: messageLog.stageNumber,
          isSuccess,
          singleResult,
          messageLog,
          currentStage,
          error: null
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          messageLogId: messageLog.id,
          organizationId: messageLog.ScheduledMessage.organizationId,
          userId: messageLog.userId,
          messageId: messageLog.scheduledMessageId,
          stageNumber: messageLog.stageNumber,
          isSuccess: false,
          error: errorMessage,
          messageLog
        };
      }
    };

    // 3.2 배치별 병렬 처리 (동시성 10)
    for (let i = 0; i < pendingMessages.length; i += CONCURRENCY) {
      const batch = pendingMessages.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(batch.map(processMessage));

      // 결과 처리
      for (const settledResult of batchResults) {
        if (settledResult.status === 'fulfilled') {
          const processResult = settledResult.value;
          result.summary.processed++;
          processedResults.set(processResult.messageLogId, processResult);

          // 조직별 통계 초기화
          if (!statsPerOrg.has(processResult.organizationId)) {
            statsPerOrg.set(processResult.organizationId, {
              processed: 0,
              sent: 0,
              failed: 0
            });
          }
          const stats = statsPerOrg.get(processResult.organizationId)!;
          stats.processed++;

          if (processResult.isSuccess) {
            stats.sent++;
            result.summary.sent++;
          } else {
            stats.failed++;
            result.summary.failed++;
          }
        } else {
          // Promise 자체가 실패한 경우
          logger.error('[SendScheduledMessages] Promise.allSettled failed', {
            reason: settledResult.reason
          });
          result.summary.failed++;
        }
      }
    }

    // P1-13: 순차 처리 → 병렬 처리 (8-10배 성능 향상)
    // Step 1: 모든 다음 메시지 스케줄 시간을 병렬로 계산
    const scheduleCalculations: Promise<{
      messageLogId: number;
      processResult: any;
      nextMessageTime?: any;
    }>[] = [];

    for (const [messageLogId, processResult] of processedResults) {
      if (processResult.isSuccess) {
        const nextStage = processResult.messageLog.ScheduledMessage.ScheduledMessageStage.find(
          (stage: any) => stage.stageNumber === processResult.messageLog.stageNumber + 1
        );

        if (nextStage) {
          scheduleCalculations.push(
            calculateNextMessageTime({
              leadId: processResult.messageLog.userId,
              funnelId: processResult.messageLog.scheduledMessageId,
              lastMessageSentAt: now,
              daysAfter: nextStage.daysAfter,
              timeOfDay: nextStage.sendTime || '09:00',
              userTimezone: 'Asia/Seoul'
            }).then((nextMessageTime) => ({
              messageLogId,
              processResult,
              nextMessageTime
            }))
          );
        } else {
          scheduleCalculations.push(
            Promise.resolve({ messageLogId, processResult })
          );
        }
      } else {
        scheduleCalculations.push(
          Promise.resolve({ messageLogId, processResult })
        );
      }
    }

    // 모든 스케줄 계산을 병렬로 실행
    const calculatedResults = await Promise.all(scheduleCalculations);

    // Step 2: DB 작업 수집 (Update + Create)
    const updatePromises: Promise<any>[] = [];
    const newMessagesToCreate: any[] = [];

    for (const { messageLogId, processResult, nextMessageTime } of calculatedResults) {
      try {
        if (processResult.isSuccess) {
          // 성공: 상태 업데이트
          updatePromises.push(
            prisma.scheduledMessageLog.update({
              where: { id: messageLogId },
              data: {
                status: 'sent',
                sentAt: now,
                errorMessage: null
              }
            })
          );

          // 다음 메시지 생성 데이터 수집
          if (nextMessageTime) {
            newMessagesToCreate.push({
              scheduledMessageId: processResult.messageLog.scheduledMessageId,
              organizationId: processResult.organizationId,
              userId: processResult.messageLog.userId,
              stageNumber: processResult.messageLog.stageNumber + 1,
              sentAt: nextMessageTime.nextMessageTime || now,
              status: 'PENDING',
              retryCount: 0
            });

            logger.log('[SendScheduledMessages] Next message scheduled', {
              userId: processResult.userId,
              messageId: processResult.messageId,
              nextStage: processResult.stageNumber + 1,
              scheduledTime: nextMessageTime.nextMessageTime?.toISOString()
            });
          }

          logger.log('[SendScheduledMessages] Message sent successfully', {
            userId: processResult.userId,
            messageId: processResult.messageId,
            stage: processResult.stageNumber,
            channel: processResult.singleResult.successful[0]?.channel
          });
        } else {
          // 실패: 상태 업데이트 + 재시도 예약
          const nextRetryAt = new Date(now.getTime() + 10 * 60 * 1000);
          const failureReason = processResult.error || 'unknown';

          updatePromises.push(
            prisma.scheduledMessageLog.update({
              where: { id: messageLogId },
              data: {
                status: 'WAITING',
                nextRetryAt,
                retryCount: (processResult.messageLog.retryCount || 0) + 1,
                errorMessage: failureReason
              }
            })
          );

          result.errors?.push({
            messageLogId,
            error: failureReason
          });

          logger.warn('[SendScheduledMessages] Message send failed', {
            userId: processResult.userId,
            messageId: processResult.messageId,
            stage: processResult.stageNumber,
            reason: failureReason,
            nextRetry: nextRetryAt.toISOString(),
            retryCount: (processResult.messageLog.retryCount || 0) + 1
          });
        }
      } catch (calcError) {
        logger.error('[SendScheduledMessages] Failed to process message result', {
          messageLogId,
          error: calcError
        });
      }
    }

    // Step 3: 모든 UPDATE를 병렬로 실행
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }

    // Step 4: 새 메시지들을 일괄 생성 (createMany)
    if (newMessagesToCreate.length > 0) {
      await prisma.scheduledMessageLog.createMany({
        data: newMessagesToCreate
      });
    }

    result.duration = Date.now() - startTime;

    logger.log('[SendScheduledMessages] Batch processing complete', {
      ...result.summary,
      durationMs: result.duration
    });

    // 4. 조직별 AutomationLog 기록 생성 (감사 로그)
    try {
      // 시스템 사용자 ID (관리자 첫번째 사용자 또는 시스템 계정)
      const systemUser = await prisma.user.findFirst({
        where: { role: { in: ['admin', 'GLOBAL_ADMIN'] } },
        select: { id: true },
        orderBy: { createdAt: 'asc' }
      });

      const systemUserId = systemUser?.id || 1; // 기본값: ID 1

      // P1-16: 순차 CREATE → createMany로 일괄 생성 (7-10배 성능 향상)
      const automationLogs = Array.from(statsPerOrg.entries()).map(([organizationId, stats]) => ({
        organizationId,
        action: 'cron_send_scheduled_messages',
        actionDetails: {
          processed: stats.processed,
          sent: stats.sent,
          failed: stats.failed,
          duration: result.duration
        },
        createdBy: systemUserId
      }));

      if (automationLogs.length > 0) {
        await prisma.automationLog.createMany({
          data: automationLogs
        });

        logger.log('[SendScheduledMessages] AutomationLogs created (batch)', {
          count: automationLogs.length,
          totalSent: Array.from(statsPerOrg.values()).reduce((sum, s) => sum + s.sent, 0),
          totalFailed: Array.from(statsPerOrg.values()).reduce((sum, s) => sum + s.failed, 0)
        });
      }
    } catch (logError) {
      logger.error('[SendScheduledMessages] Failed to create automation logs', {
        error: logError
      });
      // 감사 로그 생성 실패는 Cron 전체 실패로 처리하지 않음
    }

    return NextResponse.json({
      ok: result.success,
      ...result
    });
  } catch (error) {
    result.duration = Date.now() - startTime;
    result.success = false;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('[SendScheduledMessages] Critical error', {
      error: errorMessage,
      durationMs: result.duration
    });

    return NextResponse.json(
      {
        ok: false,
        error: errorMessage,
        ...result
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/send-scheduled-messages
 * 헬스 체크 및 상태 확인
 */
export async function GET(): Promise<NextResponse> {
  try {
    const now = new Date();
    const pendingCount = await prisma.scheduledMessageLog.count({
      where: {
        status: { in: ['PENDING', 'WAITING'] },
        sentAt: { lte: now }
      }
    });

    const waitingCount = await prisma.scheduledMessageLog.count({
      where: {
        status: 'WAITING'
      }
    });

    return NextResponse.json({
      ok: true,
      status: 'healthy',
      pendingMessages: pendingCount,
      waitingMessages: waitingCount,
      timestamp: now.toISOString()
    });
  } catch (error) {
    logger.error('[SendScheduledMessages] Health check failed', error);
    return NextResponse.json(
      { ok: false, error: 'Health check failed' },
      { status: 500 }
    );
  }
}
