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
      select: {
        expiresAt: true,
        User: {
          select: { id: true, role: true, name: true },
        },
      },
    });

    if (!session || !session.User || session.User.role !== 'admin') {
      return null;
    }

    // 🔒 세션 만료 검증
    if (session.expiresAt && session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: sid } }).catch(() => {});
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

// GET: 특정 그룹 조회 (관리자 그룹 + 파트너 그룹 모두 지원)
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

    // 파트너 그룹 조회
    if (source === 'partner') {
      const partnerGroup = await prisma.partnerCustomerGroup.findUnique({
        where: { id: groupId },
        include: {
          AffiliateProfile: {
            select: {
              id: true,
              displayName: true,
              branchLabel: true,
              affiliateCode: true,
              type: true,
            },
          },
        },
      });

      if (!partnerGroup) {
        return NextResponse.json({ ok: false, error: '파트너 그룹을 찾을 수 없습니다.' }, { status: 404 });
      }

      // 파트너 그룹의 고객 수 조회
      const leadCount = await prisma.affiliateLead.count({
        where: { groupId: partnerGroup.id },
      });

      return NextResponse.json({
        ok: true,
        source: 'partner',
        group: {
          id: partnerGroup.id,
          name: partnerGroup.name,
          description: partnerGroup.description,
          color: partnerGroup.color,
          affiliateProfileId: partnerGroup.profileId,
          affiliateProfile: partnerGroup.AffiliateProfile,
          funnelTalkIds: partnerGroup.funnelTalkIds,
          funnelSmsIds: partnerGroup.funnelSmsIds,
          funnelEmailIds: partnerGroup.funnelEmailIds,
          reEntryHandling: partnerGroup.reEntryHandling,
          createdAt: partnerGroup.createdAt.toISOString(),
          updatedAt: partnerGroup.updatedAt.toISOString(),
          _count: { members: leadCount },
        },
      });
    }

    // 관리자 그룹 조회 (본인이 생성한 그룹 + affiliateProfileId가 있는 그룹)
    const group = await prisma.customerGroup.findFirst({
      where: {
        id: groupId,
        OR: [
          { adminId: admin.id },
          { affiliateProfileId: { not: null } },
        ],
      },
      include: {
        AffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            branchLabel: true,
            affiliateCode: true,
          },
        },
        CustomerGroupMember: {
          include: {
            User_CustomerGroupMember_userIdToUser: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            CustomerGroupMember: true,
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ ok: false, error: '그룹을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      source: 'admin',
      group: {
        ...group,
        members: group.CustomerGroupMember.map((m: any) => ({
          id: m.id,
          userId: m.userId,
          user: m.User_CustomerGroupMember_userIdToUser,
          addedAt: m.addedAt.toISOString(),
          addedBy: m.addedBy,
        })),
        _count: { members: group._count.CustomerGroupMember },
      },
    });
  } catch (error) {
    console.error('[Customer Groups GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to fetch customer group' },
      { status: 500 }
    );
  }
}

// PUT: 그룹 수정
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
    const { name, description, color } = body;

    // 그룹 소유권 확인
    const existingGroup = await prisma.customerGroup.findFirst({
      where: {
        id: groupId,
        adminId: admin.id,
      },
    });

    if (!existingGroup) {
      return NextResponse.json({ ok: false, error: '그룹을 찾을 수 없거나 권한이 없습니다.' }, { status: 404 });
    }

    // 그룹 수정
    const group = await prisma.customerGroup.update({
      where: { id: groupId },
      data: {
        name: name?.trim() || existingGroup.name,
        description: description?.trim() || null,
        color: color || null,
      },
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    return NextResponse.json({ ok: true, group });
  } catch (error) {
    console.error('[Customer Groups PUT] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to update customer group' },
      { status: 500 }
    );
  }
}

// DELETE: 그룹 삭제
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

    // 그룹 존재 확인 (관리자 권한이면 모든 그룹 삭제 가능)
    const existingGroup = await prisma.customerGroup.findUnique({
      where: { id: groupId },
    });

    if (!existingGroup) {
      return NextResponse.json({ ok: false, error: '그룹을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 그룹 멤버 먼저 삭제 (외래키 제약)
    await prisma.customerGroupMember.deleteMany({
      where: { groupId: groupId },
    });

    // 그룹 삭제
    await prisma.customerGroup.delete({
      where: { id: groupId },
    });

    return NextResponse.json({ ok: true, message: '그룹이 삭제되었습니다.' });
  } catch (error) {
    console.error('[Customer Groups DELETE] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to delete customer group' },
      { status: 500 }
    );
  }
}
