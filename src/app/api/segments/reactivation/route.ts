/**
 * GET /api/segments/reactivation
 *
 * 부재중 고객 세그먼트 조회 및 자동분류
 *
 * Query Parameters:
 * - organizationId: string (필수)
 * - classify: boolean (기본값: false) - true일 경우 자동분류 수행
 * - daysInactive: number (기본값: 180) - 부재 기준 일수
 *
 * Response:
 * {
 *   segments: [
 *     { segment: "3-6m", count: 150, avgLikelihood: 75 },
 *     { segment: "6-12m", count: 200, avgLikelihood: 62 },
 *     { segment: "1y+", count: 100, avgLikelihood: 48 }
 *   ],
 *   total: 450,
 *   timestamp: "2026-05-25T10:30:00Z"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  classifyReactivationCustomers,
  getReactivationStats,
} from '@/lib/services/reactivation-classifier';

export async function GET(request: NextRequest) {
  try {
    const organizationId = request.nextUrl.searchParams.get('organizationId');
    const classify = request.nextUrl.searchParams.get('classify') === 'true';
    const daysInactive = parseInt(
      request.nextUrl.searchParams.get('daysInactive') || '180',
      10,
    );

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 },
      );
    }

    // 조직 검증
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 },
      );
    }

    // 필요시 자동분류 수행
    if (classify) {
      await classifyReactivationCustomers(organizationId, {
        daysInactive,
        batchSize: 100,
      });
    }

    // 세그먼트별 통계 조회
    const segments = await getReactivationStats(organizationId);

    // 총 부재중 고객 수
    const total = segments.reduce((sum, seg) => sum + seg.count, 0);

    return NextResponse.json(
      {
        segments,
        total,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[GET /api/segments/reactivation]', error);
    return NextResponse.json(
      { error: 'Failed to fetch reactivation segments' },
      { status: 500 },
    );
  }
}
