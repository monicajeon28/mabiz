/**
 * Menu #38 Phase 2: Cron Job - 실제 발송 + 재시도 로직
 *
 * 목적:
 * - 매일 정해진 시간에 실행될 캠페인 메시지 발송
 * - CrmMarketingCampaign 기반 SMS/Email 실제 발송
 * - SendingHistory에 발송 기록 저장
 * - 실패 시 재시도 로직 (1h/6h/24h + Jitter)
 *
 * 특징:
 * - SMS/Email 실제 발송 (sendSms, sendFunnelEmail)
 * - 배치 처리 (50명씩 = 성능 최적화)
 * - 재시도 간격: 1시간 → 6시간 → 24시간 (maxRetries=3)
 * - Jitter ±10% (동시 재시도 방지)
 * - 캠페인 반복 규칙 지원 (ONCE/DAILY/WEEKLY/MONTHLY)
 */

import db from "../prisma";
import { logger } from "../logger";
import type { SendingStatus, SendingFailureReason } from "@prisma/client";
import { sendSms, resolveUserSmsConfig } from "../aligo";
import { sendFunnelEmail } from "../email";

interface ExecutionCampaignParams {
  campaignId: string;
  organizationId: string;
  groupId: string;
  channel: "SMS" | "EMAIL";
  messageBody: string;
  messageSubject?: string;
  contactIds: string[];
}

interface SendingRecord {
  sent: number;
  failed: number;
  skipped: number;
}

// 재시도 간격 (ms)
const RETRY_DELAYS = [
  60 * 60 * 1000,       // 1시간
  6 * 60 * 60 * 1000,   // 6시간
  24 * 60 * 60 * 1000,  // 24시간
];

/**
 * 함수 1: 캠페인 메시지 배치 발송
 * - SMS/Email 실제 발송
 * - 배치 처리 (50건씩, Promise.all)
 * - 배치-로드 패턴으로 N+1 쿼리 최적화
 * - SendingHistory에 기록
 * - 반환: { sent, failed, skipped }
 */
