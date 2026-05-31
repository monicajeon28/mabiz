/**
 * Sequence Service - Business logic for Day 0-3 SMS sequences
 */

import { prisma } from '@/lib/prisma';
import {
  SmsSequenceTemplateDTO,
  ContactSequenceInstanceDTO,
  CreateSequenceRequest,
  UpdateSequenceRequest,
  DeploySequenceRequest,
  SequenceDetails,
  DayDetail,
  PerformanceMetrics,
  DayMetrics,
  OverallMetrics,
  SequenceConditions,
  DEFAULT_DELAYS,
  PASONA_STAGES
} from '@/lib/types/sequence';

/**
 * Create a new Day 0-3 sequence template
 */
export async function createSequence(
  organizationId: string,
  userId: string,
  request: CreateSequenceRequest
): Promise<SmsSequenceTemplateDTO> {
  const {
    name,
    description,
    productCode,
    psychologyLens,
    days,
    conditions,
    triggerOn = 'PURCHASE',
    day0Delay = DEFAULT_DELAYS.day0,
    day1Delay = DEFAULT_DELAYS.day1,
    day2Delay = DEFAULT_DELAYS.day2,
    day3Delay = DEFAULT_DELAYS.day3
  } = request;

  // Create sequence template
  const sequence = await prisma.smsSequenceTemplate.create({
    data: {
      organizationId,
      name,
      description,
      productCode,
      psychologyLens,
      day0Delay,
      day1Delay,
      day2Delay,
      day3Delay,
      conditions: conditions || undefined,
      triggerOn,
      status: 'DRAFT',
      createdByUserId: userId
    }
  });

  // Create variants for each day
  if (days && days.length > 0) {
    for (const dayConfig of days) {
      if (dayConfig.variants && dayConfig.variants.length > 0) {
        for (const variant of dayConfig.variants) {
          await prisma.smsSequenceVariant.create({
            data: {
              sequenceId: sequence.id,
              variantCode: variant.code,
              day: dayConfig.day,
              messageContent: variant.message,
              psychology: variant.psychology,
              lensName: dayConfig.lensName,
              pasonaStage: PASONA_STAGES[dayConfig.day]?.stage
            }
          });
        }
      }
    }
  }

  return sequence as SmsSequenceTemplateDTO;
}

/**
 * Get sequence by ID with full details
 */
export async function getSequence(
  organizationId: string,
  sequenceId: string
): Promise<SequenceDetails | null> {
  const template = await prisma.smsSequenceTemplate.findUnique({
    where: { id: sequenceId },
    include: {
      variants: {
        orderBy: { day: 'asc' }
      }
    }
  });

  if (!template || template.organizationId !== organizationId) {
    return null;
  }

  // Build detailed response
  const days: DayDetail[] = [0, 1, 2, 3].map(day => {
    const dayVariants = template.variants.filter(v => v.day === day);
    const dayConfig = [
      { delay: template.day0Delay },
      { delay: template.day1Delay },
      { delay: template.day2Delay },
      { delay: template.day3Delay }
    ][day];

    return {
      day,
      delay: dayConfig?.delay || 0,
      message: dayVariants[0]?.messageContent || '',
      psychology: dayVariants[0]?.psychology,
      lens: template.psychologyLens,
      framework: PASONA_STAGES[day]?.name || 'Unknown',
      expectedOpenRate: getExpectedRate(day, 'open'),
      expectedClickRate: getExpectedRate(day, 'click'),
      variants: dayVariants as any
    };
  });

  const performance = await calculatePerformance(sequenceId);

  return {
    ...template,
    days,
    performance
  } as SequenceDetails;
}

/**
 * List sequences for organization
 */
export async function listSequences(
  organizationId: string,
  filters?: {
    productCode?: string;
    status?: string;
    psychologyLens?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ sequences: SmsSequenceTemplateDTO[]; total: number }> {
  const where: any = { organizationId };

  if (filters?.productCode) {
    where.productCode = filters.productCode;
  }
  if (filters?.status) {
    where.status = filters.status;
  }
  if (filters?.psychologyLens) {
    where.psychologyLens = filters.psychologyLens;
  }

  const [sequences, total] = await Promise.all([
    prisma.smsSequenceTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
      skip: filters?.offset || 0
    }),
    prisma.smsSequenceTemplate.count({ where })
  ]);

  return { sequences: sequences as SmsSequenceTemplateDTO[], total };
}

