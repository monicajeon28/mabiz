/**
 * Ensemble Forecasting Endpoint
 * GET /api/forecast/ensemble?days=7-90&compare=true
 *
 * Returns best ensemble prediction combining Prophet + LSTM + ARIMA
 */

import { NextRequest, NextResponse } from 'next/server';
import { EnsembleForecastManager } from '@/lib/ai/ensemble-forecaster';
import { logger } from '@/lib/logger';
import { getMabizSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * Type guards for ensemble parameters
 */
function isValidDays(value: number): value is number {
  return value >= 7 && value <= 90;
}

function isValidBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
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

    const compareParam = searchParams.get('compare') === 'true';
    const compare = isValidBoolean(compareParam) ? compareParam : false;

    logger.info(`[Forecast] Ensemble request for ${days} days${compare ? ' (with comparison)' : ''}`);

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

    const dailyMap = new Map<string, number>();
    for (const s of sales) {
      const key = s.createdAt.toISOString().slice(0, 10);
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + s.saleAmount);
    }

    const historicalData: { date: Date; value: number }[] = [];
    const baseDate = new Date(since);
    let nonZero = 0;
    for (let i = 0; i < 180; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const value = dailyMap.get(key) ?? 0;
      if (value > 0) nonZero++;
      historicalData.push({ date: d, value });
    }

    // DB 데이터 부족 시 보정
    if (nonZero < 14) {
      const avg = nonZero > 0
        ? historicalData.reduce((a, b) => a + b.value, 0) / nonZero
        : 500000;
      for (let i = 0; i < 180; i++) {
        if (historicalData[i].value === 0) {
          const seasonal = avg * 0.1 * Math.sin((i / 7) * Math.PI * 2);
          historicalData[i] = { ...historicalData[i], value: Math.max(0, avg + seasonal) };
        }
      }
    }

    if (compare) {
      const result = await EnsembleForecastManager.compareModels(historicalData, days);
      return NextResponse.json(
        {
          success: true,
          data: {
            ensemble: result.ensemble,
            comparison: result.comparison,
            recommendation: result.ensemble.recommendations,
            generatedAt: new Date().toISOString(),
            processingTime: `${(Date.now() - startTime).toFixed(0)}ms`,
          },
        },
        { status: 200 }
      );
    } else {
      const result = await EnsembleForecastManager.forecastRevenue(historicalData, days);
      return NextResponse.json(
        {
          success: true,
          data: {
            forecast: result.forecast,
            ensemble: result.ensemble,
            recommendations: result.recommendations,
            generatedAt: new Date().toISOString(),
            processingTime: `${(Date.now() - startTime).toFixed(0)}ms`,
          },
        },
        { status: 200 }
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[Forecast] Ensemble error:', { message: errorMessage });
    return NextResponse.json(
      {
        success: false,
        error: '예측 처리 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
