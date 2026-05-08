export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin, AdminAuthError } from '@/lib/auth/requireAdmin';
import type { Prisma } from '@prisma/client';
import { ChatBotStats, SessionPathStat, SessionPathStep } from './types';

type AggregatedRow = {
  questionId: number;
  questionOrder: number | null;
  questionText: string;
  totalResponses: bigint;
  abandonedResponses: bigint;
  averageResponseTimeMs: number | null;
};

const parseDateParam = (value: string | null): Date | undefined => {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const searchParams = req.nextUrl.searchParams;
    const flowIdParam = searchParams.get('flowId');
    const productCodeParam = searchParams.get('productCode');
    const statusParam = searchParams.get('status'); // COMPLETED, ABANDONED, ONGOING
    const fromParam = parseDateParam(searchParams.get('from'));
    const toParam = parseDateParam(searchParams.get('to'));

    const sessionWhere: any = {};

    if (flowIdParam) {
      sessionWhere.flowId = parseInt(flowIdParam, 10);
    }
    if (productCodeParam) {
      sessionWhere.productCode = productCodeParam.toUpperCase();
    }
    if (statusParam) {
      sessionWhere.finalStatus = statusParam;
    }
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (fromParam) dateFilter.gte = fromParam;
    if (toParam) dateFilter.lte = toParam;
    if (Object.keys(dateFilter).length > 0) {
      sessionWhere.startedAt = dateFilter;
    }

    const sessions = await prisma.chatBotSession.findMany({
      where: sessionWhere,
      select: {
        sessionId: true,
        isCompleted: true,
        finalStatus: true,
        paymentStatus: true,
        paymentAttemptedAt: true,
        paymentCompletedAt: true,
        paymentOrderId: true,
        startedAt: true,
        endedAt: true,
        durationMs: true,
      },
    });

    const totalSessions = sessions.length;
    const completedSessions = sessions.filter((session) => session.finalStatus === 'COMPLETED').length;
    const abandonedSessions = sessions.filter((session) => session.finalStatus === 'ABANDONED').length;
    const ongoingSessions = sessions.filter((session) => session.finalStatus === 'ONGOING').length;

    const paymentAttemptedSessions = sessions.filter((session) => session.paymentStatus !== null && session.paymentStatus !== undefined).length;
    const paymentSuccessSessions = sessions.filter((session) => session.paymentStatus === 'SUCCESS').length;
    const paymentFailedSessions = sessions.filter((session) => session.paymentStatus === 'FAILED').length;

    const totalDuration = sessions.reduce((sum, session) => {
      if (session.durationMs) {
        return sum + session.durationMs;
      }
      if (session.endedAt && session.startedAt) {
        return sum + (session.endedAt.getTime() - session.startedAt.getTime());
      }
      return sum;
    }, 0);

    const summary = {
      totalSessions,
      completedSessions,
      abandonedSessions,
      ongoingSessions,
      conversionRate: totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 10000) / 100 : 0,
      avgDurationMs: totalSessions > 0 ? Math.round(totalDuration / totalSessions) : null,
    };

    const paymentStats = {
      attemptedSessions: paymentAttemptedSessions,
      successSessions: paymentSuccessSessions,
      failedSessions: paymentFailedSessions,
      successRate: paymentAttemptedSessions > 0
        ? Math.round((paymentSuccessSessions / paymentAttemptedSessions) * 10000) / 100
        : 0,
    };

    if (totalSessions === 0) {
      const emptyStats: ChatBotStats = {
        sessionSummary: summary,
        questionStats: [],
        optionStats: [],
        hourlyStats: Array.from({ length: 24 }, (_, hour) => ({
          hour,
          total: 0,
          completed: 0,
          abandoned: 0,
          ongoing: 0,
        })),
        topSessionPaths: [],
        paymentStats,
      };
      return NextResponse.json({ ok: true, data: emptyStats });
    }

    const hourlyBuckets = new Map<number, { total: number; completed: number; abandoned: number; ongoing: number }>();
    for (let hour = 0; hour < 24; hour += 1) {
      hourlyBuckets.set(hour, { total: 0, completed: 0, abandoned: 0, ongoing: 0 });
    }

    sessions.forEach((session) => {
      const hour = session.startedAt?.getHours() ?? 0;
      const bucket = hourlyBuckets.get(hour)!;
      bucket.total += 1;
      if (session.finalStatus === 'COMPLETED') bucket.completed += 1;
      else if (session.finalStatus === 'ABANDONED') bucket.abandoned += 1;
      else bucket.ongoing += 1;
    });

    const hourlyStats = Array.from(hourlyBuckets.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, counts]) => ({
        hour,
        ...counts,
      }));

    const sessionIds = sessions.map((session) => session.sessionId);

    const responseWhere: Prisma.ChatBotResponseWhereInput = {
      sessionId: { in: sessionIds },
    };

    const rawDropOff = await prisma.chatBotResponse.groupBy({
      by: ['questionId', 'questionOrder'],
      where: responseWhere,
      _count: {
        _all: true,
      },
      _sum: {
        responseTime: true,
        isAbandoned: true,
      },
      _avg: {
        responseTime: true,
      },
    });

    const questionMap = await prisma.chatBotQuestion.findMany({
      where: {
        id: {
          in: rawDropOff.map((row) => row.questionId),
        },
      },
      select: {
        id: true,
        questionText: true,
      },
    });
    const questionTextMap = new Map(questionMap.map((q) => [q.id, q.questionText]));

    const questionStats = rawDropOff.map((row) => {
      const total = Number(row._count._all);
      const abandoned = Number(row._sum.isAbandoned ?? 0);
      return {
        questionId: row.questionId,
        questionOrder: row.questionOrder ?? null,
        questionText: questionTextMap.get(row.questionId) ?? '',
        totalResponses: total,
        abandonedResponses: abandoned,
        dropOffRate: total > 0 ? Math.round((abandoned / total) * 10000) / 100 : 0,
        avgResponseTime: row._avg.responseTime !== null ? Number(row._avg.responseTime) : null,
      };
    });

    const topOptionsRaw = await prisma.chatBotResponse.groupBy({
      by: ['questionId', 'optionLabel'],
      where: responseWhere,
      _count: {
        optionLabel: true,
      },
      orderBy: {
        _count: {
          optionLabel: 'desc',
        },
      },
      take: 50,
    });

    const optionStats = topOptionsRaw.map((row) => ({
      questionId: row.questionId,
      optionLabel: row.optionLabel,
      count: row._count.optionLabel,
      percentage:
        totalSessions > 0 ? Math.round((row._count.optionLabel / totalSessions) * 10000) / 100 : 0,
    }));

    const responseRecords = await prisma.chatBotResponse.findMany({
      where: responseWhere,
      select: {
        sessionId: true,
        questionId: true,
        questionOrder: true,
        createdAt: true,
        question: {
          select: {
            questionText: true,
          },
        },
      },
    });

    const responsesBySession = new Map<
      string,
      Array<{
        questionId: number;
        questionOrder: number | null;
        createdAt: Date;
        questionText: string;
      }>
    >();

    responseRecords.forEach((record) => {
      const list = responsesBySession.get(record.sessionId) ?? [];
      list.push({
        questionId: record.questionId,
        questionOrder: record.questionOrder,
        createdAt: record.createdAt,
        questionText: record.question?.questionText ?? '',
      });
      responsesBySession.set(record.sessionId, list);
    });

    const pathBuckets = new Map<
      string,
      { path: SessionPathStep[]; sessions: number; completedSessions: number }
    >();

    sessions.forEach((session) => {
      const responses = responsesBySession.get(session.sessionId);
      if (!responses || responses.length === 0) {
        return;
      }

      const sorted = responses
        .slice()
        .sort((a, b) => {
          const orderA = a.questionOrder ?? Number.MAX_SAFE_INTEGER;
          const orderB = b.questionOrder ?? Number.MAX_SAFE_INTEGER;
          if (orderA === orderB) {
            return a.createdAt.getTime() - b.createdAt.getTime();
          }
          return orderA - orderB;
        });

      const path: SessionPathStep[] = sorted.map((item) => ({
        questionId: item.questionId,
        questionOrder: item.questionOrder,
        questionText: item.questionText,
      }));

      if (path.length === 0) {
        return;
      }

      const key = path.map((step) => `${step.questionOrder ?? step.questionId}`).join('>');
      const bucket = pathBuckets.get(key) ?? {
        path,
        sessions: 0,
        completedSessions: 0,
      };

      bucket.sessions += 1;
      if (session.finalStatus === 'COMPLETED') {
        bucket.completedSessions += 1;
      }

      pathBuckets.set(key, bucket);
    });

    const topSessionPaths: SessionPathStat[] = Array.from(pathBuckets.values())
      .map((bucket) => ({
        path: bucket.path,
        sessions: bucket.sessions,
        completedSessions: bucket.completedSessions,
        conversionRate:
          bucket.sessions > 0
            ? Math.round((bucket.completedSessions / bucket.sessions) * 10000) / 100
            : 0,
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 5);

    const stats: ChatBotStats = {
      sessionSummary: summary,
      questionStats,
      optionStats,
      hourlyStats,
      topSessionPaths,
      paymentStats,
    };

    return NextResponse.json({ ok: true, data: stats });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    console.error('[Admin ChatBot Stats] Error:', error);
    return NextResponse.json(
      { ok: false, error: '챗봇 통계 데이터를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
