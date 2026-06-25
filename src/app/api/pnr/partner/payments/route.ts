export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerContext } from '@/lib/passport-auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { enforceRBAC } from '@/app/api/_middleware/enforce-rbac';

/**
 * GET /api/pnr/partner/payments
 * 예약 폼(ReservationForm)에서 사용할 "완료된 결제 내역" 목록 조회.
 *
 * 스코프 규칙 (형제 라우트 list/route.ts 미러링):
 *   - ADMIN(GLOBAL_ADMIN) / OWNER: 완료된 모든 결제 조회 (전체 관리)
 *   - BRANCH_MANAGER: 본인 + 소속 대리점장이 관리하는 Lead 고객의 결제
 *   - SALES_AGENT: 본인이 관리하는 Lead 고객의 결제
 *
 * 매칭 방식: 관리 Lead의 customerPhone → Payment.buyerTel (하이픈 변형 포함)
 * 실제 DB만 사용 (더미/하드코딩 없음).
 */
export async function GET(req: NextRequest) {
  // ────────────────────────────────────────────────────────
  // RBAC: 인증된 사용자만 (AUTH 필수)
  // ────────────────────────────────────────────────────────
  const rbacCheck = enforceRBAC(req, {
    authOnly: true,
    errorMessage: '인증이 필요합니다.',
  });
  if (rbacCheck !== true) return rbacCheck;

  try {
    const ctx = await requirePartnerContext();
    if (!ctx) {
      return NextResponse.json(
        { ok: false, message: '인증이 필요합니다.' },
        { status: 403 }
      );
    }
    const { profile } = ctx;

    // 완료로 간주하는 결제 상태
    const completedStatuses = ['completed', 'paid'] as const;

    // ADMIN / OWNER: 완료된 모든 결제 조회 (전체 관리 권한)
    const isAdminOrOwner = profile.type === 'ADMIN' || profile.type === 'OWNER';

    let buyerTelVariants: string[] | null = null;

    if (!isAdminOrOwner) {
      // ── 파트너(지사장/대리점장) 스코프: 관리 Lead의 전화번호로 제한 ──

      // 지사장인 경우 팀 대리점장들의 ID 목록 조회
      let teamAgentIds: number[] = [];
      if (profile.type === 'BRANCH_MANAGER') {
        const teamRelations = await prisma.gmAffiliateRelation.findMany({
          where: {
            managerId: profile.id,
            status: 'ACTIVE',
          },
          select: {
            agentId: true,
          },
        });
        teamAgentIds = teamRelations
          .map((r) => r.agentId)
          .filter((id): id is number => id !== null);
      }

      // 지사장/대리점장이 관리하는 Lead 조회
      const managedLeads = await prisma.gmAffiliateLead.findMany({
        where: {
          customerPhone: { not: null },
          OR: [
            { managerId: profile.id },
            { agentId: profile.id },
            ...(profile.type === 'BRANCH_MANAGER' && teamAgentIds.length > 0
              ? [{ agentId: { in: teamAgentIds } }]
              : []),
          ],
        },
        select: {
          customerPhone: true,
        },
      });

      // 전화번호 변형 생성 (하이픈 포함/미포함) — Payment.buyerTel 매칭용
      const phoneVariants = new Set<string>();
      managedLeads.forEach((lead) => {
        const phone = lead.customerPhone;
        if (!phone) return;
        const digits = phone.replace(/[^0-9]/g, '');
        if (digits.length < 10) return;
        phoneVariants.add(digits); // 숫자만
        if (digits.length === 11) {
          phoneVariants.add(
            `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
          ); // 010-1234-5678
        } else if (digits.length === 10) {
          phoneVariants.add(
            `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
          ); // 010-123-4567
        }
      });

      buyerTelVariants = Array.from(phoneVariants);

      // 관리하는 고객 전화번호가 하나도 없으면 빈 결과 반환
      if (buyerTelVariants.length === 0) {
        return NextResponse.json({ ok: true, payments: [] });
      }
    }

    // 완료된 결제 조회
    const payments = await prisma.payment.findMany({
      where: {
        status: { in: [...completedStatuses] },
        ...(buyerTelVariants ? { buyerTel: { in: buyerTelVariants } } : {}),
      },
      select: {
        id: true,
        orderId: true,
        productCode: true,
        productName: true,
        amount: true,
        currency: true,
        buyerName: true,
        buyerEmail: true,
        buyerTel: true,
        paidAt: true,
        metadata: true,
      },
      orderBy: {
        id: 'desc',
      },
      take: 200,
    });

    // ReservationForm의 Payment 인터페이스에 정확히 매핑
    // (Payment 모델에는 sale 관계가 없으므로 sale은 null)
    return NextResponse.json({
      ok: true,
      payments: payments.map((p) => ({
        id: p.id,
        orderId: p.orderId,
        productCode: p.productCode,
        productName: p.productName,
        amount: p.amount,
        currency: p.currency,
        buyerName: p.buyerName,
        buyerEmail: p.buyerEmail,
        buyerTel: p.buyerTel,
        paidAt: p.paidAt ? p.paidAt.toISOString() : null,
        metadata: p.metadata,
        sale: null,
      })),
    });
  } catch (error: unknown) {
    const err = error as Record<string, unknown>;
    logger.error('GET /api/pnr/partner/payments error', {
      error: err instanceof Error ? (err as Error).message : String(err),
      name: (err as any).name,
      status: (err as any).status,
    });
    return NextResponse.json(
      { ok: false, message: (err as any).message || '결제 내역 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
