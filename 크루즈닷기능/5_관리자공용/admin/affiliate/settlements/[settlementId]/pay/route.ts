export const dynamic = 'force-dynamic';

// POST /api/admin/affiliate/settlements/[settlementId]/pay
// MonthlySettlement: CONFIRMED → LOCKED + 해당 AffiliateSale LOCKED → PAID

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ settlementId: string }> }
) {
  try {
    const { isAdmin, user: adminUser } = await checkAdminAuth();
    if (!isAdmin || !adminUser) {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { settlementId } = await params;
    const settlementIdNum = parseInt(settlementId, 10);
    if (isNaN(settlementIdNum) || settlementIdNum <= 0) {
      return NextResponse.json({ ok: false, error: '잘못된 정산 ID입니다.' }, { status: 400 });
    }

    // paymentDate 파싱 (없으면 현재 시각)
    let paymentDate = new Date();
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // body 없어도 진행 (paymentDate 선택적)
    }

    if (body.paymentDate != null) {
      if (typeof body.paymentDate !== 'string' || !ISO_DATE_REGEX.test(body.paymentDate)) {
        return NextResponse.json(
          { ok: false, error: 'paymentDate는 ISO 날짜 문자열이어야 합니다.' },
          { status: 400 }
        );
      }
      const parsed = new Date(body.paymentDate);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          { ok: false, error: 'paymentDate 날짜 형식이 올바르지 않습니다.' },
          { status: 400 }
        );
      }
      paymentDate = parsed;
    }

    // 정산 존재 여부 사전 확인 (404 응답용)
    const existCheck = await prisma.monthlySettlement.findUnique({
      where: { id: settlementIdNum },
      select: { id: true },
    });
    if (!existCheck) {
      return NextResponse.json({ ok: false, error: '정산 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const now = new Date();

    // [TOCTOU 방지] 상태 검증과 업데이트를 원자적으로 처리
    await prisma.$transaction(async (tx) => {
      const updated = await tx.monthlySettlement.updateMany({
        where: { id: settlementIdNum, status: 'CONFIRMED' },
        data: {
          status: 'LOCKED',
          paymentDate,
          lockedAt: now,
          updatedAt: now,
        },
      });

      if (updated.count === 0) {
        const current = await tx.monthlySettlement.findUnique({
          where: { id: settlementIdNum },
          select: {
            status: true,
            approvedAt: true,
            paymentDate: true,
            lockedAt: true,
          },
        });
        throw Object.assign(new Error('STATUS_CONFLICT'), {
          currentStatus: current?.status ?? 'UNKNOWN',
          approvedAt: current?.approvedAt,
          paymentDate: current?.paymentDate,
          lockedAt: current?.lockedAt,
        });
      }

      // 2. CommissionLedger로 연결된 AffiliateSale 중 LOCKED → PAID
      const linkedSaleRows = await tx.commissionLedger.findMany({
        where: { settlementId: settlementIdNum },
        select: { saleId: true },
        distinct: ['saleId'],
      });

      const saleIds = linkedSaleRows
        .map((r) => r.saleId)
        .filter((id): id is number => id !== null);

      if (saleIds.length > 0) {
        await tx.affiliateSale.updateMany({
          where: { id: { in: saleIds }, status: 'LOCKED' },
          data: { status: 'PAID', paidAt: now },
        });
      }

      // 3. AffiliatePayslip 자동 생성 (profileId별 커미션 합계 집계)
      const settlement = await tx.monthlySettlement.findUnique({
        where: { id: settlementIdNum },
        select: { periodStart: true, periodEnd: true },
      });

      if (settlement) {
        // CommissionLedger를 profileId별로 집계 (HQ_NET 제외, profileId null 제외)
        const ledgerRows = await tx.commissionLedger.findMany({
          where: {
            settlementId: settlementIdNum,
            profileId: { not: null },
            entryType: { not: 'HQ_NET' },
          },
          select: {
            profileId: true,
            entryType: true,
            amount: true,
            withholdingAmount: true,
          },
        });

        // profileId별 집계
        const profileMap = new Map<number, {
          totalCommission: number;
          totalWithholding: number;
        }>();

        for (const row of ledgerRows) {
          if (row.profileId == null) continue;
          const existing = profileMap.get(row.profileId) ?? { totalCommission: 0, totalWithholding: 0 };
          if (row.entryType === 'WITHHOLDING') {
            // WITHHOLDING 엔트리는 별도 집계하지 않음.
            // 원천징수액은 각 엔트리(BRANCH_COMMISSION 등)의 withholdingAmount 필드에 이미 반영됨.
            // 여기서 중복 합산하면 totalWithholding이 2배가 되어 netPayment 과소 계산됨.
          } else {
            existing.totalCommission += row.amount;
            existing.totalWithholding += row.withholdingAmount ?? 0;
          }
          profileMap.set(row.profileId, existing);
        }

        // 정산 기간 → period 문자열 (YYYY-MM)
        const periodLabel = `${settlement.periodStart.getUTCFullYear()}-${String(settlement.periodStart.getUTCMonth() + 1).padStart(2, '0')}`;

        // profileId별 AffiliateSale 건수 집계
        const saleCountRows = await tx.commissionLedger.findMany({
          where: {
            settlementId: settlementIdNum,
            profileId: { not: null },
            entryType: { not: 'HQ_NET' },
          },
          select: { profileId: true, saleId: true },
          distinct: ['profileId', 'saleId'],
        });
        const saleCountMap = new Map<number, number>();
        for (const row of saleCountRows) {
          if (row.profileId == null) continue;
          saleCountMap.set(row.profileId, (saleCountMap.get(row.profileId) ?? 0) + 1);
        }

        // profileId별 upsert — $transaction 내 순차 처리 (Promise.all은 Prisma interactive tx 데드락 위험)
        for (const [profileId, agg] of profileMap.entries()) {
          const netPayment = agg.totalCommission - agg.totalWithholding;
          const totalSalesCount = saleCountMap.get(profileId) ?? 0;
          const payslipData = {
            profileId,
            period: periodLabel,
            type: 'MONTHLY',
            totalSales: totalSalesCount,
            totalCommission: agg.totalCommission,
            totalWithholding: agg.totalWithholding,
            netPayment,
            status: 'APPROVED',
            approvedAt: now,
            approvedBy: adminUser.id,
            metadata: {
              settlementId: settlementIdNum,
              periodStart: settlement.periodStart.toISOString(),
              periodEnd: settlement.periodEnd.toISOString(),
              paidAt: now.toISOString(),
            },
            updatedAt: now,
          };
          await tx.affiliatePayslip.upsert({
            where: { profileId_period: { profileId, period: periodLabel } },
            create: payslipData,
            update: {
              totalSales: payslipData.totalSales,
              totalCommission: payslipData.totalCommission,
              totalWithholding: payslipData.totalWithholding,
              netPayment: payslipData.netPayment,
              status: payslipData.status,
              approvedAt: payslipData.approvedAt,
              approvedBy: payslipData.approvedBy,
              metadata: payslipData.metadata,
              updatedAt: payslipData.updatedAt,
            },
          });
        }

        logger.debug('[Settlement Pay] AffiliatePayslip 자동 생성 완료', {
          settlementId: settlementIdNum,
          period: periodLabel,
          profileCount: profileMap.size,
        });
      }

      // 5. AdminActionLog 기록
      await tx.adminActionLog.create({
        data: {
          adminId: adminUser.id,
          action: 'SETTLEMENT_PAID',
          details: {
            settlementId: settlementIdNum,
            affectedSaleCount: saleIds.length,
            paymentDate: paymentDate.toISOString(),
            paidAt: now.toISOString(),
          },
        },
      });

      // 6. SettlementEvent 기록
      await tx.settlementEvent.create({
        data: {
          settlementId: settlementIdNum,
          userId: adminUser.id,
          eventType: 'PAID',
          description: '관리자가 정산 지급 처리를 완료했습니다.',
          metadata: {
            affectedSaleCount: saleIds.length,
            paymentDate: paymentDate.toISOString(),
            paidAt: now.toISOString(),
          },
        },
      });
    });

    return NextResponse.json({
      ok: true,
      message: '정산 지급 처리가 완료되었습니다.',
      data: {
        settlementId: settlementIdNum,
        status: 'LOCKED',
        paymentDate: paymentDate.toISOString(),
        paidAt: now.toISOString(),
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && (error instanceof Error ? error.message : String(error)) === 'STATUS_CONFLICT') {
      const statusError = error as Error & {
        currentStatus?: string;
        approvedAt?: Date;
        paymentDate?: Date;
        lockedAt?: Date;
      };
      const status = statusError.currentStatus;

      let message = '';
      if (status === 'LOCKED') {
        message = '이미 잠긴 정산입니다. 지급 처리가 완료되었습니다.';
      } else if (status === 'PAID') {
        message = '이미 지급이 완료된 정산입니다.';
      } else if (status === 'DRAFT') {
        message = '아직 승인되지 않은 정산입니다. 먼저 승인 후 진행해주세요.';
      } else if (status === 'CANCELLED') {
        message = '취소된 정산은 지급 처리할 수 없습니다.';
      } else {
        message = `CONFIRMED 상태의 정산만 지급 처리할 수 있습니다. 현재 상태: ${status ?? '알 수 없음'}`;
      }

      return NextResponse.json(
        { ok: false, error: message },
        { status: 409 }
      );
    }
    logger.error('[Settlement Pay API] POST error:', error);
    return NextResponse.json({ ok: false, error: '정산 지급 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
