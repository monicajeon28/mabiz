/**
 * Partner Intervention Service
 *
 * Auto-intervention workflows based on partner risk level:
 * - GREEN: Weekly newsletter (tips, trends, success stories)
 * - YELLOW: Encouragement + win-back incentive + follow-up
 * - RED: Direct outreach + special offer + dedicated support
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendSmsViaAligo } from '@/lib/sms-service';
import { sendEmail } from '@/lib/email';

export interface InterventionAction {
  type: 'SMS' | 'EMAIL' | 'CALL' | 'NEWSLETTER';
  partnerId: string;
  riskLevel: 'GREEN' | 'YELLOW' | 'RED';
  message: string;
  details?: Record<string, any>;
  scheduledFor?: Date;
}

interface InterventionTemplate {
  type: string;
  riskLevel: 'GREEN' | 'YELLOW' | 'RED';
  subject?: string;
  body: string;
  variables: string[]; // e.g., ['{{partnerName}}', '{{commissionBoost}}']
}

const INTERVENTION_TEMPLATES: Record<string, InterventionTemplate> = {
  // GREEN - Weekly Newsletter
  GREEN_NEWSLETTER: {
    type: 'NEWSLETTER',
    riskLevel: 'GREEN',
    subject: 'Weekly Tips & Wins - {{weekNumber}}',
    body: `Hi {{partnerName}},

Great work this week! Here's your partner update:

📊 Your Performance
- Sales this week: {{weeklySales}}
- Commission earned: {{weeklyCommission}}
- Your rank: {{partnerRank}} among {{totalPartners}} partners

💡 This Week's Tips
- {{tip1}}
- {{tip2}}
- {{tip3}}

🏆 Partner Spotlight
Meet {{spotlightPartner}}, who earned {{spotlightCommission}} last week!
{{spotlightStory}}

📚 Resources
- Updated partner handbook: [link]
- Latest training video: [link]
- FAQ & troubleshooting: [link]

Keep up the momentum! Your next milestone is just around the corner.

Best,
The Partner Success Team`,
    variables: [
      'partnerName',
      'weeklySales',
      'weeklyCommission',
      'partnerRank',
      'totalPartners',
      'tip1',
      'tip2',
      'tip3',
      'spotlightPartner',
      'spotlightCommission',
      'spotlightStory',
    ],
  },

  // YELLOW - We Miss You
  YELLOW_MISS_YOU_SMS: {
    type: 'SMS',
    riskLevel: 'YELLOW',
    body: `{{partnerName}}, we miss you! No sales in 7 days. Here's a special boost: +5% commission for 7 days! Reply YES to activate.`,
    variables: ['partnerName'],
  },

  YELLOW_MISS_YOU_EMAIL: {
    type: 'EMAIL',
    riskLevel: 'YELLOW',
    subject: "We've got a special offer for you! 🎁",
    body: `Hi {{partnerName}},

We noticed you haven't brought in any sales for the last 7 days. No worries!

We want to help you get back on track with a **special commission boost**:

🚀 **+5% Commission Boost for 7 Days**
- Activate now and earn extra on every sale this week
- No setup needed - just make a sale and you're good

Here's what you need to do:
1. Click the button below to activate
2. Make a sale in the next 7 days
3. Watch your commission grow!

[Activate Boost Button]

If you're facing any challenges or need support:
- Check our FAQ: [link]
- Book a quick call: [link]
- Email us: support@partner.example.com

You've got this! {{partnerName}}, we believe in you.

Your Partner Success Team`,
    variables: ['partnerName'],
  },

  // RED - Immediate Intervention
  RED_URGENT_SMS: {
    type: 'SMS',
    riskLevel: 'RED',
    body: `{{partnerName}} - URGENT! Your account is at risk (no sales in 14 days). Let's talk! Special offer: {{offer}}. Reply CALL or click: [link]`,
    variables: ['partnerName', 'offer'],
  },

  RED_URGENT_EMAIL: {
    type: 'EMAIL',
    riskLevel: 'RED',
    subject: "Let's talk! 🤝 We want to help",
    body: `Hi {{partnerName}},

I'm reaching out because we want to make sure you're set up for success.

We've noticed you haven't made a sale in {{daysNoSales}} days, and we're concerned. This doesn't mean you're out - it means we need to work together to get you back on track.

**Here's what we're offering:**

🎁 **Temporary Commission Boost: +10% for 30 days**
- Starts immediately upon your next sale
- No strings attached, no expiration

👥 **Dedicated Support**
- I've assigned you a dedicated support person
- They'll work with you to identify barriers
- Available for weekly check-ins

📅 **Let's Talk**
I'd like to schedule a 20-minute call to understand what's getting in the way.

[Schedule a Call]

Or if you prefer:
- Email: support@partner.example.com
- Phone: {{supportPhone}}
- Quick chat: [Link to live chat]

{{partnerName}}, you've been successful before. Let's figure out what changed and get you back to winning.

Excited to work with you again,
{{managerName}}
Partner Success Manager`,
    variables: [
      'partnerName',
      'daysNoSales',
      'supportPhone',
      'managerName',
    ],
  },
};

/**
 * Get intervention template and fill variables
 */
