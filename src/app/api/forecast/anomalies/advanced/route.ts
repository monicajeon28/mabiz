/**
 * Advanced Anomaly Detection Endpoint
 * GET /api/forecast/anomalies/advanced?sensitivity=0.9&metric=revenue
 *
 * Returns multi-algorithm anomaly detection results
 */

import { NextRequest, NextResponse } from 'next/server';
import { AnomalyDetectionManager } from '@/lib/ai/advanced-anomaly-detector';
import { logger } from '@/lib/logger';

/**
 * Type guard for sensitivity parameter
 */
function isValidSensitivity(value: number): value is number {
  return value >= 0.5 && value <= 0.95;
}

/**
 * Type guard for metric parameter
 */
function isValidMetric(value: unknown): value is 'revenue' | 'orders' | 'customers' {
  return value === 'revenue' || value === 'orders' || value === 'customers';
}

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sensitivityParam = parseFloat(searchParams.get('sensitivity') || '0.85');
    const sensitivity = isValidSensitivity(sensitivityParam)
      ? sensitivityParam
      : Math.min(0.95, Math.max(0.5, sensitivityParam));

    const metricParam = searchParams.get('metric') || 'revenue';
    const metric = isValidMetric(metricParam) ? metricParam : 'revenue';

    logger.info(`[Anomaly] Advanced detection: ${metric}, sensitivity=${sensitivity}`);

    const startTime = Date.now();

    // Detect anomalies
    const anomalies = await AnomalyDetectionManager.detectAnomalies(metric, sensitivity);

    // Detect changepoints
    const changepoints = await AnomalyDetectionManager.detectChangepoints(metric);

    // Summarize results
    const critical = anomalies.filter((a) => a.severity === 'critical');
    const high = anomalies.filter((a) => a.severity === 'high');

    return NextResponse.json(
      {
        success: true,
        data: {
          anomalies,
          changepoints,
          summary: {
            totalAnomalies: anomalies.length,
            critical: critical.length,
            high: high.length,
            avgConfidence: anomalies.length > 0
              ? anomalies.reduce((s, a) => s + a.confidence, 0) / anomalies.length
              : 0,
            changePointsDetected: changepoints.length,
          },
          recommendations: {
            immediateAction:
              critical.length > 0
                ? `${critical.length} critical anomalies detected. Investigate immediately.`
                : high.length > 0
                  ? `${high.length} high-severity anomalies. Review and take action.`
                  : 'No critical anomalies detected.',
            pattern: changepoints.length > 0
              ? `${changepoints.length} trend changes detected. Possible market shift.`
              : 'No significant trend changes detected.',
          },
          generatedAt: new Date().toISOString(),
          processingTime: `${(Date.now() - startTime).toFixed(0)}ms`,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[Anomaly] Advanced detection error:', { message: errorMessage });
    return NextResponse.json(
      {
        success: false,
        error: '예측 처리 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
