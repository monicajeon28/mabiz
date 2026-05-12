export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  DEFAULT_PASSPORT_TEMPLATE_BODY,
  sanitizeLegacyTemplateBody,
} from '@/app/api/admin/passport-request/_utils';
import { requirePartnerContext } from '@/app/api/partner/_utils';

const templateSelect = {
  id: true,
  title: true,
  body: true,
  isDefault: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET() {
  try {
    await requirePartnerContext();

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
  } catch (error) {
    console.error('[PartnerPassportTemplates] GET error:', error);
    return NextResponse.json(
      { ok: false, message: '템플릿을 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}
