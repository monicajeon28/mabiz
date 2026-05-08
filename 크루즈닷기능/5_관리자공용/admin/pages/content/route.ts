export const dynamic = 'force-dynamic';

// app/api/admin/pages/content/route.ts
// 페이지 콘텐츠 관리 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sid) return false;

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { role: true },
        },
      },
    });

    return session?.User?.role === 'admin';
  } catch (error) {
    console.error('[Admin Pages Content] Auth check error:', error);
    return false;
  }
}

// GET: 페이지 콘텐츠 조회
export async function GET(req: NextRequest) {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const pagePath = searchParams.get('pagePath');
    const section = searchParams.get('section');

    const where: any = { isActive: true };
    if (pagePath) where.pagePath = pagePath;
    if (section) where.section = section;

    try {
      const contents = await (prisma as any).pageContent.findMany({
        where,
        orderBy: [{ pagePath: 'asc' }, { section: 'asc' }, { order: 'asc' }],
      });

      return NextResponse.json({ ok: true, contents });
    } catch (dbError: any) {
      console.error('[API] Database error:', dbError);
      console.error('[API] Prisma type:', typeof prisma);
      console.error('[API] Prisma keys:', Object.keys(prisma || {}).slice(0, 20));
      throw dbError;
    }
  } catch (error: any) {
    console.error('[API] Error fetching page content:', error);
    console.error('[API] Error stack:', error.stack);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch content' },
      { status: 500 }
    );
  }
}

// POST: 페이지 콘텐츠 생성
export async function POST(req: NextRequest) {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { pagePath, section, itemId, contentType, content, order } = body;

    if (!pagePath || !section || !contentType || !content) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    try {
      const pageContent = await (prisma as any).pageContent.create({
        data: {
          pagePath,
          section,
          itemId: itemId || null,
          contentType,
          content,
          order: order || 0,
        },
      });

      return NextResponse.json({ ok: true, content: pageContent });
    } catch (dbError: any) {
      console.error('[API] Database error:', dbError);
      console.error('[API] Prisma type:', typeof prisma);
      console.error('[API] Prisma keys:', Object.keys(prisma || {}).slice(0, 20));
      throw dbError;
    }
  } catch (error: any) {
    console.error('[API] Error creating page content:', error);
    console.error('[API] Error stack:', error.stack);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to create content' },
      { status: 500 }
    );
  }
}

// PUT: 페이지 콘텐츠 수정
export async function PUT(req: NextRequest) {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, contentType, content, order, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Missing id' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (contentType !== undefined) updateData.contentType = contentType;
    if (content !== undefined) updateData.content = content;
    if (order !== undefined) updateData.order = order;
    if (isActive !== undefined) updateData.isActive = isActive;

    const pageContent = await (prisma as any).pageContent.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ ok: true, content: pageContent });
  } catch (error: any) {
    console.error('[API] Error updating page content:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to update content' },
      { status: 500 }
    );
  }
}

// DELETE: 페이지 콘텐츠 삭제
export async function DELETE(req: NextRequest) {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Missing id' },
        { status: 400 }
      );
    }

    await (prisma as any).pageContent.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ ok: true, message: 'Content deleted' });
  } catch (error: any) {
    console.error('[API] Error deleting page content:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to delete content' },
      { status: 500 }
    );
  }
}