export async function executeCampaignMessages(
  params: ExecutionCampaignParams
): Promise<SendingRecord> {
  const { campaignId, organizationId, groupId, channel, messageBody, messageSubject, contactIds } = params;
  const BATCH_SIZE = 50;

  if (contactIds.length === 0) {
    logger.log("[Cron] 발송 대상 없음", { campaignId, channel });
    return { sent: 0, failed: 0, skipped: 0 };
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  try {
    logger.info(`[Cron] ${channel} 배치 발송 시작`, {
      campaignId,
      channel,
      totalCount: contactIds.length,
    });

    // 배치 단위로 처리
    for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
      const batch = contactIds.slice(i, i + BATCH_SIZE);

      // 배치-로드: 이번 배치의 모든 contact를 한 번에 조회 (N+1 최적화)
      const contacts = await db.contact.findMany({
        where: { id: { in: batch } },
        select: { id: true, phone: true, email: true },
      });
      const contactMap = new Map(contacts.map(c => [c.id, c]));

      const results = await Promise.allSettled(
        batch.map(async (contactId) => {
          const result = await sendSingleMessage({
            campaignId,
            organizationId,
            contactId,
            channel,
            messageBody,
            messageSubject,
            preloadedContact: contactMap.get(contactId),
          });
          return result;
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          if (result.value.status === "SENT") sent++;
          else if (result.value.status === "FAILED") failed++;
          else if (result.value.status === "SKIPPED") skipped++;
        } else {
          logger.error("[Cron] 개별 발송 에러", { err: result.reason });
          failed++;
        }
      }
    }

    logger.info(`[Cron] ${channel} 배치 발송 완료`, {
      campaignId,
      sent,
      failed,
      skipped,
    });

    return { sent, failed, skipped };
  } catch (err) {
    logger.error(`[Cron] ${channel} 배치 발송 실패`, { campaignId, err });
    return { sent, failed: contactIds.length, skipped };
  }
}

/**
 * 개별 메시지 발송 (내부 함수)
 * @param preloadedContact - 배치-로드된 contact (N+1 쿼리 최적화)
 */
async function sendSingleMessage(params: {
  campaignId: string;
  organizationId: string;
  contactId: string;
  channel: "SMS" | "EMAIL";
  messageBody: string;
  messageSubject?: string;
  preloadedContact?: { id: string; phone: string | null; email: string | null };
}): Promise<{ contactId: string; status: SendingStatus; failureReason?: SendingFailureReason }> {
  const { campaignId, organizationId, contactId, channel, messageBody, messageSubject, preloadedContact } = params;

  try {
    // Contact: 프리로드된 연락처 사용, 또는 개별 조회 (재시도 케이스)
    const contact = preloadedContact || await db.contact.findUnique({
      where: { id: contactId },
      select: { id: true, phone: true, email: true },
    });

    if (!contact) {
      logger.warn("[Cron] Contact 없음", { contactId });
      return {
        contactId,
        status: "SKIPPED",
        failureReason: "INVALID_EMAIL" as SendingFailureReason,
      };
    }

    let sendResult: { status: SendingStatus; failureReason?: SendingFailureReason };

    if (channel === "SMS") {
      if (!contact.phone) {
        logger.warn("[Cron] 휴대폰 없음", { contactId });
        await createSendingHistory({
          campaignId,
          contactId,
          channel: "SMS",
          status: "SKIPPED",
          failureReason: "INVALID_PHONE",
          organizationId,
          messageBody,
        });
        return { contactId, status: "SKIPPED", failureReason: "INVALID_PHONE" };
      }

      const smsConfig = await resolveUserSmsConfig(organizationId);
      if (!smsConfig) {
        logger.warn("[Cron] SMS 설정 없음", { organizationId });
        await createSendingHistory({
          campaignId,
          contactId,
          channel: "SMS",
          status: "FAILED",
          failureReason: "SYSTEM_ERROR",
          organizationId,
          messageBody,
        });
        return { contactId, status: "FAILED", failureReason: "SYSTEM_ERROR" };
      }

      const smsResult = await sendSms({
        config: smsConfig,
        receiver: contact.phone,
        msg: messageBody,
        msgType: messageBody.length > 90 ? "LMS" : "SMS",
        organizationId,
        contactId,
        channel: "FUNNEL",
      });

      sendResult =
        smsResult.result_code === 1
          ? { status: "SENT" }
          : {
              status: "FAILED",
              failureReason: mapAligoErrorToFailureReason(smsResult.result_code),
            };
    } else {
      // EMAIL 채널
      if (!contact.email) {
        logger.warn("[Cron] 이메일 없음", { contactId });
        await createSendingHistory({
          campaignId,
          contactId,
          channel: "EMAIL",
          status: "SKIPPED",
          failureReason: "INVALID_EMAIL",
          organizationId,
          messageBody,
          messageSubject,
        });
        return { contactId, status: "SKIPPED", failureReason: "INVALID_EMAIL" };
      }

      const emailResult = await sendFunnelEmail({
        organizationId,
        contactId,
        to: contact.email,
        subject: messageSubject || "안내드립니다",
        html: `<div style="font-family:sans-serif;line-height:1.8;white-space:pre-wrap">${messageBody}</div>`,
        channel: "CAMPAIGN",
      });

      sendResult =
        emailResult.result_code === 1
          ? { status: "SENT" }
          : {
              status: "FAILED",
              failureReason: mapEmailErrorToFailureReason(emailResult.result_code),
            };
    }

    // SendingHistory 기록
    await createSendingHistory({
      campaignId,
      contactId,
      channel,
      status: sendResult.status,
      failureReason: sendResult.failureReason,
      organizationId,
      messageBody,
      messageSubject,
      sentAt: sendResult.status === "SENT" ? new Date() : undefined,
    });

    return { contactId, status: sendResult.status, failureReason: sendResult.failureReason };
  } catch (err) {
    logger.error("[Cron] 개별 발송 오류", { contactId, err });
    await createSendingHistory({
      campaignId,
      contactId,
      channel: params.channel,
      status: "FAILED",
      failureReason: "SYSTEM_ERROR",
      organizationId,
      messageBody,
      messageSubject,
    });
    return { contactId, status: "FAILED", failureReason: "SYSTEM_ERROR" };
  }
}

/**
 * 함수 2: 발송 상태 업데이트 + 재시도 판단
 * - 영구 실패: INVALID_EMAIL, INVALID_PHONE, OPT_OUT → ABANDONED
 * - 일시적 오류: SYSTEM_ERROR, PROVIDER_ERROR, NETWORK_ERROR → 재시도 예약
 * - 재시도 간격: 1h/6h/24h (+ Jitter ±10%)
 */
export async function updateSendingStatus(
  sendingId: string,
  status: SendingStatus,
  failureReason?: SendingFailureReason,
  retryCount: number = 0
) {
  try {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === "SENT") {
      updateData.sentAt = new Date();
    }

    if (status === "FAILED" && failureReason) {
      updateData.failureReason = failureReason;

      // 영구 실패 여부 판단
      const isPermanentFailure = [
        "INVALID_EMAIL",
        "INVALID_PHONE",
        "OPT_OUT",
      ].includes(failureReason);

      if (isPermanentFailure) {
        updateData.status = "ABANDONED";
        updateData.failureReason = failureReason;
      } else {
        // 일시적 오류 → 재시도 예약
        const nextRetryAt = calculateNextRetry(retryCount);
        if (nextRetryAt) {
          updateData.status = "RETRY_SCHEDULED";
          updateData.nextRetryAt = nextRetryAt;
          updateData.retryCount = retryCount + 1;
        } else {
          updateData.status = "ABANDONED";
        }
      }
    }

    await db.sendingHistory.update({
      where: { id: sendingId },
      data: updateData,
    });

    logger.log("[Cron] SendingHistory 상태 업데이트", { sendingId, status: updateData.status });
  } catch (err) {
    logger.error("[Cron] SendingHistory 상태 업데이트 실패", { sendingId, err });
    throw err;
  }
}

