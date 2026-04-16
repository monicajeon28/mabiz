import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { searchParams } = new URL(req.url);
    const persona  = searchParams.get('persona');
    const category = searchParams.get('category');

    const patterns = await prisma.scriptPattern.findMany({
      where: {
        organizationId: orgId,
        status: 'APPROVED',
        ...(persona  ? { personaType: persona } : {}),
        ...(category ? { category }             : {}),
      },
      orderBy: [{ conversionRate: 'desc' }, { extractedAt: 'desc' }],
      take: 50,
    });

    return NextResponse.json({ ok: true, patterns });
  } catch (e) {
    logger.log('[Patterns] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
