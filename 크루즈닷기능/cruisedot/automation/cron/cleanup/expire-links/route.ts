export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// app/api/cron/expire-links/route.ts
// Vercel Cron: 만료 기한이 지난 어필리에이트 링크를 자동으로 EXPIRED 처리
// Schedule: vercel.json에 설정 (권장: 매일 00:00 UTC)

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * POST /api/cron/expire-links
 * expiresAt < now이고 아직 ACTIVE 상태인 어필리에이트 링크를 일괄 만료 처리합니다.
 *
 * 보안:
 * - CRON_SECRET 환경변수 Bearer token 인증 필수
 * - Vercel Cron이 자동 제공하는 Authorization 헤더 검증
 *
 * 성능:
 * - updateMany로 단일 쿼리 배치 업데이트
 * - AffiliateLinkEvent 감사 로그는 영향받은 링크 ID 기준으로 createMany 처리
 */
export async function POST(req: Request) {
  try {
    // 1. CRON_SECRET 환경변수 검증
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      logger.error('[Cron ExpireLinks] CRON_SECRET 환경변수 미설정');
      return NextResponse.json(
        { error: 'CRON_SECRET not configured' },
        { status: 401 }
      );
    }

    // 2. Bearer token 인증
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    // 3. 만료 대상 링크 조회 (ACTIVE이고 expiresAt < now)
    const expiredLinks = await prisma.affiliateLink.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lt: now },
      },
      select: { id: true, code: true },
    });

    if (expiredLinks.length === 0) {
      logger.info('[Cron ExpireLinks] 만료할 링크 없음', { timestamp: now.toISOString() });
      return NextResponse.json({
        ok: true,
        expiredCount: 0,
        timestamp: now.toISOString(),
      });
    }

    const linkIds = expiredLinks.map((l) => l.id);

    // 4. 배치 만료 처리 + 감사 로그 생성 (트랜잭션)
    const [updateResult] = await prisma.$transaction([
      prisma.affiliateLink.updateMany({
        where: { id: { in: linkIds } },
        data: {
          status: 'EXPIRED',
          updatedAt: now,
        },
      }),
      prisma.affiliateLinkEvent.createMany({
        data: expiredLinks.map((link) => ({
          linkId: link.id,
          eventType: 'EXPIRED',
          description: '유효기간 만료로 자동 비활성화',
          metadata: { expiredAt: now.toISOString(), triggeredBy: 'cron' },
          createdAt: now,
        })),
        skipDuplicates: true,
      }),
    ]);

    logger.info('[Cron ExpireLinks] 링크 만료 처리 완료', {
      expiredCount: updateResult.count,
      linkIds,
      timestamp: now.toISOString(),
    });

    return NextResponse.json({
      ok: true,
      expiredCount: updateResult.count,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    logger.error('[Cron ExpireLinks] 처리 실패:', error);
    return NextResponse.json(
      { error: '링크 만료 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
