export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requirePartnerContext } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';
import {
  getB2BProspects,
  createB2BProspect,
} from '@/lib/b2b/service';
import {
  B2BProspectCreateSchema,
} from '@/lib/b2b/validation';

export async function GET(req: Request) {
  try {
    const ctx = await requirePartnerContext();
    if (!ctx) return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 403 });

    if (!ctx.organizationId) {
      logger.error('[b2b] organizationId 없음', { userId: ctx.sessionUser?.id });
      return NextResponse.json({ ok: false, error: '조직 정보 없음. 관리자에게 문의하세요.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)));
    const eduType = searchParams.get('eduType') || undefined;
    const status = searchParams.get('status') || undefined;
    const q = searchParams.get('q') || undefined;

    const result = await getB2BProspects(ctx.organizationId, {
      page,
      limit,
      eduType: eduType || undefined,
      status: status || undefined,
      q: q || undefined,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    logger.error('[b2b] GET /api/b2b error', { err });
    return NextResponse.json(
      { ok: false, error: '목록 조회에 실패했습니다' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requirePartnerContext();
    if (!ctx) return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 403 });

    if (!ctx.organizationId) {
      logger.error('[b2b] organizationId 없음', { userId: ctx.sessionUser?.id });
      return NextResponse.json({ ok: false, error: '조직 정보 없음' }, { status: 403 });
    }

    const body = await req.json();

    // Validate input
    const parseResult = B2BProspectCreateSchema.safeParse(body);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return NextResponse.json(
        { ok: false, error: `검증 오류: ${errors}` },
        { status: 400 }
      );
    }

    const result = await createB2BProspect(ctx.organizationId, parseResult.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    if (err.code === 'DUPLICATE_PROSPECT') {
      return NextResponse.json(
        { ok: false, error: '같은 조직에 이미 존재하는 전화번호입니다' },
        { status: 409 }
      );
    }

    logger.error('[b2b] POST /api/b2b error', { err });
    return NextResponse.json(
      { ok: false, error: '생성에 실패했습니다' },
      { status: 500 }
    );
  }
}
