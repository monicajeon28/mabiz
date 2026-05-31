/**
 * Delivery Optimizer
 * Manages outreach frequency, respects opt-outs, prevents fatigue
 * Rules: Max 2 messages/day, 2-day gaps between similar messages, quiet hours, opt-out respect
 */

import { prisma } from '@/lib/prisma';
import { Contact, ScheduledSms } from '@prisma/client';

export interface DeliveryConstraints {
  maxMessagesPerDay: number; // Default: 2
  minGapBetweenSimilarMessages: number; // Hours, default: 48
  quietHoursStart: number; // Hour of day, default: 21 (9 PM)
  quietHoursEnd: number; // Hour of day, default: 8 (8 AM)
  respectOptOut: boolean; // Default: true
  maxMessagesPerWeek: number; // Default: 7
}

export interface DeliveryWindowAnalysis {
  contactId: string;
  canSendNow: boolean;
  nextOptimalTime: Date;
  reasonsForWait: string[];
  currentDayMessageCount: number;
  currentWeekMessageCount: number;
  lastMessageTime: Date | null;
  lastMessageChannel: string | null;
  availableChannels: ('SMS' | 'EMAIL' | 'CALL')[];
}

export class DeliveryOptimizer {
  private readonly DEFAULT_CONSTRAINTS: DeliveryConstraints = {
    maxMessagesPerDay: 2,
    minGapBetweenSimilarMessages: 48,
    quietHoursStart: 21, // 9 PM
    quietHoursEnd: 8, // 8 AM
    respectOptOut: true,
    maxMessagesPerWeek: 7
  };

