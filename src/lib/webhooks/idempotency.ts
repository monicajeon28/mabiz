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

  markProcessed: async (organizationId: string, eventId: string, payload: any): Promise<void> => {
    await prisma.webhookEvent.create({
      data: {
        eventId,
        organizationId,
        webhookType: 'IDEMPOTENCY_MARKER',
        payload,
        status: 'COMPLETED',
        processingStartAt: new Date(),
        processingEndAt: new Date(),
        executionTimeMs: 0,
      },
    });
  },
};
