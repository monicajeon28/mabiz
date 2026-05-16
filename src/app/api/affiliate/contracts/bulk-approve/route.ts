export const dynamic = 'force-dynamic';

/**
 * PUT /api/affiliate/contracts/bulk-approve  — 일괄 승인
 *
 * 요청:
 * {
 *   "contractIds": [1, 2, 3, 4, 5],
 *   "amount": 1000000,
 *   "tier": "SALES_AGENT"
 * }
 *
 * 응답:
 * {
 *   "ok": true,
 *   "results": [
 *     { "contractId": 1, "status": "APPROVED", "managerCode": "MGR-abc123" },
 *     { "contractId": 3, "status": "FAILED", "error": "Already approved" }
 *   ],
 *   "summary": { "approved": 4, "failed": 1 }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getAuthContext } from '@/lib/rbac';
import { provisionAffiliateAccounts } from '@/lib/affiliate/provision';
import {
  CONTRACT_PRICE_TIERS,
  VALID_AMOUNTS,
  VALID_AMOUNTS_LABEL,
  getPriceTierByAmount,
  getPriceTierInfo,
} from '@/lib/affiliate/priceTiers';
import { sendSms, getOrgSmsConfig } from '@/lib/aligo';
import { sendFunnelEmail } from '@/lib/email';
import { renderPartnerWelcomeEmail } from '@/lib/email-templates';

export async function PUT(req: NextRequest) {
  try {
    // 1. 인증 — GLOBAL_ADMIN만 허용
    const ctx = await getAuthContext();
    if (!ctx || ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, message: '관리자 권한이 필요합니다.' },
        { status: 403 },
      );
    }

    const body = await req.json();
    const contractIds: number[] = Array.isArray(body.contractIds)
      ? body.contractIds.map((id: unknown) => (typeof id === 'number' ? id : parseInt(String(id), 10)))
      : [];
    const amount: number | undefined = body.amount;

    // 2. 검증
    if (!contractIds.length) {
      return NextResponse.json(
        { ok: false, message: '승인할 계약 ID 목록이 필요합니다.' },
        { status: 400 },
      );
    }

    if (contractIds.length > 5) {
      return NextResponse.json(
        { ok: false, message: '한 번에 최대 5개까지 승인 가능합니다.' },
        { status: 400 },
      );
    }

    if (!amount) {
      return NextResponse.json(
        { ok: false, message: `계약금은 필수입니다. (${VALID_AMOUNTS_LABEL})` },
        { status: 400 },
      );
    }

    if (!VALID_AMOUNTS.includes(amount as any)) {
      return NextResponse.json(
        { ok: false, message: `유효하지 않은 계약금입니다. (${VALID_AMOUNTS_LABEL})` },
        { status: 400 },
      );
    }

    // 3. CRM 조직 ID 결정
    const organizationId = ctx.organizationId || process.env.BONSA_ORG_ID || '';
    if (!organizationId) {
      return NextResponse.json(
        { ok: false, message: '조직 ID를 확인할 수 없습니다.' },
        { status: 500 },
      );
    }

    // 4. 가격 정책 확인
    const tierKey = getPriceTierByAmount(amount)!;
    const tierInfo = getPriceTierInfo(tierKey);

    // 5. 각 계약 순차 승인
    const results: Array<{
      contractId: number;
      status: 'APPROVED' | 'FAILED';
      managerCode?: string;
      error?: string;
    }> = [];
    let approvedCount = 0;

    for (const contractId of contractIds) {
      try {
        // 5a. 계약 정보 조회
        const contract = await prisma.gmAffiliateContract.findUnique({
          where: { id: contractId },
        });

        if (!contract) {
          results.push({
            contractId,
            status: 'FAILED',
            error: '계약을 찾을 수 없습니다.',
          });
          continue;
        }

        if (contract.status === 'APPROVED') {
          results.push({
            contractId,
            status: 'FAILED',
            error: '이미 승인된 계약입니다.',
          });
          continue;
        }

        // 5b. 원자적 상태 잠금
        const locked = await prisma.gmAffiliateContract.updateMany({
          where: { id: contractId, status: { notIn: ['APPROVED', 'PROCESSING'] } },
          data: { status: 'PROCESSING' },
        });

        if (locked.count === 0) {
          results.push({
            contractId,
            status: 'FAILED',
            error: '처리 중인 계약입니다.',
          });
          continue;
        }

        if (!contract.email) {
          await prisma.gmAffiliateContract.updateMany({
            where: { id: contractId, status: 'PROCESSING' },
            data: { status: 'submitted' },
          });
          results.push({
            contractId,
            status: 'FAILED',
            error: '이메일이 없습니다.',
          });
          continue;
        }

        // 5c. 계정 생성
        let provisionResult;
        try {
          provisionResult = await provisionAffiliateAccounts({
            contractId,
            contractorName: contract.name || '계약자',
            contractorEmail: contract.email,
            contractorPhone: contract.phone || '',
            commissionRate: tierInfo.commissionRate,
            organizationId,
            approvedByMemberId: ctx.userId,
          });
        } catch (provisionErr) {
          await prisma.gmAffiliateContract.updateMany({
            where: { id: contractId, status: 'PROCESSING' },
            data: { status: 'submitted' },
          });
          results.push({
            contractId,
            status: 'FAILED',
            error: provisionErr instanceof Error ? provisionErr.message : '계정 생성 실패',
          });
          continue;
        }

        // 5d. SMS 발송 (실패해도 계속 진행)
        try {
          if (contract.phone) {
            const smsConfig = await getOrgSmsConfig(organizationId);
            if (smsConfig) {
              const msg = [
                `[마비즈] ${contract.name} 대리점장님, 계약이 승인되었습니다.`,
                `대리점 코드: ${provisionResult.manager.affiliateCode}`,
                `임시 비밀번호: ${provisionResult.managerTempPassword}`,
                `로그인: ${process.env.NEXT_PUBLIC_APP_URL}/login`,
              ].join('\n');

              await sendSms({
                config: { key: smsConfig.aligoKey, userId: smsConfig.aligoUserId, sender: smsConfig.senderPhone },
                receiver: contract.phone,
                msg,
                msgType: 'LMS',
                organizationId,
              });
            }
          }
        } catch (smsErr) {
          logger.warn('[AFFILIATE-BULK-APPROVE] SMS 발송 실패', {
            contractId,
            error: smsErr instanceof Error ? smsErr.message : String(smsErr),
          });
        }

        // 5e. 이메일 발송 (실패해도 계속 진행)
        try {
          if (contract.email) {
            const { subject, html } = renderPartnerWelcomeEmail({
              name: contract.name,
              tier: tierInfo.label,
              managerCode: provisionResult.manager.affiliateCode,
              managerLink: provisionResult.manager.linkUrl,
              agentCode: provisionResult.agent?.affiliateCode,
              agentLink: provisionResult.agent?.linkUrl,
              appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://mabizcruisedot.com',
            });

            await sendFunnelEmail({
              organizationId,
              toEmail: contract.email,
              subject,
              htmlContent: html,
            });
          }
        } catch (emailErr) {
          logger.warn('[AFFILIATE-BULK-APPROVE] 이메일 발송 실패', {
            contractId,
            error: emailErr instanceof Error ? emailErr.message : String(emailErr),
          });
        }

        // 5f. 성공 기록
        results.push({
          contractId,
          status: 'APPROVED',
          managerCode: provisionResult.manager.affiliateCode,
        });
        approvedCount++;

        logger.info('[AFFILIATE-BULK-APPROVE] 계약 승인 완료', {
          contractId,
          amount,
          tierKey,
          managerId: provisionResult.manager.gmUserId,
        });
      } catch (err) {
        logger.error('[AFFILIATE-BULK-APPROVE] 예상치 못한 오류', {
          contractId,
          error: err instanceof Error ? err.message : String(err),
        });
        results.push({
          contractId,
          status: 'FAILED',
          error: '알 수 없는 오류가 발생했습니다.',
        });
      }
    }

    // 6. 응답
    return NextResponse.json({
      ok: true,
      results,
      summary: {
        total: contractIds.length,
        approved: approvedCount,
        failed: contractIds.length - approvedCount,
      },
    });
  } catch (err) {
    logger.error('[AFFILIATE-BULK-APPROVE] 일괄 승인 실패', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, message: '일괄 승인 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
