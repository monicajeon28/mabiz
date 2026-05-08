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

// GET: 랜딩페이지 상세 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const resolvedParams = await params;
    const landingPage = await prisma.landingPage.findUnique({
      where: { id: parseInt(resolvedParams.id) },
      include: {
        CustomerGroup: {
          select: {
            id: true,
            name: true,
          },
        },
        ScheduledMessage: {
          select: {
            id: true,
            title: true,
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
      { ok: false, error: '랜딩페이지를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// PUT: 랜딩페이지 수정
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const resolvedParams = await params;
    const body = await req.json();
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
      smsNotification,
      commentEnabled,
      infoCollection,
      scheduledMessageId,
      isActive,
      isPublic,
      marketingAccountId,
      marketingFunnelId,
      funnelOrder,
    } = body;

    const now = new Date();
    
    // businessInfo를 JSON으로 변환 (이미 객체인 경우)
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

    const landingPage = await prisma.landingPage.update({
      where: { id: parseInt(resolvedParams.id) },
      data: {
        title,
        exposureTitle: exposureTitle || null,
        category: category || null,
        pageGroup: pageGroup || null,
        description: description || null,
        htmlContent,
        headerScript: headerScript || null,
        businessInfo: businessInfoJson,
        exposureImage: exposureImage || null,
        attachmentFile: attachmentFile || null,
        groupId: groupId ? parseInt(String(groupId)) : null,
        additionalGroupId: additionalGroupId ? parseInt(String(additionalGroupId)) : null,
        checkDuplicateGroup: checkDuplicateGroup || false,
        inputLimit: inputLimit || '무제한 허용',
        completionPageUrl: completionPageUrl || null,
        buttonTitle: buttonTitle || '신청하기',
        smsNotification: smsNotification || false,
        commentEnabled: commentEnabled || false,
        infoCollection: infoCollection || false,
        scheduledMessageId: scheduledMessageId ? parseInt(String(scheduledMessageId)) : null,
        isActive: isActive !== undefined ? isActive : true,
        isPublic: isPublic !== undefined ? isPublic : true,
        marketingAccountId: marketingAccountId ? parseInt(String(marketingAccountId)) : null,
        marketingFunnelId: marketingFunnelId ? parseInt(String(marketingFunnelId)) : null,
        funnelOrder: funnelOrder ? parseInt(String(funnelOrder)) : null,
        updatedAt: now, // updatedAt 필수 필드 추가
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
      landingPage,
    });
  } catch (error: any) {
    console.error('[Admin Landing Pages] PUT error:', error);
    return NextResponse.json(
      { ok: false, error: '랜딩페이지 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 랜딩페이지 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const resolvedParams = await params;
    await prisma.landingPage.delete({
      where: { id: parseInt(resolvedParams.id) },
    });

    return NextResponse.json({
      ok: true,
      message: '랜딩페이지가 삭제되었습니다.',
    });
  } catch (error: any) {
    console.error('[Admin Landing Pages] DELETE error:', error);
    return NextResponse.json(
      { ok: false, error: '랜딩페이지 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
