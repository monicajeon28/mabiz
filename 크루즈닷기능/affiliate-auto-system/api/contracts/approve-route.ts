export const dynamic = 'force-dynamic';

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  createAffiliateAccountPair,
  generateAffiliateLinksPair,
  getPriceTierInfo,
  CONTRACT_PRICE_TIERS,
} from '@/lib/affiliate/contract-automation';

interface ApproveRequest {
  amount?: number; // 330/540/750만원
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { contractId: string } },
) {
  try {
    const contractId = parseInt(params.contractId, 10);
    if (isNaN(contractId)) {
      return NextResponse.json(
        { ok: false, message: '유효한 계약 ID가 아닙니다.' },
        { status: 400 },
      );
    }

    // 1. 기존 계약 조회
    const contract = await prisma.affiliateContract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      return NextResponse.json(
        { ok: false, message: '계약을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    // 이미 승인된 계약인지 확인
    if (contract.status === 'APPROVED') {
      return NextResponse.json(
        { ok: false, message: '이미 승인된 계약입니다.' },
        { status: 400 },
      );
    }

    const body: ApproveRequest = await req.json();
    const amount = body.amount || 3300000; // 기본값: 330만원

    // 유효한 금액인지 확인
    const validAmounts = Object.values(CONTRACT_PRICE_TIERS).map(
      (t) => t.priceKRW,
    );
    if (!validAmounts.includes(amount)) {
      return NextResponse.json(
        {
          ok: false,
          message: '유효한 계약금 금액이 아닙니다. (330/540/750만원)',
        },
        { status: 400 },
      );
    }

    // 금액에 따른 수수료율 조회
    const tierKey = Object.entries(CONTRACT_PRICE_TIERS).find(
      ([_, tier]) => tier.priceKRW === amount,
    )?.[0] as keyof typeof CONTRACT_PRICE_TIERS;
    const tierInfo = getPriceTierInfo(tierKey);

    // 2. 자동 계정 생성
    const accountPair = await createAffiliateAccountPair(
      contractId,
      contract.name || '계약자',
      contract.email || 'unknown@cruiseai.local',
      contract.phone || '010-0000-0000',
      tierInfo.commissionRate,
    );

    // 3. 자동 링크 생성
    const linksPair = await generateAffiliateLinksPair(
      accountPair.manager.profile.id,
      accountPair.agent.profile.id,
      contractId,
    );

    // 4. 계약 업데이트
    const updatedContract = await prisma.affiliateContract.update({
      where: { id: contractId },
      data: {
        status: 'APPROVED',
        metadata: {
          ...(contract.metadata as Record<string, any>),
          amount,
          tierKey,
          approvedAt: new Date().toISOString(),
          managerProfileId: accountPair.manager.profile.id,
          agentProfileId: accountPair.agent.profile.id,
          managerLinkCode: linksPair.manager.code,
          agentLinkCode: linksPair.agent.code,
        },
      },
    });

    logger.info('[AFFILIATE-AUTO] 계약 승인 완료', {
      contractId,
      amount,
      tierKey,
      managerId: accountPair.manager.profile.id,
      agentId: accountPair.agent.profile.id,
    });

    return NextResponse.json({
      ok: true,
      message: '계약이 승인되었습니다.',
      data: {
        contract: updatedContract,
        manager: {
          id: accountPair.manager.profile.id,
          name: accountPair.manager.user.name,
          email: accountPair.manager.user.email,
          affiliateCode: accountPair.manager.affiliateCode,
          linkCode: linksPair.manager.code,
          linkUrl: linksPair.manager.url,
          tempPassword: accountPair.manager.password, // 초기 비밀번호는 안전하게 전달해야 함
        },
        agent: {
          id: accountPair.agent.profile.id,
          name: accountPair.agent.user.name,
          email: accountPair.agent.user.email,
          affiliateCode: accountPair.agent.affiliateCode,
          linkCode: linksPair.agent.code,
          linkUrl: linksPair.agent.url,
          tempPassword: accountPair.agent.password, // 초기 비밀번호는 안전하게 전달해야 함
        },
        tier: {
          label: tierInfo.label,
          amount,
          commissionRate: tierInfo.commissionRate,
        },
      },
    });
  } catch (error) {
    logger.error('[AFFILIATE-AUTO] 계약 승인 실패', {
      contractId: params.contractId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        message: '계약 승인 중 오류가 발생했습니다.',
      },
      { status: 500 },
    );
  }
}

/**
 * 계약 승인 상태 조회
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { contractId: string } },
) {
  try {
    const contractId = parseInt(params.contractId, 10);
    if (isNaN(contractId)) {
      return NextResponse.json(
        { ok: false, message: '유효한 계약 ID가 아닙니다.' },
        { status: 400 },
      );
    }

    const contract = await prisma.affiliateContract.findUnique({
      where: { id: contractId },
      include: {
        User_AffiliateContract_userIdToUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!contract) {
      return NextResponse.json(
        { ok: false, message: '계약을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const metadata = contract.metadata as Record<string, any> | null;

    return NextResponse.json({
      ok: true,
      data: {
        contractId: contract.id,
        status: contract.status,
        name: contract.name,
        email: contract.email,
        phone: contract.phone,
        isApproved: contract.status === 'APPROVED',
        manager: contract.User_AffiliateContract_userIdToUser
          ? {
              id: contract.User_AffiliateContract_userIdToUser.id,
              name: contract.User_AffiliateContract_userIdToUser.name,
              email: contract.User_AffiliateContract_userIdToUser.email,
            }
          : null,
        tier: metadata
          ? {
              label:
                getPriceTierInfo(
                  metadata.tierKey as keyof typeof CONTRACT_PRICE_TIERS,
                )?.label || 'Unknown',
              amount: metadata.amount,
              commissionRate: metadata.commissionRate,
            }
          : null,
        approvedAt: metadata?.approvedAt || null,
        links: metadata
          ? {
              managerCode: metadata.managerLinkCode,
              agentCode: metadata.agentLinkCode,
            }
          : null,
      },
    });
  } catch (error) {
    logger.error('[AFFILIATE-AUTO] 계약 조회 실패', {
      contractId: params.contractId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        message: '계약 조회 중 오류가 발생했습니다.',
      },
      { status: 500 },
    );
  }
}
