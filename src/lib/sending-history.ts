/**
 * Menu #38 Phase 2: SendingHistory 유틸 함수
 *
 * 목적:
 * - SendingHistory 관리 (생성, 조회, 통계 업데이트)
 * - 캠페인 발송 기록 추적
 * - 재시도 로직 지원
 */

import db from "./prisma";
import { logger } from "./logger";
import type { SendingStatus, SendingFailureReason } from "@prisma/client";

/**
 * SendingHistory 생성
 */
export async function createSendingHistory(params: {
  campaignId: string;
  contactId: string;
  channel: "SMS" | "EMAIL";
  status: SendingStatus;
  messageBody: string;
  organizationId: string;
  messageSubject?: string;
  failureReason?: SendingFailureReason;
  sentAt?: Date;
}) {
  try {
    await db.sendingHistory.create({
      data: {
        campaignId: params.campaignId,
        contactId: params.contactId,
        channel: params.channel,
        body: params.messageBody,
        subject: params.messageSubject,
        status: params.status,
        failureReason: params.failureReason,
        organizationId: params.organizationId,
        sentAt: params.sentAt,
        scheduledAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
        sendingType: "CAMPAIGN",
      },
    });

    logger.log("[SendingHistory] 생성 완료", {
      campaignId: params.campaignId,
      contactId: params.contactId,
      channel: params.channel,
      status: params.status,
    });
  } catch (err) {
    logger.error("[SendingHistory] 생성 실패", { err, params });
  }
}

/**
 * 재시도 대상 조회
 * - status='RETRY_SCHEDULED' AND nextRetryAt <= NOW
 */
export async function getPendingRetries(limit: number = 1000) {
  try {
    const retries = await db.sendingHistory.findMany({
      where: {
        status: "RETRY_SCHEDULED",
        nextRetryAt: {
          lte: new Date(),
        },
      },
      take: limit,
      select: {
        id: true,
        campaignId: true,
        contactId: true,
        channel: true,
        body: true,
        subject: true,
        retryCount: true,
      },
    });

    logger.log("[SendingHistory] 재시도 대상 조회 완료", { count: retries.length });
    return retries;
  } catch (err) {
    logger.error("[SendingHistory] 재시도 대상 조회 실패", { err });
    throw err;
  }
}

/**
 * 캠페인별 발송 통계 업데이트
 * - totalCount: 전체 발송 대상 수
 * - sentCount: 발송 완료 수 (SENT + DELIVERED)
 * - failedCount: 발송 실패 수 (FAILED + ABANDONED)
 */
export async function updateCampaignStats(campaignId: string) {
  try {
    const stats = await db.sendingHistory.groupBy({
      by: ["status"],
      where: { campaignId },
      _count: {
        id: true,
      },
    });

    let sentCount = 0;
    let failedCount = 0;
    let totalCount = 0;

    for (const stat of stats) {
      const count = stat._count.id;
      totalCount += count;

      if (["SENT", "DELIVERED"].includes(stat.status)) {
        sentCount += count;
      } else if (["FAILED", "ABANDONED"].includes(stat.status)) {
        failedCount += count;
      }
    }

    await db.crmMarketingCampaign.update({
      where: { id: campaignId },
      data: {
        totalCount,
        sentCount,
        updatedAt: new Date(),
      },
    });

    logger.log("[SendingHistory] 캠페인 통계 업데이트 완료", {
      campaignId,
      totalCount,
      sentCount,
      failedCount,
    });
  } catch (err) {
    logger.error("[SendingHistory] 캠페인 통계 업데이트 실패", { campaignId, err });
  }
}

/**
 * 특정 캠페인의 발송 이력 조회
 */
export async function getCampaignSendingHistory(campaignId: string) {
  try {
    const history = await db.sendingHistory.findMany({
      where: { campaignId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        contactId: true,
        channel: true,
        status: true,
        failureReason: true,
        sentAt: true,
        retryCount: true,
        createdAt: true,
      },
    });

    return history;
  } catch (err) {
    logger.error("[SendingHistory] 발송 이력 조회 실패", { campaignId, err });
    throw err;
  }
}

/**
 * 조직별 발송 통계
 */
export async function getOrganizationSendingStats(organizationId: string) {
  try {
    const stats = await db.sendingHistory.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: {
        id: true,
      },
    });

    const result = {
      total: 0,
      sent: 0,
      failed: 0,
      pending: 0,
      retryScheduled: 0,
      abandoned: 0,
    };

    for (const stat of stats) {
      const count = stat._count.id;
      result.total += count;

      switch (stat.status) {
        case "SENT":
          result.sent += count;
          break;
        case "FAILED":
          result.failed += count;
          break;
        case "PENDING":
          result.pending += count;
          break;
        case "RETRY_SCHEDULED":
          result.retryScheduled += count;
          break;
        case "ABANDONED":
          result.abandoned += count;
          break;
      }
    }

    return result;
  } catch (err) {
    logger.error("[SendingHistory] 조직 통계 조회 실패", { organizationId, err });
    throw err;
  }
}

/**
 * 실패한 발송 기록 조회 (상세)
 */
export async function getFailedSending(campaignId: string) {
  try {
    const failed = await db.sendingHistory.findMany({
      where: {
        campaignId,
        status: { in: ["FAILED", "ABANDONED"] },
      },
      select: {
        id: true,
        contactId: true,
        channel: true,
        failureReason: true,
        retryCount: true,
        nextRetryAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return failed;
  } catch (err) {
    logger.error("[SendingHistory] 실패 기록 조회 실패", { campaignId, err });
    throw err;
  }
}
