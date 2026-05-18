/**
 * WebHook 실행 유틸리티
 * SendingHistory 상태 업데이트를 위한 멱등성 처리 & 서명 검증
 */

import { createHmac, timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { SendingStatus, SendingFailureReason } from "@prisma/client";

/**
 * 1. HMAC-SHA256 서명 검증
 * 타이밍 공격 방지를 위해 timingSafeEqual 사용
 */
export function verifyWebhookSignature(
  payload: Record<string, any>,
  signatureHeader: string,
  secret: string,
): boolean {
  try {
    const hash = createHmac("sha256", secret)
      .update(JSON.stringify(payload))
      .digest("hex");

    const expected = `sha256=${hash}`;
    return timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  } catch (error) {
    logger.error("[WebhookSignature] 서명 검증 에러", { error });
    return false;
  }
}

/**
 * 2. WebHook 이벤트 중복 여부 확인
 */
export async function isProcessedWebhook(eventId: string): Promise<boolean> {
  try {
    const existing = await prisma.processedWebhookEvent.findUnique({
      where: { eventId },
    });
    return !!existing;
  } catch (error) {
    logger.error("[WebhookExecution] 중복 확인 에러", { eventId, error });
    return false;
  }
}

/**
 * 3. WebHook 처리 완료 기록 (멱등성)
 */
export async function markWebhookProcessed(
  eventId: string,
  webhookType: string,
): Promise<void> {
  try {
    await prisma.processedWebhookEvent.create({
      data: {
        eventId,
        webhookType,
        processedAt: new Date(),
      },
    });
    logger.info("[WebhookExecution] 처리 완료 기록", { eventId, webhookType });
  } catch (error) {
    logger.error("[WebhookExecution] 처리 기록 실패", { eventId, error });
    throw error;
  }
}

/**
 * 4. SendingHistory 상태 업데이트
 */
export async function updateSendingStatus(
  sendingId: string,
  status: SendingStatus,
  failureReason?: SendingFailureReason | null,
  failureUserMsg?: string,
): Promise<void> {
  try {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === "FAILED" && failureReason) {
      updateData.failureReason = failureReason;
      updateData.failureUserMsg = failureUserMsg || null;
    }

    if (status === "SENT") {
      updateData.deliveredAt = new Date();
    }

    await prisma.sendingHistory.update({
      where: { id: sendingId },
      data: updateData,
    });

    logger.info("[WebhookExecution] SendingHistory 업데이트", {
      sendingId,
      status,
      failureReason,
    });
  } catch (error) {
    logger.error("[WebhookExecution] SendingHistory 업데이트 실패", {
      sendingId,
      error,
    });
    throw error;
  }
}

/**
 * 5. Aligo stat 코드 → SendingStatus 매핑
 * 0: PENDING, 1: SENT, 2: FAILED, 3: PENDING
 */
export function mapAligoStatusToSending(stat: number): SendingStatus {
  const map: Record<number, SendingStatus> = {
    0: "PENDING", // 수신중
    1: "SENT", // 성공
    2: "FAILED", // 실패
    3: "PENDING", // 대기
  };
  return map[stat] || "PENDING";
}

/**
 * 6. Aligo result 코드 → SendingFailureReason 매핑
 */
export function mapAligoResultToReason(
  result: string,
): SendingFailureReason | null {
  const map: Record<string, SendingFailureReason> = {
    "1000": "PROVIDER_ERROR", // 일반 오류
    "1001": "INVALID_PHONE", // 유효하지 않은 번호
    "1004": "QUOTA_EXCEEDED", // 한도 초과
    "1005": "SYSTEM_ERROR", // 시스템 오류
  };

  const failureReason = map[result];
  if (failureReason) {
    return failureReason;
  }

  // 다른 오류 코드는 일반 PROVIDER_ERROR로 매핑
  const resultCode = parseInt(result, 10);
  return resultCode !== 0 && !isNaN(resultCode) ? "PROVIDER_ERROR" : null;
}

/**
 * 7. Aligo stat 코드에 따른 사용자 메시지 생성
 */
export function getAligoUserMessage(
  stat: number,
  result: string,
): string | undefined {
  if (stat === 1) return undefined; // SENT는 메시지 없음

  const resultCode = parseInt(result, 10);
  const messageMap: Record<number, string> = {
    1000: "SMS 서비스 오류로 발송 실패",
    1001: "유효하지 않은 휴대폰 번호",
    1004: "일일 발송 한도 초과",
    1005: "SMS 서비스 시스템 오류",
  };

  return messageMap[resultCode] || "SMS 발송 실패";
}

/**
 * 8. 통합 처리 함수: 중복 확인 + 상태 업데이트 + 기록
 */
export async function processSendingWebhook(
  eventId: string,
  sendingId: string,
  status: SendingStatus,
  failureReason?: SendingFailureReason,
  failureUserMsg?: string,
): Promise<{ ok: boolean; duplicate: boolean }> {
  // 멱등성: 이미 처리된 이벤트는 성공으로 반환
  if (await isProcessedWebhook(eventId)) {
    logger.info("[WebhookExecution] 중복 이벤트 (멱등성)", {
      eventId,
      sendingId,
    });
    return { ok: true, duplicate: true };
  }

  try {
    // SendingHistory 상태 업데이트
    await updateSendingStatus(sendingId, status, failureReason, failureUserMsg);

    // 처리 완료 기록
    await markWebhookProcessed(eventId, "sending_status");

    return { ok: true, duplicate: false };
  } catch (error) {
    logger.error("[WebhookExecution] 통합 처리 실패", {
      eventId,
      sendingId,
      error,
    });
    throw error;
  }
}

/**
 * 9. SendingHistory 존재 확인
 */
export async function getSendingHistory(sendingId: string) {
  try {
    const sending = await prisma.sendingHistory.findUnique({
      where: { id: sendingId },
    });
    return sending;
  } catch (error) {
    logger.error("[WebhookExecution] SendingHistory 조회 실패", {
      sendingId,
      error,
    });
    return null;
  }
}

/**
 * 10. messageId로 SendingHistory 조회 (Aligo callback용)
 */
export async function getSendingHistoryByMessageId(messageId: string) {
  try {
    const sending = await prisma.sendingHistory.findFirst({
      where: { messageId },
    });
    return sending;
  } catch (error) {
    logger.error("[WebhookExecution] MessageId 기반 조회 실패", {
      messageId,
      error,
    });
    return null;
  }
}
