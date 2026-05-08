export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * 기존 프로필들의 AffiliateRelation을 확인하고 수정하는 유틸리티 API
 * GET: 현재 상태 확인
 * POST: 누락된 관계 수정
 */
export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true },
    });

    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
    }

    // 모든 프로필 조회
    const profiles = await prisma.affiliateProfile.findMany({
      select: {
        id: true,
        type: true,
        displayName: true,
        nickname: true,
        branchLabel: true,
        affiliateCode: true,
        metadata: true,
      },
      orderBy: { id: 'asc' },
    });

    // 모든 AffiliateRelation 조회
    const relations = await prisma.affiliateRelation.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        managerId: true,
        agentId: true,
        status: true,
      },
    });

    // 판매원 프로필 중 manager가 없는 것 찾기
    const salesAgents = profiles.filter((p) => p.type === 'SALES_AGENT');
    const missingRelations: Array<{
      agentId: number;
      agentName: string;
      agentCode: string;
      expectedManagerId?: number;
      reason: string;
    }> = [];

    for (const agent of salesAgents) {
      const hasRelation = relations.some((r) => r.agentId === agent.id);
      if (!hasRelation) {
        // metadata에서 invitedByProfileId 확인
        const metadata = (agent.metadata || {}) as Record<string, any>;
        const invitedByProfileId = metadata?.invitedByProfileId as number | undefined;

        missingRelations.push({
          agentId: agent.id,
          agentName: agent.nickname || agent.displayName || 'Unknown',
          agentCode: agent.affiliateCode,
          expectedManagerId: invitedByProfileId,
          reason: invitedByProfileId
            ? `metadata에 invitedByProfileId(${invitedByProfileId})가 있지만 AffiliateRelation이 없음`
            : 'metadata에 invitedByProfileId가 없음',
        });
      }
    }

    // 대리점장 프로필과 팀원 수 확인
    const branchManagers = profiles.filter((p) => p.type === 'BRANCH_MANAGER');
    const managerStats = branchManagers.map((manager) => {
      const teamCount = relations.filter((r) => r.managerId === manager.id).length;
      return {
        managerId: manager.id,
        managerName: manager.nickname || manager.displayName || 'Unknown',
        managerCode: manager.affiliateCode,
        branchLabel: manager.branchLabel,
        teamCount,
      };
    });

    return NextResponse.json({
      ok: true,
      summary: {
        totalProfiles: profiles.length,
        totalRelations: relations.length,
        salesAgents: salesAgents.length,
        branchManagers: branchManagers.length,
        missingRelations: missingRelations.length,
      },
      missingRelations,
      managerStats,
      allProfiles: profiles.map((p) => ({
        id: p.id,
        type: p.type,
        name: p.nickname || p.displayName,
        code: p.affiliateCode,
        hasRelation: relations.some((r) => r.agentId === p.id || r.managerId === p.id),
      })),
    });
  } catch (error: any) {
    console.error('[Fix Relations] GET error:', error);
    return NextResponse.json(
      {
        ok: false,
        message: 'Failed to check relations',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true },
    });

    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { agentId, managerId } = body;

    if (!agentId || !managerId) {
      return NextResponse.json({ ok: false, message: 'agentId and managerId are required' }, { status: 400 });
    }

    // 프로필 확인
    const agent = await prisma.affiliateProfile.findUnique({
      where: { id: agentId },
      select: { id: true, type: true },
    });

    const manager = await prisma.affiliateProfile.findUnique({
      where: { id: managerId },
      select: { id: true, type: true },
    });

    if (!agent || agent.type !== 'SALES_AGENT') {
      return NextResponse.json({ ok: false, message: 'Invalid agent profile' }, { status: 400 });
    }

    if (!manager || manager.type !== 'BRANCH_MANAGER') {
      return NextResponse.json({ ok: false, message: 'Invalid manager profile' }, { status: 400 });
    }

    // AffiliateRelation 생성/업데이트
    const relationNow = new Date();
    const relation = await prisma.affiliateRelation.upsert({
      where: {
        managerId_agentId: {
          managerId: managerId,
          agentId: agentId,
        },
      },
      create: {
        managerId: managerId,
        agentId: agentId,
        status: 'ACTIVE',
        connectedAt: relationNow,
        updatedAt: relationNow,
      },
      update: {
        status: 'ACTIVE',
        connectedAt: relationNow,
        disconnectedAt: null,
        updatedAt: relationNow,
      },
    });

    return NextResponse.json({
      ok: true,
      message: 'AffiliateRelation created/updated successfully',
      relation,
    });
  } catch (error: any) {
    console.error('[Fix Relations] POST error:', error);
    return NextResponse.json(
      {
        ok: false,
        message: 'Failed to fix relation',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
