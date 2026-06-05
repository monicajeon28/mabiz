export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

// GET /api/partner/[id]/contacts — 파트너에 속한 고객 목록
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id: partnerId } = await params;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const limit = 20;
    const offset = (page - 1) * limit;

    // 권한 확인: 해당 조직의 파트너인지
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
    });

    if (!partner || partner.organizationId !== orgId) {
      return NextResponse.json({ ok: false, message: '접근 권한 없음' }, { status: 403 });
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where: {
          partnerId,
          organizationId: orgId,
          deletedAt: null,
        },
        include: {
          callLogs: {
            orderBy: { createdAt: 'desc' },
            take: 3,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.contact.count({
        where: {
          partnerId,
          organizationId: orgId,
          deletedAt: null,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      data: contacts,
      total,
      page,
      limit,
    });
  } catch (err) {
    logger.error('[GET /api/partner/[id]/contacts]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
