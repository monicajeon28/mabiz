export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return null;
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true, name: true },
        },
      },
    });

    if (!session || !session.User || session.User.role !== 'admin') {
      return null;
    }

    return {
      id: session.User.id,
      name: session.User.name,
      role: session.User.role,
    };
  } catch (error) {
    console.error('[Customer Groups Funnel Settings] Auth check error:', error);
    return null;
  }
}

// PUT: 퍼널 설정 업데이트 (관리자 그룹 + 파트너 그룹 모두 지원)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const resolvedParams = await params;
    const groupId = parseInt(resolvedParams.id);

    if (isNaN(groupId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 그룹 ID입니다.' }, { status: 400 });
    }

    const body = await req.json();
    const { funnelTalkIds, funnelSmsIds, funnelEmailIds, reEntryHandling, source } = body;

    // 파트너 그룹인 경우
    if (source === 'partner') {
      const partnerGroup = await prisma.partnerCustomerGroup.findUnique({
        where: { id: groupId },
      });

      if (!partnerGroup) {
        return NextResponse.json({ ok: false, error: '파트너 그룹을 찾을 수 없습니다.' }, { status: 404 });
      }

      // 파트너 그룹 퍼널 설정 업데이트
      const updatedGroup = await prisma.partnerCustomerGroup.update({
        where: { id: groupId },
        data: {
          funnelTalkIds: Array.isArray(funnelTalkIds) && funnelTalkIds.length > 0 ? funnelTalkIds : null,
          funnelSmsIds: Array.isArray(funnelSmsIds) && funnelSmsIds.length > 0 ? funnelSmsIds : null,
          funnelEmailIds: Array.isArray(funnelEmailIds) && funnelEmailIds.length > 0 ? funnelEmailIds : null,
          reEntryHandling: reEntryHandling || null,
          updatedAt: new Date(),
        },
      });

      // 고객 수 조회
      const leadCount = await prisma.affiliateLead.count({
        where: { groupId: updatedGroup.id },
      });

      return NextResponse.json({
        ok: true,
        source: 'partner',
        group: {
          ...updatedGroup,
          _count: { members: leadCount },
        },
      });
    }

    // 관리자 그룹 소유권 확인 (본인 그룹 + affiliateProfileId가 있는 그룹)
    const existingGroup = await prisma.customerGroup.findFirst({
      where: {
        id: groupId,
        OR: [
          { adminId: admin.id },
          { affiliateProfileId: { not: null } },
        ],
      },
    });

    if (!existingGroup) {
      return NextResponse.json({ ok: false, error: '그룹을 찾을 수 없거나 권한이 없습니다.' }, { status: 404 });
    }

    // 퍼널 설정 업데이트
    const group = await prisma.customerGroup.update({
      where: { id: groupId },
      data: {
        funnelTalkIds: Array.isArray(funnelTalkIds) ? funnelTalkIds : null,
        funnelSmsIds: Array.isArray(funnelSmsIds) ? funnelSmsIds : null,
        funnelEmailIds: Array.isArray(funnelEmailIds) ? funnelEmailIds : null,
        reEntryHandling: reEntryHandling || null,
      },
      include: {
        _count: {
          select: {
            CustomerGroupMember: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      source: 'admin',
      group: {
        ...group,
        _count: { members: group._count.CustomerGroupMember },
      },
    });
  } catch (error) {
    console.error('[Customer Groups Funnel Settings PUT] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to update funnel settings' },
      { status: 500 }
    );
  }
}
