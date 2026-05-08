export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE } from '@/lib/session';

// 판매원/대리점장/관리자 인증 확인 및 프로필 정보 반환
async function checkAffiliateAuth(sid: string | undefined): Promise<{
  userId: number;
  role: string;
  profile: { id: number; type: string } | null;
} | null> {
  if (!sid) return null;
  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true },
          include: {
            AffiliateProfile: {
              select: { id: true, type: true },
            },
          },
        },
      },
    });

    if (!session || !session.User) return null;
    // admin도 허용
    if (!['agent', 'manager', 'admin'].includes(session.User.role)) return null;

    return {
      userId: session.User.id,
      role: session.User.role,
      profile: session.User.AffiliateProfile,
    };
  } catch (error) {
    console.error('[Affiliate Message Recipients] Auth check error:', error);
    return null;
  }
}

// GET: 메시지를 보낼 수 있는 수신자 목록 조회
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;

    if (!sid) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const sender = await checkAffiliateAuth(sid);
    if (!sender) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }
    // 관리자가 아닌데 프로필이 없는 경우만 에러
    if (sender.role !== 'admin' && !sender.profile) {
      return NextResponse.json({ ok: false, error: '판매원 또는 대리점장 권한이 필요합니다.' }, { status: 403 });
    }

    const recipients: Array<{
      id: number;
      name: string | null;
      phone: string | null;
      role: string;
      type: string;
      affiliateCode: string | null;
    }> = [];

    if (sender.role === 'agent') {
      // 판매원인 경우: 담당 대리점장, 관리자
      const agentProfile = sender.profile;

      // 담당 대리점장 조회
      const relations = await prisma.affiliateRelation.findMany({
        where: {
          agentId: agentProfile.id,
          status: 'ACTIVE',
        },
        include: {
          AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile: {
            include: {
              User: {
                select: { id: true, name: true, phone: true },
              },
            },
          },
        },
      });

      relations.forEach(relation => {
        const manager = relation.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile;
        if (manager && manager.User) {
          recipients.push({
            id: manager.User.id,
            name: manager.User.name,
            phone: manager.User.phone,
            role: 'manager',
            type: 'BRANCH_MANAGER',
            affiliateCode: manager.affiliateCode,
          });
        }
      });

      // 관리자 조회
      const admins = await prisma.user.findMany({
        where: { role: 'admin' },
        select: { id: true, name: true, phone: true },
      });

      admins.forEach(admin => {
        recipients.push({
          id: admin.id,
          name: admin.name,
          phone: admin.phone,
          role: 'admin',
          type: 'ADMIN',
          affiliateCode: null,
        });
      });
    } else if (sender.role === 'manager') {
      // 대리점장인 경우: 소속 판매원, 다른 대리점장, 관리자
      const managerProfile = sender.profile;

      // 소속 판매원 조회
      const relations = await prisma.affiliateRelation.findMany({
        where: {
          managerId: managerProfile.id,
          status: 'ACTIVE',
        },
        include: {
          AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile: {
            include: {
              User: {
                select: { id: true, name: true, phone: true },
              },
            },
          },
        },
      });

      relations.forEach(relation => {
        const agent = relation.AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile;
        if (agent && agent.User) {
          recipients.push({
            id: agent.User.id,
            name: agent.User.name,
            phone: agent.User.phone,
            role: 'agent',
            type: 'SALES_AGENT',
            affiliateCode: agent.affiliateCode,
          });
        }
      });

      // 다른 대리점장 조회
      const otherManagers = await prisma.affiliateProfile.findMany({
        where: {
          type: 'BRANCH_MANAGER',
          id: { not: managerProfile.id },
          status: 'ACTIVE',
        },
        include: {
          User: {
            select: { id: true, name: true, phone: true },
          },
        },
      });

      otherManagers.forEach(manager => {
        if (manager.User) {
          recipients.push({
            id: manager.User.id,
            name: manager.User.name,
            phone: manager.User.phone,
            role: 'manager',
            type: 'BRANCH_MANAGER',
            affiliateCode: manager.affiliateCode,
          });
        }
      });

      // 관리자 조회
      const admins = await prisma.user.findMany({
        where: { role: 'admin' },
        select: { id: true, name: true, phone: true },
      });

      admins.forEach(admin => {
        recipients.push({
          id: admin.id,
          name: admin.name,
          phone: admin.phone,
          role: 'admin',
          type: 'ADMIN',
          affiliateCode: null,
        });
      });
    } else if (sender.role === 'admin') {
      // 관리자인 경우: 모든 대리점장, 판매원 조회

      // 모든 대리점장 조회
      const allManagers = await prisma.affiliateProfile.findMany({
        where: {
          type: 'BRANCH_MANAGER',
          status: 'ACTIVE',
        },
        include: {
          User: {
            select: { id: true, name: true, phone: true },
          },
        },
      });

      allManagers.forEach(manager => {
        if (manager.User) {
          recipients.push({
            id: manager.User.id,
            name: manager.User.name,
            phone: manager.User.phone,
            role: 'manager',
            type: 'BRANCH_MANAGER',
            affiliateCode: manager.affiliateCode,
          });
        }
      });

      // 모든 판매원 조회
      const allAgents = await prisma.affiliateProfile.findMany({
        where: {
          type: 'SALES_AGENT',
          status: 'ACTIVE',
        },
        include: {
          User: {
            select: { id: true, name: true, phone: true },
          },
        },
      });

      allAgents.forEach(agent => {
        if (agent.User) {
          recipients.push({
            id: agent.User.id,
            name: agent.User.name,
            phone: agent.User.phone,
            role: 'agent',
            type: 'SALES_AGENT',
            affiliateCode: agent.affiliateCode,
          });
        }
      });
    }

    // 중복 제거 및 본인 제외
    const uniqueRecipients = recipients
      .filter((r, index, self) =>
        index === self.findIndex(t => t.id === r.id)
      )
      .filter(r => r.id !== sender.userId); // 본인 제외

    // TeamMessagesClient 호환성을 위해 userId와 profileType 추가
    const formattedRecipients = uniqueRecipients.map(r => ({
      ...r,
      userId: r.id,
      profileType: r.type === 'ADMIN' ? 'HQ' : r.type,
    }));

    return NextResponse.json({
      ok: true,
      recipients: formattedRecipients,
    });
  } catch (error) {
    console.error('[Affiliate Message Recipients] Error:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : '수신자 목록을 불러오는데 실패했습니다.',
    }, { status: 500 });
  }
}

