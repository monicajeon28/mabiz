export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  DEFAULT_PASSPORT_TEMPLATE_BODY,
  requireAdminUser,
  sanitizeLegacyTemplateBody,
} from '../_utils';

export async function GET() {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
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
      isDefault: true,
      updatedById: true,
      createdAt: true,
      updatedAt: true,
    } as const;

    let templates = await prisma.passportRequestTemplate.findMany({
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      select: templateSelect,
    });

    templates = await Promise.all(
      templates.map(async (template) => {
        const sanitizedBody = sanitizeLegacyTemplateBody(template.body);
        if (sanitizedBody !== template.body) {
          return prisma.passportRequestTemplate.update({
            where: { id: template.id },
            data: { body: sanitizedBody },
            select: templateSelect,
          });
        }
        return template;
      })
    );

    if (templates.length === 0) {
      const created = await prisma.passportRequestTemplate.create({
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
        variables: null,
        isDefault: template.isDefault,
        updatedById: template.updatedById,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error('[PassportRequest] GET /templates error:', error);
    console.error('[PassportRequest] Error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });
    return NextResponse.json(
      { 
        ok: false, 
        message: '템플릿을 불러올 수 없습니다.',
        error: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    );
  }
}
