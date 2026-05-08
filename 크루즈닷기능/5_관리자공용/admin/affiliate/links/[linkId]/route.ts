export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/links/[linkId]/route.ts
// 어필리에이트 링크 개별 관리 API

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) {
    logger.log('[Admin Affiliate Links] No session ID');
    return false;
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { role: true },
        },
      },
    });

    if (!session || !session.User) {
      logger.log('[Admin Affiliate Links] Session or user not found');
      return false;
    }

    const isAdmin = session.User.role === 'admin';
    logger.log('[Admin Affiliate Links] Auth check:', { userId: session.userId, role: session.User.role, isAdmin });
    return isAdmin;
  } catch (error) {
    console.error('[Admin Affiliate Links] Auth check error:', error);
    return false;
  }
}

// PUT: 링크 수정 및 만료 처리
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  try {
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return NextResponse.json({ 
        ok: false, 
        message: '인증이 필요합니다. 다시 로그인해 주세요.',
      }, { status: 403 });
    }

    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json({ 
        ok: false, 
        message: '인증이 필요합니다. 다시 로그인해 주세요.',
      }, { status: 403 });
    }

    const { linkId } = await params;
    const linkIdNum = parseInt(linkId);
    
    if (isNaN(linkIdNum)) {
      return NextResponse.json({
        ok: false,
        message: '유효하지 않은 링크 ID입니다.',
      }, { status: 400 });
    }

    const body = await req.json();
    const { 
      title,
      productCode,
      expiresAt,
      campaignName,
      description,
      status,
      landingPageId
    } = body;

    // 링크 존재 확인
    const existingLink = await prisma.affiliateLink.findUnique({
      where: { id: linkIdNum },
    });

    if (!existingLink) {
      return NextResponse.json({
        ok: false,
        message: '링크를 찾을 수 없습니다.',
      }, { status: 404 });
    }

    // 업데이트할 데이터 준비
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (title !== undefined) updateData.title = title || null;
    if (productCode !== undefined) updateData.productCode = productCode || null;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (campaignName !== undefined) updateData.campaignName = campaignName || null;
    if (description !== undefined) updateData.description = description || null;
    if (status !== undefined) updateData.status = status;

    // metadata 업데이트 (랜딩페이지 정보)
    if (landingPageId !== undefined) {
      const metadata: any = existingLink.metadata ? { ...(existingLink.metadata as any) } : {};
      if (landingPageId) {
        metadata.landingPageId = Number(landingPageId);
      } else {
        delete metadata.landingPageId;
      }
      updateData.metadata = Object.keys(metadata).length > 0 ? metadata : null;
    }

    // 링크 업데이트
    const updatedLink = await prisma.affiliateLink.update({
      where: { id: linkIdNum },
      data: updateData,
      include: {
        AffiliateProfile_AffiliateLink_managerIdToAffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            affiliateCode: true,
          },
        },
        AffiliateProfile_AffiliateLink_agentIdToAffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            affiliateCode: true,
          },
        },
        AffiliateProduct: {
          select: {
            id: true,
            productCode: true,
            title: true,
          },
        },
        User: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            AffiliateLead: true,
            AffiliateSale: true,
          },
        },
      },
    });

    // 응답 형식 변환
    const formattedLink = {
      ...updatedLink,
      manager: updatedLink.AffiliateProfile_AffiliateLink_managerIdToAffiliateProfile,
      agent: updatedLink.AffiliateProfile_AffiliateLink_agentIdToAffiliateProfile,
      product: updatedLink.AffiliateProduct,
      issuedBy: updatedLink.User,
      _count: {
        leads: updatedLink._count.AffiliateLead,
        sales: updatedLink._count.AffiliateSale,
      },
    };

    return NextResponse.json({
      ok: true,
      link: formattedLink,
      message: status === 'EXPIRED' ? '링크가 만료 처리되었습니다.' : '링크가 수정되었습니다.',
    });
  } catch (error: any) {
    console.error('[Admin Affiliate Links] PUT error:', error);
    return NextResponse.json(
      { 
        ok: false, 
        message: '링크 수정 중 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// DELETE: 링크 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  try {
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return NextResponse.json({ 
        ok: false, 
        message: '인증이 필요합니다. 다시 로그인해 주세요.',
      }, { status: 403 });
    }

    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json({ 
        ok: false, 
        message: '인증이 필요합니다. 다시 로그인해 주세요.',
      }, { status: 403 });
    }

    const { linkId } = await params;
    const linkIdNum = parseInt(linkId);
    
    if (isNaN(linkIdNum)) {
      return NextResponse.json({
        ok: false,
        message: '유효하지 않은 링크 ID입니다.',
      }, { status: 400 });
    }

    // 링크 존재 확인
    const link = await prisma.affiliateLink.findUnique({
      where: { id: linkIdNum },
    });

    if (!link) {
      return NextResponse.json({
        ok: false,
        message: '링크를 찾을 수 없습니다.',
      }, { status: 404 });
    }

    // 링크 삭제
    await prisma.affiliateLink.delete({
      where: { id: linkIdNum },
    });

    return NextResponse.json({
      ok: true,
      message: '링크가 삭제되었습니다.',
    });
  } catch (error: any) {
    console.error('[Admin Affiliate Links] DELETE error:', error);
    return NextResponse.json(
      { 
        ok: false, 
        message: '링크 삭제 중 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
