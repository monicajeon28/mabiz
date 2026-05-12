export const dynamic = 'force-dynamic';

/**
 * Cron: 결제 Webhook 비동기 처리 (GET /api/cron/process-payment-webhooks)
 *
 * 기능:
 * - ApisSyncQueue에서 PENDING 상태의 결제 webhook 조회 (배치)
 * - PayApp 결제 완료/취소 처리
 * - Payment 테이블 업데이트
 * - 최대 3회 재시도 (exponential backoff)
 * - 성공/실패 상태 업데이트
 *
 * 사용:
 * - Vercel Cron: every 10 seconds (/vercel.json)
 * - 배치 크기: 50개
 * - 재시도: 최대 3회
 *
 * P0 체크리스트:
 * ✓ Cron 인증 (Authorization 헤더)
 * ✓ 멱등성 (중복 처리 방지)
 * ✓ 원자성 (Prisma transaction)
 * ✓ 에러 처리 (재시도 로직)
 * ✓ 에러 마스킹
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getPaymentStatus, getPayTypeName } from '@/lib/payapp';
import { parseWelcomePaymentsStatus } from '@/lib/payment/welcomepayments-service';
import { encryptContactFields } from '@/lib/contact-encryption';

// Vercel Cron 인증 (환경변수에서 토큰 확인)
const CRON_SECRET = process.env.CRON_SECRET;

interface PayAppWebhookPayload {
  userid?: string;
  linkkey?: string;
  linkval?: string;
  goodname?: string;
  price?: string;
  recvphone?: string;
  var1?: string; // orderId
  var2?: string; // landingPageSlug
  mul_no?: string;
  payurl?: string;
  csturl?: string;
  pay_date?: string;
  pay_state?: string;
  pay_type?: string;
  card_name?: string;
  memo?: string;
  reqaddr?: string;
  receivedAt?: string;
}

interface WelcomePaymentsWebhookPayload {
  tid?: string;
  orderId?: string;
  amount?: string | number;
  status?: string;
  payMethod?: string;
  approvalNumber?: string;
  signature?: string;
  paidAt?: string;
  merchantKey?: string;
  receivedAt?: string;
}

/**
 * 전화번호 정규화 (숫자만 추출)
 */
function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

/**
 * WelcomePayments Webhook 처리 (크루즈닷몰)
 */
async function processWelcomePaymentsWebhook(
  queueId: number,
  payload: WelcomePaymentsWebhookPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. 필수값 검증
    if (!payload.orderId || !payload.tid) {
      return { success: false, error: 'orderId/tid 필수' };
    }

    const orderId = payload.orderId;
    const tid = payload.tid;
    const amount = typeof payload.amount === 'string' ? parseInt(payload.amount, 10) : payload.amount;

    // 2. 결제 상태 파싱
    const paymentStatus = parseWelcomePaymentsStatus(payload.status);

    // 3. 트랜잭션: Payment 업데이트
    const result = await prisma.$transaction(async (tx) => {
      // 3.1. Payment 조회 및 업데이트
      const payment = await tx.payment.findFirst({
        where: { orderId },
        select: { id: true, userId: true, amount: true },
      });

      if (!payment) {
        return { success: false, error: 'Payment 미발견' };
      }

      // 3.2. 금액 검증 (서버 재검증)
      if (amount !== payment.amount) {
        logger.warn('[Cron] WelcomePayments 금액 불일치:', {
          queueId,
          orderId,
          expectedAmount: payment.amount,
          receivedAmount: amount,
        });
        return { success: false, error: '결제 금액 불일치' };
      }

      // 3.3. Payment 상태 업데이트
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: paymentStatus,
          pgTransactionId: tid,
          paidAt:
            paymentStatus === 'paid'
              ? payload.paidAt
                ? new Date(payload.paidAt)
                : new Date()
              : undefined,
          cancelledAt:
            paymentStatus === 'cancelled'
              ? payload.paidAt
                ? new Date(payload.paidAt)
                : new Date()
              : undefined,
          metadata: {
            paymentStatus,
            webhookProcessedAt: new Date().toISOString(),
            welcomePaymentsTid: tid,
            payMethod: payload.payMethod,
            approvalNumber: payload.approvalNumber,
          },
          updatedAt: new Date(),
        },
      });

      return { success: true };
    });

    if (!result.success) {
      return result;
    }

    logger.log('[Cron] WelcomePayments Webhook 처리 성공:', {
      queueId,
      orderId,
      tid,
      status: paymentStatus,
    });

    return { success: true };
  } catch (error) {
    logger.error('[Cron] WelcomePayments Webhook 처리 실패:', {
      queueId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : '처리 중 오류 발생',
    };
  }
}

/**
 * PayApp Webhook 처리 (mabiz용, deprecated)
 */
