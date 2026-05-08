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

// POST: 랜딩페이지 복사
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

    if (isNaN(pageId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 랜딩페이지 ID입니다' }, { status: 400 });
    }

    // 원본 랜딩페이지 가져오기
    const originalPage = await prisma.landingPage.findUnique({
      where: { id: pageId },
    });

    if (!originalPage) {
      return NextResponse.json({ ok: false, error: '랜딩페이지를 찾을 수 없습니다' }, { status: 404 });
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      select: { userId: true },
    });

    if (!session) {
      return NextResponse.json({ ok: false, error: '세션을 찾을 수 없습니다' }, { status: 401 });
    }

    // slug 생성 (제목 기반, 중복 체크)
    let baseSlug = originalPage.title
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    if (!baseSlug) {
      baseSlug = `landing-${Date.now()}`;
    }

    // 복사본임을 표시
    baseSlug = `${baseSlug}-copy`;

    let slug = baseSlug;
    let counter = 1;
    while (await prisma.landingPage.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const now = new Date();

    // 랜딩페이지 복사
    const duplicatedPage = await prisma.landingPage.create({
      data: {
        adminId: session.userId,
        title: `${originalPage.title} (복사본)`,
        exposureTitle: originalPage.exposureTitle,
        category: originalPage.category,
        pageGroup: originalPage.pageGroup,
        description: originalPage.description,
        htmlContent: originalPage.htmlContent,
        headerScript: originalPage.headerScript,
        businessInfo: originalPage.businessInfo,
        exposureImage: originalPage.exposureImage,
        attachmentFile: originalPage.attachmentFile,
        slug,
        isActive: false, // 복사본은 비활성화 상태로 생성
        isPublic: originalPage.isPublic,
        marketingAccountId: originalPage.marketingAccountId,
        marketingFunnelId: originalPage.marketingFunnelId,
        funnelOrder: originalPage.funnelOrder,
        groupId: originalPage.groupId,
        additionalGroupId: originalPage.additionalGroupId,
        checkDuplicateGroup: originalPage.checkDuplicateGroup,
        inputLimit: originalPage.inputLimit,
        completionPageUrl: originalPage.completionPageUrl,
        buttonTitle: originalPage.buttonTitle,
        commentEnabled: originalPage.commentEnabled,
        infoCollection: originalPage.infoCollection,
        scheduledMessageId: originalPage.scheduledMessageId,
        smsNotification: originalPage.smsNotification,
        viewCount: 0,
        shortcutUrl: null, // 바로가기 URL은 새로 생성해야 함
        updatedAt: now,
        createdAt: now,
      },
      include: {
        CustomerGroup: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      landingPage: duplicatedPage,
    });
  } catch (error: any) {
    console.error('[Admin Landing Pages] Duplicate error:', error);
    return NextResponse.json(
      { ok: false, error: '랜딩페이지 복사 중 오류가 발생했습니다: ' + error.message },
      { status: 500 }
    );
  }
}
