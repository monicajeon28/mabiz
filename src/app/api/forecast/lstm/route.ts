/**
 * LSTM Forecasting Endpoint
 * GET /api/forecast/lstm?days=7-90
 *
 * Returns LSTM neural network predictions
 */

import { NextRequest, NextResponse } from 'next/server';
import { LSTMForecastManager } from '@/lib/ai/lstm-forecaster';
import { logger } from '@/lib/logger';

/**
 * Type guard for days parameter
 */
function isValidDays(value: number): value is number {
  return value >= 7 && value <= 90;
}

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const daysParam = parseInt(searchParams.get('days') || '30', 10);
    const days = isValidDays(daysParam)
      ? daysParam
      : Math.min(90, Math.max(7, daysParam));

    logger.info(`[Forecast] LSTM request for ${days} days`);

    const startTime = Date.now();

    // Generate mock historical data for demo
    const historicalData: number[] = [];
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - 180);

    for (let i = 0; i < 180; i++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + i);
      const dayOfWeek = date.getDay();
      const weekendMultiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 0.8 : 1.0;
      const trend = i * 0.5;
      const seasonal = 50 * Math.sin((i / 7) * Math.PI * 2);
      const noise = Math.random() * 20 - 10;
      const value = 500 + trend + seasonal + noise;

      historicalData.push(Math.max(0, value * weekendMultiplier));
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
