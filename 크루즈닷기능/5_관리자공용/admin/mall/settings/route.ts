export const dynamic = 'force-dynamic';

// app/api/admin/mall/settings/route.ts
// 메인몰 전역 설정 API

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
 * GET: 메인몰 설정 조회
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const section = searchParams.get('section');

    const where: any = {
      section: section || { in: ['banner-management', 'product-display-settings', 'menu-bar-settings', 'recommended-below-settings'] },
    };

    const contents = await prisma.mallContent.findMany({
      where,
      orderBy: { order: 'asc' },
    });

    // 섹션별로 그룹화
    const settings: Record<string, any> = {};
    contents.forEach((content) => {
      if (!settings[content.section]) {
        settings[content.section] = [];
      }
      settings[content.section].push({
        id: content.id,
        key: content.key,
        ...(content.content as any),
        order: content.order,
        isActive: content.isActive,
      });
    });

    return NextResponse.json({
      ok: true,
      settings,
    });
  } catch (error: any) {
    logger.error('[Mall Settings API] GET Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '설정을 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST/PUT: 메인몰 설정 저장
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { section, key, content, order } = body;

    if (!section || !key) {
      return NextResponse.json(
        { ok: false, error: 'section과 key는 필수입니다.' },
        { status: 400 }
      );
    }

    // 기존 설정 확인
    const existing = await prisma.mallContent.findUnique({
      where: {
        section_key: {
          section,
          key,
        },
      },
    });

    if (existing) {
      // 업데이트
      const updated = await prisma.mallContent.update({
        where: { id: existing.id },
        data: {
          content: content || {},
          ...(order !== undefined && { order }),
        },
      });

      return NextResponse.json({
        ok: true,
        setting: {
          id: updated.id,
          section: updated.section,
          key: updated.key,
          ...(updated.content as any),
          order: updated.order,
        },
      });
    } else {
      // 생성
      const created = await prisma.mallContent.create({
        data: {
          section,
          key,
          type: 'settings',
          content: content || {},
          order: order || 0,
          isActive: true,
        },
      });

      return NextResponse.json({
        ok: true,
        setting: {
          id: created.id,
          section: created.section,
          key: created.key,
          ...(created.content as any),
          order: created.order,
        },
      });
    }
  } catch (error: any) {
    logger.error('[Mall Settings API] POST Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '설정 저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * PUT: 메인몰 설정 업데이트
 */
export async function PUT(req: NextRequest) {
  return POST(req); // POST와 동일한 로직 사용
}
