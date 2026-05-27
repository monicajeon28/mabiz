/**
 * Prophet Forecasting Endpoint
 * GET /api/forecast/prophet?days=7-90
 *
 * Returns Prophet model forecasts with decomposition
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProphetForecastManager } from '@/lib/ai/prophet-forecaster';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = Math.min(90, Math.max(7, parseInt(searchParams.get('days') || '30', 10)));
    const metric = (searchParams.get('metric') || 'revenue') as 'revenue' | 'orders' | 'customers';

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
  } catch (error) {
    logger.error('[Forecast] Prophet error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Forecasting failed',
      },
      { status: 500 }
    );
  }
}
