import prisma from '@/lib/prisma';
import crypto from 'crypto';

export interface IdempotencyKey {
  organizationId: string;
  eventId: string;
}

export const idempotency = {
  generateKey: (organizationId: string, source: string, sourceId: string): string => {
    const combined = `${organizationId}:${source}:${sourceId}`;
    return crypto.createHash('sha256').update(combined).digest('hex');
  },

  checkExists: async (eventId: string): Promise<boolean> => {
    const event = await prisma.webhookEvent.findUnique({
      where: { eventId },
      select: { id: true },
    });
    return !!event;
  },

  markProcessed: async (eventId: string): Promise<void> => {
    // Already marked during webhook event creation
    // This is a no-op to maintain API compatibility
  },
};
