export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/sales/[saleId]/status/route.ts
// AffiliateSale 상태 전환 API (CONFIRMED → LOCKED → PAID → PAYOUT_SCHEDULED)

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

// 허용된 목표 상태 집합
const ALLOWED_TARGET_STATUSES = ['LOCKED', 'PAID', 'PAYOUT_SCHEDULED'] as const;
type AllowedTargetStatus = (typeof ALLOWED_TARGET_STATUSES)[number];

// 상태 전환 규칙: 현재 상태 → 허용되는 다음 상태 (순방향만)
const VALID_TRANSITIONS: Record<string, AllowedTargetStatus> = {
  CONFIRMED: 'LOCKED',
  LOCKED: 'PAID',
  PAID: 'PAYOUT_SCHEDULED',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: '대기',
  PENDING_APPROVAL: '승인 대기',
  CONFIRMED: '확정',
  LOCKED: '정산 잠금',
  PAID: '지급완료',
  PAYOUT_SCHEDULED: '지급 예정',
  REFUNDED: '환불',
  REJECTED: '거절',
};

/**
 * PATCH /api/admin/affiliate/sales/[saleId]/status
 * AffiliateSale 상태를 순방향으로 전환 (역방향 금지)
 * body: { status: 'LOCKED' | 'PAID' | 'PAYOUT_SCHEDULED', note?: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ saleId: string }> }
) {
  try {
    // 1. 인증 — admin 전용
    const user = await getSessionUser();
    if (!user || !['admin', 'superadmin'].includes(user.role ?? '')) {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    // 2. saleId 파라미터 검증
    const { saleId: saleIdStr } = await params;
    const saleId = parseInt(saleIdStr, 10);
    if (isNaN(saleId) || saleId <= 0) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 판매 ID입니다.' },
        { status: 400 }
      );
    }

    // 3. 요청 바디 파싱
    let body: { status?: unknown; note?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: '요청 본문을 파싱할 수 없습니다.' },
        { status: 400 }
      );
    }

    const targetStatus = body.status;
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : null;

    // 4. 목표 상태값 검증
    if (!ALLOWED_TARGET_STATUSES.includes(targetStatus as AllowedTargetStatus)) {
      return NextResponse.json(
        {
          ok: false,
          error: `허용되지 않는 상태값입니다. 가능한 값: ${ALLOWED_TARGET_STATUSES.join(', ')}`,
        },
        { status: 400 }
      );
    }
    const validatedTargetStatus = targetStatus as AllowedTargetStatus;

    // 5. 현재 sale 조회
    const sale = await prisma.affiliateSale.findUnique({
      where: { id: saleId },
      select: {
        id: true,
        status: true,
        saleAmount: true,
        productCode: true,
        agentId: true,
        metadata: true,
      },
    });

    if (!sale) {
      return NextResponse.json(
        { ok: false, error: '판매를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 6. 상태 전환 유효성 검증
    const allowedNext = VALID_TRANSITIONS[sale.status];
    if (!allowedNext) {
      const currentLabel = STATUS_LABELS[sale.status] ?? sale.status;
      return NextResponse.json(
        {
          ok: false,
          error: `현재 상태(${currentLabel})에서는 상태를 변경할 수 없습니다.`,
          currentStatus: sale.status,
        },
        { status: 400 }
      );
    }

    if (allowedNext !== validatedTargetStatus) {
      const currentLabel = STATUS_LABELS[sale.status] ?? sale.status;
      const allowedLabel = STATUS_LABELS[allowedNext] ?? allowedNext;
      return NextResponse.json(
        {
          ok: false,
          error: `현재 상태(${currentLabel})에서는 ${allowedLabel}(${allowedNext})로만 전환할 수 있습니다.`,
          currentStatus: sale.status,
          allowedNext,
        },
        { status: 400 }
      );
    }

    // 7. DB 업데이트 + AdminActionLog 기록 ($transaction)
    const now = new Date();
    const currentMetadata =
      typeof sale.metadata === 'object' && sale.metadata !== null
        ? (sale.metadata as Record<string, unknown>)
        : {};

    // 상태별 타임스탬프를 metadata에 기록 (schema에 전용 컬럼 없음 — mark-paid 동일 패턴)
    const timestampKey =
      validatedTargetStatus === 'LOCKED'
        ? 'lockedAt'
        : validatedTargetStatus === 'PAID'
          ? 'paidAt'
          : 'payoutScheduledAt';

    const updatedMetadata: Record<string, unknown> = {
      ...currentMetadata,
      [timestampKey]: now.toISOString(),
      [`${timestampKey.replace('At', 'ByAdminId')}`]: user.id,
      ...(note && { [`${validatedTargetStatus.toLowerCase()}Note`]: note }),
    };

    const [updatedSale] = await prisma.$transaction([
      prisma.affiliateSale.update({
        where: { id: saleId },
        data: {
          status: validatedTargetStatus,
          metadata: updatedMetadata as Prisma.InputJsonValue,
          updatedAt: now,
        },
        select: {
          id: true,
          status: true,
          saleAmount: true,
          productCode: true,
          agentId: true,
        },
      }),
      prisma.adminActionLog.create({
        data: {
          adminId: user.id,
          action: 'AFFILIATE_SALE_STATUS_CHANGE',
          details: {
            saleId,
            fromStatus: sale.status,
            toStatus: validatedTargetStatus,
            ...(note && { note }),
            changedAt: now.toISOString(),
          },
        },
      }),
    ]);

    const statusLabel = STATUS_LABELS[validatedTargetStatus] ?? validatedTargetStatus;

    return NextResponse.json({
      ok: true,
      message: `${statusLabel} 처리되었습니다.`,
      sale: {
        id: updatedSale.id,
        status: updatedSale.status,
        saleAmount: updatedSale.saleAmount,
        productCode: updatedSale.productCode,
        [timestampKey]: now.toISOString(),
      },
    });
  } catch (error: unknown) {
    logger.error('[Affiliate Sale Status API] Error:', error);
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
