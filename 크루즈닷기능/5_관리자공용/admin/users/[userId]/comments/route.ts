export const dynamic = 'force-dynamic';

// app/api/admin/users/[userId]/comments/route.ts
// 사용자가 작성한 댓글 조회 (관리자 전용)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { logger } from '@/lib/logger';

async function checkAdminAuth() {
  const session = await getSession();
  if (!session?.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: parseInt(session.userId) },
    select: { role: true }
  });

  return user?.role === 'admin' ? user : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { userId: userIdStr } = await params; const userId = parseInt(userIdStr);
    if (isNaN(userId)) {
      return NextResponse.json({ ok: false, error: 'Invalid user ID' }, { status: 400 });
    }

    const comments = await prisma.communityComment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        postId: true,
        content: true,
        authorName: true,
        parentCommentId: true,
        createdAt: true,
        updatedAt: true,
        Post: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    return NextResponse.json({
      ok: true,
      comments: comments.map(c => ({
        id: c.id,
        postId: c.postId,
        postTitle: c.Post?.title || '게시글 없음',
        content: c.content,
        authorName: c.authorName,
        parentCommentId: c.parentCommentId,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString()
      }))
    });
  } catch (error: any) {
    logger.error('[Admin User Comments API] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}
