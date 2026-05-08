export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { validateCsrfAndRespond } from '@/lib/api-utils';

// GET: 팝업 목록 (관리자)
export async function GET() {
  try {
    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) return NextResponse.json({ ok: false, error: '관리자만 접근 가능합니다.' }, { status: 403 });

    const popups = await prisma.mallPopup.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ ok: true, popups });
  } catch (error: unknown) {
    logger.error('[Admin Popups GET]', { message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ ok: false, error: '조회 실패' }, { status: 500 });
  }
}

// POST: 팝업 생성
export async function POST(req: NextRequest) {
  try {
    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) return NextResponse.json({ ok: false, error: '관리자만 접근 가능합니다.' }, { status: 403 });

    const csrfCheck = validateCsrfAndRespond(req, 'Admin Popups POST');
    if (!csrfCheck.valid) return csrfCheck.response!;

    const body = await req.json();
    const { title, description, imageUrl, linkUrl, sortOrder, isActive, startAt, endAt } = body;

    // 최대 3개 제한 확인
    const count = await prisma.mallPopup.count({ where: { deletedAt: null } });
    if (count >= 3) {
      return NextResponse.json({ ok: false, error: '팝업은 최대 3개까지 등록 가능합니다.' }, { status: 400 });
    }

    const popup = await prisma.mallPopup.create({
      data: {
        title: String(title || '').slice(0, 100),
        description: description ? String(description).slice(0, 500) : null,
        imageUrl: imageUrl ? String(imageUrl).slice(0, 500) : null,
        linkUrl: linkUrl ? String(linkUrl).slice(0, 500) : null,
        sortOrder: Number(sortOrder) || 0,
        isActive: Boolean(isActive ?? true),
        startAt: startAt ? new Date(startAt) : null,
        endAt: endAt ? new Date(endAt) : null,
      },
    });

    return NextResponse.json({ ok: true, popup });
  } catch (error: unknown) {
    logger.error('[Admin Popups POST]', { message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ ok: false, error: '생성 실패' }, { status: 500 });
  }
}
