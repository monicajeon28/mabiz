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
    console.error('[Admin Landing Pages Share] Auth check error:', error);
    return false;
  }
}

interface ShareRequestBody {
  managerProfileIds: number[];
  category?: string | null;
}

interface RevokeRequestBody {
  managerProfileIds?: number[];
  revokeAll?: boolean;
}

const getPageIdFromParams = async (params: Promise<{ id: string }> | { id: string }) => {
  const resolvedParams = await Promise.resolve(params);
  const pageId = parseInt(resolvedParams.id);
  if (Number.isNaN(pageId)) {
    throw new Error('INVALID_PAGE_ID');
  }
  return pageId;
};

async function ensureAdminSession() {
  const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sid) {
    throw new Error('UNAUTHORIZED');
  }

  const isAdmin = await checkAdminAuth(sid);
  if (!isAdmin) {
    throw new Error('FORBIDDEN');
  }

  return sid;
}

export async function POST(
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
    const pageId = parseInt(resolvedParams.id);

    if (Number.isNaN(pageId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 랜딩페이지 ID입니다.' }, { status: 400 });
    }

    const landingPage = await prisma.landingPage.findUnique({
      where: { id: pageId },
    });

    if (!landingPage) {
      return NextResponse.json({ ok: false, error: '랜딩페이지를 찾을 수 없습니다' }, { status: 404 });
    }

    let body: ShareRequestBody;
    try {
      body = await req.json();
    } catch (error) {
      console.error('[Admin Landing Pages Share] JSON parse error:', error);
      return NextResponse.json({ ok: false, error: '요청 데이터를 파싱할 수 없습니다.' }, { status: 400 });
    }

    const { managerProfileIds, category } = body;

    if (!Array.isArray(managerProfileIds) || managerProfileIds.length === 0) {
      return NextResponse.json({ ok: false, error: '공유할 대리점장을 선택해주세요.' }, { status: 400 });
    }

    const normalizedIds = managerProfileIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (normalizedIds.length === 0) {
      return NextResponse.json({ ok: false, error: '유효한 대리점장 ID가 없습니다.' }, { status: 400 });
    }

    const managers = await prisma.affiliateProfile.findMany({
      where: {
        id: { in: normalizedIds },
        type: 'BRANCH_MANAGER',
        status: 'ACTIVE',
      },
      select: {
        id: true,
        displayName: true,
        branchLabel: true,
      },
    });

    if (managers.length === 0) {
      return NextResponse.json({ ok: false, error: '선택한 대리점장을 찾을 수 없습니다.' }, { status: 404 });
    }

    // upsert를 사용하여 이미 공유된 경우 업데이트, 삭제된 경우 다시 생성
    await prisma.$transaction(
      managers.map((manager) =>
        prisma.sharedLandingPage.upsert({
          where: {
            landingPageId_managerProfileId: {
              landingPageId: pageId,
              managerProfileId: manager.id,
            },
          },
          update: {
            category: category?.trim() || '관리자 보너스',
            // 삭제되었다가 다시 공유되는 경우 createdAt을 업데이트하지 않음 (원래 공유일시 유지)
          },
          create: {
            landingPageId: pageId,
            managerProfileId: manager.id,
            category: category?.trim() || '관리자 보너스',
          },
        })
      )
    );

    return NextResponse.json({
      ok: true,
      sharedCount: managers.length,
      managers: managers.map((manager) => ({
        id: manager.id,
        displayName: manager.displayName,
        branchLabel: manager.branchLabel,
      })),
    });
  } catch (error: any) {
    console.error('[Admin Landing Pages Share] POST error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: '랜딩페이지 공유 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    await ensureAdminSession();
    const pageId = await getPageIdFromParams(params);

    const sharedPages = await prisma.sharedLandingPage.findMany({
      where: { landingPageId: pageId },
      include: {
        ManagerProfile: {
          select: {
            id: true,
            displayName: true,
            branchLabel: true,
            affiliateCode: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      ok: true,
      sharedLandingPages: sharedPages.map((entry) => ({
        managerProfileId: entry.managerProfileId,
        displayName: entry.ManagerProfile?.displayName ?? null,
        branchLabel: entry.ManagerProfile?.branchLabel ?? null,
        affiliateCode: entry.ManagerProfile?.affiliateCode ?? null,
        category: entry.category ?? '관리자 보너스',
        sharedAt: entry.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error('[Admin Landing Pages Share] GET error:', error);
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }
    if (error?.message === 'FORBIDDEN') {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
    }
    if (error?.message === 'INVALID_PAGE_ID') {
      return NextResponse.json({ ok: false, error: '유효하지 않은 랜딩페이지 ID입니다.' }, { status: 400 });
    }

    return NextResponse.json(
      { ok: false, error: '공유 현황을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    await ensureAdminSession();
    const pageId = await getPageIdFromParams(params);

    let body: RevokeRequestBody = {};
    try {
      body = await req.json();
    } catch (error) {
      // body optional; ignore parse errors for empty body
    }

    const normalizedIds = Array.isArray(body.managerProfileIds)
      ? body.managerProfileIds
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0)
      : [];

    const revokeAll = body.revokeAll || normalizedIds.length === 0;

    if (!revokeAll && normalizedIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: '회수할 대리점장을 선택해주세요.' },
        { status: 400 }
      );
    }

    const whereClause: { landingPageId: number; managerProfileId?: { in: number[] } } = {
      landingPageId: pageId,
    };

    if (!revokeAll) {
      whereClause.managerProfileId = { in: normalizedIds };
    }

    const result = await prisma.sharedLandingPage.deleteMany({
      where: whereClause,
    });

    return NextResponse.json({
      ok: true,
      revokedCount: result.count,
    });
  } catch (error: any) {
    console.error('[Admin Landing Pages Share] DELETE error:', error);
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }
    if (error?.message === 'FORBIDDEN') {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
    }
    if (error?.message === 'INVALID_PAGE_ID') {
      return NextResponse.json({ ok: false, error: '유효하지 않은 랜딩페이지 ID입니다.' }, { status: 400 });
    }

    return NextResponse.json(
      { ok: false, error: '랜딩페이지 공유 회수 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
