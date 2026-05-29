export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';
import { DEFAULT_PASSPORT_TEMPLATE_BODY } from '@/lib/passport-utils';

export async function GET() {
  try {
    const manager = await requireCrmManager();
    if (!manager) {
      return NextResponse.json({
        ok: false,
        message: '인증이 필요합니다. 다시 로그인해 주세요.',
        details: 'Admin authentication failed'
      }, { status: 403 });
    }

    const templateSelect = {
      id: true,
      title: true,
      body: true,
      variables: true,
      isDefault: true,
      updatedById: true,
      createdAt: true,
      updatedAt: true,
    } as const;

    // GET은 읽기 전용 — sanitize는 PUT/POST(저장) 시에만 수행
    let templates = await prisma.gmPassportRequestTemplate.findMany({
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      select: templateSelect,
    });

    if (templates.length === 0) {
      const created = await prisma.gmPassportRequestTemplate.create({
        data: {
          title: '여권 제출 안내',
          body: DEFAULT_PASSPORT_TEMPLATE_BODY,
          isDefault: true,
        },
        select: templateSelect,
      });
      templates = [created];
    }

    return NextResponse.json({
      ok: true,
      templates: templates.map((template) => ({
        id: template.id,
        title: template.title,
        body: template.body,
        variables: template.variables as Record<string, unknown> | null ?? null,
        isDefault: template.isDefault,
        updatedById: template.updatedById,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[PassportRequest] GET /templates error:', {
      message: err.message,
      stack: err.stack,
    });
    return NextResponse.json(
      { ok: false, message: '템플릿을 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}
