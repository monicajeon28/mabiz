/**
 * LSTM Forecasting Endpoint
 * GET /api/forecast/lstm?days=7-90
 *
 * Returns LSTM neural network predictions
 */

import { NextRequest, NextResponse } from 'next/server';
import { LSTMForecastManager } from '@/lib/ai/lstm-forecaster';
import { logger } from '@/lib/logger';
import { getMabizSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * Type guard for days parameter
 */
function isValidDays(value: number): value is number {
  return value >= 7 && value <= 90;
}

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const daysParam = parseInt(searchParams.get('days') || '30', 10);
    const days = isValidDays(daysParam)
      ? daysParam
      : Math.min(90, Math.max(7, daysParam));

    logger.info(`[Forecast] LSTM request for ${days} days`);

    const startTime = Date.now();

    // 실 DB: 180일치 일별 매출 집계
    const since = new Date();
    since.setDate(since.getDate() - 180);
    const sales = await prisma.affiliateSale.findMany({
      where: {
        organizationId: session.organizationId ?? undefined,
        createdAt: { gte: since },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
      select: { createdAt: true, saleAmount: true },
      orderBy: { createdAt: 'asc' },
    });

    // 일별 집계 맵 생성
    const dailyMap = new Map<string, number>();
    for (const s of sales) {
      const key = s.createdAt.toISOString().slice(0, 10);
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + s.saleAmount);
    }

    // 180일 연속 배열 생성 (데이터 없는 날은 0 또는 이웃 평균으로 보간)
    const historicalData: number[] = [];
    const baseDate = new Date(since);
    for (let i = 0; i < 180; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      historicalData.push(dailyMap.get(key) ?? 0);
    }

    // DB 데이터가 충분하지 않으면 trend + seasonal 보정
    const nonZero = historicalData.filter((v) => v > 0).length;
    if (nonZero < 14) {
      const avg = nonZero > 0 ? historicalData.reduce((a, b) => a + b, 0) / nonZero : 500000;
      for (let i = 0; i < 180; i++) {
        if (historicalData[i] === 0) {
          const seasonal = avg * 0.1 * Math.sin((i / 7) * Math.PI * 2);
          historicalData[i] = Math.max(0, avg + seasonal);
        }
      }
    }

    const result = await LSTMForecastManager.forecastRevenue(historicalData, days);

    return NextResponse.json(
      {
        success: true,
        data: {
          forecast: result.forecast,
          metrics: result.metrics,
          model: result.model,
          generatedAt: new Date().toISOString(),
          processingTime: `${(Date.now() - startTime).toFixed(0)}ms`,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[Forecast] LSTM error:', { message: errorMessage });
    return NextResponse.json(
      {
        success: false,
        error: '예측 처리 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
