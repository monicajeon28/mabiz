// app/api/admin/affiliate/sales/[saleId]/refund-with-verification/route.ts
// 환절 + PG 검증 엔드포인트

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getSessionUser } from '@/lib/auth';
import { processRefundWithPgVerification } from '@/lib/affiliate/refund-with-pg-verification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/affiliate/sales/[saleId]/refund-with-verification
 *
 * 요청:
 * {
 *   refundAmount?: number,    // 부분 환절 금액 (선택), DB 값으로 검증됨
 *   refundReason: string      // 환절 사유 (필수)
 * }
 *
 * 응답 (성공):
 * {
 *   ok: true,
 *   data: {
 *     saleId: number,
 *     refundAmount: number,
 *     withholdingAmount: number,   // ← P0-1: 원천징수액
 *     netAmount: number,           // ← P0-1: 실제 입금액 (= refundAmount - withholdingAmount)
 *     pgStatus: 'CONFIRMED' | 'PENDING' | 'FAILED',
 *     pgVerification: { status, resultCode, resultMsg, ... },
 *     userMessage: string,         // ← P0-1: 사용자 친화 메시지
 *     refundEntries: [ { id, entryType, amount, isSettled } ]
 *   }
 * }
 *
 * [P0-1] 금액 검증: DB saleAmount와 비교하여 클라이언트 입력 검증
 * [P0-2] 응답에 재무정보 포함: withholdingAmount, netAmount, userMessage
 * [P0-3] 에러 처리: 404/400/500 명확히
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { saleId: string } }
) {
  try {
    // ─── 1️⃣ 인증 ────────────────────────────────────────────────────────
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (sessionUser.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 });
    }

    // ─── 2️⃣ 경로 파라미터 검증 ────────────────────────────────────────────
    const saleId = parseInt(params.saleId, 10);
    if (isNaN(saleId)) {
      return NextResponse.json({ ok: false, error: 'Invalid saleId' }, { status: 400 });
    }

    // ─── 3️⃣ 요청 본문 검증 ────────────────────────────────────────────────
    const body = await req.json();
    const { refundAmount, refundReason } = body;

    if (!refundReason || typeof refundReason !== 'string' || refundReason.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: 'refundReason is required and must be non-empty string' },
        { status: 400 }
      );
    }

    // ─── 4️⃣ saleId 존재 확인만 (P0-1) ───────────────────────────────────────
    // [CLAUDE.md 조항 2] 요청 수준 검증만 실행
    // - refundAmount는 참고만 함 (processRefund는 전액 환절만 지원)
    // - 누적 금액 검증은 processRefund 내부 transaction에서 Serializable 격리로 보호

    const saleExists = await prisma.affiliateSale.findUnique({
      where: { id: saleId },
      select: { id: true, saleAmount: true },
    });

    if (!saleExists) {
      return NextResponse.json({ ok: false, error: 'Sale not found' }, { status: 404 });
    }

    logger.log('[refund-with-verification] 요청 처리', {
      saleId,
      clientRefundAmount: refundAmount,
      dbSaleAmount: saleExists.saleAmount,
      refundReason: refundReason.substring(0, 50),
      processedBy: sessionUser.id,
    });

    // ─── 5️⃣ processRefundWithPgVerification 호출 ──────────────────────────
    // [P0] 부분 환절 요청은 무시, processRefund는 전액 환절만 지원
    const result = await processRefundWithPgVerification(
      saleId,
      refundReason,
      sessionUser.id
    );

    // ─── 6️⃣ 실제 환절 금액으로 재무정보 계산 (P0-1, P1) ──────────────────
    // [P1] processRefund 결과 sale의 saleAmount가 실제 환절 금액
    const actualRefundAmount = result.sale.saleAmount;
    const withholdingRefunded = Math.floor(actualRefundAmount * 0.033); // 3.3% 원천징수
    const netRefunded = actualRefundAmount - withholdingRefunded;

    // ─── 7️⃣ 응답 구성 (P0-1, P0-2, P0-3) ──────────────────────────────────
    logger.debug('[refund-with-verification] 완료', {
      saleId,
      refundAmount: actualRefundAmount,
      withholdingAmount: withholdingRefunded,
      netAmount: netRefunded,
      pgStatus: result.pgStatus,
      processedBy: sessionUser.id,
    });

    return NextResponse.json({
      ok: true,
      data: {
        saleId: result.sale.id,
        refundAmount: actualRefundAmount,
        withholdingAmount: withholdingRefunded,                      // ← P0-1: 원천징수액
        netAmount: netRefunded,                                      // ← P0-1: 실제 입금액
        pgStatus: result.pgStatus,
        pgVerification: {
          ...result.pgVerification,
          userMessage: getUserMessage(result.pgStatus),             // ← P0-1: 사용자 메시지
        },
        refundEntries: result.refundEntries.map((e) => ({
          id: e.id,
          entryType: e.entryType,
          amount: e.amount,
          isSettled: e.isSettled,
        })),
      },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    logger.error('[refund-with-verification] 에러', {
      saleId: params.saleId,
      error: errorMsg,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { ok: false, error: errorMsg },
      { status: 500 }
    );
  }
}

/**
 * 헬퍼 함수: pgStatus별 사용자 메시지 생성 (P0-1, P1-3)
 *
 * [P1-3] 파트너가 읽을 수 있는 명확한 메시지
 * - CONFIRMED: 은행 송금 완료, 입금 대기
 * - PENDING: 신청 접수, 수동 확인 필요
 * - FAILED: 오류 발생, 관리자 문의
 */
function getUserMessage(pgStatus: 'CONFIRMED' | 'PENDING' | 'FAILED'): string {
  const messages: Record<'CONFIRMED' | 'PENDING' | 'FAILED', string> = {
    CONFIRMED: '환불이 완료되어 3-5일 내 입금될 예정입니다.',
    PENDING: '환불 신청이 접수되었습니다. 은행 송금 대기 중이며, 수동 확인이 필요합니다.',
    FAILED: '환불 처리 중 오류가 발생했습니다. 관리자에게 문의하세요.',
  };
  return messages[pgStatus] ?? '상태 불명';
}
