import { logger } from '@/lib/logger';

/**
 * 봇 방어 3레이어: Honeypot + 시간방어 + 기본 검증
 * @returns true = 통과 (정상), false = 봇 의심 (차단)
 */
export function checkBotGuard(body: Record<string, unknown>, context: string): boolean {
  // Layer 1: Honeypot
  const honeypot = (body.website ?? body.hp ?? '').toString();
  if (honeypot.trim()) {
    logger.log(`[BotGuard:${context}] Honeypot 감지`);
    return false;
  }
  // Layer 2: 시간 방어 (800ms 미만 = 봇)
  const loadedAt = typeof body.loadedAt === 'number' ? body.loadedAt : null;
  if (loadedAt) {
    const elapsed = Date.now() - loadedAt;
    if (elapsed > 0 && elapsed < 800) {
      logger.log(`[BotGuard:${context}] 시간방어 감지`, { elapsed });
      return false;
    }
  }
  return true;
}
