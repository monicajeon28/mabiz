/**
 * API 6: GET /api/trust-score/{userId}/audit-logs
 * 신뢰도 기록 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = params.userId;
    const searchParams = req.nextUrl.searchParams;
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100);
    const offset = Number(searchParams.get('offset')) || 0;
    const eventType = searchParams.get('eventType');

    // 권한 확인: 본인 또는 관리자만
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json(
        { error: '권한 없음', code: 'UNAUTHORIZED' },
        { status: 403 }
      );
    }

    const isOwner = session.userId === userId;
    const isAdmin = session.role === 'OWNER';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: '권한 없음', code: 'UNAUTHORIZED' },
        { status: 403 }
      );
    }

    // 로그 조회
    const where: any = { userId };
    if (eventType) {
      where.eventType = eventType;
    }

    const [logs, total] = await Promise.all([
      (prisma as any).trustAuditLog?.findMany?.({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      (prisma as any).trustAuditLog?.count?.({ where }),
    ]);

    return NextResponse.json(
      {
        total,
        limit,
        offset,
        logs: (logs || []).map((log: any) => ({
          id: log.id,
          eventType: log.eventType,
          description: log.description,
          previousValue: log.previousValue,
          newValue: log.newValue,
          triggeredBy: log.triggeredBy,
          createdAt: log.createdAt.toISOString(),
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] 기록 조회 실패:', error);
    return NextResponse.json(
      { error: '서버 오류', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