  /**
   * Analyze delivery window for a contact
   */
  async analyzeDeliveryWindow(
    contactId: string,
    proposedChannel: 'SMS' | 'EMAIL' | 'CALL'
  ): Promise<DeliveryWindowAnalysis> {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId }
    });

    if (!contact) {
      throw new Error(`Contact not found: ${contactId}`);
    }

    const constraints = this.DEFAULT_CONSTRAINTS;
    const now = new Date();

    // Check opt-outs
    const optedOut = contact.optOutAt !== null;

    if (optedOut && constraints.respectOptOut) {
      return {
        contactId,
        canSendNow: false,
        nextOptimalTime: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days
        reasonsForWait: [`Contact opted out of ${proposedChannel}`],
        currentDayMessageCount: 0,
        currentWeekMessageCount: 0,
        lastMessageTime: null,
        lastMessageChannel: null,
        availableChannels: this.getAvailableChannels(contact)
      };
    }

    // Get recent message activity
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 7);

    const todayMessages = await prisma.scheduledSms.count({
      where: {
        contactId,
        createdAt: { gte: today },
        status: { in: ['DELIVERED', 'SCHEDULED'] }
      }
    });

    const weekMessages = await prisma.scheduledSms.count({
      where: {
        contactId,
        createdAt: { gte: weekStart },
        status: { in: ['DELIVERED', 'SCHEDULED'] }
      }
    });

    // Get last message
    const lastMessage = await prisma.scheduledSms.findFirst({
      where: {
        contactId,
        status: { in: ['DELIVERED', 'SCHEDULED'] }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Check daily frequency
    const dayExceeded = todayMessages >= constraints.maxMessagesPerDay;
    const weekExceeded = weekMessages >= constraints.maxMessagesPerWeek;

    // Check time window
    const inQuietHours = this.isInQuietHours(now, constraints);

    // Check gap since last message
    const timeSinceLastMessage = lastMessage ? (now.getTime() - lastMessage.createdAt.getTime()) / (1000 * 60 * 60) : Infinity;
    const gapExceeded = timeSinceLastMessage < constraints.minGapBetweenSimilarMessages && lastMessage?.channel === proposedChannel;

    // Determine next optimal time
    const nextOptimalTime = this.calculateNextOptimalTime(
      now,
      constraints,
      dayExceeded,
      weekExceeded,
      inQuietHours,
      gapExceeded,
      lastMessage?.createdAt ?? null
    );

    const reasonsForWait: string[] = [];
    if (dayExceeded) reasonsForWait.push(`Already sent ${todayMessages} messages today (max: ${constraints.maxMessagesPerDay})`);
    if (weekExceeded) reasonsForWait.push(`Already sent ${weekMessages} messages this week (max: ${constraints.maxMessagesPerWeek})`);
    if (inQuietHours) reasonsForWait.push('Current time in quiet hours (9 PM - 8 AM)');
    if (gapExceeded) reasonsForWait.push(`Only ${Math.round(timeSinceLastMessage)} hours since last ${proposedChannel} (min gap: ${constraints.minGapBetweenSimilarMessages}h)`);

    const canSendNow = !dayExceeded && !weekExceeded && !inQuietHours && !gapExceeded;

    return {
      contactId,
      canSendNow,
      nextOptimalTime,
      reasonsForWait,
      currentDayMessageCount: todayMessages,
      currentWeekMessageCount: weekMessages,
      lastMessageTime: lastMessage?.createdAt || null,
      lastMessageChannel: lastMessage?.channel || null,
      availableChannels: this.getAvailableChannels(contact)
    };
  }

  /**
   * Check if current time is in quiet hours
   */
  private isInQuietHours(date: Date, constraints: DeliveryConstraints): boolean {
    const hour = date.getHours();
    if (constraints.quietHoursStart < constraints.quietHoursEnd) {
      // Normal case: 8 AM - 9 PM
      return hour >= constraints.quietHoursStart || hour < constraints.quietHoursEnd;
    } else {
      // Wrapping case: 9 PM - 8 AM
      return hour >= constraints.quietHoursStart || hour < constraints.quietHoursEnd;
    }
  }

  /**
   * Calculate next optimal delivery time
   */
  private calculateNextOptimalTime(
    now: Date,
    constraints: DeliveryConstraints,
    dayExceeded: boolean,
    weekExceeded: boolean,
    inQuietHours: boolean,
    gapExceeded: boolean,
    lastMessageTime: Date | null
  ): Date {
    let nextTime = new Date(now);

    // If week exceeded, wait until next week
    if (weekExceeded) {
      const daysUntilWeekReset = 7 - ((now.getDay() + 1) % 7);
      nextTime.setDate(nextTime.getDate() + daysUntilWeekReset);
      nextTime.setHours(constraints.quietHoursEnd, 0, 0, 0);
      return nextTime;
    }

    // If in quiet hours, wait until quiet hours end
    if (inQuietHours) {
      if (now.getHours() >= constraints.quietHoursStart) {
        // After 9 PM, wait until 8 AM tomorrow
        nextTime.setDate(nextTime.getDate() + 1);
        nextTime.setHours(constraints.quietHoursEnd, 0, 0, 0);
      } else {
        // Between 12 AM - 8 AM, wait until 8 AM
        nextTime.setHours(constraints.quietHoursEnd, 0, 0, 0);
      }
      return nextTime;
    }

    // If day limit exceeded, wait until next day
    if (dayExceeded) {
      nextTime.setDate(nextTime.getDate() + 1);
      nextTime.setHours(constraints.quietHoursEnd, 0, 0, 0);
      return nextTime;
    }

    // If gap not met, wait for the gap
    if (gapExceeded && lastMessageTime) {
      nextTime = new Date(lastMessageTime.getTime() + constraints.minGapBetweenSimilarMessages * 60 * 60 * 1000);
      if (this.isInQuietHours(nextTime, constraints)) {
        nextTime.setHours(constraints.quietHoursEnd, 0, 0, 0);
      }
      return nextTime;
    }

    // Can send soon, prefer business hours
    if (now.getHours() < constraints.quietHoursEnd) {
      nextTime.setHours(constraints.quietHoursEnd, 0, 0, 0);
    } else if (now.getHours() >= constraints.quietHoursStart) {
      nextTime.setDate(nextTime.getDate() + 1);
      nextTime.setHours(constraints.quietHoursEnd, 0, 0, 0);
    }

    return nextTime;
  }

  /**
   * Get available channels for contact (not opted out)
   */
  private getAvailableChannels(contact: Contact): ('SMS' | 'EMAIL' | 'CALL')[] {
    const channels: ('SMS' | 'EMAIL' | 'CALL')[] = ['CALL']; // Always available

    if (!contact.optOutAt) {
      channels.push('SMS');
      channels.push('EMAIL');
    }

    return channels;
  }

  /**
   * Recommend best channel based on constraints and contact preference
   */
  async recommendChannel(
    contactId: string
  ): Promise<'SMS' | 'EMAIL' | 'CALL'> {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId }
    });

    if (!contact) throw new Error(`Contact not found: ${contactId}`);

    const availableChannels = this.getAvailableChannels(contact);

    // Prefer SMS (highest engagement) if available
    if (availableChannels.includes('SMS')) return 'SMS';
    if (availableChannels.includes('EMAIL')) return 'EMAIL';
    return 'CALL';
  }

  /**
   * Schedule message with automatic constraint checking
   */
  async scheduleWithConstraints(
    contactId: string,
    message: string,
    proposedChannel: 'SMS' | 'EMAIL' | 'CALL'
  ): Promise<{ scheduled: boolean; scheduledTime: Date; reason: string }> {
    const analysis = await this.analyzeDeliveryWindow(contactId, proposedChannel);

    if (analysis.canSendNow) {
      return {
        scheduled: true,
        scheduledTime: new Date(),
        reason: 'Scheduled immediately'
      };
    }

    return {
      scheduled: true,
      scheduledTime: analysis.nextOptimalTime,
      reason: analysis.reasonsForWait.join('; ')
    };
  }

  /**
   * Batch validate delivery windows for campaign
   */
  async validateDeliveryWindowsBatch(
    contactIds: string[],
    channel: 'SMS' | 'EMAIL' | 'CALL'
  ): Promise<Map<string, DeliveryWindowAnalysis>> {
    const results = new Map<string, DeliveryWindowAnalysis>();

    for (const contactId of contactIds) {
      const analysis = await this.analyzeDeliveryWindow(contactId, channel);
      results.set(contactId, analysis);
    }

    return results;
  }

  /**
   * Get contacts ready for immediate delivery
   */
  async getReadyForImmediateDelivery(
    organizationId: string,
    channel: 'SMS' | 'EMAIL' | 'CALL',
    limit: number = 100
  ): Promise<Contact[]> {
    const contacts = await prisma.contact.findMany({
      where: {
        organizationId,
        deletedAt: null,
        // Channel-specific filters
        ...(channel === 'SMS' && { smsOptOut: false }),
        ...(channel === 'EMAIL' && { emailOptOut: false })
      },
      take: limit
    });

    const readyContacts: Contact[] = [];

    for (const contact of contacts) {
      const analysis = await this.analyzeDeliveryWindow(contact.id, channel);
      if (analysis.canSendNow) {
        readyContacts.push(contact);
      }
    }

    return readyContacts;
  }
}
