/**
 * GET /api/contacts/[id]/integrated-360
 * Contact 통합 360도 뷰 조회 (모든 데이터 + 캐싱)
 */

import { NextResponse } from 'next/server';
import { getAuthContext, buildContactWhere } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { getContact360, invalidateContact360Cache } from '@/lib/contact-integrator';
import { applyMaskingPolicy } from '@/lib/contact-integrator/pii-mask';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/contacts/[id]/integrated-360
 */
export async function GET(_req: Request, { params }: Params) {
  const startTime = Date.now();

  try {
    const ctx = await getAuthContext();
    const { id } = await params;

    // 권한 검증
    const where = buildContactWhere(ctx, { id });
    if (!(where as Record<string, unknown>).id) {
      return NextResponse.json(
        { ok: false, error: 'Contact not found' },
        { status: 404 }
      );
    }

    // 360도 뷰 조회 (캐시 포함)
    const contact360 = await getContact360(id, ctx.organizationId ?? '');

    // PII 마스킹 적용 (역할 기반)
    const masked = await applyMaskingPolicy(contact360, ctx.role, ctx.organizationId ?? '');

    // 응답 시간 로깅
    const responseTime = Date.now() - startTime;
    logger.info('[GET /api/contacts/[id]/integrated-360] Success', {
      contactId: id,
      responseTime,
      cacheSource: masked.metadata.cacheInfo.source
    });

    return NextResponse.json(
      {
        ok: true,
        data: masked,
        metadata: {
          responseTime,
          cacheSource: masked.metadata.cacheInfo.source
        }
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=300', // 5분 클라이언트 캐시
          'X-Response-Time': `${responseTime}ms`
        }
      }
    );
  } catch (err) {
    logger.error('[GET /api/contacts/[id]/integrated-360] Error', { err });

    const statusCode = err instanceof Error && err.message.includes('not found') ? 404 : 500;
    return NextResponse.json(
      {
        ok: false,
        error: '서버 오류가 발생했습니다.'
      },
      { status: statusCode }
    );
  }
}

/**
 * POST /api/contacts/[id]/integrated-360/invalidate
 * 캐시 무효화 (Contact 업데이트 시)
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;

    // GLOBAL_ADMIN 권한만 허용
    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 캐시 무효화
    await invalidateContact360Cache(id, ctx.organizationId ?? '');

    logger.info('[POST /api/contacts/[id]/integrated-360/invalidate] Success', {
      contactId: id
    });

    return NextResponse.json({
      ok: true,
      message: 'Cache invalidated'
    });
  } catch (err) {
    logger.error('[POST /api/contacts/[id]/integrated-360/invalidate] Error', { err });
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