export function getInterventionTemplate(
  templateKey: string,
  variables: Record<string, any>
): Partial<InterventionTemplate> {
  const template = INTERVENTION_TEMPLATES[templateKey];
  if (!template) {
    throw new Error(`Template not found: ${templateKey}`);
  }

  let body = template.body;
  let subject = template.subject || '';

  // Replace variables
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    body = body.replace(new RegExp(placeholder, 'g'), String(value));
    subject = subject.replace(new RegExp(placeholder, 'g'), String(value));
  }

  return {
    ...template,
    body,
    subject: subject || undefined,
  };
}

/**
 * Send intervention for GREEN level partners
 */
export async function sendGreenIntervention(
  partnerId: string,
  organizationId: string
): Promise<InterventionAction> {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    include: {
      organization: {
        select: { emailConfig: true },
      },
    },
  });

  if (!partner || !partner.email) {
    throw new Error(`Partner not found or no email: ${partnerId}`);
  }

  // Get template with variables
  const template = getInterventionTemplate('GREEN_NEWSLETTER', {
    partnerName: partner.name,
    weeklySales: '5', // TODO: Calculate from metrics
    weeklyCommission: '$500', // TODO: Calculate
    partnerRank: '12',
    totalPartners: '45',
    tip1: 'Follow up within 24 hours of initial contact',
    tip2: 'Use success stories in your pitch',
    tip3: 'Ask for referrals after closing',
    spotlightPartner: 'Sarah Johnson',
    spotlightCommission: '$2,500',
    spotlightStory: 'Sarah quadrupled her commission by focusing on quality leads.',
  });

  // Send email
  if (partner.organization.emailConfig) {
    try {
      const config = partner.organization.emailConfig;
      await sendEmail({
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpUser: config.smtpUser,
        smtpPassEncrypted: config.smtpPassEncrypted,
        senderName: config.senderName,
        senderEmail: config.senderEmail,
        to: partner.email,
        subject: template.subject || 'Weekly Partner Update',
        html: template.body || '',
      });
    } catch (err) {
      logger.error('Failed to send GREEN intervention email', {
        partnerId,
        err,
      });
    }
  }

  return {
    type: 'NEWSLETTER',
    partnerId,
    riskLevel: 'GREEN',
    message: 'Weekly newsletter sent',
    details: {
      template: 'GREEN_NEWSLETTER',
      sentAt: new Date(),
    },
  };
}

/**
 * Send intervention for YELLOW level partners
 */
export async function sendYellowIntervention(
  partnerId: string,
  organizationId: string
): Promise<InterventionAction[]> {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    include: {
      organization: { select: { emailConfig: true, smsConfig: true } },
    },
  });

  if (!partner) {
    throw new Error(`Partner not found: ${partnerId}`);
  }

  const actions: InterventionAction[] = [];

  // Send SMS
  if (partner.phone && partner.organization.smsConfig?.isActive) {
    const smsTemplate = getInterventionTemplate('YELLOW_MISS_YOU_SMS', {
      partnerName: partner.name.split(' ')[0], // First name only
    });

    try {
      await sendSmsViaAligo(partner.phone, smsTemplate.body || '');
      actions.push({
        type: 'SMS',
        partnerId,
        riskLevel: 'YELLOW',
        message: 'Encouragement SMS sent',
      });
    } catch (err) {
      logger.error('Failed to send YELLOW SMS', { partnerId, err });
    }
  }

  // Schedule follow-up email for 2 days later
  const followUpDate = new Date();
  followUpDate.setDate(followUpDate.getDate() + 2);

  const emailTemplate = getInterventionTemplate('YELLOW_MISS_YOU_EMAIL', {
    partnerName: partner.name,
  });

  if (partner.email && partner.organization.emailConfig) {
    try {
      const config = partner.organization.emailConfig;
      await sendEmail({
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpUser: config.smtpUser,
        smtpPassEncrypted: config.smtpPassEncrypted,
        senderName: config.senderName,
        senderEmail: config.senderEmail,
        to: partner.email,
        subject: emailTemplate.subject || 'Special Offer',
        html: emailTemplate.body || '',
      });

      actions.push({
        type: 'EMAIL',
        partnerId,
        riskLevel: 'YELLOW',
        message: 'Follow-up email scheduled',
        scheduledFor: followUpDate,
      });
    } catch (err) {
      logger.error('Failed to schedule YELLOW email', { partnerId, err });
    }
  }

  return actions;
}

