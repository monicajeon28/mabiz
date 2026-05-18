export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requirePartnerContext } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';
import {
  updateB2BProspect,
  deleteB2BProspect,
} from '@/lib/b2b/service';
import {
  B2BProspectUpdateSchema,
} from '@/lib/b2b/validation';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requirePartnerContext();
    if (!ctx) return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 403 });

    if (!ctx.organizationId) {
      logger.error('[b2b] organizationId 없음', { userId: ctx.sessionUser?.id });
      return NextResponse.json({ ok: false, error: '조직 정보 없음' }, { status: 403 });
    }

    const { id } = await params;
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'ID가 필요합니다' },
        { status: 400 }
      );
    }

    const body = await req.json();

    // Validate input
    const parseResult = B2BProspectUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return NextResponse.json(
        { ok: false, error: `검증 오류: ${errors}` },
        { status: 400 }
      );
    }

    const result = await updateB2BProspect(ctx.organizationId, id, parseResult.data);
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    if (err.code === 'PROSPECT_NOT_FOUND') {
      return NextResponse.json(
        { ok: false, error: '찾을 수 없는 prospect입니다' },
        { status: 404 }
      );
    }

    logger.error('[b2b] PATCH /api/b2b/[id] error', { err, id: params.id });
    return NextResponse.json(
      { ok: false, error: '업데이트에 실패했습니다' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requirePartnerContext();
    if (!ctx) return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 403 });

    if (!ctx.organizationId) {
      logger.error('[b2b] organizationId 없음', { userId: ctx.sessionUser?.id });
      return NextResponse.json({ ok: false, error: '조직 정보 없음' }, { status: 403 });
    }

    const { id } = await params;
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'ID가 필요합니다' },
        { status: 400 }
      );
    }

    const result = await deleteB2BProspect(ctx.organizationId, id);
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    if (err.code === 'PROSPECT_NOT_FOUND') {
      return NextResponse.json(
        { ok: false, error: '찾을 수 없는 prospect입니다' },
        { status: 404 }
      );
    }

    logger.error('[b2b] DELETE /api/b2b/[id] error', { err, id: params.id });
    return NextResponse.json(
      { ok: false, error: '삭제에 실패했습니다' },
      { status: 500 }
    );
  }
}
