/**
 * Demand Sensing Endpoint
 * GET /api/forecast/demand-sensing?lookback=30&forecast=7
 *
 * Returns early warning demand forecast (3-5 days ahead)
 */

import { NextRequest, NextResponse } from 'next/server';
import { DemandSensingManager } from '@/lib/ai/demand-sensing';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const lookback = Math.min(90, Math.max(14, parseInt(searchParams.get('lookback') || '30', 10)));
    const forecastDays = Math.min(14, Math.max(3, parseInt(searchParams.get('forecast') || '7', 10)));

    logger.info(`[Demand Sensing] Request: lookback=${lookback}d, forecast=${forecastDays}d`);

    const startTime = Date.now();

    const result = await DemandSensingManager.forecastDemand(lookback, {
      forecastDays,
    });

    // Format response
    const responseData = {
      success: true,
      data: {
        forecast: result.forecast.map((f) => ({
          date: f.date.toISOString(),
          expectedSalesChange: parseFloat((f.expectedSalesChange * 100).toFixed(2)),
          confidence: parseFloat(f.confidence.toFixed(3)),
          recommendation: f.recommendation,
          actions: f.actions,
        })),
        summary: {
          trend: result.summary.overallTrend,
          expectedChange: `${(result.summary.magnitude * 100).toFixed(1)}%`,
          confidence: parseFloat(result.summary.confidence.toFixed(2)),
          daysAhead: result.summary.daysAhead,
        },
        alerts: result.alerts,
        recommendations: {
          inventory: result.recommendations.inventory,
          staffing: result.recommendations.staffing,
          marketing: result.recommendations.marketing,
          partnerships: result.recommendations.partnerships,
        },
        generatedAt: new Date().toISOString(),
        processingTime: `${(Date.now() - startTime).toFixed(0)}ms`,
      },
    };

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    logger.error('[Demand Sensing] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Demand sensing failed',
      },
      { status: 500 }
    );
  }
}
