/**
 * Cron API: 매일 오전 2:00 (UTC) 신뢰도 자동 재계산
 * GET /api/cron/daily-trust-score-calculation
 * vercel.json 설정: { "path": "/api/cron/daily-trust-score-calculation", "schedule": "0 2 * * *" }
 */

export default async (req, res) => {
  // Cron 시크릿 검증
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers['authorization'];

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(403).json({
      error: '권한 없음',
      code: 'UNAUTHORIZED',
    });
  }

  try {
    const startTime = Date.now();

    // 동적 import (ESM)
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    try {
      // 신뢰도 엔진 import
      const module = await import('../../../lib/trust-score.js');
      const { recalculateAllTrustScores } = module;

      const result = await recalculateAllTrustScores();

      const duration = Date.now() - startTime;

      return res.status(200).json({
        success: true,
        timestamp: new Date().toISOString(),
        updateCount: result.updateCount,
        changeCount: result.changeCount,
        duration,
        message: `신뢰도 재계산 완료: ${result.updateCount}명 업데이트, ${result.changeCount}명 상태 변경`,
      });
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    console.error('[Cron] 신뢰도 재계산 실패:', error);
    return res.status(500).json({
      error: '서버 오류',
      code: 'SERVER_ERROR',
      message: error.message,
    });
  }
};
