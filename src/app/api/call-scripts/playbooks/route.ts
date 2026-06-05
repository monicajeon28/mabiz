import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!['OWNER', 'GLOBAL_ADMIN', 'AGENT'].includes(session.role ?? '')) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || undefined;
    const segment = searchParams.get('segment') || undefined;
    const tab = searchParams.get('tab') || undefined;

    const scripts = await prisma.salesPlaybook.findMany({
      where: {
        isActive: true,
        ...(type ? { type } : {}),
        ...(segment ? { customerSegment: segment } : {}),
        ...(tab ? { scriptTab: tab } : {}),
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      take: 200,
      select: {
        id: true,
        type: true,
        title: true,
        content: true,
        priority: true,
        scriptTab: true,
        customerSegment: true,
        pasonaStage: true,
        psychology: true,
      },
    });

    return NextResponse.json({ ok: true, scripts, total: scripts.length });
  } catch (error) {
    logger.error('[GET /api/call-scripts/playbooks]', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
