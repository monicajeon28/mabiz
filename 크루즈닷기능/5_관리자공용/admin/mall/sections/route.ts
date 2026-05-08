export const dynamic = 'force-dynamic';

// app/api/admin/mall/sections/route.ts
// 메인페이지 섹션 관리 API

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
 * GET: 섹션 목록 조회
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const section = searchParams.get('section') || 'main-page';

    const contents = await prisma.mallContent.findMany({
      where: {
        section,
        isActive: true,
      },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json({
      ok: true,
      sections: contents.map((content) => ({
        id: content.id,
        section: content.section,
        key: content.key,
        type: content.type,
        content: content.content as any,
        order: content.order,
        isActive: content.isActive,
      })),
    });
  } catch (error: any) {
    logger.error('[Sections API] GET Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '섹션을 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST: 섹션 생성
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { section, key, type, content, order, isActive } = body;

    if (!section || !key || !type) {
      return NextResponse.json(
        { ok: false, error: 'section, key, type은 필수입니다.' },
        { status: 400 }
      );
    }

    // 기존 섹션 개수 확인하여 order 설정
    const existingCount = await prisma.mallContent.count({
      where: { section: 'main-page' },
    });

    const created = await prisma.mallContent.create({
      data: {
        section: section || 'main-page',
        key,
        type,
        content: content || {},
        order: order !== undefined ? order : existingCount,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json({
      ok: true,
      section: {
        id: created.id,
        section: created.section,
        key: created.key,
        type: created.type,
        content: created.content as any,
        order: created.order,
        isActive: created.isActive,
      },
    });
  } catch (error: any) {
    logger.error('[Sections API] POST Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '섹션 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
