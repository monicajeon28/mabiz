export const dynamic = 'force-dynamic';

// app/api/admin/users/[userId]/reviews/route.ts
// 사용자가 작성한 후기 조회 (관리자 전용)

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

    const reviews = await prisma.cruiseReview.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        content: true,
        rating: true,
        cruiseLine: true,
        shipName: true,
        travelDate: true,
        images: true,
        isApproved: true,
        isDeleted: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return NextResponse.json({
      ok: true,
      reviews: reviews.map(r => ({
        ...r,
        travelDate: r.travelDate?.toISOString() || null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        images: r.images ? (typeof r.images === 'string' ? JSON.parse(r.images) : r.images) : []
      }))
    });
  } catch (error: any) {
    logger.error('[Admin User Reviews API] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}
