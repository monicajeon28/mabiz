export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

const SESSION_COOKIE = 'cg.sid.v2';

async function checkAdminAuth() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return null;
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { User: true },
    });

    if (session && session.User.role === 'admin') {
      return session.User;
    }
  } catch (error) {
    logger.error('[Admin Auth] Error:', error);
  }

  return null;
}

/**
 * GET: 히어로 배너 목록 조회 (공개 API)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const section = searchParams.get('section') || 'hero-banner';

    const contents = await prisma.mallContent.findMany({
      where: {
        section,
        isActive: true,
      },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json({
      ok: true,
      banners: contents.map((content) => ({
        id: content.id,
        ...(content.content as any),
        order: content.order,
      })),
    });
  } catch (error: any) {
    logger.error('[Hero Banner API] GET Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch banners' },
      { status: 500 }
    );
  }
}

/**
 * POST: 히어로 배너 생성
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { image, title, subtitle, button1Text, button1Link, button2Text, button2Link, order } = body;

    if (!image) {
      return NextResponse.json(
        { ok: false, error: '이미지는 필수입니다.' },
        { status: 400 }
      );
    }

    // 기존 배너 개수 확인하여 order 설정
    const existingCount = await prisma.mallContent.count({
      where: { section: 'hero-banner' },
    });

    const content = await prisma.mallContent.create({
      data: {
        section: 'hero-banner',
        key: `banner-${Date.now()}`,
        type: 'banner',
        content: {
          image,
          title: title || '',
          subtitle: subtitle || '',
          button1Text: button1Text || '',
          button1Link: button1Link || '',
          button2Text: button2Text || '',
          button2Link: button2Link || '',
        },
        order: order !== undefined ? order : existingCount,
        isActive: true,
      },
    });

    return NextResponse.json({
      ok: true,
      banner: {
        id: content.id,
        ...(content.content as any),
        order: content.order,
      },
    });
  } catch (error: any) {
    logger.error('[Hero Banner API] POST Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to create banner' },
      { status: 500 }
    );
  }
}

/**
 * PUT: 히어로 배너 수정
 */
export async function PUT(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, image, title, subtitle, button1Text, button1Link, button2Text, button2Link, order } = body;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: '배너 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const content = await prisma.mallContent.update({
      where: { id },
      data: {
        content: {
          image: image || '',
          title: title || '',
          subtitle: subtitle || '',
          button1Text: button1Text || '',
          button1Link: button1Link || '',
          button2Text: button2Text || '',
          button2Link: button2Link || '',
        },
        ...(order !== undefined && { order }),
      },
    });

    return NextResponse.json({
      ok: true,
      banner: {
        id: content.id,
        ...(content.content as any),
        order: content.order,
      },
    });
  } catch (error: any) {
    logger.error('[Hero Banner API] PUT Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to update banner' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: 히어로 배너 삭제
 */
export async function DELETE(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { ok: false, error: '배너 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    await prisma.mallContent.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({
      ok: true,
      message: '배너가 삭제되었습니다.',
    });
  } catch (error: any) {
    logger.error('[Hero Banner API] DELETE Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to delete banner' },
      { status: 500 }
    );
  }
}