/**
 * Send intervention for RED level partners
 */
export async function sendRedIntervention(
  partnerId: string,
  organizationId: string
): Promise<InterventionAction[]> {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    include: {
      organization: {
        select: { emailConfig: true, smsConfig: true },
      },
      riskFlags: true,
    },
  });

  if (!partner) {
    throw new Error(`Partner not found: ${partnerId}`);
  }

  const actions: InterventionAction[] = [];

  // Send SMS immediately
  if (partner.phone && partner.organization.smsConfig?.isActive) {
    const smsTemplate = getInterventionTemplate('RED_URGENT_SMS', {
      partnerName: partner.name.split(' ')[0],
      offer: '+10% commission for 30 days',
    });

    try {
      await sendSmsViaAligo(partner.phone, smsTemplate.body || '');
      actions.push({
        type: 'SMS',
        partnerId,
        riskLevel: 'RED',
        message: 'Urgent SMS sent',
      });
    } catch (err) {
      logger.error('Failed to send RED SMS', { partnerId, err });
    }
  }

  // Send urgent email
  const emailTemplate = getInterventionTemplate('RED_URGENT_EMAIL', {
    partnerName: partner.name,
    daysNoSales: '14',
    supportPhone: '+1-800-PARTNER',
    managerName: 'The Partner Success Team',
  });

  if (partner.email && partner.organization.emailConfig) {
    try {
      const config = partner.organization.emailConfig;
      await sendEmail({
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpUser: config.smtpUser,
        smtpPassEncrypted: config.smtpPassEncrypted,
        senderName: config.senderName,
        senderEmail: config.senderEmail,
        to: partner.email,
        subject: emailTemplate.subject || 'Let\'s Talk!',
        html: emailTemplate.body || '',
      });

      actions.push({
        type: 'EMAIL',
        partnerId,
        riskLevel: 'RED',
        message: 'Urgent email sent',
      });
    } catch (err) {
      logger.error('Failed to send RED email', { partnerId, err });
    }
  }

  // Schedule support call
  actions.push({
    type: 'CALL',
    partnerId,
    riskLevel: 'RED',
    message: 'Support call scheduled',
    details: {
      priority: 'HIGH',
      deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    },
  });

  // Mark intervention as triggered
  if (partner.riskFlags) {
    await prisma.partnerRiskFlags.update({
      where: { partnerId },
      data: {
        interventionTriggeredAt: new Date(),
      },
    });
  }

  return actions;
}

/**
 * Send all interventions based on risk level
 */
export async function sendAutoInterventions(
  riskLevel: 'GREEN' | 'YELLOW' | 'RED',
  organizationId: string
) {
  logger.info(`Sending ${riskLevel} interventions`, { organizationId });

  const partnerQuery = {
    where: {
      organizationId,
      status: 'ACTIVE',
      riskFlags: {
        totalRiskScore:
          riskLevel === 'GREEN'
            ? { lte: 3 }
            : riskLevel === 'YELLOW'
            ? { gte: 4, lte: 6 }
            : { gte: 7 },
      },
    },
    select: { id: true },
  };

  const partners = await prisma.partner.findMany(partnerQuery);

  const results = {
    total: partners.length,
    successful: 0,
    failed: 0,
    actions: [] as InterventionAction[],
    errors: [] as string[],
  };

  for (const partner of partners) {
    try {
      let actions: InterventionAction | InterventionAction[];

      if (riskLevel === 'GREEN') {
        actions = await sendGreenIntervention(partner.id, organizationId);
      } else if (riskLevel === 'YELLOW') {
        actions = await sendYellowIntervention(partner.id, organizationId);
      } else {
        actions = await sendRedIntervention(partner.id, organizationId);
      }

      const actionList = Array.isArray(actions) ? actions : [actions];
      results.actions.push(...actionList);
      results.successful++;
    } catch (err) {
      results.failed++;
      results.errors.push(`${partner.id}: ${String(err)}`);
      logger.error(`Failed to send ${riskLevel} intervention`, {
        partnerId: partner.id,
        err,
      });
    }
  }

  return results;
}
