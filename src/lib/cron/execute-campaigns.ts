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
import {
  mapSendingToExecutionFailureReason,
  mapSendingToExecutionStatus,
} from "../enum-mapping";
// Phase 3-β: 래퍼 함수 import
import { sendToContactByTemplate } from "../services/contact-template-sender";
import { getFeatureFlag } from "../config/feature-flags";
// Phase 3-δ: SMS Rate Limiter import
import { waitForSmsCapacity } from "../sms-rate-limiter";
// Phase 3-γ: Redis 분산 락 + 캐시 import
import { getCache, setCache, invalidateCache } from "../redis";
// Redis 직접 import (setex 등 저수준 명령어 사용)
import { Redis } from '@upstash/redis';
// Phase 3-β: P1-1 에러 매핑 중앙화 import
import {
  mapAligoErrorToFailureReason,
  mapEmailErrorToFailureReason,
} from "../services/error-mapper";
// Phase 3-β: P1-2 Contact Snapshot import
import {
  ContactSnapshotCache,
  cacheContactSnapshotToRedis,
  getContactSnapshotFromRedis,
} from "../services/contact-snapshot";
// Phase 3-β: P1-3 Rate Limiter import
import {
  checkChannelRateLimit,
  checkContactRateLimit,
  checkAllRateLimits,
} from "../services/rate-limiter";
// Phase 3-γ Wave 2: Variant 선택 import
import {
  selectVariant,
  getVariantContent,
  selectVariantBatch,
  getVariantContentBatch,
} from "../campaign-variant";
// Phase 4 Track 1: 렌탈 발송 추적 import
import {
  isRentalProduct,
  getSegmentVariation,
  getRentalSendingData,
} from "../rental-sending-helper";

// Redis 인스턴스 (분산 락용) — 환경변수 없을 때 graceful fallback
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!redisUrl || !redisToken) {
  logger.warn('[execute-campaigns] Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN — distributed lock disabled');
}

let _redis: Redis | null = null;
function getRedis(): Redis | null {
  if (!redisUrl || !redisToken) return null;
  if (!_redis) _redis = new Redis({ url: redisUrl, token: redisToken });
  return _redis;
}

interface ExecutionCampaignParams {
  campaignId: string;
  organizationId: string;
  groupId: string;
  channel: "SMS" | "EMAIL";
  messageBody: string;
  messageSubject?: string;
  contactIds: string[];
  campaignTitle?: string; // Phase 3-γ: ExecutionLog sourceName용
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
  const { campaignId, organizationId, groupId, channel, messageBody, messageSubject, contactIds, campaignTitle } = params;
  // Phase 3-δ: 배치 크기 증가 (50 → 150) - Rate Limiter로 인한 지연 보상
  const BATCH_SIZE = 150;

  if (contactIds.length === 0) {
    logger.log("[Cron] 발송 대상 없음", { campaignId, channel });
    return { sent: 0, failed: 0, skipped: 0 };
  }

