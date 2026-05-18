/**
 * GET /api/webhooks/aligo/status
 * Aligo SMS 콜백 엔드포인트
 *
 * Aligo에서 SMS 발송 결과를 GET 요청으로 전달
 * 쿼리 파라미터: msg_id, stat, result, dest, send_time, receive_time
 *
 * 요청 예시:
 * GET /api/webhooks/aligo/status?msg_id=12345&stat=1&result=1000&dest=01012345678&send_time=20250115103000&receive_time=20250115103015
 *
 * stat 코드:
 * 0: PENDING (수신중)
 * 1: SENT (성공)
 * 2: FAILED (실패)
 * 3: PENDING (대기)
 */

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { enqueueDLQ } from '@/lib/mabiz-dlq';
import {
  isProcessedWebhook,
  markWebhookProcessed,
  mapAligoStatusToSending,
  mapAligoResultToReason,
  getAligoUserMessage,
  getSendingHistoryByMessageId,
  updateSendingStatus,
} from '@/lib/webhook-execution';

interface AligoStatusParams {
  msg_id: string;
  stat: string;
  result: string;
  dest?: string;
  send_time?: string;
  receive_time?: string;
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  let params: AligoStatusParams;

  try {
    // 1. 쿼리 파라미터 파싱
    const searchParams = req.nextUrl.searchParams;
    params = {
      msg_id: searchParams.get('msg_id') || '',
      stat: searchParams.get('stat') || '',
      result: searchParams.get('result') || '',
      dest: searchParams.get('dest') || undefined,
      send_time: searchParams.get('send_time') || undefined,
      receive_time: searchParams.get('receive_time') || undefined,
    };

    logger.info('[AligoStatusWebhook] 수신', {
      msg_id: params.msg_id,
      stat: params.stat,
      result: params.result,
    });

    // 2. 필수 파라미터 검증
    if (!params.msg_id) {
      logger.warn('[AligoStatusWebhook] msg_id 누락');
      return NextResponse.json(
        { ok: false, error: 'msg_id 필수' },
        { status: 400 }
      );
    }

    if (!params.stat || !params.result) {
      logger.warn('[AligoStatusWebhook] stat/result 누락', {
        msg_id: params.msg_id,
      });
      return NextResponse.json(
        { ok: false, error: 'stat, result 필수' },
        { status: 400 }
      );
    }

    // 3. 멱등성: msg_id를 eventId로 사용하여 중복 확인
    const eventId = `aligo-${params.msg_id}`;
    if (await isProcessedWebhook(eventId)) {
      logger.info('[AligoStatusWebhook] 중복 콜백 (멱등성)', {
        msg_id: params.msg_id,
      });
      // 이미 처리된 콜백은 200 OK로 반환 (멱등성)
      return NextResponse.json(
        {
          ok: true,
          msg_id: params.msg_id,
          status: params.stat,
          duplicate: true,
        },
        { status: 200 }
      );
    }

    // 4. stat 코드 → SendingStatus 변환
    const stat = parseInt(params.stat, 10);
    const sendingStatus = mapAligoStatusToSending(stat);

    // 5. result 코드 → SendingFailureReason 변환 (실패 시)
    const result = params.result;
    const failureReason =
      sendingStatus === 'FAILED' ? mapAligoResultToReason(result) : undefined;
    const failureUserMsg =
      sendingStatus === 'FAILED'
        ? getAligoUserMessage(stat, result)
        : undefined;

    // 6. SendingHistory 조회 (messageId = msg_id)
    const sending = await getSendingHistoryByMessageId(params.msg_id);
    if (!sending) {
      logger.warn('[AligoStatusWebhook] SendingHistory 없음', {
        msg_id: params.msg_id,
      });
      // msg_id가 없으면 처리 기록만 하고 200 OK 반환
      // (Aligo는 콜백 응답 상태를 보지 않으므로 재시도하지 않음)
      try {
        await markWebhookProcessed(eventId, 'aligo_status');
      } catch (error) {
        logger.error('[AligoStatusWebhook] 처리 기록 실패', { eventId });
      }
      return NextResponse.json(
        {
          ok: true,
          msg_id: params.msg_id,
          status: params.stat,
          note: 'SendingHistory를 찾을 수 없음 (이미 삭제됨 또는 존재하지 않음)',
        },
        { status: 200 }
      );
    }

    // 7. SendingHistory 상태 업데이트
    await updateSendingStatus(
      sending.id,
      sendingStatus,
      failureReason,
      failureUserMsg
    );

    // 8. ProcessedWebhookEvent 기록 (멱등성)
    await markWebhookProcessed(eventId, 'aligo_status');

    logger.info('[AligoStatusWebhook] 처리 완료', {
      msg_id: params.msg_id,
      sendingId: sending.id,
      status: sendingStatus,
      duration: Date.now() - startTime,
    });

    // 9. JSON 응답
    return NextResponse.json(
      {
        ok: true,
        msg_id: params.msg_id,
        status: sendingStatus,
        updatedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[AligoStatusWebhook] 예외 발생', {
      error,
      msg_id: params && params.msg_id,
    });

    // 500 에러는 DLQ에 등록 (재시도 가능)
    if (params && params.msg_id) {
      try {
        await enqueueDLQ({
          service: 'webhook-aligo-status',
          payload: params,
          error: String(error),
        });
      } catch (dlqError) {
        logger.error('[AligoStatusWebhook] DLQ 등록 실패', { dlqError });
      }
    }

    // Aligo는 응답 상태를 보지 않으므로 200 OK 반환
    return NextResponse.json(
      { ok: false, error: '서버 오류' },
      { status: 500 }
    );
  }
}