/**
 * Update sequence configuration
 */
export async function updateSequence(
  organizationId: string,
  sequenceId: string,
  request: UpdateSequenceRequest
): Promise<SmsSequenceTemplateDTO> {
  // Verify ownership
  const existing = await prisma.smsSequenceTemplate.findUnique({
    where: { id: sequenceId }
  });

  if (!existing || existing.organizationId !== organizationId) {
    throw new Error('Sequence not found or unauthorized');
  }

  const updated = await prisma.smsSequenceTemplate.update({
    where: { id: sequenceId },
    data: {
      name: request.name,
      description: request.description,
      productCode: request.productCode,
      psychologyLens: request.psychologyLens,
      day0Delay: request.day0Delay,
      day1Delay: request.day1Delay,
      day2Delay: request.day2Delay,
      day3Delay: request.day3Delay,
      conditions: request.conditions,
      triggerOn: request.triggerOn,
      status: request.status
    }
  });

  return updated as SmsSequenceTemplateDTO;
}

/**
 * Deploy sequence to contacts
 */
export async function deploySequence(
  organizationId: string,
  sequenceId: string,
  request: DeploySequenceRequest
): Promise<{ deployed: number; scheduled: number }> {
  // Verify sequence exists
  const sequence = await prisma.smsSequenceTemplate.findUnique({
    where: { id: sequenceId }
  });

  if (!sequence || sequence.organizationId !== organizationId) {
    throw new Error('Sequence not found');
  }

  let contactIds: string[] = [];

  if (request.contactIds) {
    contactIds = request.contactIds;
  } else if (request.segmentCode) {
    // Find contacts matching segment
    const contacts = await prisma.contact.findMany({
      where: {
        organizationId,
        segment: request.segmentCode
      },
      select: { id: true }
    });
    contactIds = contacts.map(c => c.id);
  }

  // Deduplicate
  const uniqueContactIds = [...new Set(contactIds)];

  // Create instances
  let deployed = 0;
  const now = new Date();

  for (const contactId of uniqueContactIds) {
    // Skip if already active
    const existing = await prisma.contactSequenceInstance.findUnique({
      where: {
        contactId_sequenceId: { contactId, sequenceId }
      }
    });

    if (existing && ['ACTIVE', 'PAUSED'].includes(existing.status)) {
      continue;
    }

    // Create or update instance
    const nextSendAt = new Date(now.getTime() + sequence.day0Delay * 60 * 1000);

    await prisma.contactSequenceInstance.upsert({
      where: {
        contactId_sequenceId: { contactId, sequenceId }
      },
      update: {
        status: 'ACTIVE',
        nextSendAt,
        pausedAt: null
      },
      create: {
        organizationId,
        contactId,
        sequenceId,
        status: 'ACTIVE',
        nextSendAt
      }
    });

    deployed++;
  }

  // Update template status if deploying from DRAFT
  if (sequence.status === 'DRAFT') {
    await prisma.smsSequenceTemplate.update({
      where: { id: sequenceId },
      data: {
        status: 'ACTIVE',
        deployedAt: now
      }
    });
  }

  return { deployed, scheduled: deployed };
}

/**
 * Pause/Resume sequence for a contact
 */
export async function pauseSequence(
  organizationId: string,
  sequenceId: string,
  contactId: string,
  userId: string
): Promise<ContactSequenceInstanceDTO> {
  const instance = await prisma.contactSequenceInstance.findUnique({
    where: {
      contactId_sequenceId: { contactId, sequenceId }
    }
  });

  if (!instance || instance.organizationId !== organizationId) {
    throw new Error('Instance not found');
  }

  const newStatus = instance.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';

  const updated = await prisma.contactSequenceInstance.update({
    where: { id: instance.id },
    data: {
      status: newStatus,
      pausedAt: newStatus === 'PAUSED' ? new Date() : null,
      pausedBy: newStatus === 'PAUSED' ? userId : null
    }
  });

  return updated as ContactSequenceInstanceDTO;
}

/**
 * Calculate performance metrics for a sequence
 */