  // Phase 3-β: P1-3 채널 레벨 Rate Limit 검사 (먼저 확인)
  const channelRateLimit = await checkChannelRateLimit(channel, organizationId);
  if (!channelRateLimit.allowed) {
    logger.warn(`[Cron] ${channel} Rate Limit 초과, 캠페인 스킵`, {
      campaignId,
      channel,
      remainingQuota: channelRateLimit.remaining,
      resetAt: new Date(channelRateLimit.resetAt).toISOString(),
    });
    return { sent: 0, failed: contactIds.length, skipped: 0 };
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

    // Phase 4 Track 1: 캠페인 정보 조회 (렌탈 판별용)
    const campaign = await db.crmMarketingCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true, title: true },
    });
    const isRental = campaign ? isRentalProduct(campaign) : false;

    // Phase 3-γ Wave 2: Variant 선택 (배치 전에 미리 수행)
    const variantKey = await selectVariant(campaignId);
    const variantContent = await getVariantContent(campaignId, variantKey);

    // Variant 내용이 없으면 캠페인 기본 메시지 사용
    const finalMessageBody = variantContent?.smsBody || messageBody;
    const finalMessageSubject = variantContent?.emailSubject || messageSubject;
    const finalEmailBody = variantContent?.emailBody;

    logger.info(`[Cron] Variant 선택됨`, {
      campaignId,
      variantKey,
      hasSmsBody: !!variantContent?.smsBody,
      hasEmailContent: !!(variantContent?.emailSubject || variantContent?.emailBody),
    });

    // Phase 3-β: P1-2 Contact Snapshot 캐시 초기화 (배치 내 재사용)
    const snapshotCache = new ContactSnapshotCache();

    // 배치 단위로 처리
    for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
      const batch = contactIds.slice(i, i + BATCH_SIZE);

      // 배치-로드: 이번 배치의 모든 contact를 한 번에 조회 (N+1 최적화)
      const contacts = await db.contact.findMany({
        where: { id: { in: batch } },
        select: { id: true, phone: true, email: true, name: true },
      });

      // Phase 3-β: P1-2 Contact Snapshot 캐시에 저장
      snapshotCache.setMany(
        contacts.map((c) => ({
          id: c.id,
          phone: c.phone,
          email: c.email,
          name: c.name,
        }))
      );

      const contactMap = new Map(contacts.map(c => [c.id, c]));

      const results = await Promise.allSettled(
        batch.map(async (contactId) => {
          // Phase 3-β: P1-3 Contact 레벨 Rate Limit 검사
          const contactRateLimit = await checkContactRateLimit(contactId);
          if (!contactRateLimit.allowed) {
            logger.warn(`[Cron] Contact Rate Limit 초과`, {
              contactId,
              resetAt: new Date(contactRateLimit.resetAt).toISOString(),
            });
            return {
              contactId,
              status: "SKIPPED" as SendingStatus,
              failureReason: "RATE_LIMITED" as SendingFailureReason,
            };
          }

          // 프리로드된 contact 사용 (캐시)
          const preloadedContact = contactMap.get(contactId);

          const result = await sendSingleMessage({
            campaignId,
            organizationId,
            contactId,
            channel,
            messageBody: finalMessageBody,
            messageSubject: finalMessageSubject,
            preloadedContact,
            campaignTitle,
            variantKey,
            emailBody: typeof finalEmailBody === 'string' ? finalEmailBody : undefined,
            // Phase 4 Track 1: 렌탈 발송 정보 전달
            isRental,
            // Phase 3-β: P1-2 Contact snapshot 전달 (재시도 시 N+1 제거)
            contactSnapshot: preloadedContact ? {
              id: preloadedContact.id,
              phone: preloadedContact.phone,
              email: preloadedContact.email,
              name: (preloadedContact as any).name,
            } : undefined,
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
 * @param contactSnapshot - Contact 스냅샷 (재시도 시 N+1 제거)
 * Phase 3-β: Feature Flag 기반 래퍼 함수로 호출 가능
 */

// P0-2: SendSingleMessageResult 타입 정의 (any 제거)
interface SendSingleMessageResult {
  contactId: string;
  status: SendingStatus;
  failureReason?: SendingFailureReason;
}

async function sendSingleMessage(params: {
  campaignId: string;
  organizationId: string;
  contactId: string;
  channel: "SMS" | "EMAIL";
  messageBody: string;
  messageSubject?: string;
  preloadedContact?: { id: string; phone: string | null; email: string | null };
  contactSnapshot?: { id: string; phone: string | null; email: string | null; name?: string | null };
  campaignTitle?: string; // Phase 3-β: ExecutionLog sourceName용
  variantKey?: string | null; // Phase 3-γ Wave 2: A/B Variant 키
  emailBody?: string; // Phase 3-γ Wave 2: Email body (Variant용)
  isRental?: boolean; // Phase 4 Track 1: 렌탈 발송 여부
}): Promise<SendSingleMessageResult> {
  const { campaignId, organizationId, contactId, channel, messageBody, messageSubject, preloadedContact, campaignTitle, variantKey, emailBody, isRental } = params;

  try {
    // Phase 3-β: Feature Flag 체크 - 래퍼 함수 사용 여부
    if (getFeatureFlag("ENABLE_EXECUTION_LOG_WRAPPER")) {
      // 래퍼 함수 사용 (ExecutionLog + SendingHistory 병행)
      const result = await sendToContactByTemplate({
        contactId,
        channel,
        messageBody,
        messageSubject,
        organizationId,
        campaignId,
        sourceType: "CAMPAIGN",
        sourceId: campaignId,
        sourceName: campaignTitle,
        sendingType: "CAMPAIGN",
        useExecutionLog: true,
      });

      return {
        contactId,
        status: result.status,
        failureReason: result.failureReason,
      };
    }

    // Feature Flag OFF: 기존 로직 유지
    // Contact: 프리로드된 연락처 사용, 또는 개별 조회 (재시도 케이스)
    const contact = preloadedContact || await db.contact.findUnique({
      where: { id: contactId },
      select: { id: true, phone: true, email: true, name: true },
    });

    // Phase 4 Track 1: 세그먼트 변형 결정
    const segmentVariation = contact ? getSegmentVariation(contact as any) : "A";

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
          variantKey,
          isRental,
          segmentVariation,
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
          variantKey,
          isRental,
          segmentVariation,
        });
        return { contactId, status: "FAILED", failureReason: "SYSTEM_ERROR" };
      }

      // Phase 3-δ: Rate Limit 확인 (Aligo API 초당 3건)
      await waitForSmsCapacity();

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
          variantKey,
          isRental,
          segmentVariation,
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
      variantKey,
      isRental,
      segmentVariation,
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
      variantKey,
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
 * - Phase 3-β: P1-2 Contact snapshot 캐시 사용 (Redis)
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

    // Phase 3-β: P1-2 Redis 캐시에서 Contact Snapshot 조회 (N+1 제거)
    let contact = await getContactSnapshotFromRedis(sending.contactId, redis);

    // 캐시 미스: DB에서 조회
    if (!contact) {
      const dbContact = await db.contact.findUnique({
        where: { id: sending.contactId },
        select: { id: true, phone: true, email: true, name: true },
      });

      if (!dbContact) {
        logger.warn("[Cron] Contact 없음", { contactId: sending.contactId });
        await updateSendingStatus(sendingId, "FAILED", "INVALID_EMAIL", sending.retryCount);
        return;
      }

      contact = {
        id: dbContact.id,
        phone: dbContact.phone,
        email: dbContact.email,
        name: dbContact.name,
      };

      // Redis 캐시에 저장 (다음 재시도를 위해)
      await cacheContactSnapshotToRedis(sending.contactId, contact, redis);
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
        sending.channel === "EMAIL" ? (sending.campaign?.emailSubject ?? undefined) : undefined,
      // Phase 3-β: P1-2 Contact snapshot 전달
      contactSnapshot: contact,
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
 *
 * Phase 3-γ: P0-3 솔루션 - Redis 분산 락으로 중복 실행 방지
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
      // Phase 3-γ: P0-3 Redis 분산 락 - 캠페인별 중복 실행 방지
      const lockKey = `campaign:${campaign.id}:executing`;
      const lockTTL = 300; // 5분 (캠페인 발송 최대 시간)

      try {
        // Redis SET NX (존재하지 않을 때만 설정) - 분산 락
        const lockAcquired = await acquireDistributedLock(lockKey, lockTTL);

        if (!lockAcquired) {
          logger.info(`[Cron] 캠페인 ${campaign.id} 이미 실행 중, 스킵`, {
            campaignId: campaign.id,
            title: campaign.title,
          });
          continue; // 다음 캠페인으로
        }

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
              campaignTitle: campaign.title, // Phase 3-β: ExecutionLog sourceName용
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
              messageSubject: campaign.emailSubject ?? undefined,
              contactIds: contactIdList,
              campaignTitle: campaign.title, // Phase 3-β: ExecutionLog sourceName용
            });

            totalSent += emailResult.sent;
            totalFailed += emailResult.failed;
          }

          // nextExecutionAt 업데이트 (repeatRule 기반)
          const nextExecutionAt = calculateNextExecution(campaign.repeatRule, campaign.sendAt);

          // P0-1: 트랜잭션으로 배치 업데이트 (N+1 쿼리 방지)
          // 루프 외부에서 모든 업데이트를 수집한 후 한 번에 처리하는 것이 더 효율적
          // 현재는 update() 사용이 필수이므로 트랜잭션 사용
          await db.$transaction(
            async (tx) => {
              await tx.crmMarketingCampaign.update({
                where: { id: campaign.id },
                data: {
                  nextExecutionAt,
                  sentCount: campaign.sentCount + totalSent,
                  updatedAt: new Date(),
                },
              });
            }
          );

          logger.info("[Cron] 캠페인 발송 완료", {
            campaignId: campaign.id,
            sentCount: totalSent,
            failedCount: totalFailed,
          });
        } finally {
          // 락 해제 (finally로 항상 실행)
          await releaseDistributedLock(lockKey);
        }
      } catch (err) {
        logger.error("[Cron] 캠페인 처리 실패", { campaignId: campaign.id, err });
        // 락 정리 (에러 발생 시에도)
        await releaseDistributedLock(lockKey).catch(() => {
          // 정리 실패는 무시 (5분 후 자동 해제)
        });
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
 * 헬퍼: Redis 분산 락 획득
 * Phase 3-γ: P0-3 솔루션 - SET NX (원자적 설정)
 * Upstash Redis SET NX EX: "SET key value NX EX ttl"
 */
async function acquireDistributedLock(lockKey: string, ttlSeconds: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) {
    // Redis 없으면 락 없이 진행 (단일 인스턴스 환경에서는 안전)
    logger.warn("[Cron] Redis 미설정 — 분산 락 없이 진행", { lockKey });
    return true;
  }
  try {
    const lockValue = `lock:${Date.now()}:${Math.random()}`;
    // Upstash Redis: SET with NX and EX options
    const result = await redis.set(lockKey, lockValue, {
      nx: true,
      ex: ttlSeconds,
    });

    // result is null if key already exists (NX failed)
    // result is "OK" if key was set successfully
    const acquired = result === "OK" || result !== null;

    if (acquired) {
      logger.log("[Cron] 분산 락 획득 성공", { lockKey });
    }

    return acquired;
  } catch (err) {
    logger.warn("[Cron] 분산 락 획득 실패", { lockKey, error: (err as Error).message });
    return false;
  }
}

/**
 * 헬퍼: Redis 분산 락 해제
 * Phase 3-γ: P0-3 솔루션 - DEL
 */
async function releaseDistributedLock(lockKey: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(lockKey);
    logger.log("[Cron] 분산 락 해제 완료", { lockKey });
  } catch (err) {
    logger.warn("[Cron] 분산 락 해제 실패 (5분 후 자동 해제됨)", { lockKey, error: (err as Error).message });
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

// Phase 3-β: P1-1 에러 매핑 함수 제거 (src/lib/services/error-mapper.ts에서 import)

/**
 * 헬퍼: SendingHistory + ExecutionLog 생성 (트랜잭션)
 * Phase 3-γ: P0-1 솔루션 - db.$transaction으로 원자성 보장
 * - SendingHistory 생성 (필수)
 * - ExecutionLog 생성 시도 (선택, 실패해도 SendingHistory는 남음)
 * - 부분 실패 처리 (ExecutionLog 생성 실패는 경고만, SendingHistory는 정상 생성)
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
  campaignTitle?: string;
  executionLogId?: string;
  variantKey?: string | null; // Phase 3-γ Wave 2: A/B Variant 키
  isRental?: boolean; // Phase 4 Track 1: 렌탈 발송 여부
  segmentVariation?: string; // Phase 4 Track 1: 세그먼트 변형 (A/B/C)
}): Promise<{ id: string } | null> {
  // Phase 3-γ: P1-1, P1-2 트랜잭션 타임아웃 + finally 정리
  let tx = null;
  try {
    // Phase 3-γ: P1-1 성능 모니터링 시작
    const start = performance.now();

    // Phase 3-γ: P0-1 + P1-1 트랜잭션으로 원자성 보장 + 1초 타임아웃
    const result = await db.$transaction(
      async (transaction) => {
        tx = transaction; // 명시적 추적용 (finally에서 정리)

        // Step 1: SendingHistory 생성 (필수)
        const sendingHistory = await tx!.sendingHistory.create({
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
            variantKey: params.variantKey ?? null, // Phase 3-γ Wave 2: A/B Variant 키 저장
            // Phase 4 Track 1: 렌탈 발송 추적 필드
            isRentalPurchase: params.isRental ?? false,
            isDeltaSmsEligible: params.isRental ?? false,
            deltaDay: 0,  // 초기값: 발송일
            segmentVariation: params.segmentVariation ?? "A",  // 기본값: A (자유여행)
          },
        });

        // Phase 3-γ: P0-2 반환값 검증 - sendingHistory ID 필수 체크
        if (!sendingHistory?.id) {
          throw new Error("SendingHistory 생성 실패: ID가 없음");
        }

        // Step 2: ExecutionLog 생성 시도 (선택, Feature Flag 체크)
        if (getFeatureFlag("ENABLE_EXECUTION_LOG_WRAPPER")) {
          try {
            await tx!.executionLog.create({
              data: {
                id: params.executionLogId || sendingHistory.id, // 동일 ID로 추적
                organizationId: params.organizationId,
                sourceType: "CAMPAIGN",
                sourceId: params.campaignId,
                sourceName: params.campaignTitle || "",
                campaignId: params.campaignId,
                contactId: params.contactId,
                channel: params.channel,
                status: mapSendingToExecutionStatus(params.status),
                executeMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
                scheduledAt: new Date(),
              },
            });
          } catch (executionErr) {
            // ExecutionLog 실패는 경고만 - SendingHistory는 정상 생성됨 (원자성 보장)
            logger.warn("[Cron] ExecutionLog 생성 실패 (SendingHistory는 생성됨)", {
              sendingHistoryId: sendingHistory.id,
              error: (executionErr as Error).message,
            });
          }
        }

        return sendingHistory;
      },
      { timeout: 1000 } // Phase 3-γ: P1-1 1초 타임아웃
    );

    // Phase 3-γ: P1-1 성능 모니터링 완료
    const duration = performance.now() - start;
    if (duration > 500) {
      logger.warn("[Cron] SendingHistory 트랜잭션 느림", {
        durationMs: duration,
        contactId: params.contactId,
        campaignId: params.campaignId,
      });
    } else if (duration > 100) {
      logger.log("[Cron] SendingHistory 트랜잭션 성능", {
        durationMs: duration,
        contactId: params.contactId,
      });
    }

    return result;
  } catch (err) {
    logger.error("[Cron] SendingHistory 생성 실패", { err, params });
    return null;
  } finally {
    // P0-3: Prisma $transaction()은 자동 정리됨 (수동 정리 불필요)
    // tx 참조는 명시적 추적용일 뿐, Prisma가 자동으로 정리
    tx = null; // 가비지 컬렉션 힌트용
  }
}

/**
 * 테스트용: 로컬 수동 실행
 * $ npx ts-node src/lib/cron/execute-campaigns.ts
 */
if (require.main === module) {
  executePendingCampaigns()
    .then((result) => {
      logger.log("[Cron] 캠페인 자동 발송 완료", result as object);
      process.exit(0);
    })
    .catch((err) => {
      logger.error("[Cron] 캠페인 자동 발송 실패", {
        error: err instanceof Error ? err.message : String(err),
      });
      process.exit(1);
    });
}
