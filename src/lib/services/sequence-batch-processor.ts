/**
 * Sequence Batch Processor
 * Handles parallel processing of Day 0-3 message sends
 *
 * Responsibilities:
 * - Fetch active sequence instances
 * - Process in parallel batches for performance
 * - Track success/error per contact
 * - Manage rate limiting and retries
 * - Return summary statistics
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  calculateCurrentDay,
  shouldSendDay,
  getSequenceDayTemplate,
  performSubstitution,
  updateSequenceProgress,
  getActiveSequenceInstances
} from './sequence-lifecycle-service';

interface BatchProcessResult {
  sentCount: number;
  errorCount: number;
  skippedCount: number;
  errors: Array<{
    contactId: string;
    instanceId: string;
    dayNumber: number;
    error: string;
  }>;
}

/**
 * Send SMS message via Aligo API
 * Private helper function
 */
async function sendSmsViaAligo(
  organizationId: string,
  phone: string,
  message: string
): Promise<{ success: boolean; msgId?: string; errorCode?: string }> {
  try {
    if (!process.env.ALIGO_API_KEY || !process.env.ALIGO_USER_ID || !process.env.ALIGO_SENDER_PHONE) {
      logger.error('[batch-processor] Aligo credentials missing');
      return { success: false, errorCode: 'MISSING_CREDENTIALS' };
    }

    const response = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      body: new URLSearchParams({
        key: process.env.ALIGO_API_KEY,
        user_id: process.env.ALIGO_USER_ID,
        sender: process.env.ALIGO_SENDER_PHONE,
        receiver: phone,
        msg: message
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const data = await response.json();

    if (data.result_code === '1') {
      return { success: true, msgId: data.msg_id };
    } else {
      logger.warn('[batch-processor] Aligo send failed', {
        resultCode: data.result_code,
        message: data.message
      });
      return { success: false, errorCode: data.result_code };
    }
  } catch (error) {
    logger.error('[batch-processor] Error sending SMS', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return { success: false, errorCode: 'NETWORK_ERROR' };
  }
}

/**
 * Log SMS send for analytics and audit
 * Fire-and-forget operation
 */
async function logSmsEvent(
  organizationId: string,
  contactId: string,
  phone: string,
  content: string,
  instanceId: string,
  dayNumber: number,
  status: 'SENT' | 'FAILED' | 'SKIPPED',
  msgId?: string
): Promise<void> {
  try {
    // Log to SmsLog
    await prisma.smsLog.create({
      data: {
        organizationId,
        contactId,
        phone,
        contentPreview: content.substring(0, 100),
        status,
        msgId: msgId || undefined,
        channel: 'DAY_0_3_SEQUENCE',
        segmentCode: `DAY${dayNumber}_SEQUENCE`
      }
    });

    // Update Contact fields for Day 0 sends
    if (dayNumber === 0 && status === 'SENT') {
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          smsDay0Sent: true,
          smsDay0SentAt: new Date()
        }
      });
    }
  } catch (error) {
    logger.error('[batch-processor] Error logging SMS event', {
      contactId,
      dayNumber,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    // Don't throw - logging errors shouldn't break the process
  }
}

/**
 * Process a single sequence instance
 * Determine if message should be sent and send it
 */
async function processSingleInstance(
  instance: any,
  organizationId: string
): Promise<{ success: boolean; dayNumber?: number; error?: string }> {
  try {
    if (!instance.template || !instance.contact) {
      return { success: false, error: 'Missing template or contact' };
    }

    // Calculate current day
    const currentDay = calculateCurrentDay(instance.createdAt);

    // Check if day was already sent
    const sentDays = [
      instance.day0SentAt ? 0 : null,
      instance.day1SentAt ? 1 : null,
      instance.day2SentAt ? 2 : null,
      instance.day3SentAt ? 3 : null
    ].filter((d) => d !== null) as number[];

    if (!shouldSendDay(currentDay, sentDays)) {
      return { success: false, error: `Day ${currentDay} already sent` };
    }

    // Get template
    const template = await getSequenceDayTemplate(
      organizationId,
      instance.sequenceId,
      currentDay,
      instance.contact.lensMetadata?.lensId
    );

    if (!template) {
      return {
        success: false,
        error: `No template found for day ${currentDay}`
      };
    }

    // Perform substitution
    const message = await performSubstitution(template, instance.contact, instance.template);

    // Send SMS
    const smsResult = await sendSmsViaAligo(
      organizationId,
      instance.contact.phone,
      message
    );

    if (!smsResult.success) {
      // Log failure
      await logSmsEvent(
        organizationId,
        instance.contactId,
        instance.contact.phone,
        message,
        instance.id,
        currentDay,
        'FAILED'
      );

      return {
        success: false,
        dayNumber: currentDay,
        error: `SMS send failed: ${smsResult.errorCode}`
      };
    }

    // Update progress
    await updateSequenceProgress(instance.id, currentDay);

    // Log success
    await logSmsEvent(
      organizationId,
      instance.contactId,
      instance.contact.phone,
      message,
      instance.id,
      currentDay,
      'SENT',
      smsResult.msgId
    );

    logger.log('[batch-processor] Message sent', {
      contactId: instance.contactId,
      instanceId: instance.id,
      dayNumber: currentDay,
      msgId: smsResult.msgId
    });

    return { success: true, dayNumber: currentDay };
  } catch (error) {
    logger.error('[batch-processor] Error processing instance', {
      instanceId: instance.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Process sequences in parallel batches
 * Returns summary of sends and errors
 */
export async function processActiveSequences(
  organizationId: string,
  batchSize: number = 10,
  maxPerRun: number = 100
): Promise<BatchProcessResult> {
  const result: BatchProcessResult = {
    sentCount: 0,
    errorCount: 0,
    skippedCount: 0,
    errors: []
  };

  try {
    logger.log('[batch-processor] Starting batch process', {
      organizationId,
      batchSize,
      maxPerRun
    });

    // Fetch active instances
    const instances = await getActiveSequenceInstances(organizationId, maxPerRun);

    if (instances.length === 0) {
      logger.log('[batch-processor] No active instances found', { organizationId });
      return result;
    }

    logger.log('[batch-processor] Found instances', {
      count: instances.length
    });

    // Process in parallel batches
    for (let i = 0; i < instances.length; i += batchSize) {
      const batch = instances.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map((instance) => processSingleInstance(instance, organizationId))
      );

      // Aggregate results
      for (let j = 0; j < batchResults.length; j++) {
        const batchResult = batchResults[j];
        const instance = batch[j];

        if (batchResult.success) {
          result.sentCount++;
        } else {
          result.errorCount++;
          result.errors.push({
            contactId: instance.contactId,
            instanceId: instance.id,
            dayNumber: batchResult.dayNumber || -1,
            error: batchResult.error || 'Unknown error'
          });
        }
      }

      // Log batch progress
      logger.log('[batch-processor] Batch processed', {
        batchNumber: Math.floor(i / batchSize) + 1,
        batchSize: batch.length,
        sentCount: result.sentCount,
        errorCount: result.errorCount
      });
    }

    logger.log('[batch-processor] Batch process completed', {
      sentCount: result.sentCount,
      errorCount: result.errorCount,
      skippedCount: result.skippedCount
    });

    return result;
  } catch (error) {
    logger.error('[batch-processor] Batch process failed', {
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    throw error;
  }
}

/**
 * Process sequences for a specific organization
 * Entry point for cron jobs
 */
export async function processSequencesForOrg(
  organizationId: string
): Promise<BatchProcessResult> {
  return processActiveSequences(organizationId, 10, 100);
}
