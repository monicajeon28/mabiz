export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

const CONFIG_KEY_PREFIX = 'B2B_LANDING_TEMPLATE';

function buildConfigKey(partnerId?: string | null): string {
  return partnerId ? `${CONFIG_KEY_PREFIX}_${partnerId}` : CONFIG_KEY_PREFIX;
}

/**
 * GET /api/b2b/templates?partnerId=xxx
 * - partnerId 없으면 전역 템플릿 조회
 * - partnerId 있으면 파트너별 템플릿 조회
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const partnerId = searchParams.get('partnerId');
    const configKey = buildConfigKey(partnerId);

    const config = await prisma.systemConfig.findUnique({
      where: { configKey },
    });

    return NextResponse.json({
      ok: true,
      config: config
        ? {
            configKey: config.configKey,
            configValue: config.configValue,
            description: config.description,
            updatedAt: config.updatedAt,
          }
        : null,
      isGlobal: !partnerId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 });
    }
    logger.error('[B2B Templates API] GET Error:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * POST /api/b2b/templates
 * body: { partnerId?: string, htmlContent: string }
 * - partnerId 없으면 전역 템플릿 upsert
 * - partnerId 있으면 파트너별 템플릿 upsert
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await req.json();
    const { partnerId, htmlContent } = body as {
      partnerId?: string;
      htmlContent: string;
    };

    if (!htmlContent && htmlContent !== '') {
      return NextResponse.json(
        { ok: false, error: 'htmlContent 필드가 필요합니다.' },
        { status: 400 }
      );
    }

    const configKey = buildConfigKey(partnerId);
    const description = partnerId
      ? `B2B 랜딩페이지 템플릿 (파트너: ${partnerId})`
      : 'B2B 랜딩페이지 전역 기본 템플릿';

    const config = await prisma.systemConfig.upsert({
      where: { configKey },
      create: {
        configKey,
        configValue: htmlContent,
        description,
        category: 'b2b_landing',
        updatedAt: new Date(),
      },
      update: {
        configValue: htmlContent,
        updatedAt: new Date(),
      },
    });

    logger.info('[B2B Templates API] Template saved:', {
      configKey,
      isGlobal: !partnerId,
      userId: ctx.userId,
    });

    return NextResponse.json({
      ok: true,
      message: partnerId
        ? '파트너 개별 템플릿이 저장되었습니다.'
        : '전역 기본 템플릿이 저장되었습니다.',
      config: {
        configKey: config.configKey,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 });
    }
    logger.error('[B2B Templates API] POST Error:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * DELETE /api/b2b/templates?partnerId=xxx
 * 파트너별 개별 템플릿 삭제 (전역 템플릿으로 복귀)
 */
export async function DELETE(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const partnerId = searchParams.get('partnerId');

    if (!partnerId) {
      return NextResponse.json(
        { ok: false, error: '전역 템플릿은 삭제할 수 없습니다. partnerId를 지정하세요.' },
        { status: 400 }
      );
    }

    const configKey = buildConfigKey(partnerId);

    await prisma.systemConfig.deleteMany({
      where: { configKey },
    });

    logger.info('[B2B Templates API] Partner template deleted:', {
      configKey,
      partnerId,
      userId: ctx.userId,
    });

    return NextResponse.json({
      ok: true,
      message: '파트너 개별 템플릿이 삭제되었습니다. 전역 템플릿이 적용됩니다.',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 });
    }
    logger.error('[B2B Templates API] DELETE Error:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
