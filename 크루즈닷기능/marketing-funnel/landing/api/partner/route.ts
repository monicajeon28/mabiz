export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { requirePartnerContext } from '@/app/api/partner/_utils';

// GET: 대리점장의 랜딩페이지 목록 조회
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const { profile } = await requirePartnerContext();
    
    // 대리점장만 가능
    if (profile.type !== 'BRANCH_MANAGER') {
      return NextResponse.json({ ok: false, error: '대리점장만 접근 가능합니다' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');

    const where: any = {
      adminId: user.id, // 대리점장이 생성한 랜딩페이지만
    };
    
    if (category && category !== '전체') {
      where.category = category;
    }

    const landingPages = await prisma.landingPage.findMany({
      where,
      include: {
        CustomerGroup: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const sharedEntries = await prisma.sharedLandingPage.findMany({
      where: {
        managerProfileId: profile.id,
      },
      include: {
        LandingPage: {
          include: {
            CustomerGroup: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const sharedPages = sharedEntries
      .filter((entry) => entry.LandingPage)
      .map((entry) => ({
        ...entry.LandingPage,
        sharedCategory: entry.category || '관리자 보너스',
        sharedAt: entry.createdAt.toISOString(),
      }));

    return NextResponse.json({
      ok: true,
      ownedPages: landingPages,
      sharedPages,
    });
  } catch (error: any) {
    console.error('[Partner Landing Pages] GET error:', error);
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

// POST: 대리점장이 새 랜딩페이지 생성 (15개 제한)
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const { profile } = await requirePartnerContext();
    
    // 대리점장만 가능
    if (profile.type !== 'BRANCH_MANAGER') {
      return NextResponse.json({ ok: false, error: '대리점장만 접근 가능합니다' }, { status: 403 });
    }

    // 대리점장의 랜딩페이지 개수 확인 (20개 제한)
    const existingPagesCount = await prisma.landingPage.count({
      where: {
        adminId: user.id,
      },
    });

    if (existingPagesCount >= 20) {
      return NextResponse.json(
        { 
          ok: false, 
          error: '대리점장은 최대 20개의 랜딩페이지만 생성할 수 있습니다. 기존 페이지를 삭제한 후 다시 시도해주세요.' 
        },
        { status: 403 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch (parseError: any) {
      console.error('[Partner Landing Pages] JSON parse error:', parseError);
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
      isPublic = true,
      marketingAccountId,
      marketingFunnelId,
      funnelOrder,
    } = body;

    // businessInfo에서 commentSettings 추출
    let commentSettings = null;
    if (businessInfo && typeof businessInfo === 'object' && 'commentSettings' in businessInfo) {
      commentSettings = businessInfo.commentSettings;
    }

    if (!title || !htmlContent) {
      return NextResponse.json(
        { ok: false, error: '제목과 HTML 내용은 필수입니다' },
        { status: 400 }
      );
    }

    // slug 생성 (제목 기반, 중복 체크)
    let baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    if (!baseSlug) {
      baseSlug = `landing-${Date.now()}`;
    }

    let slug = baseSlug;
    let counter = 1;
    while (await prisma.landingPage.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const now = new Date();
    let landingPage;
    try {
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

      landingPage = await prisma.landingPage.create({
        data: {
          adminId: user.id, // 대리점장의 user ID
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
          slug,
          isActive: true,
          isPublic: isPublic !== undefined ? isPublic : true,
          marketingAccountId: marketingAccountId ? parseInt(String(marketingAccountId)) : null,
          marketingFunnelId: marketingFunnelId ? parseInt(String(marketingFunnelId)) : null,
          funnelOrder: funnelOrder ? parseInt(String(funnelOrder)) : null,
          groupId: groupId ? parseInt(String(groupId)) : null,
          additionalGroupId: additionalGroupId ? parseInt(String(additionalGroupId)) : null,
          checkDuplicateGroup: checkDuplicateGroup || false,
          inputLimit: inputLimit || '무제한 허용',
          completionPageUrl: completionPageUrl || null,
          buttonTitle: buttonTitle || '신청하기',
          commentEnabled: commentEnabled || false,
          infoCollection: infoCollection || false,
          scheduledMessageId: scheduledMessageId ? parseInt(String(scheduledMessageId)) : null,
          smsNotification: false,
          updatedAt: now,
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
    } catch (createError: any) {
      console.error('[Partner Landing Pages] Create database error:', createError);
      
      let errorMessage = '랜딩페이지 생성에 실패했습니다.';
      if (createError?.code === 'P2002') {
        const target = createError?.meta?.target;
        if (Array.isArray(target) && target.includes('slug')) {
          errorMessage = '이미 존재하는 슬러그입니다.';
        } else {
          errorMessage = '중복된 데이터가 있습니다.';
        }
      } else if (createError?.code === 'P2003') {
        errorMessage = '연결된 데이터를 찾을 수 없습니다. (외래 키 제약 조건 위반)';
      } else if (createError?.code === 'P2011') {
        errorMessage = '필수 필드가 누락되었습니다.';
      } else if (createError?.message) {
        errorMessage = createError.message;
      }
      
      return NextResponse.json(
        { 
          ok: false, 
          error: errorMessage,
          details: process.env.NODE_ENV === 'development' ? {
            message: createError?.message,
            code: createError?.code,
            meta: createError?.meta,
            name: createError?.name,
          } : undefined
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      landingPage,
      remainingQuota: 20 - (existingPagesCount + 1), // 남은 할당량
    });
  } catch (error: any) {
    console.error('[Partner Landing Pages] POST error:', error);
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
