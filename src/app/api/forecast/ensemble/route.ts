/**
 * Ensemble Forecasting Endpoint
 * GET /api/forecast/ensemble?days=7-90&compare=true
 *
 * Returns best ensemble prediction combining Prophet + LSTM + ARIMA
 */

import { NextRequest, NextResponse } from 'next/server';
import { EnsembleForecastManager } from '@/lib/ai/ensemble-forecaster';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = Math.min(90, Math.max(7, parseInt(searchParams.get('days') || '30', 10)));
    const compare = searchParams.get('compare') === 'true';

    logger.info(`[Forecast] Ensemble request for ${days} days${compare ? ' (with comparison)' : ''}`);

    const startTime = Date.now();

    // Generate mock historical data
    const historicalData: { date: Date; value: number }[] = [];
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

      historicalData.push({
        date,
        value: Math.max(0, value * weekendMultiplier),
      });
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
  } catch (error) {
    logger.error('[Forecast] Ensemble error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Ensemble forecasting failed',
      },
      { status: 500 }
    );
  }
}
