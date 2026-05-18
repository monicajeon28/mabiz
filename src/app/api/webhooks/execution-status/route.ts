/**
 * POST /api/webhooks/execution-status
 * 일반 WebHook 콜백 엔드포인트
 *
 * SendingHistory 상태 업데이트를 위한 WebHook 콜백
 * HMAC-SHA256 서명 검증 + 멱등성 처리
 *
 * 요청 형식:
 * {
 *   "eventId": "webhook-123",
 *   "sendingId": "sending-456",
 *   "status": "SENT" | "FAILED",
 *   "failureReason": "PROVIDER_ERROR" | null,
 *   "failureUserMsg": "Aligo 서비스 오류",
 *   "messageId": "aligo-msg-789",
 *   "deliveredAt": "2025-01-15T10:30:00Z",
 *   "timestamp": 1737960600000,
 *   "signature": "sha256=..."
 * }
 */

export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { enqueueDLQ } from "@/lib/mabiz-dlq";
import {
  verifyWebhookSignature,
  isProcessedWebhook,
  markWebhookProcessed,
  updateSendingStatus,
  getSendingHistory,
} from "@/lib/webhook-execution";

interface ExecutionStatusWebhookPayload {
  eventId: string;
  sendingId: string;
  status: "SENT" | "FAILED";
  failureReason?: string;
  failureUserMsg?: string;
  messageId?: string;
  deliveredAt?: string;
  timestamp?: number;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let body: ExecutionStatusWebhookPayload;

  try {
    // 1. 요청 본문 파싱
    body = await req.json();
    const { eventId, sendingId, status, failureReason, failureUserMsg } = body;

    logger.info("[ExecutionStatusWebhook] 수신", {
      eventId,
      sendingId,
      status,
    });

    // 2. 필수 필드 검증
    if (!eventId || !sendingId || !status) {
      logger.warn("[ExecutionStatusWebhook] 필수 필드 누락", {
        eventId,
        sendingId,
        status,
      });
      return NextResponse.json(
        { ok: false, error: "eventId, sendingId, status 필수" },
        { status: 400 },
      );
    }

    // 3. 서명 검증 (X-Signature 헤더)
    const signature = req.headers.get("x-signature");
    const secret = process.env.EXECUTION_STATUS_WEBHOOK_SECRET;

    if (!secret) {
      logger.error(
        "[ExecutionStatusWebhook] EXECUTION_STATUS_WEBHOOK_SECRET 미설정",
      );
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    if (!signature || !verifyWebhookSignature(body, signature, secret)) {
      logger.error("[ExecutionStatusWebhook] 서명 검증 실패", {
        eventId,
        signature: signature ? "존재" : "없음",
      });
      // 401은 재시도하지 않음
      return NextResponse.json(
        { ok: false, error: "서명 검증 실패" },
        { status: 401 },
      );
    }

    // 4. 멱등성: 이미 처리된 이벤트 확인
    if (await isProcessedWebhook(eventId)) {
      logger.info("[ExecutionStatusWebhook] 중복 이벤트 (멱등성)", {
        eventId,
        sendingId,
      });
      return NextResponse.json(
        {
          ok: true,
          executionId: sendingId,
          status,
          updatedAt: new Date().toISOString(),
          duplicate: true,
        },
        { status: 200 },
      );
    }

    // 5. SendingHistory 존재 확인
    const sending = await getSendingHistory(sendingId);
    if (!sending) {
      logger.warn("[ExecutionStatusWebhook] SendingHistory 없음", {
        eventId,
        sendingId,
      });
      // 404는 재시도하지 않음 (존재하지 않는 리소스)
      return NextResponse.json(
        { ok: false, error: "SendingHistory를 찾을 수 없음" },
        { status: 404 },
      );
    }

    // 6. 상태 유효성 검증 (SENT/FAILED만 허용)
    if (!["SENT", "FAILED"].includes(status)) {
      logger.warn("[ExecutionStatusWebhook] 유효하지 않은 상태", {
        eventId,
        status,
      });
      return NextResponse.json(
        { ok: false, error: "status는 SENT 또는 FAILED만 허용" },
        { status: 400 },
      );
    }

    // 7. SendingHistory 상태 업데이트
    await updateSendingStatus(
      sendingId,
      status as "SENT" | "FAILED",
      status === "FAILED" && failureReason ? (failureReason as any) : undefined,
      status === "FAILED" ? failureUserMsg : undefined,
    );

    // 8. ProcessedWebhookEvent 기록 (멱등성)
    await markWebhookProcessed(eventId, "execution_status");

    logger.info("[ExecutionStatusWebhook] 처리 완료", {
      eventId,
      sendingId,
      status,
      duration: Date.now() - startTime,
    });

    // 9. 성공 응답
    return NextResponse.json(
      {
        ok: true,
        executionId: sendingId,
        status,
        updatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("[ExecutionStatusWebhook] 예외 발생", {
      error,
      body: body && { eventId: body.eventId, sendingId: body.sendingId },
    });

    // 500 에러는 DLQ에 등록 (재시도 가능)
    if (body) {
      try {
        await enqueueDLQ({
          service: "webhook-execution-status",
          payload: body,
          error: String(error),
        });
      } catch (dlqError) {
        logger.error("[ExecutionStatusWebhook] DLQ 등록 실패", { dlqError });
      }
    }

    return NextResponse.json(
      { ok: false, error: "서버 오류" },
      { status: 500 },
    );
  }
}
