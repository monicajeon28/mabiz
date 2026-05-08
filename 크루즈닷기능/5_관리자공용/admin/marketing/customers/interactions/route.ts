export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

const SESSION_COOKIE = 'cg.sid.v2';

async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) {
    return false;
  }
  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { User: true },
    });

    if (!session || !session.User) {
      return false;
    }

    return session.User.role === 'admin';
  } catch (error) {
    console.error('[Marketing Customers Interactions] Auth check error:', error);
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return NextResponse.json({ 
        ok: false, 
        error: '인증이 필요합니다.' 
      }, { status: 403 });
    }

    const isAdmin = await checkAdminAuth(sid);
    if (!isAdmin) {
      return NextResponse.json({ 
        ok: false, 
        error: '관리자 권한이 필요합니다.' 
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get('leadId');
    const phone = searchParams.get('phone');

    if (!leadId && !phone) {
      return NextResponse.json({
        ok: false,
        error: 'leadId 또는 phone이 필요합니다.',
      }, { status: 400 });
    }

    // leadId가 있으면 직접 조회, 없으면 phone으로 AffiliateLead 찾기
    let targetLeadId: number | null = null;
    
    if (leadId) {
      targetLeadId = parseInt(leadId, 10);
      if (isNaN(targetLeadId)) {
        return NextResponse.json({
          ok: false,
          error: '유효하지 않은 leadId입니다.',
        }, { status: 400 });
      }
    } else if (phone) {
      // phone으로 AffiliateLead 찾기
      const lead = await prisma.affiliateLead.findFirst({
        where: { customerPhone: phone },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      });
      if (lead) {
        targetLeadId = lead.id;
      }
    }

    if (!targetLeadId) {
      return NextResponse.json({
        ok: true,
        interactions: [],
      });
    }

    // AffiliateInteraction 조회
    const interactions = await prisma.affiliateInteraction.findMany({
      where: { leadId: targetLeadId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        AffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            branchLabel: true,
            type: true,
          },
        },
      },
      orderBy: {
        occurredAt: 'desc',
      },
    });

    // 데이터 변환
    const formattedInteractions = interactions.map(interaction => {
      let createdByName: string | null = null;
      let profileName: string | null = null;

      if (interaction.User) {
        if (interaction.User.role === 'admin') {
          createdByName = '본사';
        } else {
          createdByName = interaction.User.name || null;
        }
      }

      if (interaction.AffiliateProfile) {
        profileName = interaction.AffiliateProfile.displayName || 
                      interaction.AffiliateProfile.branchLabel || 
                      null;
        if (!createdByName && profileName) {
          createdByName = profileName;
        }
      }

      return {
        id: interaction.id,
        interactionType: interaction.interactionType,
        note: interaction.note,
        occurredAt: interaction.occurredAt.toISOString(),
        createdByName,
        profileName,
      };
    });

    return NextResponse.json({
      ok: true,
      interactions: formattedInteractions,
    });
  } catch (error: any) {
    console.error('[Marketing Customers Interactions] Error:', error);
    return NextResponse.json({
      ok: false,
      error: '고객 기록을 불러오는데 실패했습니다.',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
    }, { status: 500 });
  }
}
