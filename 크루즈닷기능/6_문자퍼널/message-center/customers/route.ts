export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  PartnerApiError,
  requirePartnerContext,
} from '@/app/api/partner/_utils';

interface CustomerData {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  createdAt: Date;
  groupId: number | null;
  groupName: string | null;
  agentName: string | null;
  agentId: number | null;
}

export async function GET(req: NextRequest) {
  try {
    const { profile } = await requirePartnerContext({ includeManagedAgents: true });
    const { searchParams } = new URL(req.url);

    const groupId = searchParams.get('groupId');
    const search = searchParams.get('search');
    const category = searchParams.get('category'); // 새로운 카테고리 필터

    // 프로필 타입에 따라 고객 범위 결정
    const isManager = profile.type === 'BRANCH_MANAGER';
    let profileIds: number[] = [profile.id];

    if (isManager && profile.managedAgents) {
      // 대리점장은 본인 + 팀원들의 고객 볼 수 있음
      const teamIds = profile.managedAgents.map((agent: any) => agent.id).filter((id: number) => id);
      profileIds = [profile.id, ...teamIds];
    }

    // 기본 조건: 본인 또는 팀원의 고객
    const whereCondition: any = {
      OR: [
        { agentId: { in: profileIds } },
        { managerId: { in: profileIds } },
      ],
    };

    // 카테고리 필터
    if (category && category !== 'all') {
      switch (category) {
        case 'free_trial':
          // 3일 무료체험 고객
          whereCondition.source = { contains: 'free_trial', mode: 'insensitive' };
          break;
        case 'purchased':
          // 구매고객 - AffiliateSale이 있는 고객
          whereCondition.AffiliateSale = { some: {} };
          break;
        case 'mall':
          // 크루즈몰고객
          whereCondition.source = { contains: 'mall', mode: 'insensitive' };
          break;
        case 'b2b':
          // B2B유입 (대리점장 전용)
          if (isManager) {
            whereCondition.source = { contains: 'b2b', mode: 'insensitive' };
          }
          break;
        case 'landing':
          // 랜딩유입 (대리점장 전용)
          if (isManager) {
            whereCondition.source = { contains: 'landing', mode: 'insensitive' };
          }
          break;
        case 'group':
          // 그룹선택 - groupId로 별도 필터
          break;
      }
    }

    // 그룹 필터
    if (groupId && groupId !== 'all') {
      whereCondition.groupId = parseInt(groupId, 10);
    }

    // 검색 필터
    if (search) {
      whereCondition.AND = [
        ...(whereCondition.AND || []),
        {
          OR: [
            { customerName: { contains: search, mode: 'insensitive' } },
            { customerPhone: { contains: search } },
          ],
        },
      ];
    }

    const customers = await prisma.affiliateLead.findMany({
      where: whereCondition,
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        source: true,
        createdAt: true,
        groupId: true,
        agentId: true,
        metadata: true, // 이메일은 metadata에 저장될 수 있음
        AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile: {
          select: {
            id: true,
            displayName: true,
          },
        },
        PartnerCustomerGroup: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const customerList: CustomerData[] = customers.map((c) => {
      // metadata에서 이메일 추출 시도
      const metadata = c.metadata as { email?: string } | null;
      return {
        id: c.id,
        name: c.customerName,
        phone: c.customerPhone,
        email: metadata?.email || null,
        source: c.source,
        createdAt: c.createdAt,
        groupId: c.groupId,
        groupName: c.PartnerCustomerGroup?.name || null,
        agentName: c.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile?.displayName || null,
        agentId: c.agentId,
      };
    });

    // 그룹 목록도 함께 반환
    const groups = await prisma.partnerCustomerGroup.findMany({
      where: {
        OR: [
          { profileId: { in: profileIds } },
        ],
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: { AffiliateLead: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      ok: true,
      customers: customerList,
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        count: g._count.AffiliateLead,
      })),
      total: customerList.length,
      isManager, // 대리점장 여부 (B2B/랜딩 카테고리 표시 여부 결정용)
    });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error('[Partner Message Center Customers] Error:', error);
    return NextResponse.json(
      { ok: false, message: '고객 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