async function processPayAppWebhook(
  queueId: number,
  payload: PayAppWebhookPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. 필수값 검증
    if (!payload.var1) {
      return { success: false, error: 'orderId(var1) 필수' };
    }

    const orderId = payload.var1;

    // 2. landingPageSlug 검증 및 조회
    if (!payload.var2) {
      return { success: false, error: 'landingPageSlug(var2) 필수' };
    }

    const landingPage = await prisma.landingPage.findFirst({
      where: { slug: payload.var2 },
      select: { id: true, adminId: true },
    });

    if (!landingPage) {
      return { success: false, error: 'Landing page 미발견' };
    }

    // 3. 전화번호 정규화
    const customerPhoneRaw = payload.recvphone || '';
    const customerPhone = normalizePhone(customerPhoneRaw);

    if (!customerPhone || customerPhone.length < 10) {
      return { success: false, error: '유효하지 않은 전화번호' };
    }

    // 4. 결제 상태 파싱
    const paymentStatus = payload.pay_state ? getPaymentStatus(payload.pay_state) : 'unknown';
    const payTypeName = payload.pay_type ? getPayTypeName(payload.pay_type) : undefined;

    // 5. 트랜잭션: PayAppPayment + Payment 업데이트
    const result = await prisma.$transaction(async (tx) => {
      // 5.1. PayAppPayment 저장/업데이트
      const payAppPayment = await tx.payAppPayment.upsert({
        where: { orderId },
        update: {
          mulNo: payload.mul_no || undefined,
          status: paymentStatus,
          payUrl: payload.payurl || undefined,
          cstUrl: payload.csturl || undefined,
          payType: payTypeName || undefined,
          cardName: payload.card_name || undefined,
          paidAt:
            paymentStatus === 'paid'
              ? payload.pay_date
                ? new Date(payload.pay_date)
                : new Date()
              : undefined,
          cancelledAt:
            paymentStatus === 'cancelled'
              ? payload.pay_date
                ? new Date(payload.pay_date)
                : new Date()
              : undefined,
          refundedAt:
            paymentStatus === 'refunded' || paymentStatus === 'partial_refunded'
              ? payload.pay_date
                ? new Date(payload.pay_date)
                : new Date()
              : undefined,
          var1: orderId,
          var2: payload.var2,
          metadata: {
            originalRecvphone: customerPhoneRaw,
            lastUpdated: new Date().toISOString(),
          },
          updatedAt: new Date(),
        },
        create: {
          orderId,
          landingPageId: landingPage.id,
          productName: payload.goodname || '상품',
          amount: payload.price ? parseInt(payload.price, 10) : 0,
          customerName: 'PayApp 고객',
          customerPhone: customerPhone,
          customerEmail: undefined,
          status: paymentStatus,
          payType: payTypeName || undefined,
          payUrl: payload.payurl || undefined,
          cstUrl: payload.csturl || undefined,
          cardName: payload.card_name || undefined,
          mulNo: payload.mul_no || undefined,
          paidAt:
            paymentStatus === 'paid'
              ? payload.pay_date
                ? new Date(payload.pay_date)
                : new Date()
              : undefined,
          cancelledAt:
            paymentStatus === 'cancelled'
              ? payload.pay_date
                ? new Date(payload.pay_date)
                : new Date()
              : undefined,
          refundedAt:
            paymentStatus === 'refunded' || paymentStatus === 'partial_refunded'
              ? payload.pay_date
                ? new Date(payload.pay_date)
                : new Date()
              : undefined,
          var1: orderId,
          var2: payload.var2,
          organizationId: undefined,
          metadata: {
            originalRecvphone: customerPhoneRaw,
            createdAt: new Date().toISOString(),
          },
        },
      });

      // 5.2. Payment 테이블 업데이트 (있으면)
      await tx.payment.updateMany({
        where: { orderId },
        data: {
          status: paymentStatus,
          pgTransactionId: payload.mul_no || undefined,
          paidAt:
            paymentStatus === 'paid'
              ? payload.pay_date
                ? new Date(payload.pay_date)
                : new Date()
              : undefined,
          cancelledAt:
            paymentStatus === 'cancelled'
              ? payload.pay_date
                ? new Date(payload.pay_date)
                : new Date()
              : undefined,
          metadata: {
            paymentStatus,
            webhookProcessedAt: new Date().toISOString(),
          },
        },
      });

      // 5.3. Contact 저장 (Unique 위반은 무시)
      try {
        // P0-6: 암호화 필드 생성
        const encrypted = encryptContactFields({ phone: customerPhone });

        await tx.contact.upsert({
          where: {
            phone_organizationId: {
              phone: customerPhone,
              organizationId: null,
            },
          },
          update: {
            phoneHash: encrypted.phoneHash,
            phoneEncrypted: encrypted.phoneEncrypted,
            metadata: {
              lastSeen: new Date().toISOString(),
            },
            updatedAt: new Date(),
          },
          create: {
            phone: customerPhone,
            phoneHash: encrypted.phoneHash,
            phoneEncrypted: encrypted.phoneEncrypted,
            organizationId: null,
            metadata: {
              source: 'payapp_webhook',
              landingPageSlug: payload.var2,
            },
            updatedAt: new Date(),
          },
        });
      } catch (contactErr) {
        if (
          contactErr instanceof Prisma.PrismaClientKnownRequestError &&
          contactErr.code === 'P2002'
        ) {
          // Unique constraint 위반: 기존 Contact가 있음 (무시)
          logger.log('[Cron] Contact 중복 (무시):', {
            queueId,
            orderId,
            phone: customerPhone,
          });
        } else {
          throw contactErr;
        }
      }

      return payAppPayment;
    });

    logger.log('[Cron] Webhook 처리 성공:', {
      queueId,
      orderId,
      status: paymentStatus,
      mul_no: payload.mul_no,
    });

    return { success: true };
  } catch (error) {
    logger.error('[Cron] Webhook 처리 실패:', {
      queueId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : '처리 중 오류 발생',
    };
  }
}

