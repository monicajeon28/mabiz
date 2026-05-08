export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

const SESSION_COOKIE = 'cg.sid.v2';

async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  try {
    if (!sid) return false;

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { User: true },
    });

    if (!session || !session.User) return false;
    return session.User.role === 'admin';
  } catch (error) {
    console.error('[Admin Landing Pages] Auth check error:', error);
    return false;
  }
}

// GET: 랜딩페이지 등록 데이터 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sid) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const isAdmin = await checkAdminAuth(sid);
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const resolvedParams = await Promise.resolve(params);
    const landingPageId = parseInt(resolvedParams.id);
    if (isNaN(landingPageId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 랜딩페이지 ID입니다' }, { status: 400 });
    }

    const landingPage = await prisma.landingPage.findUnique({
      where: { id: landingPageId },
      select: {
        id: true,
        groupId: true,
        additionalGroupId: true,
      },
    });

    if (!landingPage) {
      return NextResponse.json(
        { ok: false, error: '랜딩페이지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const [registrations, total] = await Promise.all([
      prisma.landingPageRegistration.findMany({
        where: {
          landingPageId,
          deletedAt: null, // 삭제되지 않은 데이터만
        },
        orderBy: {
          registeredAt: 'desc',
        },
        skip,
        take: limit,
        include: {
          User: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
        },
      }),
      prisma.landingPageRegistration.count({
        where: {
          landingPageId,
          deletedAt: null,
        },
      }),
    ]);

    const userIds = registrations
      .map((registration) => registration.userId)
      .filter((userId): userId is number => typeof userId === 'number');

    const targetGroupIds = [landingPage.groupId, landingPage.additionalGroupId]
      .filter((groupId): groupId is number => typeof groupId === 'number');

    const membershipFilter: Record<string, unknown> = {};
    if (userIds.length > 0) {
      membershipFilter.userId = { in: userIds };
    }
    if (targetGroupIds.length > 0) {
      membershipFilter.groupId = { in: targetGroupIds };
    }

    const memberships = userIds.length
      ? await prisma.customerGroupMember.findMany({
          where: membershipFilter,
          include: {
            CustomerGroup: {
              select: { id: true, name: true },
            },
          },
        })
      : [];

    const membershipMap = new Map<
      number,
      Array<{ groupId: number; groupName: string | null; addedAt: string; addedBy: number | null }>
    >();

    memberships.forEach((member) => {
      const list = membershipMap.get(member.userId) ?? [];
      list.push({
        groupId: member.groupId,
        groupName: member.CustomerGroup?.name ?? null,
        addedAt: member.addedAt.toISOString(),
        addedBy: member.addedBy ?? null,
      });
      membershipMap.set(member.userId, list);
    });

    const registrationsWithGroups = registrations.map((registration) => ({
      ...registration,
      groupMemberships: registration.userId
        ? membershipMap.get(registration.userId) ?? []
        : [],
    }));

    return NextResponse.json({
      ok: true,
      registrations: registrationsWithGroups,
      groupPreferences: {
        primaryGroupId: landingPage.groupId,
        additionalGroupId: landingPage.additionalGroupId,
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('[Admin Landing Pages] GET registrations error:', error);
    return NextResponse.json(
      { ok: false, error: '등록 데이터를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 랜딩페이지 등록 데이터 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sid) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const isAdmin = await checkAdminAuth(sid);
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const resolvedParams = await Promise.resolve(params);

    const body = await req.json();
    const { registrationId } = body;

    if (!registrationId) {
      return NextResponse.json({ ok: false, error: '등록 ID가 필요합니다' }, { status: 400 });
    }

    await prisma.landingPageRegistration.update({
      where: { id: registrationId },
      data: {
        deletedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      message: '등록 데이터가 삭제되었습니다.',
    });
  } catch (error: any) {
    console.error('[Admin Landing Pages] DELETE registration error:', error);
    return NextResponse.json(
      { ok: false, error: '등록 데이터 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
