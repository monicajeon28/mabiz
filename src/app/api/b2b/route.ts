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
    // P1: 보안 - 권한 검증 강화
    const ctx = await requirePartnerContext();
    if (!ctx) {
      logger.warn('[b2b] GET: 미인증 요청');
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 403 });
    }

    if (!ctx.organizationId) {
      logger.error('[b2b] GET: organizationId 없음', { userId: ctx.sessionUser?.id });
      return NextResponse.json({ ok: false, error: '조직 정보 없음. 관리자에게 문의하세요.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);

    // P1: 안정성 - 입력 검증 강화
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)));

    // 쿼리 파라미터 검증
    const eduType = searchParams.get('eduType');
    const status = searchParams.get('status');
    const q = searchParams.get('q');

    // eduType 검증
    if (eduType && !['BUYER', 'INQUIRER'].includes(eduType)) {
      logger.warn('[b2b] GET: 잘못된 eduType', { eduType });
      return NextResponse.json(
        { ok: false, error: 'eduType이 올바르지 않습니다' },
        { status: 400 }
      );
    }

    // P1: 성능 - 병렬 쿼리 실행 (getB2BProspects 내부에서 처리)
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
    // P1: 보안 - 권한 검증 강화
    const ctx = await requirePartnerContext();
    if (!ctx) {
      logger.warn('[b2b] POST: 미인증 요청');
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 403 });
    }

    if (!ctx.organizationId) {
      logger.error('[b2b] POST: organizationId 없음', { userId: ctx.sessionUser?.id });
      return NextResponse.json({ ok: false, error: '조직 정보 없음' }, { status: 403 });
    }

    let body;
    try {
      body = await req.json();
    } catch (err) {
      logger.warn('[b2b] POST: 잘못된 JSON 형식');
      return NextResponse.json(
        { ok: false, error: 'JSON 형식이 올바르지 않습니다' },
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = B2BProspectCreateSchema.safeParse(body);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      logger.warn('[b2b] POST: 검증 실패', { errors });
      return NextResponse.json(
        { ok: false, error: `검증 오류: ${errors}` },
        { status: 400 }
      );
    }

    // P1: 보안 - organizationId로 생성 (클라이언트 전달값 무시, IDOR 방지)
    const result = await createB2BProspect(ctx.organizationId, parseResult.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    if (err.code === 'DUPLICATE_PROSPECT') {
      logger.warn('[b2b] POST: 중복 prospect');
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
