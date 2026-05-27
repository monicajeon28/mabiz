/**
 * 웹훅 공통 처리 라이브러리
 * - 인증 (Bearer Token)
 * - 서명 검증 (HMAC-SHA256)
 * - 멱등성 (eventId)
 * - 에러 처리
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface WebhookOptions {
  webhookType: string;
  secret: string;
  requireAuth?: boolean;
  handler: (payload: any, req: NextRequest) => Promise<any>;
}

export interface WebhookResponse {
  ok: boolean;
  message?: string;
  data?: any;
  duplicate?: boolean;
}

/**
 * 웹훅 메인 핸들러
 * - Bearer Token 검증
 * - 서명 검증
 * - 멱등성 체크
 * - 비즈니스 로직 호출
 * - 멱등성 기록
 */
export async function handleWebhook(
  req: NextRequest,
  options: WebhookOptions
): Promise<NextResponse<WebhookResponse>> {
  const { webhookType, secret, requireAuth = true, handler } = options;
  const startTime = Date.now();

  try {
    // 1. Bearer Token 검증
    if (requireAuth) {
      const authHeader = req.headers.get('authorization') ?? '';
      const token = authHeader.replace('Bearer ', '');

      if (token !== secret) {
        logger.warn(`[Webhook:${webhookType}] 인증 실패`, { token: token?.slice(0, 10) });
        return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
      }
    }

    // 2. 요청 본문 읽기
    const body = await req.text();

    if (!body) {
      return NextResponse.json(
        { ok: false, message: 'Empty body' },
        { status: 400 }
      );
    }

    // 3. 서명 검증
    const signature = req.headers.get('x-signature');
    if (signature) {
      const expectedSignature = createHmac('sha256', secret)
        .update(body)
        .digest('hex');

      if (signature !== expectedSignature) {
        logger.warn(`[Webhook:${webhookType}] 서명 검증 실패`);
        return NextResponse.json({ ok: false, message: 'Invalid signature' }, { status: 403 });
      }
    }

    // 4. JSON 파싱
    let payload: any;
    try {
      payload = JSON.parse(body);
    } catch {
      return NextResponse.json(
        { ok: false, message: 'Invalid JSON' },
        { status: 400 }
      );
    }

    const { eventId } = payload;

    // 5. eventId 필수 검증 (멱등성을 위해)
    if (!eventId) {
      logger.warn(`[Webhook:${webhookType}] eventId 누락`);
      return NextResponse.json(
        { ok: false, message: 'Missing eventId' },
        { status: 400 }
      );
    }

    // 6. 멱등성 체크: 이전에 처리한 이벤트인지 확인
    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
      where: { eventId }
    });

    if (alreadyProcessed) {
      logger.log(`[Webhook:${webhookType}] 중복 이벤트 무시`, { eventId });
      return NextResponse.json({
        ok: true,
        message: 'Duplicate event',
        duplicate: true
      });
    }

    // 7. 비즈니스 로직 실행
    let result: any;
    let error: string | null = null;

    try {
      result = await handler(payload, req);
    } catch (err) {
      error = (err as Error).message;
      logger.error(`[Webhook:${webhookType}] 처리 실패`, { eventId, error });
      throw err;
    }

    // 8. 멱등성 기록 (성공)
    await prisma.processedWebhookEvent.create({
      data: {
        id: crypto.randomUUID(),
        eventId,
        webhookType,
        status: 'SUCCESS',
        errorMessage: null,
        retryCount: 0
      }
    });

    const duration = Date.now() - startTime;
    logger.log(`[Webhook:${webhookType}] 처리 완료`, { eventId, duration: `${duration}ms` });

    return NextResponse.json({
      ok: true,
      message: 'Processed',
      data: result
    });

  } catch (error) {
    // 에러 발생 시 멱등성 기록 (FAILED)
    try {
      const body = await req.text();
      const payload = JSON.parse(body);
      const { eventId } = payload;

      if (eventId) {
        await prisma.processedWebhookEvent.create({
          data: {
            id: crypto.randomUUID(),
            eventId,
            webhookType,
            status: 'FAILED',
            errorMessage: (error as Error).message,
            retryCount: 0
          }
        }).catch(() => {
          // 멱등성 기록 실패 무시
        });
      }
    } catch {
      // 에러 로깅 실패 무시
    }

    logger.error(`[Webhook:${webhookType}] 예상 밖의 에러`, {
      error: (error as Error).message
    });

    return NextResponse.json(
      { ok: false, message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * 웹훅 응답 래퍼
 */
export function webhookResponse(data: WebhookResponse, status: number = 200) {
  return NextResponse.json(data, { status });
}
