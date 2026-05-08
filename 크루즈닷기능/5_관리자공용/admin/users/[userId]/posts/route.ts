export const dynamic = 'force-dynamic';

// app/api/admin/users/[userId]/posts/route.ts
// 사용자가 작성한 게시글 조회 (관리자 전용)

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

    const posts = await prisma.communityPost.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
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
        isDeleted: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return NextResponse.json({
      ok: true,
      posts: posts.map(p => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        images: p.images ? (typeof p.images === 'string' ? JSON.parse(p.images) : p.images) : []
      }))
    });
  } catch (error: any) {
    logger.error('[Admin User Posts API] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}
