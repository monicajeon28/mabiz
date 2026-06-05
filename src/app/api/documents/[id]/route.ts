import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * GET: 문서 상세 정보 + 버전 + 승인 이력
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    const orgId = ctx.organizationId;
    if (!orgId) {
      return NextResponse.json({ ok: false, message: '조직 정보 없음' }, { status: 400 });
    }

    const { id } = await params;

    const doc = await prisma.document.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { versionNumber: 'desc' } },
        approvals: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!doc) {
      return NextResponse.json({ ok: false, message: '문서를 찾을 수 없습니다' }, { status: 404 });
    }

    if (doc.organizationId !== orgId) {
      return NextResponse.json({ ok: false, message: '접근 권한 없음' }, { status: 403 });
    }

    return NextResponse.json({ ok: true, data: doc });
  } catch (err) {
    logger.error('[GET /api/documents/:id]', { err });
    return NextResponse.json({ ok: false, message: '처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * PATCH: 문서 정보 수정 (DRAFT 상태만)
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    const orgId = ctx.organizationId;
    if (!orgId) {
      return NextResponse.json({ ok: false, message: '조직 정보 없음' }, { status: 400 });
    }

    const { id } = await params;
    const { title, description, category, contactId } = await req.json();

    const doc = await prisma.document.findUnique({
      where: { id },
    });

    if (!doc) {
      return NextResponse.json({ ok: false, message: '문서를 찾을 수 없습니다' }, { status: 404 });
    }

    if (doc.organizationId !== orgId) {
      return NextResponse.json({ ok: false, message: '접근 권한 없음' }, { status: 403 });
    }

    if (doc.status !== 'DRAFT') {
      return NextResponse.json(
        { ok: false, message: '초안 상태만 수정 가능합니다' },
        { status: 400 }
      );
    }

    const updated = await prisma.document.update({
      where: { id },
      data: {
        title: title ?? doc.title,
        description: description ?? doc.description,
        category: category ?? doc.category,
        contactId: contactId ?? doc.contactId,
        updatedBy: ctx.userId,
      },
      include: {
        versions: { orderBy: { versionNumber: 'desc' } },
        approvals: true,
      },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    logger.error('[PATCH /api/documents/:id]', { err });
    return NextResponse.json({ ok: false, message: '처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * DELETE: 문서 삭제 (DRAFT, REJECTED 상태만)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    const orgId = ctx.organizationId;
    if (!orgId) {
      return NextResponse.json({ ok: false, message: '조직 정보 없음' }, { status: 400 });
    }

    const { id } = await params;

    const doc = await prisma.document.findUnique({
      where: { id },
    });

    if (!doc) {
      return NextResponse.json({ ok: false, message: '문서를 찾을 수 없습니다' }, { status: 404 });
    }

    if (doc.organizationId !== orgId) {
      return NextResponse.json({ ok: false, message: '접근 권한 없음' }, { status: 403 });
    }

    if (!['DRAFT', 'REJECTED'].includes(doc.status)) {
      return NextResponse.json(
        { ok: false, message: '초안 또는 거부된 상태만 삭제 가능합니다' },
        { status: 400 }
      );
    }

    await prisma.document.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true, message: '문서가 삭제되었습니다' });
  } catch (err) {
    logger.error('[DELETE /api/documents/:id]', { err });
    return NextResponse.json({ ok: false, message: '처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
