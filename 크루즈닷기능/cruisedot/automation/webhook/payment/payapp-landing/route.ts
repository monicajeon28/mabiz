export const dynamic = 'force-dynamic';

/**
 * 랜딩페이지 PayApp Webhook (feedbackurl)
 * POST /api/payapp/landing/webhook
 *
 * PayApp에서 결제 상태 변경 시 호출됨
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { validatePayAppFeedback, getPaymentStatus, PAY_STATE } from '@/lib/payapp';

export async function POST(req: Request) {
  try {
    // PayApp은 application/x-www-form-urlencoded 형식으로 전송
    const contentType = req.headers.get('content-type');
    let body: Record<string, string> = {};

    if (contentType?.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        body[key] = value.toString();
      });
    } else if (contentType?.includes('application/json')) {
      body = await req.json();
    } else {
      // URL encoded string 파싱
      const text = await req.text();
      const params = new URLSearchParams(text);
      params.forEach((value, key) => {
        body[key] = value;
      });
    }

    logger.log('[PayApp Landing Webhook] 수신 데이터');

    const {
      userid,
      linkkey,
      linkval,
      goodname,
      price,
      recvphone,
      pay_state,
      pay_type,
      pay_date,
      mul_no,
      csturl,
      card_name,
      var1: orderId,  // orderId
      var2: landingPageIdStr, // landingPageId
      canceldate,
    } = body;

    // 보안 검증
    if (!validatePayAppFeedback({ userid, linkkey, linkval, goodname, price, recvphone })) {
      logger.error('[PayApp Landing Webhook] 보안 검증 실패');
      return new NextResponse('FAIL', { status: 400 });
    }

    // orderId로 결제 레코드 찾기
    if (!orderId) {
      logger.error('[PayApp Landing Webhook] orderId 없음');
      return new NextResponse('FAIL', { status: 400 });
    }

    const payment = await prisma.payAppPayment.findUnique({
      where: { orderId },
      include: {
        LandingPage: {
          select: { id: true, title: true, slug: true },
        },
      },
    });

    if (!payment) {
      logger.error('[PayApp Landing Webhook] 결제 레코드 없음', { orderId });
      return new NextResponse('FAIL', { status: 404 });
    }

    // 결제 상태에 따른 처리
    const status = getPaymentStatus(pay_state || '');

    switch (pay_state) {
      case PAY_STATE.PAID: {
        // 결제 완료
        const paidAmount = parseInt(price || '0');
        logger.log('[PayApp Landing Webhook] 결제 완료:', {
          orderId,
          mulNo: mul_no,
          amount: paidAmount,
        });

        const existingMeta = (payment.metadata as Record<string, any>) || {};

        await prisma.payAppPayment.update({
          where: { id: payment.id },
          data: {
            status: 'paid',
            mulNo: mul_no || payment.mulNo,
            payType: pay_type,
            cstUrl: csturl,
            cardName: card_name,
            paidAt: new Date(),
            metadata: {
              ...existingMeta,
              pay_date,
              pay_state: 'paid',
            },
          },
        });

        // 어필리에이트 추적: metadata에 저장된 affiliateCode / affiliateMallUserId로 AffiliateSale 생성
        const metaAffiliateCode: string | null = existingMeta.affiliateCode || null;
        const metaAffiliateMallUserId: string | null = existingMeta.affiliateMallUserId || null;

        if (metaAffiliateCode || metaAffiliateMallUserId) {
          try {
            // AffiliateProfile 조회
            const profileWhere: any = { status: 'ACTIVE' };
            if (metaAffiliateCode) {
              profileWhere.affiliateCode = metaAffiliateCode;
            } else if (metaAffiliateMallUserId) {
              profileWhere.User = { mallUserId: metaAffiliateMallUserId };
            }
            const profile = await prisma.affiliateProfile.findFirst({
              where: profileWhere,
              select: { id: true, type: true, userId: true },
            });

            if (profile) {
              let managerId: number | null = null;
              let agentId: number | null = null;

              if (profile.type === 'BRANCH_MANAGER') {
                managerId = profile.id;
              } else if (profile.type === 'SALES_AGENT') {
                agentId = profile.id;
                const relation = await prisma.affiliateRelation.findFirst({
                  where: { agentId: profile.id, status: 'ACTIVE' },
                  select: { managerId: true },
                });
                if (relation) managerId = relation.managerId;
              }

              // 중복 생성 방지: externalOrderCode로 체크
              const existingSale = await prisma.affiliateSale.findFirst({
                where: { externalOrderCode: orderId },
              });

              if (!existingSale) {
                await prisma.affiliateSale.create({
                  data: {
                    externalOrderCode: orderId,
                    managerId,
                    agentId,
                    saleAmount: paidAmount,
                    status: 'PENDING',
                    saleDate: new Date(),
                    updatedAt: new Date(),
                    metadata: {
                      source: 'payapp_landing',
                      landingPageId: payment.landingPageId,
                      productName: payment.productName,
                      customerName: payment.customerName,
                      affiliateCode: metaAffiliateCode,
                      affiliateMallUserId: metaAffiliateMallUserId,
                    },
                  },
                });
                logger.log('[PayApp Landing Webhook] AffiliateSale 생성 완료:', {
                  orderId,
                  managerId,
                  agentId,
                  saleAmount: paidAmount,
                });
              } else {
                logger.log('[PayApp Landing Webhook] AffiliateSale 이미 존재:', orderId);
              }
            } else {
              logger.log('[PayApp Landing Webhook] AffiliateProfile 없음');
            }
          } catch (saleErr: any) {
            // AffiliateSale 생성 실패해도 결제는 성공 처리
            logger.error('[PayApp Landing Webhook] AffiliateSale 생성 실패', { error: saleErr instanceof Error ? saleErr.message : String(saleErr) });
          }
        }
        break;
      }

      case PAY_STATE.CANCELLED_REQUEST:
      case PAY_STATE.CANCELLED_REQUEST_2:
        // 요청 취소
        logger.log('[PayApp Landing Webhook] 결제 요청 취소:', orderId);

        await prisma.payAppPayment.update({
          where: { id: payment.id },
          data: {
            status: 'cancelled',
            cancelledAt: new Date(),
            metadata: {
              ...(payment.metadata as any || {}),
              pay_state: 'cancelled',
              cancel_date: canceldate || new Date().toISOString(),
            },
          },
        });
        break;

      case PAY_STATE.CANCELLED_APPROVAL:
      case PAY_STATE.CANCELLED_APPROVAL_2:
        // 승인 취소 (환불)
        logger.log('[PayApp Landing Webhook] 결제 환불:', orderId);

        await prisma.payAppPayment.update({
          where: { id: payment.id },
          data: {
            status: 'refunded',
            refundedAt: new Date(),
            refundAmount: payment.amount,
            metadata: {
              ...(payment.metadata as any || {}),
              pay_state: 'refunded',
              cancel_date: canceldate || new Date().toISOString(),
            },
          },
        });
        break;

      case PAY_STATE.PARTIAL_CANCELLED:
      case PAY_STATE.PARTIAL_CANCELLED_2:
        // 부분 환불
        logger.log('[PayApp Landing Webhook] 부분 환불:', orderId);

        const cancelPrice = parseInt(body.cancelprice || '0');
        await prisma.payAppPayment.update({
          where: { id: payment.id },
          data: {
            status: 'partial_refunded',
            refundedAt: new Date(),
            refundAmount: (payment.refundAmount || 0) + cancelPrice,
            metadata: {
              ...(payment.metadata as any || {}),
              pay_state: 'partial_refunded',
              cancel_date: canceldate || new Date().toISOString(),
              partial_cancel_price: cancelPrice,
            },
          },
        });
        break;

      case PAY_STATE.WAITING:
        // 결제 대기 (가상계좌)
        logger.log('[PayApp Landing Webhook] 결제 대기:', orderId);

        await prisma.payAppPayment.update({
          where: { id: payment.id },
          data: {
            status: 'waiting',
            metadata: {
              ...(payment.metadata as any || {}),
              pay_state: 'waiting',
              vbank: body.vbank,
              vbankno: body.vbankno,
            },
          },
        });
        break;

      case PAY_STATE.REQUESTED:
        // 결제 요청
        logger.log('[PayApp Landing Webhook] 결제 요청 상태:', orderId);
        break;

      default:
        logger.log('[PayApp Landing Webhook] 알 수 없는 상태:', pay_state, orderId);
    }

    // PayApp에 성공 응답 (반드시 'SUCCESS' 반환)
    return new NextResponse('SUCCESS', { status: 200 });
  } catch (error: any) {
    logger.error('[PayApp Landing Webhook] 오류', { error: error instanceof Error ? error.message : String(error) });
    // 오류 발생 시에도 'SUCCESS' 반환 (PayApp 재시도 방지)
    return new NextResponse('SUCCESS', { status: 200 });
  }
}
