export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import SendDbClient from './SendDbClient';

export default async function SendDbPage({ params }: { params: Promise<{ partnerId: string }> }) {
  try {
    const { partnerId } = await params;
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      redirect('/partner');
    }

    const { profile } = await requirePartnerContext();

    // 대리점장만 접근 가능
    if (profile.type !== 'BRANCH_MANAGER') {
      redirect(`/partner/${partnerId}/customers`);
    }

    // 판매원 목록 조회
    const relations = await prisma.affiliateRelation.findMany({
      where: {
        managerId: profile.id,
        status: 'ACTIVE',
      },
      include: {
        AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            affiliateCode: true,
            User: {
              select: {
                mallUserId: true,
              },
            },
          },
        },
      },
    });

    const teamAgents = relations
      .map(rel => rel.AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile)
      .filter(Boolean)
      .map(agent => ({
        id: agent!.id,
        displayName: agent!.displayName,
        affiliateCode: agent!.affiliateCode,
        mallUserId: agent!.User?.mallUserId ?? null,
      }));

    return (
      <SendDbClient
        partner={{
          profileId: profile.id,
          type: profile.type,
          displayName: profile.displayName,
          branchLabel: profile.branchLabel,
          mallUserId: partnerId,
          teamAgents,
        }}
      />
    );
  } catch (error) {
    redirect('/partner');
  }
}




