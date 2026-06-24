import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, buildContactWhere } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10), 1000);

    // 격리: AGENT는 본인 고객(배정/작성/공유) 태그만 집계.
    // OWNER=조직전체, GLOBAL_ADMIN=전체 (buildContactWhere가 자동 보존).
    // deletedAt:null도 buildContactWhere가 포함.
    const contacts = await prisma.contact.findMany({
      where: buildContactWhere(ctx),
      select: { tags: true },
    });

    const tagSet = new Set<string>();
    for (const c of contacts) {
      for (const t of c.tags) {
        if (t) tagSet.add(t);
      }
    }

    const tags = Array.from(tagSet).sort().slice(0, limit);

    logger.log('[GET /api/contacts/tags]', { role: ctx.role, count: tags.length });
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
