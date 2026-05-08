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

export async function GET(req: NextRequest) {
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

    const landingPages = await prisma.landingPage.findMany({
      orderBy: { createdAt: 'desc' },
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
      landingPages,
    });
  } catch (error: any) {
    console.error('[Admin Landing Pages] GET error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: '랜딩페이지 목록을 불러오는 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
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

    const newPage = await prisma.landingPage.create({
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
        commentEnabled: commentEnabled || false,
        infoCollection: infoCollection || false,
        scheduledMessageId: scheduledMessageId ? parseInt(String(scheduledMessageId)) : null,
        isPublic: isPublic !== undefined ? isPublic : true,
        marketingAccountId: marketingAccountId ? parseInt(String(marketingAccountId)) : null,
        marketingFunnelId: marketingFunnelId ? parseInt(String(marketingFunnelId)) : null,
        funnelOrder: funnelOrder ? parseInt(String(funnelOrder)) : null,
      },
    });

    return NextResponse.json({
      ok: true,
      landingPage: newPage,
    });
  } catch (error: any) {
    console.error('[Admin Landing Pages] POST error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: '랜딩페이지 생성 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    );
  }
}
