export const dynamic = 'force-dynamic';

// app/api/payment/webhook/route.ts
// 결제 완료 웹훅 (외부 결제 시스템에서 호출)

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { generateLedgerEntries, calculateCommissionBreakdown } from '@/lib/affiliate/commission';
import { notifyCommissionTierMissing } from '@/lib/affiliate/admin-notifications';
import { log, error, warn } from '@/lib/logger-wrapper';
import { getManagerIdForAgent } from '@/lib/affiliate/relation-cache';
import { internalWebhookPayloadSchema } from '@/lib/schemas/paymentSchema';
import { resolveAffiliateFromRequest } from '@/lib/affiliate/resolve-affiliate';

/**
 * POST: 결제 완료 웹훅
 * 내부 callback 라우트에서만 호출되는 내부 전용 엔드포인트.
 * WEBHOOK_SECRET 헤더 검증으로 외부 임의 호출을 차단한다.
 */
export async function POST(req: NextRequest) {
  // [보안] 내부 전용 비밀키 검증 (자동화 보호)
  // INTERNAL_WEBHOOK_SECRET이 설정되면 → 엄격한 검증 (권장)
  // 미설정이면 → 경고 후 통과 (하위호환, Vercel 환경변수 추가 시 자동 보안 강화)
  const webhookSecret = process.env.INTERNAL_WEBHOOK_SECRET;
  if (webhookSecret) {
    const requestSecret = req.headers.get('x-internal-webhook-secret');
    const a = Buffer.from(requestSecret ?? '', 'utf8');
    const b = Buffer.from(webhookSecret, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      error('[Payment Webhook] Unauthorized request - invalid x-internal-webhook-secret');
      return NextResponse.json({ ok: false, message: '인증되지 않은 요청입니다.' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    // 프로덕션에서 시크릿 미설정 = 서버 설정 오류 → 임의 Sale 생성 차단
    error('[Payment Webhook] CRITICAL: INTERNAL_WEBHOOK_SECRET not configured in production');
    return NextResponse.json({ ok: false, message: '서버 설정 오류입니다.' }, { status: 500 });
  } else {
    warn('[Payment Webhook] ⚠️ INTERNAL_WEBHOOK_SECRET 미설정 — 개발 환경에서만 허용됨');
  }

  try {
    const rawBody = await req.json();

    // [보안] Zod 런타임 입력 검증 — 타입 강제 + 범위/형식 검증
    const parseResult = internalWebhookPayloadSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      error('[Payment Webhook] 입력 검증 실패:', parseResult.error.errors);
      return NextResponse.json(
        { ok: false, message: `필수 정보가 누락되었습니다. (${firstError.path.join('.')}: ${firstError.message})` },
        { status: 400 }
      );
    }

    const {
      imp_uid,       // 아임포트 결제 고유 ID (또는 PG TID)
      merchant_uid,  // 주문번호
      status,        // 결제 상태 ('paid', 'ready', 'failed', 'cancelled')
      amount,        // 결제 금액
      productCode,
      customerName,
      customerPhone,
      cabinType,
      fareCategory,
      headcount,
      costAmount,
      metadata: rawMetadata, // 추가 메타데이터 (leadId, partnerId 등)
      // [v11.0] callback에서 직접 전달되는 파트너 정보
      affiliateCode: directAffiliateCode,
      affiliateMallUserId: directAffiliateUserId,
      _partnerSource, // 디버그용 출처 정보
    } = parseResult.data;

    // metadata null → 빈 객체로 정규화
    const metadata: Record<string, unknown> = rawMetadata ?? {};

    // [v11.0] 디버그 로그
    log('[Payment Webhook v11.0] ===== 요청 수신 =====');
    log('[Payment Webhook v11.0] 기본 정보:', {
      imp_uid,
      merchant_uid,
      status,
      amount,
      productCode,
      customerName,
    });
    log('[Payment Webhook v11.0] 파트너 정보 (직접 전달):', {
      directAffiliateCode: directAffiliateCode || '(empty)',
      directAffiliateUserId: directAffiliateUserId || '(empty)',
      _partnerSource: _partnerSource || '(unknown)',
    });

    // 결제 성공 여부 확인 (Zod로 타입은 검증됐으므로 값만 확인)
    if (status !== 'paid') {
      return NextResponse.json({ ok: false, message: '결제가 완료되지 않았습니다.' }, { status: 400 });
    }

    // 🔒 결제 금액 검증: DB에 저장된 금액과 비교
    if (merchant_uid) {
      const existingPayment = await prisma.payment.findFirst({
        where: { orderId: merchant_uid },
        select: { amount: true },
      });

      if (existingPayment) {
        if (existingPayment.amount !== amount) {
          error('[Payment Webhook] 금액 불일치 탐지:', {
            expected: existingPayment.amount,
            received: amount,
            orderId: merchant_uid,
          });
          return NextResponse.json({
            ok: false,
            message: '결제 금액이 일치하지 않습니다. 관리자에게 문의하세요.'
          }, { status: 400 });
        }
      } else {
        // 신규 주문: DB 기준값 없으므로 amount 양수 검증만 수행
        if (!amount || amount <= 0) {
          error('[Payment Webhook] 신규 주문 금액 비정상', { paymentId: merchant_uid, amount });
          return NextResponse.json({ ok: false, error: '비정상 금액' }, { status: 400 });
        }
        warn('[Payment Webhook] 신규 주문 — DB Payment 레코드 없음, 금액 미검증', { paymentId: merchant_uid, amount });
      }
    }

    // 🔒 중복 호출 방지: 이미 처리된 주문인지 확인 (DB 에러 핸들링 추가)
    let existingSale = null;
    try {
      existingSale = await prisma.affiliateSale.findFirst({
        where: { externalOrderCode: merchant_uid },
        select: { id: true, createdAt: true },
      });

      if (existingSale) {
        log(`[Payment Webhook] ⚠️ 이미 처리된 주문입니다: ${merchant_uid} (saleId: ${existingSale.id})`);
        return NextResponse.json({
          ok: true,
          message: '이미 처리된 주문입니다.',
          saleId: existingSale.id,
          duplicate: true,
        });
      }
    } catch (dbError) {
      // DB 조회 실패 시에도 계속 진행 (graceful degradation)
      error('[Payment Webhook] DB 조회 실패 (중복 체크):', dbError);
      warn('[Payment Webhook] 중복 체크 실패 - 계속 진행 (중복 가능성 있음)');
      // 중복 생성 방지를 위해 나중에 skipDuplicates: true 사용
    }

    // [v11.0] 어필리에이트 코드 추적 - 우선순위: 직접전달 > 쿠키 > metadata
    // resolveAffiliateFromRequest: 형식 검증(Zod) 포함, 비정상값은 null 반환
    const { affiliateCode, affiliateMallUserId } = resolveAffiliateFromRequest(req, {
      directCode: directAffiliateCode,
      directMallUserId: directAffiliateUserId,
      metadataFallback: {
        affiliateCode: typeof metadata?.affiliateCode === 'string' ? metadata.affiliateCode : null,
        partnerId: typeof metadata?.partnerId === 'string' ? metadata.partnerId : null,
      },
    });
    const leadId = metadata?.leadId || null;

    log('[Payment Webhook v11.0] 최종 파트너 정보:', {
      affiliateCode: affiliateCode || 'NONE',
      affiliateMallUserId: affiliateMallUserId || 'NONE',
      leadId: leadId || 'NONE',
    });

    // 어필리에이트 프로필 찾기 (DB 에러 핸들링 추가)
    let managerId: number | null = null;
    let agentId: number | null = null;

    if (affiliateCode || affiliateMallUserId) {
      let affiliateProfile = null;

      try {
        // 방법 1: affiliateCode로 찾기
        if (affiliateCode) {
          affiliateProfile = await prisma.affiliateProfile.findFirst({
            where: {
              affiliateCode: affiliateCode,
              status: 'ACTIVE',
            },
            select: {
              id: true,
              type: true,
            },
          });
        }

        // 방법 2: affiliateMallUserId로 찾기 (mallUserId로 찾기)
        if (!affiliateProfile && affiliateMallUserId) {
          // User를 mallUserId로 찾기
          const user = await prisma.user.findFirst({
            where: { mallUserId: affiliateMallUserId },
            select: { id: true, mallUserId: true },
          });

          if (user) {
            // User와 연결된 AffiliateProfile 찾기
            affiliateProfile = await prisma.affiliateProfile.findFirst({
              where: {
                userId: user.id,
                status: 'ACTIVE',
              },
              select: {
                id: true,
                type: true,
              },
            });
          }
        }

        if (affiliateProfile) {
          if (affiliateProfile.type === 'BRANCH_MANAGER') {
            managerId = affiliateProfile.id;
          } else if (affiliateProfile.type === 'SALES_AGENT') {
            agentId = affiliateProfile.id;
            // 판매원이 속한 대리점장 찾기 (relation-cache 활용)
            managerId = await getManagerIdForAgent(affiliateProfile.id);
          }
        }
      } catch (dbError) {
        // DB 조회 실패 시에도 계속 진행 (파트너 정보 없이 본사 직접 판매로 처리)
        error('[Payment Webhook] DB 조회 실패 (어필리에이트 프로필):', dbError);
        warn('[Payment Webhook] 어필리에이트 조회 실패 - 본사 직접 판매로 처리');
      }
    }

    // [병렬] Lead 조회 + AffiliateProduct 조회 (서로 독립적이므로 동시 실행)
    const [lead, affiliateProduct] = await Promise.all([
      // Lead에서 어필리에이트 정보 가져오기 (없는 경우)
      // [보안] IDOR 방지: leadId가 실제로 존재하는 레코드인지 DB에서 확인.
      //   찾지 못하면 (null) managerId/agentId를 무시하여 권한 에스컬레이션을 차단한다.
      (!managerId && !agentId && leadId)
        ? prisma.affiliateLead.findUnique({
            where: { id: Number(leadId) },
            select: {
              id: true,       // 존재 여부 확인용
              managerId: true,
              agentId: true,
            },
          })
        : Promise.resolve(null),
      // AffiliateProduct 찾기
      productCode
        ? prisma.affiliateProduct.findFirst({
            where: {
              productCode,
              isPublished: true,
              effectiveFrom: { lte: new Date() },
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: new Date() } },
              ],
            },
            orderBy: { effectiveFrom: 'desc' },
            take: 1,
          })
        : Promise.resolve(null),
    ]);

    if (lead) {
      // [보안] lead.id 가 존재해야만 파트너 정보를 신뢰한다 (IDOR 이중 확인)
      managerId = lead.managerId ?? null;
      agentId = lead.agentId ?? null;
    }

    let affiliateProductId: number | null = affiliateProduct ? affiliateProduct.id : null;

    // 🎯 CommissionTier 조회 (상품별 수당 설정)
    let commissionTier = null;
    const roomSelections = metadata?.roomSelections || [];

    // 객실 타입 결정: 직접 전달된 cabinType 또는 roomSelections의 첫 번째 객실
    let determinedCabinType = cabinType;
    if (!determinedCabinType && roomSelections.length > 0) {
      determinedCabinType = roomSelections[0].roomType;
    }

    if (affiliateProductId && determinedCabinType) {
      commissionTier = await prisma.affiliateCommissionTier.findFirst({
        where: {
          affiliateProductId,
          cabinType: determinedCabinType,
          // fareCategory가 있으면 매칭, 없으면 무시
          ...(fareCategory ? { fareCategory } : {}),
        },
        select: {
          cabinType: true,
          fareCategory: true,
          saleAmount: true,
          costAmount: true,
          branchShareAmount: true,
          salesShareAmount: true,
          overrideAmount: true,
          currency: true,
        },
      });

      if (commissionTier) {
        log('[Payment Webhook] CommissionTier 찾음:', {
          productCode,
          cabinType: determinedCabinType,
          branchShare: commissionTier.branchShareAmount,
          salesShare: commissionTier.salesShareAmount,
        });
      } else {
        warn('[Payment Webhook] CommissionTier를 찾을 수 없음:', {
          productCode,
          affiliateProductId,
          cabinType: determinedCabinType,
          fareCategory,
        });

        // 🚨 어필리에이트 판매인 경우에만 관리자 알림 (수당이 0원으로 처리됨)
        if (affiliateProductId && (managerId || agentId)) {
          notifyCommissionTierMissing(
            productCode,
            determinedCabinType || 'unknown',
            affiliateProductId,
            fareCategory
          ).catch((e) => {
            error('[Payment Webhook] 알림 전송 실패:', e);
          });
        }
      }
    }

    // 수당 계산 (🎯 CommissionTier 적용!)
    const netRevenue = amount - (costAmount || 0);
    const breakdown = calculateCommissionBreakdown({
      saleAmount: amount,
      costAmount: commissionTier?.costAmount || costAmount || 0,
      branchCommission: commissionTier?.branchShareAmount || 0, // 🎯 Tier에서 가져옴!
      salesCommission: commissionTier?.salesShareAmount || 0,   // 🎯 Tier에서 가져옴!
      overrideCommission: commissionTier?.overrideAmount || 0,  // 🎯 Tier에서 가져옴!
      currency: commissionTier?.currency || 'KRW',
    });

    // 🎯 실제 수당 결정 (어필리에이트 여부에 따라)
    const actualBranchCommission = managerId && !agentId ? breakdown.branchCommission : 0;
    const actualSalesCommission = agentId ? breakdown.salesCommission : 0;
    const actualOverrideCommission = managerId && agentId ? breakdown.overrideCommission : 0;

    // [A-4] 원천징수는 실제 지급액 기준으로 계산 (미지급 수당 제외)
    const actualTotalPayout = actualBranchCommission + actualSalesCommission + actualOverrideCommission;
    const actualWithholdingAmount = Math.round((actualTotalPayout * 3.3) / 100);

    // CommissionLedger 엔트리 사전 계산 (순수 함수, 트랜잭션 밖에서 실행)
    // 🎯 대리점장 직접 판매: branchCommission만, 대리점 팀 판매: salesCommission + override만
    // saleId는 트랜잭션 내부에서 생성 후 주입
    const ledgerMetadata = {
      ...metadata,
      imp_uid,
      merchant_uid,
      affiliateCode,
      affiliateMallUserId,
      commissionTierId: commissionTier ? `${affiliateProductId}-${determinedCabinType}` : null,
    };
    const ledgerParams = {
      saleAmount: amount,
      costAmount: commissionTier?.costAmount || costAmount || 0,
      branchCommission: agentId ? 0 : (commissionTier?.branchShareAmount || 0),
      salesCommission: agentId ? (commissionTier?.salesShareAmount || 0) : 0,
      overrideCommission: managerId && agentId ? (commissionTier?.overrideAmount || 0) : 0,
      managerProfileId: managerId ?? undefined,
      agentProfileId: agentId ?? undefined,
      overrideProfileId: managerId ?? undefined,
      currency: commissionTier?.currency || 'KRW',
      metadata: ledgerMetadata,
    };

    // [2-3] AffiliateSale + CommissionLedger + Payment 업데이트를 트랜잭션으로 묶음
    // CommissionLedger 실패 시 AffiliateSale도 롤백되어 데이터 일관성 보장
    // tier 누락 여부: 어필리에이트 판매인데 tier가 없으면 수동 수당 조정 필요
    const commissionTierMissing =
      !!(affiliateProductId && !commissionTier && (managerId || agentId)) || undefined;

    const saleMetadata = {
      ...metadata,
      imp_uid,
      merchant_uid,
      affiliateCode,
      affiliateMallUserId,
      commissionTierId: commissionTier ? `${affiliateProductId}-${determinedCabinType}` : null,
      roomSelections,
      ...(commissionTierMissing ? { commissionTierMissing: true } : {}),
      commissionProcessed: true,
      commissionProcessedAt: new Date().toISOString(),
    };

    // [성능] sale + ledgerResult 를 트랜잭션에서 함께 반환하여 generateLedgerEntries 중복 호출 제거
    const { sale, ledgerResult } = await prisma.$transaction(async (tx) => {
      // 1) AffiliateSale 생성
      const createdSale = await tx.affiliateSale.create({
        data: {
          externalOrderCode: merchant_uid,
          leadId: leadId ? Number(leadId) : null,
          affiliateProductId,
          managerId: managerId,
          agentId: agentId,
          productCode,
          cabinType: determinedCabinType || cabinType || null, // 🎯 결정된 cabinType 저장
          fareCategory: fareCategory || null,
          headcount: headcount || null,
          saleAmount: amount,
          costAmount: commissionTier?.costAmount || costAmount || null, // 🎯 Tier의 costAmount 우선
          netRevenue,
          branchCommission: actualBranchCommission,
          salesCommission: actualSalesCommission,
          overrideCommission: actualOverrideCommission,
          withholdingAmount: actualWithholdingAmount,
          status: 'CONFIRMED',
          saleDate: new Date(),
          confirmedAt: new Date(),
          updatedAt: new Date(),
          metadata: saleMetadata,
        },
      });

      // 2) CommissionLedger 생성 (saleId 확정 후 실행)
      //    결과를 트랜잭션 밖에서도 재사용하므로 반환값에 포함시킨다 (중복 호출 방지)
      const txLedgerResult = generateLedgerEntries({ saleId: createdSale.id, ...ledgerParams });
      if (txLedgerResult.ledgerEntries.length > 0) {
        await tx.commissionLedger.createMany({
          data: txLedgerResult.ledgerEntries.map((entry) => ({
            ...entry,
            updatedAt: new Date(),
          })),
          skipDuplicates: true, // 중복 방지
        });
        log('[Payment Webhook] CommissionLedger 생성 완료:', txLedgerResult.ledgerEntries.length);
      }

      // 3) Payment 상태 업데이트 (결제 완료)
      await tx.payment.updateMany({
        where: { orderId: merchant_uid },
        data: {
          status: 'completed',
          paidAt: new Date(),
          pgTransactionId: imp_uid,
          saleId: createdSale.id,
        },
      });

      // 4) Lead 상태 업데이트 — leadId가 있으면 트랜잭션 내에서 원자적으로 처리
      if (leadId) {
        await tx.affiliateLead.update({
          where: { id: Number(leadId) },
          data: { status: 'PURCHASED' },
        });
      }

      // [성능] ledgerResult를 함께 반환하여 트랜잭션 외부에서 재계산하지 않도록 함
      return { sale: createdSale, ledgerResult: txLedgerResult };
    });

    // 🔴 CRITICAL: Reservation 생성 (PNR/여권 정보 입력을 위해 필요)
    // 실패 시 수동 환불 필요함을 DB에 기록
    let reservationId: number | null = null;
    let reservationFailed = false;
    try {
      // 1. 총 인원 수 계산
      const totalGuests = metadata?.totalGuests || roomSelections.reduce((sum: number, sel: any) => {
        return sum + (sel.adult || 0) + (sel.adult3rd || 0) + (sel.child2to11 || 0) + (sel.infantUnder2 || 0);
      }, 0) || 1;

      // 2. User 찾기 또는 생성 (customerPhone 기준)
      const normalizePhone = (phone: string) => phone.replace(/\D/g, '');
      const normalizedPhone = customerPhone ? normalizePhone(customerPhone) : '';

      let userId: number;

      // user 조회와 trip 조회 병렬 실행 (서로 독립적)
      const [existingUserForReservation, existingTrip] = await Promise.all([
        normalizedPhone.length >= 10
          ? prisma.user.findFirst({ where: { phone: normalizedPhone }, select: { id: true } })
          : null,
        prisma.trip.findFirst({ where: { productCode }, select: { id: true } }),
      ]);

      if (normalizedPhone.length >= 10) {
        if (existingUserForReservation) {
          userId = existingUserForReservation.id;
          // 이름 업데이트 (있는 경우)
          if (customerName) {
            await prisma.user.update({
              where: { id: userId },
              data: { name: customerName.trim() },
            });
          }
        } else {
          // 새 User 생성
          const newUser = await prisma.user.create({
            data: {
              name: customerName?.trim() || '고객',
              phone: normalizedPhone,
              password: await bcrypt.hash(normalizedPhone.slice(-4), 10), // 전화번호 뒤 4자리 (해시)
              role: 'user',
              onboarded: false,
            },
          });
          userId = newUser.id;
        }
      } else {
        // 전화번호가 없으면 임시 User 생성
        const tempUser = await prisma.user.create({
          data: {
            name: customerName?.trim() || '고객',
            phone: `temp_${Date.now()}`,
            password: await bcrypt.hash('0000', 10),
            role: 'user',
            onboarded: false,
          },
        });
        userId = tempUser.id;
      }

      // 3. Trip 찾기 또는 생성 (productCode 기준) — 이미 병렬로 가져옴
      let trip = existingTrip;

      if (!trip) {
        // 상품 정보 + AffiliateProduct 병렬 조회
        const [product, affProduct] = await Promise.all([
          prisma.cruiseProduct.findUnique({
            where: { productCode },
            select: { shipName: true, packageName: true },
          }),
          prisma.affiliateProduct.findFirst({
            where: { productCode },
            select: { effectiveFrom: true, effectiveTo: true },
          }),
        ]);

        // Trip 생성
        trip = await prisma.trip.create({
          data: {
            productCode,
            shipName: product?.shipName || product?.packageName || productCode,
            departureDate: affProduct?.effectiveFrom || new Date(),
            endDate: affProduct?.effectiveTo || null,
            status: 'Upcoming',
          },
          select: { id: true },
        });
      }

      // 4. Reservation 생성
      const reservation = await prisma.reservation.create({
        data: {
          tripId: trip.id,
          mainUserId: userId,
          totalPeople: totalGuests,
          cabinType: determinedCabinType || null,
          paymentDate: new Date(),
          paymentMethod: 'card',
          paymentAmount: amount,
          passportStatus: 'PENDING',
          pnrStatus: 'PENDING',
          status: 'CONFIRMED',
          affiliateSaleId: sale.id,
          remarks: `주문번호: ${merchant_uid}`,
        },
      });
      reservationId = reservation.id;

      // 5. 빈 Traveler 레코드 생성 (총 인원 수만큼)
      const travelerData = [];
      for (let i = 0; i < totalGuests; i++) {
        travelerData.push({
          reservationId: reservation.id,
          roomNumber: 1, // 기본값, PNR 입력 시 변경
          korName: i === 0 ? (customerName?.trim() || '') : '',
        });
      }

      if (travelerData.length > 0) {
        await prisma.traveler.createMany({
          data: travelerData,
        });
      }

      log('[Payment Webhook] Reservation 생성 완료:', {
        reservationId: reservation.id,
        tripId: trip.id,
        userId,
        totalGuests,
      });

      // 예약인원 자동 증가 + 예약가능 자동 차감 (마케팅 카운터)
      if (productCode && totalGuests > 0) {
        try {
          await prisma.cruiseProduct.update({
            where: { productCode },
            data: {
              reservedCount: { increment: totalGuests },
              availableCount: {
                decrement: totalGuests,
              },
            },
          });
        } catch {
          // 카운터 업데이트 실패는 예약 성공에 영향 없음
        }
      }
    } catch (err) {
      error('[Payment Webhook] 🔴 CRITICAL: Reservation 생성 실패:', err);
      reservationFailed = true;

      // 🔴 CRITICAL: 결제는 완료되었지만 예약 생성 실패 - 자동 환불 시도
      // 트랜잭션으로 Sale과 Payment 업데이트 (원자성 보장)
      try {
        await prisma.$transaction(async (tx) => {
          // Sale 메타데이터에 실패 기록
          await tx.affiliateSale.update({
            where: { id: sale.id },
            data: {
              metadata: {
                ...(sale.metadata as any || {}),
                reservationFailed: true,
                reservationFailureReason: err instanceof Error ? err.message : String(err),
                reservationFailedAt: new Date().toISOString(),
                autoRefundAttempted: true, // 🔴 자동 환불 시도 플래그
              },
            },
          });

          // ✅ BUG FIX: 기존 Payment metadata 조회 후 병합 (데이터 손실 방지)
          const existingPayment = await tx.payment.findFirst({
            where: { orderId: merchant_uid },
            select: { metadata: true }
          });

          // Payment 상태를 refund_pending으로 변경 (환불 대기)
          await tx.payment.updateMany({
            where: { orderId: merchant_uid },
            data: {
              status: 'refund_pending',
              metadata: {
                ...(existingPayment?.metadata as object || {}), // ✅ 기존 메타데이터 보존
                reservationFailed: true,
                autoRefundAttempted: true,
                failureReason: err instanceof Error ? err.message : String(err),
                refundInitiatedAt: new Date().toISOString(),
              },
            },
          });
        });

        log('[Payment Webhook] ✅ Reservation 실패 정보 DB 기록 완료 (트랜잭션)');
      } catch (txErr) {
        error('[Payment Webhook] ❌ Reservation 실패 정보 DB 기록 실패:', txErr);
      }

      // 🔴 자동 환불 API 호출 시도 (웰컴페이먼츠 취소)
      try {
        log('[Payment Webhook] 자동 환불 API 호출 시작:', { imp_uid, merchant_uid, amount });

        const { callPayWelcomeCancel } = await import('@/lib/mall/welcomepay-cancel');
        const cancelResult = await callPayWelcomeCancel({
          tid: imp_uid,
          msg: '예약 생성 실패 - 자동 환불',
          price: amount,
        });

        if (cancelResult.success) {
          log('[Payment Webhook] ✅ 자동 환불 성공:', { resultCode: cancelResult.resultCode, cancelledPrice: cancelResult.cancelledPrice });
          await prisma.payment.updateMany({
            where: { orderId: merchant_uid },
            data: {
              status: 'cancelled',
              cancelledAt: new Date(),
            },
          });
        } else {
          warn('[Payment Webhook] ⚠️ 자동 환불 실패 - 관리자 수동 처리 필요:', { resultCode: cancelResult.resultCode, resultMsg: cancelResult.resultMsg });
        }
      } catch (refundErr) {
        error('[Payment Webhook] ❌ 자동 환불 오류:', refundErr);
      }

      // 🔴 관리자 알림 (이메일/텔레그램 등)
      // NOTE: 알림 시스템 구현 필요 (See GitHub Issue #TBD)
      // 임시: 로그에 CRITICAL 오류로 기록
      error('[Payment Webhook] 🚨 ADMIN ACTION REQUIRED:', {
        saleId: sale.id,
        merchant_uid,
        imp_uid,
        amount,
        customerName,
        customerPhone: customerPhone ? `***${customerPhone.slice(-4)}` : undefined,
        error: err instanceof Error ? err.message : String(err),
        action: 'MANUAL_REFUND_REQUIRED',
      });
    }

    // Lead 상태 업데이트 또는 생성
    // leadId가 있는 경우는 트랜잭션 내에서 이미 처리됨 — 여기서는 신규 Lead 생성 케이스만 처리
    let updatedLeadId: number | null = leadId ? Number(leadId) : null;
    if (!leadId && customerName && customerPhone && (managerId || agentId)) {
      // Lead가 없지만 고객 정보와 어필리에이트 정보가 있으면 새로 생성
      const normalizePhone = (phone: string) => phone.replace(/\D/g, '');
      const normalizedPhone = normalizePhone(customerPhone);

      if (normalizedPhone.length >= 10) {
        // 기존 Lead 확인
        const existingLead = await prisma.affiliateLead.findFirst({
          where: {
            customerPhone: normalizedPhone,
            status: { not: 'CANCELLED' },
          },
        });

        if (existingLead) {
          // 기존 Lead 업데이트
          await prisma.affiliateLead.update({
            where: { id: existingLead.id },
            data: {
              status: 'PURCHASED',
              customerName: customerName.trim(),
              customerPhone: normalizedPhone,
              managerId: managerId || existingLead.managerId,
              agentId: agentId || existingLead.agentId,
              metadata: {
                ...(existingLead.metadata as any || {}),
                purchasedAt: new Date().toISOString(),
                productCode,
                orderId: merchant_uid,
              },
            },
          });
          updatedLeadId = existingLead.id;
        } else {
          // 새 Lead 생성
          const newLead = await prisma.affiliateLead.create({
            data: {
              customerName: customerName.trim(),
              customerPhone: normalizedPhone,
              status: 'PURCHASED',
              source: 'purchase',
              managerId: managerId,
              agentId: agentId,
              metadata: {
                purchasedAt: new Date().toISOString(),
                productCode,
                orderId: merchant_uid,
                imp_uid,
              },
              updatedAt: new Date(),
            },
          });
          updatedLeadId = newLead.id;
        }
      }
    }

    // 결제 완료 시 자동으로 일반 크루즈 가이드 승인 처리
    if (customerPhone) {
      const normalizePhone = (phone: string) => phone.replace(/\D/g, '');
      const normalizedPhone = normalizePhone(customerPhone);

      if (normalizedPhone.length >= 10) {
        // 전화번호로 User 찾기
        const user = await prisma.user.findFirst({
          where: {
            phone: normalizedPhone,
          },
          select: {
            id: true,
            testModeStartedAt: true,
            customerStatus: true,
            name: true,
          },
        });

        // 3일 체험 사용자인 경우 자동 승인
        if (user && user.testModeStartedAt && user.customerStatus !== 'active' && user.customerStatus !== 'package') {
          log('[Payment Webhook] 자동 승인 처리:', {
            userId: user.id,
            name: user.name,
            phone: normalizedPhone,
            previousStatus: user.customerStatus,
          });

          await prisma.user.update({
            where: { id: user.id },
            data: {
              testModeStartedAt: null, // 3일 체험 종료
              customerStatus: 'active', // 일반 크루즈 가이드 활성화
            },
          });

          log('[Payment Webhook] 일반 크루즈 가이드 자동 승인 완료:', {
            userId: user.id,
            name: user.name,
            phone: normalizedPhone,
          });
        }
      }
    }

    // [v11.0] 실적 생성 완료 로그
    log('[Payment Webhook v11.0] ===== 실적 저장 완료 =====');
    log('[Payment Webhook v11.0] AffiliateSale:', {
      saleId: sale.id,
      managerId: managerId || 'NONE',
      agentId: agentId || 'NONE',
      amount,
      status: 'CONFIRMED',
    });
    log('[Payment Webhook v11.0] CommissionLedger:', {
      entriesCreated: ledgerResult.ledgerEntries.length,
      managerProfileId: managerId || 'NONE',
      agentProfileId: agentId || 'NONE',
    });

    // 파트너 확인 로그
    if (managerId || agentId) {
      log(`[Payment Webhook v11.0] ✅ 파트너 실적 저장 성공! affiliateMallUserId: ${affiliateMallUserId}`);
    } else {
      log('[Payment Webhook v11.0] ⚠️ 파트너 없음 - 실적은 저장되었으나 수당 배정 없음');
    }

    // Google 스프레드시트 백업 및 자동화 + 구매확인서 발송 (비동기 실행)
    // 파트너 유무와 관계없이 항상 실행 (본사 직접 판매 포함)
    // 1. 기존 구매고객관리 시트 백업
    // 2. Drive 폴더 생성 및 APIS 시트 생성
    // 3. 구매확인서 PNG 생성 및 발송
    (async () => {
        try {
          // 동적 import로 순환 참조 방지 및 성능 최적화
          const { sendToGoogleSheet } = await import('@/lib/google-sheets');
          const { ensureTripFolder, ensureApisSheet, recordPaymentToPurchasedList, initApisSheetRows, uploadCertificateToDrive } = await import('@/lib/google-automation');
          const { generateCertificatePng } = await import('@/lib/certificate-generator');
          const { sendPurchaseConfirmation } = await import('@/lib/affiliate/purchase-confirmation');

          // 담당자 정보 + 상품 정보 + 출발일 병렬 조회
          let managerName = '';
          let channel = '본사';
          let productName = productCode || '';
          let departureDate = '';

          const [mProfile, aProfile, product, tripForDate] = await Promise.all([
            managerId ? prisma.affiliateProfile.findUnique({
              where: { id: managerId },
              select: { displayName: true, nickname: true, userId: true },
            }) : null,
            agentId ? prisma.affiliateProfile.findUnique({
              where: { id: agentId },
              select: { displayName: true, nickname: true, userId: true },
            }) : null,
            productCode ? prisma.cruiseProduct.findUnique({
              where: { productCode },
              select: { packageName: true, cruiseLine: true, shipName: true },
            }) : null,
            productCode ? prisma.trip.findFirst({
              where: { productCode },
              select: { departureDate: true },
            }) : null,
          ]);

          if (mProfile) {
            managerName = mProfile.displayName || mProfile.nickname || '';
            channel = '대리점장';
          }
          if (aProfile) {
            managerName = aProfile.displayName || aProfile.nickname || '';
            channel = '판매원';
          }
          if (product) {
            productName = product.packageName || `${product.cruiseLine} ${product.shipName}`;
          }
          if (tripForDate?.departureDate) {
            departureDate = tripForDate.departureDate.toISOString().split('T')[0];
          } else if (productCode) {
            const affProduct = await prisma.affiliateProduct.findFirst({
              where: { productCode },
              select: { effectiveFrom: true },
            });
            if (affProduct?.effectiveFrom) {
              departureDate = affProduct.effectiveFrom.toISOString().split('T')[0];
            }
          }

          const now = new Date();
          const kstDate = now.toLocaleString('ko-KR');
          const isoDate = now.toISOString().split('T')[0];

          // 1. 기존 Google Sheet 백업 (하위 호환성 유지)
          sendToGoogleSheet({
            name: customerName ? String(customerName).trim() : '',
            phone: customerPhone ? String(customerPhone).replace(/[^0-9]/g, '') : '',
            source: 'purchase',
            productName: productName,
            channel,
            manager: managerName,
            target: 'purchased',
            reservationDate: isoDate,
            reservationNo: merchant_uid,
            departureDate: departureDate,
            cabinType: cabinType || '',
            paymentDate: isoDate,
            paymentMethod: '카드',
            amount: amount,
            lastEditor: 'System',
            lastEditTime: kstDate,
          }).catch(err => error('[Automation] Legacy Sheet Backup Error:', err));

          // 2. 새로운 자동화: Drive 폴더 및 APIS 시트 생성
          if (productName && departureDate) {
            try {
              // 폴더 생성/확인
              const folderId = await ensureTripFolder(productName, departureDate);

              // APIS 시트 생성/확인
              const sheetId = await ensureApisSheet(folderId, productName, departureDate);

              // 결제 목록 시트에 기록 (월별 시트)
              await recordPaymentToPurchasedList({
                customerName: customerName || '고객',
                customerPhone: customerPhone || '',
                productName,
                departureDate,
                amount,
                headcount: headcount || 1,
                orderId: merchant_uid,
                managerName,
                channel
              });

              // APIS 시트에 초기 행 추가
              await initApisSheetRows(sheetId, {
                customerName: customerName || '고객',
                customerPhone: customerPhone || '',
                productName,
                departureDate,
                amount,
                headcount: headcount || 1,
                orderId: merchant_uid
              });

              log('[Automation] Drive & Sheet setup completed');
            } catch (driveError) {
              error('[Automation] Drive/Sheet Error:', driveError);
            }
          }

          // 3. 구매확인서 PNG 생성 및 발송
          try {
            // 상품 상세 정보 조회 (구매확인서에 포함)
            let productDetails = undefined;
            if (productCode) {
              const productInfo = await prisma.cruiseProduct.findUnique({
                where: { productCode },
                select: {
                  tags: true,
                  visitedCountries: true,
                  destinations: true,
                  nights: true,
                  days: true,
                  cruiseLine: true,
                  shipName: true,
                  included: true,
                  excluded: true,
                  refundPolicy: true,
                  hasGuide: true,
                  hasEscort: true,
                  hasCruiseDotStaff: true,
                  hasTravelInsurance: true,
                  flightInfo: true,
                }
              });

              if (productInfo) {
                productDetails = {
                  tags: productInfo.tags || [],
                  visitedCountries: productInfo.visitedCountries || [],
                  destinations: productInfo.destinations || [],
                  nights: productInfo.nights || undefined,
                  days: productInfo.days || undefined,
                  cruiseLine: productInfo.cruiseLine || undefined,
                  shipName: productInfo.shipName || undefined,
                  included: productInfo.included || [],
                  excluded: productInfo.excluded || [],
                  refundPolicy: productInfo.refundPolicy || undefined,
                  hasGuide: productInfo.hasGuide || false,
                  hasEscort: productInfo.hasEscort || false,
                  hasCruiseDotStaff: productInfo.hasCruiseDotStaff || false,
                  hasTravelInsurance: productInfo.hasTravelInsurance || false,
                  flightIncluded: (productInfo.flightInfo as any)?.included || false,
                };
              }
            }

            // PNG 생성 (관리자 패널과 동일한 양식)
            const pngBuffer = await generateCertificatePng({
              customerName: customerName || '고객',
              birthDate: '', // 생년월일은 결제 시점에 모를 수 있음 (빈칸)
              productName,
              paymentAmount: amount,
              paymentDate: isoDate,
              orderId: merchant_uid,
              managerName,
              productDetails,
            });

            // Drive에 PNG 업로드 (비동기, 실패해도 진행)
            const pngFilename = `구매확인증서_${customerName || '고객'}_${isoDate}.png`;
            uploadCertificateToDrive(pngBuffer, pngFilename)
              .then(fileId => log(`[Automation] Certificate uploaded to Drive: ${fileId}`))
              .catch(err => error('[Automation] Certificate upload failed:', err));

            // 승인 요청 생성 (자동 승인 상태로)
            // User 찾기 (customerPhone 기준)
            let customerUserId = null;
            if (customerPhone) {
              const u = await prisma.user.findFirst({ where: { phone: customerPhone.replace(/\D/g, '') } });
              if (u) customerUserId = u.id;
            }

            // 요청자(담당자) ID — 위 Promise.all에서 이미 조회한 profile 재사용
            const requesterId = agentId ? aProfile?.userId :
              (managerId ? mProfile?.userId : null);

            if (customerUserId && requesterId) {
              await prisma.certificateApproval.create({
                data: {
                  certificateType: 'purchase',
                  requesterId: requesterId,
                  requesterType: agentId ? 'SALES_AGENT' : 'BRANCH_MANAGER',
                  customerId: customerUserId,
                  customerName: customerName || '고객',
                  productName,
                  paymentAmount: amount,
                  paymentDate: isoDate,
                  status: 'approved', // 자동 승인
                  approvedBy: requesterId, // 본인 전결 처리 (또는 시스템 계정)
                  approvedAt: new Date(),
                  updatedAt: new Date(),
                }
              });
            }

            // 이메일 발송 (PNG 첨부) - 파트너 유무와 관계없이 항상 발송
            await sendPurchaseConfirmation(sale.id, pngBuffer);
            log('[Automation] Purchase Confirmation with PNG sent');
          } catch (certErr) {
            error('[Automation] Certificate Generation/Send Error:', certErr);
            // PNG 생성 실패시 기존 텍스트 이메일이라도 보내도록 fallback
            await sendPurchaseConfirmation(sale.id);
          }

        } catch (err) {
          error('[Automation] Async Task Error:', err);
        }
      })();

    // [v11.0] 응답에 실적 저장 결과 포함
    return NextResponse.json({
      ok: true,
      saleId: sale.id,
      reservationId: reservationId,
      // 🔴 예약 생성 실패 시 경고
      reservationFailed: reservationFailed,
      warning: reservationFailed ? 'MANUAL_REFUND_REQUIRED: 결제는 완료되었으나 예약 생성에 실패했습니다. 관리자에게 문의하세요.' : null,
      // [v11.0] callback에서 확인할 수 있는 실적 정보
      affiliateSaleCreated: true,
      commissionCreated: ledgerResult.ledgerEntries.length > 0,
      partnerInfo: {
        managerId: managerId || null,
        agentId: agentId || null,
        affiliateMallUserId: affiliateMallUserId || null,
        affiliateCode: affiliateCode || null,
      },
      message: reservationFailed
        ? '결제는 완료되었으나 예약 생성에 실패했습니다. 관리자가 확인 후 처리할 예정입니다.'
        : '결제 완료 및 어필리에이트 판매가 기록되었습니다.',
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      log('[Payment Webhook] P2002 중복 키 - 이미 처리된 주문으로 200 반환');
      return NextResponse.json({ ok: true, message: '이미 처리된 주문입니다.', duplicate: true });
    }
    if (process.env.NODE_ENV === 'development') {
      error('[Payment Webhook] Error:', err);
    } else {
      error('[Payment Webhook] Error:', {
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
    return NextResponse.json(
      { ok: false, message: '결제 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
