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
    console.error('[Admin Landing Pages] Auth check error:', error);
    return false;
  }
}

// GET: 단일 랜딩페이지 조회
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
    const pageId = parseInt(resolvedParams.id);
    
    if (isNaN(pageId)) {
      return NextResponse.json({ ok: false, error: '잘못된 랜딩페이지 ID' }, { status: 400 });
    }

    const landingPage = await prisma.landingPage.findUnique({
      where: { id: pageId },
      include: {
        CustomerGroup: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!landingPage) {
      return NextResponse.json({ ok: false, error: '랜딩페이지를 찾을 수 없습니다' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      landingPage,
    });
  } catch (error: any) {
    console.error('[Admin Landing Pages] GET error:', error);
    return NextResponse.json(
      { 
        ok: false, 
        error: '랜딩페이지를 불러오는 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    );
  }
}

// PUT: 랜딩페이지 수정
export async function PUT(
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
      return NextResponse.json({ ok: false, error: '잘못된 랜딩페이지 ID' }, { status: 400 });
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      select: { userId: true },
    });

    if (!session) {
      return NextResponse.json({ ok: false, error: '세션을 찾을 수 없습니다' }, { status: 401 });
    }

    // 기존 랜딩페이지 확인
    const existingPage = await prisma.landingPage.findUnique({
      where: { id: pageId },
    });

    if (!existingPage) {
      return NextResponse.json({ ok: false, error: '랜딩페이지를 찾을 수 없습니다' }, { status: 404 });
    }

    let body;
    try {
      body = await req.json();
    } catch (parseError: any) {
      console.error('[Admin Landing Pages] JSON parse error:', parseError);
      return NextResponse.json(
        { ok: false, error: '요청 데이터를 파싱할 수 없습니다.' },
        { status: 400 }
      );
    }

    const {
      title,
      exposureTitle,
      category,
      pageGroup,
      description,
      htmlContent,
      headerScript,
      businessInfo,
      exposureImage,
      attachmentFile,
      groupId,
      additionalGroupId,
      checkDuplicateGroup,
      inputLimit,
      completionPageUrl,
      buttonTitle,
      commentEnabled,
      infoCollection,
      scheduledMessageId,
      isPublic,
      marketingAccountId,
      marketingFunnelId,
      funnelOrder,
    } = body;

    if (!title || !htmlContent) {
      return NextResponse.json(
        { ok: false, error: '제목과 HTML 내용은 필수입니다' },
        { status: 400 }
      );
    }

    // businessInfo를 JSON으로 변환
    let businessInfoJson = null;
    if (businessInfo) {
      if (typeof businessInfo === 'string') {
        try {
          businessInfoJson = JSON.parse(businessInfo);
        } catch {
          businessInfoJson = businessInfo;
        }
      } else {
        businessInfoJson = businessInfo;
      }
    }

    const updatedPage = await prisma.landingPage.update({
      where: { id: pageId },
      data: {
        title,
        exposureTitle: exposureTitle || null,
        category: category || null,
        pageGroup: pageGroup || null,
        description: description || null,
        htmlContent,
        headerScript: headerScript || null,
        businessInfo: businessInfoJson,
        exposureImage: exposureImage !== undefined ? exposureImage : existingPage.exposureImage,
        attachmentFile: attachmentFile !== undefined ? attachmentFile : existingPage.attachmentFile,
        groupId: groupId ? parseInt(String(groupId)) : null,
        additionalGroupId: additionalGroupId ? parseInt(String(additionalGroupId)) : null,
        checkDuplicateGroup: checkDuplicateGroup || false,
        inputLimit: inputLimit || '무제한 허용',
        completionPageUrl: completionPageUrl || null,
        buttonTitle: buttonTitle || '신청하기',
        commentEnabled: commentEnabled || false,
        infoCollection: infoCollection || false,
        scheduledMessageId: scheduledMessageId ? parseInt(String(scheduledMessageId)) : null,
        isPublic: isPublic !== undefined ? isPublic : existingPage.isPublic,
        marketingAccountId: marketingAccountId ? parseInt(String(marketingAccountId)) : null,
        marketingFunnelId: marketingFunnelId ? parseInt(String(marketingFunnelId)) : null,
        funnelOrder: funnelOrder ? parseInt(String(funnelOrder)) : null,
        updatedAt: new Date(),
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
      landingPage: updatedPage,
    });
  } catch (error: any) {
    console.error('[Admin Landing Pages] PUT error:', error);
    return NextResponse.json(
      { 
        ok: false, 
        error: '랜딩페이지 수정 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    );
  }
}

// DELETE: 랜딩페이지 삭제
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
    const pageId = parseInt(resolvedParams.id);
    
    if (isNaN(pageId)) {
      return NextResponse.json({ ok: false, error: '잘못된 랜딩페이지 ID' }, { status: 400 });
    }

    await prisma.landingPage.delete({
      where: { id: pageId },
    });

    return NextResponse.json({
      ok: true,
      message: '랜딩페이지가 삭제되었습니다.',
    });
  } catch (error: any) {
    console.error('[Admin Landing Pages] DELETE error:', error);
    return NextResponse.json(
      { 
        ok: false, 
        error: '랜딩페이지 삭제 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    );
  }
}
