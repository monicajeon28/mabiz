import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * POST: 문서 승인 요청 제출
 * 상태: DRAFT -> SUBMITTED
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = ctx.organizationId;
    if (!orgId) {
      return NextResponse.json({ ok: false, message: '조직 정보 없음' }, { status: 400 });
    }

    const { documentId } = await req.json();
    if (!documentId) {
      return NextResponse.json({ ok: false, message: '문서 ID 필수' }, { status: 400 });
    }

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      return NextResponse.json({ ok: false, message: '문서를 찾을 수 없습니다' }, { status: 404 });
    }

    if (doc.organizationId !== orgId) {
      return NextResponse.json({ ok: false, message: '접근 권한 없음' }, { status: 403 });
    }

    if (doc.status !== 'DRAFT') {
      return NextResponse.json(
        { ok: false, message: '초안 상태만 제출 가능합니다' },
        { status: 400 }
      );
    }

    const updated = await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'SUBMITTED',
        updatedBy: ctx.userId,
      },
      include: {
        versions: { orderBy: { versionNumber: 'desc' } },
        approvals: true,
      },
    });

    return NextResponse.json({
      ok: true,
      data: updated,
      message: '문서가 승인 대기 상태로 변경되었습니다',
    });
  } catch (err) {
    logger.error('[POST /api/documents/submit]', { err });
    return NextResponse.json({ ok: false, message: String(err) }, { status: 500 });
  }
}