/**
 * 함수 3: 다음 재시도 시간 계산
 * - 재시도 간격: 1h/6h/24h
 * - Jitter: ±10%
 * - maxRetries=3 초과 시: null (ABANDONED)
 */
function calculateNextRetry(retryCount: number): Date | null {
  if (retryCount >= RETRY_DELAYS.length) {
    return null; // ABANDONED
  }

  const base = RETRY_DELAYS[retryCount];
  const jitter = Math.random() * 0.2 * base - 0.1 * base; // ±10%
  return new Date(Date.now() + base + jitter);
}

/**
 * 함수 4: 재시도 메시지 발송
 * - SendingHistory ID (status=RETRY_SCHEDULED, nextRetryAt<=NOW)
 * - 실제 SMS/Email 발송
 * - 성공: status='SENT'
 * - 실패: updateSendingStatus() 호출 (다음 재시도 예약)
 */
export async function retrySendingMessage(sendingId: string): Promise<void> {
  try {
    logger.info("[Cron] 재시도 메시지 발송", { sendingId });

    const sending = await db.sendingHistory.findUnique({
      where: { id: sendingId },
      include: {
        campaign: {
          select: { id: true, organizationId: true, smsBody: true, emailSubject: true, emailBody: true },
        },
      },
    });

    if (!sending) {
      logger.warn("[Cron] SendingHistory 없음", { sendingId });
      return;
    }

    if (sending.status !== "RETRY_SCHEDULED") {
      logger.warn("[Cron] 재시도 대상이 아님", { sendingId, status: sending.status });
      return;
    }

    // Contact 별도 조회
    const contact = await db.contact.findUnique({
      where: { id: sending.contactId },
      select: { id: true, phone: true, email: true },
    });

    if (!contact) {
      logger.warn("[Cron] Contact 없음", { contactId: sending.contactId });
      await updateSendingStatus(sendingId, "FAILED", "INVALID_EMAIL", sending.retryCount);
      return;
    }

    const result = await sendSingleMessage({
      campaignId: sending.campaignId!,
      organizationId: sending.organizationId,
      contactId: contact.id,
      channel: sending.channel as "SMS" | "EMAIL",
      messageBody:
        sending.channel === "SMS"
          ? sending.campaign?.smsBody || ""
          : sending.campaign?.emailBody || "",
      messageSubject:
        sending.channel === "EMAIL" ? sending.campaign?.emailSubject : undefined,
    });

    // 성공 시: 상태 업데이트만
    if (result.status === "SENT") {
      await db.sendingHistory.update({
        where: { id: sendingId },
        data: {
          status: "SENT",
          sentAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } else {
      // 실패 시: 재시도 상태 업데이트
      await updateSendingStatus(sendingId, "FAILED", result.failureReason, sending.retryCount);
    }
  } catch (err) {
    logger.error("[Cron] 재시도 발송 실패", { sendingId, err });
    await updateSendingStatus(sendingId, "FAILED", "SYSTEM_ERROR", 0);
  }
}

/**
 * 함수 5: 펀딩 캠페인 실행 (메인 Cron 함수)
 * - CrmMarketingCampaign 조회 (nextExecutionAt <= NOW)
 * - 각 캠페인별 대상 연락처 조회
 * - executeCampaignMessages() 호출
 * - nextExecutionAt 업데이트 (repeatRule 기반)
 * - 재시도 대상 처리
 */
export async function executePendingCampaigns() {
  const startTime = Date.now();

  try {
    logger.info("[Cron] 캠페인 자동 발송 시작", {
      timestamp: new Date().toISOString(),
    });

    // 실행 대기 중인 캠페인 조회 (status='ACTIVE', nextExecutionAt <= NOW)
    const campaigns = await db.crmMarketingCampaign.findMany({
      where: {
        status: "ACTIVE",
        nextExecutionAt: {
          lte: new Date(),
        },
      },
      include: {
        group: { select: { id: true } },
      },
    });

    logger.info("[Cron] 실행 대기 캠페인 조회 완료", { count: campaigns.length });

    let totalSent = 0;
    let totalFailed = 0;

    for (const campaign of campaigns) {
      try {
        logger.info("[Cron] 캠페인 발송 시작", {
          campaignId: campaign.id,
          title: campaign.title,
        });

        // ContactGroup에서 대상 연락처 조회
        const contactIds = await db.contactGroupMember.findMany({
          where: { groupId: campaign.groupId },
          select: { contactId: true },
        });

        const contactIdList = contactIds.map((m) => m.contactId);

        // SMS 발송
        if (campaign.sendSms && campaign.smsBody) {
          const smsResult = await executeCampaignMessages({
            campaignId: campaign.id,
            organizationId: campaign.organizationId,
            groupId: campaign.groupId,
            channel: "SMS",
            messageBody: campaign.smsBody,
            contactIds: contactIdList,
          });

          totalSent += smsResult.sent;
          totalFailed += smsResult.failed;
        }

        // Email 발송
        if (campaign.sendEmail && campaign.emailBody) {
          const emailResult = await executeCampaignMessages({
            campaignId: campaign.id,
            organizationId: campaign.organizationId,
            groupId: campaign.groupId,
            channel: "EMAIL",
            messageBody: campaign.emailBody,
            messageSubject: campaign.emailSubject,
            contactIds: contactIdList,
          });

          totalSent += emailResult.sent;
          totalFailed += emailResult.failed;
        }

        // nextExecutionAt 업데이트 (repeatRule 기반)
        const nextExecutionAt = calculateNextExecution(campaign.repeatRule, campaign.sendAt);

        await db.crmMarketingCampaign.update({
          where: { id: campaign.id },
          data: {
            nextExecutionAt,
            sentCount: campaign.sentCount + totalSent,
            updatedAt: new Date(),
          },
        });

        logger.info("[Cron] 캠페인 발송 완료", {
          campaignId: campaign.id,
          sentCount: totalSent,
          failedCount: totalFailed,
        });
      } catch (err) {
        logger.error("[Cron] 캠페인 처리 실패", { campaignId: campaign.id, err });
      }
    }

    // 재시도 대상 처리
    const retryTargets = await db.sendingHistory.findMany({
      where: {
        status: "RETRY_SCHEDULED",
        nextRetryAt: {
          lte: new Date(),
        },
      },
      take: 1000,
    });

    logger.info("[Cron] 재시도 대상 조회 완료", { count: retryTargets.length });

    for (const target of retryTargets) {
      try {
        await retrySendingMessage(target.id);
      } catch (err) {
        logger.error("[Cron] 재시도 처리 실패", { sendingId: target.id, err });
      }
    }

    const duration = Date.now() - startTime;
    logger.info("[Cron] 캠페인 자동 발송 완료", {
      totalSent,
      totalFailed,
      retryCount: retryTargets.length,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });

    return { success: totalSent, failed: totalFailed, duration };
  } catch (err) {
    logger.error("[Cron] 캠페인 자동 발송 실패", { err });
    throw err;
  }
}

/**
 * 헬퍼: 반복 규칙에 따라 다음 실행 시간 계산
 */
function calculateNextExecution(
  repeatRule: string | null,
  sendAt: Date
): Date | null {
  if (!repeatRule || repeatRule === "ONCE") {
    return null; // 일회성 캠페인은 다시 실행하지 않음
  }

  const now = new Date();
  const next = new Date(sendAt);

  switch (repeatRule) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      return null;
  }

  // 다음 실행 시간이 현재보다 이전이면 한 주기 더 추가
  if (next <= now) {
    return calculateNextExecution(repeatRule, next);
  }

  return next;
}

/**
 * 헬퍼: Aligo 에러 코드를 SendingFailureReason으로 매핑
 */
function mapAligoErrorToFailureReason(resultCode: number): SendingFailureReason {
  switch (resultCode) {
    case -99:
      return "OPT_OUT";
    case -98:
      return "SYSTEM_ERROR"; // 야간 차단
    case -96:
      return "INVALID_PHONE";
    case -97:
      return "SYSTEM_ERROR"; // 설정 미완료
    default:
      return resultCode === 1 ? "SYSTEM_ERROR" : "PROVIDER_ERROR";
  }
}

/**
 * 헬퍼: Email 에러 코드를 SendingFailureReason으로 매핑
 */
function mapEmailErrorToFailureReason(resultCode: number): SendingFailureReason {
  switch (resultCode) {
    case 1:
      return "SYSTEM_ERROR"; // 성공 (에러 아님)
    case -96:
      return "INVALID_EMAIL";
    case -97:
      return "SYSTEM_ERROR"; // 설정 미완료
    default:
      return "PROVIDER_ERROR";
  }
}

/**
 * 헬퍼: SendingHistory 생성
 */
async function createSendingHistory(params: {
  campaignId: string;
  contactId: string;
  channel: "SMS" | "EMAIL";
  status: SendingStatus;
  failureReason?: SendingFailureReason;
  organizationId: string;
  messageBody?: string;
  messageSubject?: string;
  sentAt?: Date;
}) {
  try {
    await db.sendingHistory.create({
      data: {
        campaignId: params.campaignId,
        contactId: params.contactId,
        channel: params.channel,
        status: params.status,
        failureReason: params.failureReason,
        organizationId: params.organizationId,
        body: params.messageBody || "",
        subject: params.messageSubject || undefined,
        sentAt: params.sentAt,
        retryCount: 0,
        maxRetries: 3,
        nextRetryAt: null,
        scheduledAt: new Date(),
        sendingType: "CAMPAIGN",
      },
    });
  } catch (err) {
    logger.error("[Cron] SendingHistory 생성 실패", { err, params });
  }
}

/**
 * 테스트용: 로컬 수동 실행
 * $ npx ts-node src/lib/cron/execute-campaigns.ts
 */
if (require.main === module) {
  executePendingCampaigns()
    .then((result) => {
      console.log("[Cron] 캠페인 자동 발송 완료:", result);
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Cron] 캠페인 자동 발송 실패:", err);
      process.exit(1);
    });
}
