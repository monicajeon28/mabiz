export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

// GET /api/tools/call-upload-stats?timeRange=week|month|all
// 판매원별 통화 기록 통계 조회
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();

    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
    }

    // GLOBAL_ADMIN은 organizationId가 null일 수 있으며, 전체 조직 통계를 조회
    const orgId = ctx.organizationId ?? null;

    const url = new URL(req.url);
    const timeRange = url.searchParams.get('timeRange') ?? 'week';

    // 시간 범위 계산
    const now = new Date();
    let startDate = new Date();

    if (timeRange === 'week') {
      startDate.setDate(now.getDate() - 7);
    } else if (timeRange === 'month') {
      startDate.setMonth(now.getMonth() - 1);
    } else {
      // 'all': 365일
      startDate.setDate(now.getDate() - 365);
    }

    // AiCallLog 통계 조회 (organizationId가 null이면 전체 조직 조회)
    const callLogs = await prisma.aiCallLog.findMany({
      where: {
        ...(orgId ? { organizationId: orgId } : {}),
        uploadedAt: {
          gte: startDate,
          lte: now,
        },
      },
      include: {
        analysis: true,
      },
    });

    // 판매원별 그룹화
    const groupByAgent = new Map<string, (typeof callLogs)>();
    const memberCache = new Map<string, string>();

    for (const log of callLogs) {
      // 캐시에서 먼저 확인
      let agentName: string;
      if (memberCache.has(log.agentUserId)) {
        agentName = memberCache.get(log.agentUserId)!;
      } else {
        const member = await prisma.organizationMember.findUnique({
          where: { id: log.agentUserId },
          select: { displayName: true },
        });
        agentName = member?.displayName ?? log.agentUserId;
        memberCache.set(log.agentUserId, agentName);
      }

      if (!groupByAgent.has(agentName)) {
        groupByAgent.set(agentName, []);
      }
      groupByAgent.get(agentName)!.push(log);
    }

    // 통계 집계
    const totalConverted = callLogs.filter((l) => l.converted).length;
    const stats = {
      total: callLogs.length,
      converted: totalConverted,
      conversionRate: callLogs.length > 0
        ? Math.round((totalConverted / callLogs.length) * 100)
        : 0,
      byAgent: Array.from(groupByAgent.entries()).map(([agentName, logs]) => {
        const agentConverted = logs.filter((l) => l.converted).length;
        const objections: Record<string, number> = {};

        for (const log of logs) {
          if (log.analysis?.objectionTypes) {
            const objTypes = log.analysis.objectionTypes as unknown;
            if (Array.isArray(objTypes)) {
              for (const objType of objTypes) {
                const key = String(objType);
                objections[key] = (objections[key] ?? 0) + 1;
              }
            }
          }
        }

        return {
          agentName,
          total: logs.length,
          converted: agentConverted,
          conversionRate: logs.length > 0
            ? Math.round((agentConverted / logs.length) * 100)
            : 0,
          objections,
        };
      }),
      timeRange,
      periodStart: startDate.toISOString(),
      periodEnd: now.toISOString(),
    };

    return NextResponse.json({ ok: true, stats });
  } catch (err) {
    logger.error('[call-upload-stats] 오류', { err });
    return NextResponse.json({ ok: false, message: '통계 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
