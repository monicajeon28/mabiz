export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

// GET /api/tools/call-logs?limit=20&driveOnly=true
// 최근 콜 로그 목록 (성약 여부 표시 포함)
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
    }
    const orgId = resolveOrgId(ctx);
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50);
    const driveOnly = searchParams.get('driveOnly') === 'true';

    const logs = await prisma.aiCallLog.findMany({
      where: {
        organizationId: orgId,
        analysisStatus: 'DONE',
        ...(driveOnly ? { driveFileId: { not: null } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        agentUserId: true,
        agentLastName: true,
        productType: true,
        personaType: true,
        converted: true,
        driveFileId: true,
        createdAt: true,
        analysis: {
          select: {
            customerSegmentDetected: true,
            scores: true,
          },
        },
      },
    });

    return NextResponse.json({ ok: true, logs });
  } catch (e) {
    logger.error('[call-logs GET]', { e });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
