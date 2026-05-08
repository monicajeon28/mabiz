export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

function requireAdmin(role?: string | null) {
  if (role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { role: true } });
    const guard = requireAdmin(admin?.role);
    if (guard) return guard;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ];
    }

    logger.log('[admin/affiliate/contracts][GET] Query params:', { status, search, where });
    
    const contracts = await prisma.affiliateContract.findMany({
      where,
      include: {
        User_AffiliateContract_userIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            mallUserId: true,
            password: true, // 비밀번호 포함
          },
        },
        User_AffiliateContract_reviewerIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        AffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            nickname: true,
            type: true,
            affiliateCode: true,
            branchLabel: true,
            contactPhone: true, // 프로필 수정에서 입력한 연락처
            contactEmail: true, // 프로필 수정에서 입력한 이메일
            User: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                mallUserId: true,
              },
            },
            // 판매원인 경우 소속 대리점장 정보 조회
            AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile: {
              where: {
                status: 'ACTIVE',
              },
              select: {
                id: true,
                status: true,
                AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile: {
                  select: {
                    id: true,
                    displayName: true,
                    nickname: true,
                    affiliateCode: true,
                    branchLabel: true,
                    type: true,
                  },
                },
              },
              take: 1, // 가장 최근 관계만
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    logger.log('[admin/affiliate/contracts][GET] Found contracts:', contracts.length);
    logger.log('[admin/affiliate/contracts][GET] Contract details:', contracts.map(c => ({ 
      id: c.id, 
      name: c.name, 
      status: c.status, 
      invitedByProfileId: c.invitedByProfileId,
      hasAffiliateProfile: !!c.AffiliateProfile,
      affiliateProfileType: c.AffiliateProfile?.type,
      affiliateProfileName: c.AffiliateProfile?.displayName || c.AffiliateProfile?.nickname,
      affiliateProfileCode: c.AffiliateProfile?.affiliateCode,
      branchLabel: c.AffiliateProfile?.branchLabel,
      managerInfo: c.AffiliateProfile?.type === 'SALES_AGENT' ? 
        (c.AffiliateProfile.AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile?.[0]?.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile ? {
          id: c.AffiliateProfile.AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile[0].AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile.id,
          name: c.AffiliateProfile.AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile[0].AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile.displayName || c.AffiliateProfile.AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile[0].AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile.nickname,
          code: c.AffiliateProfile.AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile[0].AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile.affiliateCode,
        } : null) : null
    })));

    // 프론트엔드 형식에 맞게 변환
    const formattedContracts = contracts.map((contract) => {
      // 판매원인 경우 소속 대리점장 정보 추출
      let managerInfo = null;
      if (
        contract.AffiliateProfile &&
        contract.AffiliateProfile.type === 'SALES_AGENT' &&
        contract.AffiliateProfile.AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile &&
        contract.AffiliateProfile.AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile.length > 0
      ) {
        const relation = contract.AffiliateProfile.AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile[0];
        if (relation?.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile) {
          managerInfo = relation.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile;
        }
      }

      return {
        ...contract,
        user: contract.User_AffiliateContract_userIdToUser,
        reviewer: contract.User_AffiliateContract_reviewerIdToUser,
        invitedBy: contract.AffiliateProfile,
        managerInfo, // 판매원의 소속 대리점장 정보
      };
    });

    return NextResponse.json({ ok: true, contracts: formattedContracts });
  } catch (error) {
    logger.error('[admin/affiliate/contracts][GET] error:', error instanceof Error ? error.message : String(error));

    // Prisma 에러 상세 정보
    if (error && typeof error === 'object' && 'code' in error) {
      logger.error('[admin/affiliate/contracts][GET] Prisma error code:', (error as any).code);
      logger.error('[admin/affiliate/contracts][GET] Prisma error meta:', (error as any).meta);
    }

    return NextResponse.json({
      ok: false,
      message: '서버 오류가 발생했습니다.',
    }, { status: 500 });
  }
}
