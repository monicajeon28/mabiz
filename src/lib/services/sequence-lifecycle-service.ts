/**
 * Sequence Lifecycle Service
 * Manages Day 0-3 sequence progression and message delivery
 *
 * Responsibilities:
 * - Calculate current day based on elapsed time
 * - Determine if a day should be sent
 * - Retrieve appropriate message templates with PASONA framework
 * - Perform variable substitution ({{name}}, {{product}}, {{price}}, etc.)
 * - Update sequence progress and mark days as sent
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Calculate which day (0-3) a sequence is currently on
 * Based on elapsed time since sequence started
 *
 * Day 0: 0-24 hours
 * Day 1: 24-48 hours
 * Day 2: 48-72 hours
 * Day 3: 72+ hours
 */
export function calculateCurrentDay(startedAt: Date): number {
  const now = new Date();
  const elapsedMs = now.getTime() - startedAt.getTime();
  const elapsedHours = elapsedMs / (1000 * 60 * 60);

  if (elapsedHours < 24) return 0;
  if (elapsedHours < 48) return 1;
  if (elapsedHours < 72) return 2;
  return 3;
}

/**
 * Determine if a specific day should be sent
 * Based on daysSent array and current day
 */
export function shouldSendDay(dayNumber: number, daysSent: (number | null)[]): boolean {
  // Check if day was already sent
  if (daysSent && daysSent.includes(dayNumber)) {
    return false;
  }
  return true;
}

/**
 * Get the message template for a specific day
 * Prioritizes PASONA stage and psychology lens
 *
 * Fetches template that matches:
 * 1. Organization
 * 2. Sequence ID (template variants)
 * 3. Day number
 * 4. Optionally: Psychology lens for targeted messages
 */
export async function getSequenceDayTemplate(
  organizationId: string,
  sequenceId: string,
  dayNumber: number,
  lensId?: string
): Promise<string | null> {
  try {
    // Get the sequence template
    const sequence = await prisma.smsSequenceTemplate.findUnique({
      where: { id: sequenceId },
      include: {
        variants: {
          where: { day: dayNumber },
          orderBy: { variantCode: 'asc' }
        }
      }
    });

    if (!sequence || sequence.organizationId !== organizationId) {
      logger.warn('[sequence-lifecycle] Sequence not found', {
        sequenceId,
        organizationId
      });
      return null;
    }

    // Get variant - prioritize first available variant (A is default)
    let variant = sequence.variants[0];

    // If no variant exists, return null
    if (!variant) {
      logger.warn('[sequence-lifecycle] No variants found for day', {
        sequenceId,
        dayNumber
      });
      return null;
    }

    return variant.messageContent;
  } catch (error) {
    logger.error('[sequence-lifecycle] Error fetching template', {
      sequenceId,
      dayNumber,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
}

/**
 * Perform template variable substitution
 * Replaces placeholders like {{name}}, {{product}}, {{price}}, {{date}}
 *
 * Supported variables:
 * - {{name}} -> Contact name
 * - {{product}} -> Product name
 * - {{price}} -> Product price (formatted)
 * - {{date}} -> Formatted date
 * - {{company}} -> Organization name
 * - {{phone}} -> Contact phone
 */
export async function performSubstitution(
  template: string,
  contact: {
    id: string;
    name: string;
    phone: string;
    productName?: string | null;
    email?: string | null;
    lensMetadata?: any;
  },
  sequence: {
    organizationId: string;
    productCode?: string | null;
  }
): Promise<string> {
  let message = template;

  // Get organization name
  const org = await prisma.organization.findUnique({
    where: { id: sequence.organizationId },
    select: { name: true }
  });

  // Replace variables (case-insensitive)
  const replacements: Record<string, string> = {
    '{{name}}': contact.name || '',
    '{{product}}': contact.productName || sequence.productCode || '크루즈',
    '{{date}}': new Date().toLocaleDateString('ko-KR'),
    '{{company}}': org?.name || '마비즈',
    '{{phone}}': contact.phone || ''
  };

  // Perform replacements (case-insensitive)
  for (const [key, value] of Object.entries(replacements)) {
    const regex = new RegExp(key, 'gi');
    message = message.replace(regex, value);
  }

  return message;
}

/**
 * Update sequence progress after sending
 * Mark the day as sent and record timestamp
 */
export async function updateSequenceProgress(
  instanceId: string,
  dayNumber: number,
  sentAt: Date = new Date()
): Promise<void> {
  try {
    // Map day number to field name
    const dayFieldMap: Record<number, string> = {
      0: 'day0SentAt',
      1: 'day1SentAt',
      2: 'day2SentAt',
      3: 'day3SentAt'
    };

    const dayField = dayFieldMap[dayNumber];
    if (!dayField) {
      throw new Error(`Invalid day number: ${dayNumber}`);
    }

    // Update the instance
    await prisma.contactSequenceInstance.update({
      where: { id: instanceId },
      data: {
        [dayField]: sentAt,
        updatedAt: new Date()
      }
    });

    logger.log('[sequence-lifecycle] Progress updated', {
      instanceId,
      dayNumber,
      sentAt: sentAt.toISOString()
    });
  } catch (error) {
    logger.error('[sequence-lifecycle] Error updating progress', {
      instanceId,
      dayNumber,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Get all active sequence instances
 * That are ready to send the next message
 */
export async function getActiveSequenceInstances(
  organizationId: string,
  limit: number = 100,
  offset: number = 0
): Promise<Array<any>> {
  try {
    const instances = await prisma.contactSequenceInstance.findMany({
      where: {
        status: 'ACTIVE',
        template: {
          organizationId
        }
      },
      include: {
        template: true
      },
      orderBy: {
        createdAt: 'asc'
      },
      take: limit,
      skip: offset
    });

    // Fetch contact details separately
    const enriched = await Promise.all(
      instances.map(async (instance) => {
        const contact = await prisma.contact.findUnique({
          where: { id: instance.contactId },
          select: {
            id: true,
            name: true,
            phone: true,
            productName: true,
            lensMetadata: true
          }
        });

        return {
          ...instance,
          contact
        };
      })
    );

    return enriched;
  } catch (error) {
    logger.error('[sequence-lifecycle] Error fetching active instances', {
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return [];
  }
}

/**
 * Check if sequence is complete
 * All 4 days have been sent or time window has passed
 */
export function isSequenceComplete(instance: any): boolean {
  return (
    instance.day0SentAt !== null &&
    instance.day1SentAt !== null &&
    instance.day2SentAt !== null &&
    instance.day3SentAt !== null
  );
}

/**
 * Check if sequence should be marked as failed/paused
 * If 7+ days have elapsed without completing all days
 */
export function shouldMarkAsFailed(instance: any, createdAt: Date): boolean {
  const now = new Date();
  const elapsedDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  // If 7+ days have passed and not all days sent, mark as failed
  return elapsedDays >= 7 && !isSequenceComplete(instance);
}
