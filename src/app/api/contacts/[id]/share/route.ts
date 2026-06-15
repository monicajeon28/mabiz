import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

/**
 * POST /api/contacts/[id]/share
 * Contact 공유: createdBy=자신 또는 ADMIN 권한 필요
 * 요청: { sharedTo: "user_id" }
 * 응답: { ok: true, message: '공유되었습니다' }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;
    const body = await req.json();
    const { sharedTo } = body;

    if (!sharedTo || typeof sharedTo !== 'string') {
      return NextResponse.json(
        { ok: false, message: 'sharedTo 사용자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // Contact 조회
    const contact = await prisma.contact.findUnique({
      where: { id },
      select: { id: true, organizationId: true, createdBy: true, visibility: true },
    });

    if (!contact) {
      return NextResponse.json(
        { ok: false, message: '고객이 없습니다.' },
        { status: 404 }
      );
    }

    // 권한 체크: createdBy=자신 또는 GLOBAL_ADMIN
    if (ctx.role !== 'GLOBAL_ADMIN' && contact.createdBy !== ctx.userId) {
      return NextResponse.json(
        { ok: false, message: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    // ADMIN_ONLY Contact는 공유 불가
    if (contact.visibility === 'ADMIN_ONLY') {
      return NextResponse.json(
        { ok: false, message: '관리자 전용 DB는 공유할 수 없습니다.' },
        { status: 403 }
      );
    }

    // 이미 공유된 경우 체크
    const existing = await prisma.contactSharing.findUnique({
      where: {
        contactId_sharedBy_sharedTo: {
          contactId: id,
          sharedBy: ctx.userId,
          sharedTo,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { ok: false, message: '이미 공유되었습니다.' },
        { status: 400 }
      );
    }

    // ContactSharing 생성
    await prisma.contactSharing.create({
      data: {
        contactId: id,
        sharedBy: ctx.userId,
        sharedTo,
      },
    });

    logger.log('[POST /api/contacts/[id]/share]', { contactId: id, sharedTo, sharedBy: ctx.userId });
    return NextResponse.json({ ok: true, message: '공유되었습니다.' });
  } catch (err) {
    logger.error('[POST /api/contacts/[id]/share]', { err });
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, message: '인증이 필요합니다' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, message: '서버 오류' }, { status: 500 });
  }
}

/**
 * DELETE /api/contacts/[id]/share
 * Contact 공유 취소
 * 쿼리: ?sharedTo=user_id
 * 응답: { ok: true, message: '공유가 취소되었습니다' }
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const sharedTo = searchParams.get('sharedTo');

    if (!sharedTo || typeof sharedTo !== 'string') {
      return NextResponse.json(
        { ok: false, message: 'sharedTo 사용자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // Contact 조회
    const contact = await prisma.contact.findUnique({
      where: { id },
      select: { id: true, createdBy: true },
    });

    if (!contact) {
      return NextResponse.json(
        { ok: false, message: '고객이 없습니다.' },
        { status: 404 }
      );
    }

    // 권한 체크: createdBy=자신 또는 GLOBAL_ADMIN
    if (ctx.role !== 'GLOBAL_ADMIN' && contact.createdBy !== ctx.userId) {
      return NextResponse.json(
        { ok: false, message: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    // ContactSharing 삭제
    const result = await prisma.contactSharing.deleteMany({
      where: {
        contactId: id,
        sharedBy: ctx.userId,
        sharedTo,
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { ok: false, message: '공유 기록이 없습니다.' },
        { status: 404 }
      );
    }

    logger.log('[DELETE /api/contacts/[id]/share]', { contactId: id, sharedTo, sharedBy: ctx.userId });
    return NextResponse.json({ ok: true, message: '공유가 취소되었습니다.' });
  } catch (err) {
    logger.error('[DELETE /api/contacts/[id]/share]', { err });
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, message: '인증이 필요합니다' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, message: '서버 오류' }, { status: 500 });
  }
}
