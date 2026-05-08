export const dynamic = 'force-dynamic';

// app/api/admin/itinerary-groups/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { checkAdminAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { validateCsrfToken } from '@/lib/csrf';

// 그룹 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const groups = await prisma.itineraryGroup.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return NextResponse.json({ ok: true, groups });
  } catch (error) {
    logger.error('[Itinerary Groups GET] 그룹 목록 로드 실패', error);
    return NextResponse.json({ ok: false, error: '그룹 목록을 불러오는데 실패했습니다.' }, { status: 500 });
  }
}

// 새 그룹 저장
export async function POST(request: NextRequest) {
  try {
    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const csrfTokenFromCookie = cookieStore.get('csrf-token')?.value;
    const csrfTokenFromHeader = request.headers.get('x-csrf-token');
    if (!validateCsrfToken(csrfTokenFromCookie, csrfTokenFromHeader)) {
      return NextResponse.json({ ok: false, error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, itinerary } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ ok: false, error: '그룹 이름을 입력해주세요.' }, { status: 400 });
    }

    if (!itinerary || !Array.isArray(itinerary)) {
      return NextResponse.json({ ok: false, error: '일정 데이터가 올바르지 않습니다.' }, { status: 400 });
    }

    const group = await prisma.itineraryGroup.create({
      data: {
        name: name.trim(),
        description: description || `${itinerary.length}일 일정`,
        itinerary: itinerary as never
      }
    });

    return NextResponse.json({
      ok: true,
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt
      }
    });
  } catch (error) {
    logger.error('[Itinerary Groups POST] 그룹 저장 실패', error);
    return NextResponse.json({ ok: false, error: '그룹 저장에 실패했습니다.' }, { status: 500 });
  }
}
