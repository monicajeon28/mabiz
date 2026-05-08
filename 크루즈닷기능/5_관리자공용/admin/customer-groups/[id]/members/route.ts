export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { scheduleAdminFunnelMessages } from '@/lib/funnel-scheduler';

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
    console.error('[Customer Groups] Auth check error:', error);
    return null;
  }
}

// GET: 그룹 멤버 목록 조회 (관리자 그룹 + 파트너 그룹 모두 지원)
export async function GET(
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

    const { searchParams } = new URL(req.url);
    const source = searchParams.get('source'); // 'admin' 또는 'partner'

    // 파트너 그룹인 경우
    if (source === 'partner') {
      const partnerGroup = await prisma.partnerCustomerGroup.findUnique({
        where: { id: groupId },
      });

      if (!partnerGroup) {
        return NextResponse.json({ ok: false, error: '파트너 그룹을 찾을 수 없습니다.' }, { status: 404 });
      }

      // 파트너 그룹의 고객(AffiliateLead) 조회
      const leads = await prisma.affiliateLead.findMany({
        where: { groupId },
        select: {
          id: true,
          customerName: true,
          customerPhone: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({
        ok: true,
        source: 'partner',
        members: leads.map(l => ({
          id: l.id,
          leadId: l.id,
          userId: null, // 파트너 그룹은 userId가 없음
          name: l.customerName,
          phone: l.customerPhone,
          addedAt: l.createdAt.toISOString(),
        })),
      });
    }

    // 관리자 그룹인 경우
    const group = await prisma.customerGroup.findFirst({
      where: {
        id: groupId,
        OR: [
          { adminId: admin.id },
          { affiliateProfileId: { not: null } },
        ],
      },
    });

    if (!group) {
      return NextResponse.json({ ok: false, error: '그룹을 찾을 수 없거나 권한이 없습니다.' }, { status: 404 });
    }

    // 그룹 멤버 조회
    const members = await prisma.customerGroupMember.findMany({
      where: { groupId },
      include: {
        User_CustomerGroupMember_userIdToUser: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: { addedAt: 'desc' },
    });

    return NextResponse.json({
      ok: true,
      source: 'admin',
      members: members.map(m => ({
        id: m.id,
        userId: m.userId,
        name: m.User_CustomerGroupMember_userIdToUser?.name || null,
        phone: m.User_CustomerGroupMember_userIdToUser?.phone || null,
        addedAt: m.addedAt.toISOString(),
        addedBy: m.addedBy,
      })),
    });
  } catch (error) {
    console.error('[Customer Groups Members GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to fetch members' },
      { status: 500 }
    );
  }
}

// POST: 그룹에 고객 추가
export async function POST(
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
    const { userIds } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: '추가할 고객 ID 목록이 필요합니다.' },
        { status: 400 }
      );
    }

    // 그룹 소유권 확인
    const group = await prisma.customerGroup.findFirst({
      where: {
        id: groupId,
        adminId: admin.id,
      },
    });

    if (!group) {
      return NextResponse.json({ ok: false, error: '그룹을 찾을 수 없거나 권한이 없습니다.' }, { status: 404 });
    }

    // 고객 추가 (중복 체크 포함)
    const addedMembers = [];
    const skippedMembers = [];

    for (const userId of userIds) {
      try {
        // 고객의 customerSource를 'group'으로 설정 (고객 그룹 관리에서 추가한 고객)
        await prisma.user.update({
          where: { id: userId },
          data: {
            customerSource: 'group',
          },
        }).catch(() => {
          // 업데이트 실패해도 계속 진행
        });

        const member = await prisma.customerGroupMember.create({
          data: {
            groupId,
            userId,
            addedBy: admin.id,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
          },
        });
        addedMembers.push(member);

        // 고객이 그룹에 추가될 때 퍼널 메시지 자동 예약 (통합 퍼널 시스템 사용)
        scheduleAdminFunnelMessages({
          userId,
          groupId,
          adminId: admin.id,
        }).catch(err => console.error('[Admin Members POST] Funnel schedule error:', err));
      } catch (error: any) {
        // Unique constraint violation (이미 그룹에 속한 경우)
        if (error.code === 'P2002') {
          skippedMembers.push(userId);
        } else {
          throw error;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      added: addedMembers.length,
      skipped: skippedMembers.length,
      members: addedMembers,
    });
  } catch (error) {
    console.error('[Customer Groups Members POST] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to add members' },
      { status: 500 }
    );
  }
}

// DELETE: 그룹에서 고객 제거
export async function DELETE(
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

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: '제거할 고객 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const userIdNum = parseInt(userId);
    if (isNaN(userIdNum)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 고객 ID입니다.' }, { status: 400 });
    }

    // 그룹 소유권 확인
    const group = await prisma.customerGroup.findFirst({
      where: {
        id: groupId,
        adminId: admin.id,
      },
    });

    if (!group) {
      return NextResponse.json({ ok: false, error: '그룹을 찾을 수 없거나 권한이 없습니다.' }, { status: 404 });
    }

    // 고객 멤버십 찾기
    const membership = await prisma.customerGroupMember.findFirst({
      where: {
        groupId,
        userId: userIdNum,
        releasedAt: null, // 해제되지 않은 것만
      },
    });

    if (!membership) {
      return NextResponse.json(
        { ok: false, error: '그룹 멤버십을 찾을 수 없거나 이미 해제되었습니다.' },
        { status: 404 }
      );
    }

    // releasedAt 업데이트 (소프트 삭제)
    await prisma.customerGroupMember.update({
      where: { id: membership.id },
      data: {
        releasedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, message: '고객이 그룹에서 해제되었습니다.' });
  } catch (error) {
    console.error('[Customer Groups Members DELETE] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to remove member' },
      { status: 500 }
    );
  }
}
