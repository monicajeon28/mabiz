export const dynamic = 'force-dynamic';

// app/api/admin/landing-pages/[id]/comments/[commentId]/route.ts
// 관리자용 랜딩페이지 댓글 삭제 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

/**
 * DELETE: 댓글 삭제 (관리자/대리점장만 가능)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> | { id: string; commentId: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const resolvedParams = await Promise.resolve(params);
    const landingPageId = parseInt(resolvedParams.id);
    const commentId = parseInt(resolvedParams.commentId);

    if (isNaN(landingPageId) || isNaN(commentId)) {
      return NextResponse.json(
        { ok: false, error: '잘못된 ID입니다.' },
        { status: 400 }
      );
    }

    // 랜딩페이지 조회 및 권한 확인
    let landingPage = await prisma.landingPage.findFirst({
      where: {
        id: landingPageId,
        adminId: user.id, // 본인이 생성한 페이지
      },
    });

    // 관리자인 경우 모든 페이지 접근 가능
    if (!landingPage && user.role === 'admin') {
      landingPage = await prisma.landingPage.findUnique({
        where: { id: landingPageId },
      });
    }

    // 대리점장인지 확인
    if (!landingPage && user.role === 'partner') {
      const profile = await prisma.affiliateProfile.findUnique({
        where: { userId: user.id },
        select: { type: true },
      });
      
      if (profile?.type === 'BRANCH_MANAGER') {
        landingPage = await prisma.landingPage.findFirst({
          where: {
            id: landingPageId,
            adminId: user.id,
          },
        });
      }
    }

    if (!landingPage) {
      return NextResponse.json(
        { ok: false, error: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 댓글 조회
    const comment = await prisma.landingPageComment.findFirst({
      where: {
        id: commentId,
        landingPageId: landingPageId,
      },
    });

    if (!comment) {
      return NextResponse.json(
        { ok: false, error: '댓글을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 댓글 삭제
    await prisma.landingPageComment.delete({
      where: { id: commentId },
    });

    return NextResponse.json({
      ok: true,
      message: '댓글이 삭제되었습니다.',
    });
  } catch (error: any) {
    console.error('[Admin Landing Page Comment Delete] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || '댓글 삭제 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
