import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/contacts/[id]/campaigns
 * Contact에게 발송된 캠페인 이력 조회 (SendingHistory 기반)
 */
export async function GET(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id: contactId } = await params;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 100);
    const page = Math.max(Number(searchParams.get('page') ?? '1'), 1);
    const skip = (page - 1) * limit;

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId: orgId },
      select: { id: true },
    });
    if (!contact) {
      return NextResponse.json({ ok: false, message: 'Contact not found' }, { status: 404 });
    }

    const [histories, total] = await Promise.all([
      prisma.sendingHistory.findMany({
        where: { contactId, organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          campaign: { select: { id: true, title: true, sendSms: true, sendEmail: true } },
        },
      }),
      prisma.sendingHistory.count({ where: { contactId, organizationId: orgId } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    logger.log('[GET /api/contacts/[id]/campaigns]', { contactId, orgId, page, total });

    return NextResponse.json({
      ok: true,
      histories,
      total,
      page,
      pageSize: limit,
      totalPages,
      hasMore: page < totalPages,
    });
  } catch (err) {
    logger.error('[GET /api/contacts/[id]/campaigns]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