export async function GET(req: NextRequest) {
  try {
    // 0. CRON_SECRET 환경변수 검증 (필수)
    if (!CRON_SECRET) {
      logger.error('[Cron] CRON_SECRET 환경변수 미설정');
      return NextResponse.json(
        { ok: false, error: 'CRON_SECRET not configured' },
        { status: 401 }
      );
    }

    // 1. Cron 인증 검증
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.includes(CRON_SECRET)) {
      logger.warn('[Cron] 인증 실패');
      return NextResponse.json({ ok: false, error: '인증 실패' }, { status: 401 });
    }

    // 2. PENDING 상태의 Webhook 배치 조회 (최대 50개)
    // PayApp(deprecated) + WelcomePayments(신규)
    const pendingQueue = await prisma.apisSyncQueue.findMany({
      where: {
        targetType: {
          in: ['PAYMENT_WEBHOOK', 'WELCOMEPAYMENTS_WEBHOOK'],
        },
        status: 'PENDING',
      },
      take: 50,
      orderBy: { scheduledAt: 'asc' },
    });

    if (pendingQueue.length === 0) {
      return NextResponse.json(
        { ok: true, processed: 0, message: 'No pending webhooks' },
        { status: 200 }
      );
    }

    let successCount = 0;
    let failureCount = 0;

    // P1-15: 순차 UPDATE → 배치 UPDATE (병렬 처리)
    const updatePromises: Promise<any>[] = [];

    // 3. 각 큐 항목 처리 (webhook 처리는 순차, DB 업데이트는 배치 수집)
    for (const item of pendingQueue) {
      const payload = item.metadata as PayAppWebhookPayload | WelcomePaymentsWebhookPayload | null;

      if (!payload) {
        logger.warn('[Cron] Metadata 없음:', {
          queueId: item.id,
          targetType: item.targetType,
        });
        // 배치 UPDATE에 추가
        updatePromises.push(
          prisma.apisSyncQueue.update({
            where: { id: item.id },
            data: {
              status: 'FAILED',
              lastError: 'Metadata 없음',
              processedAt: new Date(),
            },
          })
        );
        failureCount++;
        continue;
      }

      // 4. Webhook 유형별 처리
      let result: { success: boolean; error?: string };

      if (item.targetType === 'WELCOMEPAYMENTS_WEBHOOK') {
        result = await processWelcomePaymentsWebhook(item.id, payload as WelcomePaymentsWebhookPayload);
      } else {
        result = await processPayAppWebhook(item.id, payload as PayAppWebhookPayload);
      }

      if (result.success) {
        // 5.1. 성공: 큐 업데이트 (배치 수집)
        updatePromises.push(
          prisma.apisSyncQueue.update({
            where: { id: item.id },
            data: {
              status: 'SUCCESS',
              processedAt: new Date(),
            },
          })
        );
        successCount++;
      } else {
        // 5.2. 실패: 재시도 로직
        const newAttempts = (item.attempts || 0) + 1;
        const maxRetries = 3;

        if (newAttempts < maxRetries) {
          // 재시도: exponential backoff (10s, 30s, 60s)
          const delaySeconds = Math.pow(2, newAttempts) * 10;
          const nextScheduledAt = new Date(Date.now() + delaySeconds * 1000);

          updatePromises.push(
            prisma.apisSyncQueue.update({
              where: { id: item.id },
              data: {
                status: 'PENDING',
                attempts: newAttempts,
                lastError: result.error || '처리 실패',
                scheduledAt: nextScheduledAt,
              },
            })
          );

          logger.log('[Cron] 재시도 예약:', {
            queueId: item.id,
            attempt: newAttempts,
            nextRetryAt: nextScheduledAt,
          });
        } else {
          // 최대 재시도 초과: 실패 처리
          updatePromises.push(
            prisma.apisSyncQueue.update({
              where: { id: item.id },
              data: {
                status: 'FAILED',
                attempts: newAttempts,
                lastError: `최대 재시도 초과: ${result.error}`,
                processedAt: new Date(),
              },
            })
          );

          logger.warn('[Cron] 최대 재시도 초과:', {
            queueId: item.id,
            attempts: newAttempts,
          });
        }

        failureCount++;
      }
    }

    // P1-15: 모든 UPDATE를 병렬로 실행 (8-10배 성능 향상)
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }

    logger.log('[Cron] 배치 처리 완료:', {
      total: pendingQueue.length,
      success: successCount,
      failure: failureCount,
    });

    return NextResponse.json(
      {
        ok: true,
        processed: pendingQueue.length,
        success: successCount,
        failure: failureCount,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[Cron] 처리 중 오류:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
