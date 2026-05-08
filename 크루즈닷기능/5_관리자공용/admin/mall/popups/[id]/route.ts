export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { validateCsrfAndRespond, parseIdParam } from '@/lib/api-utils';

// PATCH: 팝업 수정
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) return NextResponse.json({ ok: false, error: '관리자만 접근 가능합니다.' }, { status: 403 });

    const csrfCheck = validateCsrfAndRespond(req, 'Admin Popups PATCH');
    if (!csrfCheck.valid) return csrfCheck.response!;

    const { id } = await params;
    const idCheck = parseIdParam(id, '유효한 팝업 ID가 아닙니다.');
    if (!idCheck.valid) return idCheck.response!;

    const body = await req.json();
    const { title, description, imageUrl, linkUrl, sortOrder, isActive, startAt, endAt } = body;

    const popup = await prisma.mallPopup.update({
      where: { id: idCheck.id! },
      data: {
        ...(title !== undefined && { title: String(title).slice(0, 100) }),
        ...(description !== undefined && { description: description ? String(description).slice(0, 500) : null }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl ? String(imageUrl).slice(0, 500) : null }),
        ...(linkUrl !== undefined && { linkUrl: linkUrl ? String(linkUrl).slice(0, 500) : null }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(startAt !== undefined && { startAt: startAt ? new Date(startAt) : null }),
        ...(endAt !== undefined && { endAt: endAt ? new Date(endAt) : null }),
      },
    });

    return NextResponse.json({ ok: true, popup });
  } catch (error: unknown) {
    logger.error('[Admin Popups PATCH]', { message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ ok: false, error: '수정 실패' }, { status: 500 });
  }
}

// DELETE: 팝업 삭제 (소프트 삭제)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) return NextResponse.json({ ok: false, error: '관리자만 접근 가능합니다.' }, { status: 403 });

    const csrfCheck = validateCsrfAndRespond(req, 'Admin Popups DELETE');
    if (!csrfCheck.valid) return csrfCheck.response!;

    const { id } = await params;
    const idCheck = parseIdParam(id, '유효한 팝업 ID가 아닙니다.');
    if (!idCheck.valid) return idCheck.response!;

    await prisma.mallPopup.update({
      where: { id: idCheck.id! },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    logger.error('[Admin Popups DELETE]', { message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ ok: false, error: '삭제 실패' }, { status: 500 });
  }
}
