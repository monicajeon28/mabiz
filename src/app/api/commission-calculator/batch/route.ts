import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { batchCalculateCommissions } from '@/lib/commission-calculator';

/**
 * POST /api/commission-calculator/batch
 *
 * 배치 Commission 계산
 * - 1,000개 이상 affiliateSale ID를 한번에 처리
 * - N+1 쿼리 방지 (2-3개 쿼리로 1,000개 계산)
 * - Race Condition 방지 (찾기 → 계산 → INSERT/UPDATE)
 *
 * Request:
 * {
 *   "affiliateSaleIds": ["id1", "id2", ..., "id1000"],
 *   "organizationId": "org-xxx"
 * }
 *
 * Response:
 * {
 *   "ok": true,
 *   "results": [
 *     {
 *       "affiliateSaleId": "id1",
 *       "success": true,
 *       "commissionAmount": 50000
 *     },
 *     {
 *       "affiliateSaleId": "id2",
 *       "success": false,
 *       "error": "Sale not found"
 *     }
 *   ],
 *   "stats": {
 *     "total": 1000,
 *     "success": 999,
 *     "failed": 1,
 *     "duration_ms": 245
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const ctx = await getMabizSession();
    if (!ctx) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Role 권한 체크 (GLOBAL_ADMIN, OWNER만 허용)
    if (!['GLOBAL_ADMIN', 'OWNER'].includes(ctx.role)) {
      return NextResponse.json(
        { ok: false, error: 'Permission denied. GLOBAL_ADMIN or OWNER role required.' },
        { status: 403 }
      );
    }

    const organizationId = ctx.organizationId;
    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'Organization not set' },
        { status: 403 }
      );
    }

    // Request body 파싱
    const body = await req.json();
    const { affiliateSaleIds } = body;

    if (!Array.isArray(affiliateSaleIds)) {
      return NextResponse.json(
        { ok: false, error: 'affiliateSaleIds must be an array' },
        { status: 400 }
      );
    }

    if (affiliateSaleIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'affiliateSaleIds must not be empty' },
        { status: 400 }
      );
    }

    // 안전장치: 한번에 5,000개까지만 허용
    if (affiliateSaleIds.length > 5000) {
      return NextResponse.json(
        { ok: false, error: 'Maximum 5000 affiliateSaleIds allowed' },
        { status: 400 }
      );
    }

    logger.log('[POST /api/commission-calculator/batch] 시작', {
      organizationId,
      count: affiliateSaleIds.length,
      role: ctx.role
    });

    // 배치 계산 실행
    const results = await batchCalculateCommissions(affiliateSaleIds, organizationId);

    const stats = {
      total: affiliateSaleIds.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      duration_ms: Date.now() - startTime
    };

    logger.log('[POST /api/commission-calculator/batch] 완료', {
      organizationId,
      ...stats
    });

    return NextResponse.json({
      ok: true,
      results,
      stats
    });

  } catch (err) {
    const duration_ms = Date.now() - startTime;

    logger.error('[POST /api/commission-calculator/batch] 에러', {
      error: err instanceof Error ? err.message : String(err),
      duration_ms
    });

    return NextResponse.json(
      {
        ok: false,
        error: '서버 오류가 발생했습니다.',
        duration_ms
      },
      { status: 500 }
    );
  }
}
