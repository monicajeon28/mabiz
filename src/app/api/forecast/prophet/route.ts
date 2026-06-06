/**
 * Prophet Forecasting Endpoint
 * GET /api/forecast/prophet?days=7-90
 *
 * Returns Prophet model forecasts with decomposition
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProphetForecastManager } from '@/lib/ai/prophet-forecaster';
import { logger } from '@/lib/logger';

/**
 * Type guards for prophet parameters
 */
function isValidDays(value: number): value is number {
  return value >= 7 && value <= 90;
}

function isValidMetric(value: unknown): value is 'revenue' | 'orders' | 'customers' {
  return value === 'revenue' || value === 'orders' || value === 'customers';
}

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const daysParam = parseInt(searchParams.get('days') || '30', 10);
    const days = isValidDays(daysParam)
      ? daysParam
      : Math.min(90, Math.max(7, daysParam));

    const metricParam = searchParams.get('metric') || 'revenue';
    const metric = isValidMetric(metricParam) ? metricParam : 'revenue';

    logger.info(`[Forecast] Prophet request: ${metric} for ${days} days`);

    const startTime = Date.now();
    const result = await ProphetForecastManager.forecastRevenue(metric, days);

    return NextResponse.json(
      {
        success: true,
        data: {
          forecast: result.forecast,
          decomposition: result.decomposition,
          metrics: result.metrics,
          params: result.params,
          generatedAt: new Date().toISOString(),
          processingTime: `${(Date.now() - startTime).toFixed(0)}ms`,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[Forecast] Prophet error:', { message: errorMessage });
    return NextResponse.json(
      {
        success: false,
        error: '예측 처리 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
