export const dynamic = 'force-dynamic';

// app/api/admin/mall/community/posts/[id]/route.ts
// 관리자용 커뮤니티 게시글 수정 및 삭제 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/session';
import { logger } from '@/lib/logger';

// 관리자 권한 확인 헬퍼 함수
async function checkAdminPermission(userId: number) {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, phone: true },
  });

  // 관리자 권한 확인
  const isAdminUser = dbUser?.role === 'admin' && dbUser.phone && /^user(1[0]|[1-9])$/.test(dbUser.phone);
  const isSuperAdmin = dbUser?.role === 'admin' && dbUser.phone === '01024958013';

  return isAdminUser || isSuperAdmin;
}

// PATCH: 게시글 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const hasPermission = await checkAdminPermission(user.id);
    if (!hasPermission) {
      return NextResponse.json(
        { ok: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const postId = parseInt(params.id);
    if (isNaN(postId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid post ID' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { title, content, images } = body;

    if (!title || !content) {
      return NextResponse.json(
        { ok: false, error: '제목과 내용을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 게시글 존재 확인
    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { id: true, category: true, isDeleted: true },
    });

    if (!post || post.isDeleted) {
      return NextResponse.json(
        { ok: false, error: '게시글을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 게시글 수정
    const updatedPost = await prisma.communityPost.update({
      where: { id: postId },
      data: {
        title: title.trim(),
        content: content.trim(),
        images: images && Array.isArray(images) && images.length > 0 ? images : undefined,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        title: true,
        content: true,
        category: true,
        authorName: true,
        images: true,
        views: true,
        likes: true,
        comments: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      post: {
        ...updatedPost,
        createdAt: updatedPost.createdAt instanceof Date
          ? updatedPost.createdAt.toISOString()
          : (typeof updatedPost.createdAt === 'string' ? updatedPost.createdAt : new Date(updatedPost.createdAt).toISOString()),
        updatedAt: updatedPost.updatedAt instanceof Date
          ? updatedPost.updatedAt.toISOString()
          : (typeof updatedPost.updatedAt === 'string' ? updatedPost.updatedAt : new Date(updatedPost.updatedAt).toISOString()),
      },
    });
  } catch (error: any) {
    logger.error('[ADMIN POST UPDATE] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, error: '게시글 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 게시글 삭제
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const hasPermission = await checkAdminPermission(user.id);
    if (!hasPermission) {
      return NextResponse.json(
        { ok: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const postId = parseInt(params.id);

    if (isNaN(postId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid post ID' },
        { status: 400 }
      );
    }

    // 게시글 존재 확인
    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return NextResponse.json(
        { ok: false, error: '게시글을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 게시글 삭제 (soft delete)
    await prisma.communityPost.update({
      where: { id: postId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      message: '게시글이 삭제되었습니다.',
    });
  } catch (error: any) {
    logger.error('[ADMIN POST DELETE] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, error: '게시글 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