export async function calculatePerformance(sequenceId: string): Promise<PerformanceMetrics> {
  // Query SMS logs for this sequence
  const logs = await prisma.smsLog.findMany({
    where: {
      // Assuming sequenceId is tracked in SmsLog (to be added in Phase 2)
      // For now, we'll return mock data structure
    }
  });

  // This will be properly implemented when SmsLog integration is complete
  const emptyDay: DayMetrics = {
    sent: 0,
    opened: 0,
    clicked: 0,
    converted: 0,
    openRate: '0%',
    clickRate: '0%',
    convertRate: '0%'
  };

  return {
    day0: emptyDay,
    day1: emptyDay,
    day2: emptyDay,
    day3: emptyDay,
    overall: {
      totalSent: 0,
      totalOpened: 0,
      totalClicked: 0,
      totalConverted: 0,
      cumulativeOpenRate: '0%',
      cumulativeClickRate: '0%',
      cumulativeConvertRate: '0%'
    }
  };
}

/**
 * Get next scheduled day for sending
 */
export async function getNextSequenceDay(
  instanceId: string
): Promise<{ day: number; nextSendAt: Date } | null> {
  const instance = await prisma.contactSequenceInstance.findUnique({
    where: { id: instanceId }
  });

  if (!instance) {
    return null;
  }

  // Determine next day
  let nextDay = 0;
  if (instance.day0SentAt) nextDay++;
  if (instance.day1SentAt) nextDay++;
  if (instance.day2SentAt) nextDay++;
  if (instance.day3SentAt) nextDay++;

  if (nextDay > 3) {
    // All days sent
    return null;
  }

  return {
    day: nextDay,
    nextSendAt: instance.nextSendAt || new Date()
  };
}

/**
 * Archive sequence
 */
export async function archiveSequence(
  organizationId: string,
  sequenceId: string
): Promise<void> {
  const sequence = await prisma.smsSequenceTemplate.findUnique({
    where: { id: sequenceId }
  });

  if (!sequence || sequence.organizationId !== organizationId) {
    throw new Error('Sequence not found');
  }

  // Update status to ARCHIVED
  await prisma.smsSequenceTemplate.update({
    where: { id: sequenceId },
    data: { status: 'ARCHIVED' }
  });

  // Archive related instances
  await prisma.contactSequenceInstance.updateMany({
    where: { sequenceId },
    data: { status: 'COMPLETED' }
  });
}

/**
 * Helper: Get expected rate for benchmarking
 */
function getExpectedRate(day: number, type: 'open' | 'click'): string {
  const benchmarks: Record<number, Record<string, string>> = {
    0: { open: '28-35%', click: '8-12%' },
    1: { open: '18-22%', click: '6-10%' },
    2: { open: '12-15%', click: '3-8%' },
    3: { open: '8-12%', click: '2-5%' }
  };
  return benchmarks[day]?.[type] || '0%';
}

/**
 * Get sequence with variant winners
 */
export async function getSequenceWithWinners(sequenceId: string): Promise<any> {
  const sequence = await prisma.smsSequenceTemplate.findUnique({
    where: { id: sequenceId },
    include: {
      variants: {
        where: { isWinner: true },
        orderBy: { day: 'asc' }
      }
    }
  });

  return sequence;
}

/**
 * Update variant as winner (used after A/B test)
 */
export async function markVariantAsWinner(
  sequenceId: string,
  day: number,
  variantCode: string
): Promise<void> {
  // First, unmark all other winners for this day
  await prisma.smsSequenceVariant.updateMany({
    where: {
      sequenceId,
      day,
      isWinner: true
    },
    data: { isWinner: false }
  });

  // Mark new winner
  await prisma.smsSequenceVariant.updateMany({
    where: {
      sequenceId,
      day,
      variantCode
    },
    data: { isWinner: true }
  });
}

/**
 * Validate sequence conditions match contact
 */
export function matchesConditions(
  contact: any,
  conditions: Record<string, any> | null
): boolean {
  if (!conditions) return true;

  // Check productCode
  if (conditions.productCode && Array.isArray(conditions.productCode)) {
    if (!conditions.productCode.includes(contact.productName)) {
      return false;
    }
  }

  // Check lens
  if (conditions.lens && Array.isArray(conditions.lens)) {
    const contactLenses = contact.lensMetadata?.lenses || [];
    if (!conditions.lens.some((l: string) => contactLenses.includes(l))) {
      return false;
    }
  }

  // Check value range
  if (conditions.minValue && contact.quotedPrice < conditions.minValue) {
    return false;
  }
  if (conditions.maxValue && contact.quotedPrice > conditions.maxValue) {
    return false;
  }

  return true;
}
