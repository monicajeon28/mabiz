import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10), 1000);

    const contacts = await prisma.contact.findMany({
      where: { organizationId: orgId },
      select: { tags: true },
    });

    const tagSet = new Set<string>();
    for (const c of contacts) {
      for (const t of c.tags) {
        if (t) tagSet.add(t);
      }
    }

    const tags = Array.from(tagSet).sort().slice(0, limit);

    logger.log('[GET /api/contacts/tags]', { orgId, count: tags.length });
    return NextResponse.json({ ok: true, tags });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    logger.error('[GET /api/contacts/tags]', { error: msg });
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
