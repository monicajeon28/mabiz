import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * visitToken 기반 방문 추적 로깅
 * 파트너 어필리에이트 링크 방문 시 사용
 */
export async function logVisitToken(
  visitToken: string | null | undefined,
  context: string,
): Promise<{ status: 'reused' | 'expired' | 'not_found' | 'error'; linkId?: string }> {
  if (!visitToken) {
    logger.log(`[VisitToken:${context}] visitToken 미존재`);
    return { status: 'not_found' };
  }

  try {
    const click = await prisma.shortLinkClick.findFirst({
      where: { id: visitToken },
      select: { id: true, clickedAt: true, linkId: true },
    });

    if (!click) {
      logger.log(`[VisitToken:${context}] visitToken 미존재`, {
        visitToken: visitToken.slice(0, 8) + '...',
      });
      return { status: 'not_found' };
    }

    // 만료 체크 (24시간)
    const expiresAt = new Date(click.clickedAt.getTime() + 24 * 60 * 60 * 1000);
    if (new Date() > expiresAt) {
      logger.warn(`[VisitToken:${context}] visitToken 만료`, {
        visitToken: visitToken.slice(0, 8) + '...',
        expiresAt: expiresAt.toISOString(),
      });
      return { status: 'expired', linkId: click.linkId };
    }

    logger.log(`[VisitToken:${context}] visitToken 재사용`, {
      visitToken: visitToken.slice(0, 8) + '...',
      linkId: click.linkId,
    });
    return { status: 'reused', linkId: click.linkId };
  } catch (err) {
    logger.warn(`[VisitToken:${context}] visitToken 조회 오류`, { error: String(err) });
    return { status: 'error' };
  }
}
