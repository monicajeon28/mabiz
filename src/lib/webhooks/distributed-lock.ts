import prisma from '@/lib/prisma';
import crypto from 'crypto';

const LOCK_TTL_MS = 30000; // 30 seconds
const LOCK_PREFIX = 'webhook_lock_';

export const distributedLock = {
  acquire: async (resourceId: string, lockerId: string = crypto.randomUUID()): Promise<string | null> => {
    const lockId = `${LOCK_PREFIX}${resourceId}`;
    const lockedUntil = new Date(Date.now() + LOCK_TTL_MS);

    try {
      await prisma.retryQueue.update({
        where: { webhookEventId: resourceId },
        data: {
          lockedBy: lockerId,
          lockedUntil,
        },
      });
      return lockerId;
    } catch {
      return null;
    }
  },

  release: async (resourceId: string, lockerId: string): Promise<boolean> => {
    try {
      await prisma.retryQueue.updateMany({
        where: {
          webhookEventId: resourceId,
          lockedBy: lockerId,
        },
        data: {
          lockedBy: null,
          lockedUntil: null,
        },
      });
      return true;
    } catch {
      return false;
    }
  },

  isExpired: (lockedUntil: Date | null): boolean => {
    if (!lockedUntil) return true;
    return new Date() > lockedUntil;
  },

  canAcquire: async (resourceId: string): Promise<boolean> => {
    const item = await prisma.retryQueue.findUnique({
      where: { webhookEventId: resourceId },
      select: { lockedUntil: true },
    });

    if (!item) return false;
    return distributedLock.isExpired(item.lockedUntil);
  },
};
