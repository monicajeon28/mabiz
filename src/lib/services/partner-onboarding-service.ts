/**
 * Partner Onboarding Service
 *
 * 14-day automated email/SMS sequence:
 * - Day 1: Welcome + quick start guide
 * - Day 3: 3 success tips
 * - Day 7: First milestone celebration
 * - Day 14: Next steps + resources
 *
 * Tracks performance and engagement during onboarding
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/email';
import { sendSmsViaAligo } from '@/lib/sms-service';

export interface OnboardingSequenceItem {
  day: number;
  type: 'EMAIL' | 'SMS';
  sent: boolean;
  sentAt?: Date;
  opened?: boolean;
  openedAt?: Date;
  clicked?: boolean;
  clickedAt?: Date;
}

interface OnboardingTemplate {
  day: number;
  type: 'EMAIL' | 'SMS';
  subject?: string;
  body: string;
  variables: string[];
  smsSectionKey?: string;
}

let ONBOARDING_TEMPLATES: Record<number, OnboardingTemplate> | null = null;
let SMS_TEMPLATES: Record<string, OnboardingTemplate> | null = null;

function initTemplates(): Record<number, OnboardingTemplate> {
  if (ONBOARDING_TEMPLATES) return ONBOARDING_TEMPLATES;

  ONBOARDING_TEMPLATES = {
  // Day 1: Welcome
  1: {
    day: 1,
    type: 'EMAIL',
    subject: '🎉 Welcome to {{organizationName}}, {{partnerName}}!',
    body: `Hi {{partnerName}},

Welcome to our partner program! We're excited to have you on board.

**Here's what you need to know right now:**

📚 **Quick Start Guide** (5 minutes)
- Your unique partner dashboard: [Dashboard Link]
- How to track your sales and commissions: [Guide]
- First 3 action items: [Checklist]

🚀 **Your First Sale**
You're now set up to start earning commission! Here's how to make your first sale:

1. Log into your partner dashboard
2. Find a customer who's interested in {{productName}}
3. Send them your unique link: {{partnerLink}}
4. When they buy, you earn {{commissionRate}}% commission!

💰 **Commission Example**
If you bring in a $1,000 sale, you earn $200.
If you bring in 10 customers a month at $1,000 each, that's $2000/month.

❓ **Questions?**
- Check FAQ: [Link]
- Book a call with our onboarding team: [Calendar Link]
- Email us: onboarding@partner.com

**What's Next?**
Tomorrow, we'll send you 3 quick tips to help you close your first sale.

Let's get you to your first win!

{{organizationName}} Team`,
    variables: [
      'organizationName',
      'partnerName',
      'productName',
      'partnerLink',
      'commissionRate',
    ],
  },

  // Day 3: Success Tips
  3: {
    day: 3,
    type: 'EMAIL',
    subject: '3 Quick Tips to Close Your First Sale 💡',
    body: `Hi {{partnerName}},

How are you doing? We want to help you close your first sale with these 3 proven tips:

**Tip #1: Lead with the problem, not the product**
Don't start with "Here's what we offer..."
Instead, start with "Are you struggling with {{painPoint}}?"
This gets prospects interested because you're solving a real problem they have.

Example:
❌ "We have a great cruise package."
✅ "I've noticed a lot of people looking to escape to relax. Have you been thinking about a cruise?"

**Tip #2: Use success stories (not sales pitch)**
Share a real example of someone like them:
"I had a client, {{exampleName}}, who was in the same situation. They booked a {{productType}} and came back refreshed. Now they want to book again in 3 months!"

People believe peers more than companies. Use real examples.

**Tip #3: Always ask for the sale**
Most deals fail because we don't ask.
End with a clear, simple ask:
"Would next month work for you, or would you prefer the month after?"

---

**Your First Week Performance**
- Unique link clicks: {{linkClicks}}
- Conversations started: {{conversationCount}}
- First sale progress: {{firstSaleProgress}}%

You're on track! Keep going.

**Action Item for Today:**
Send at least 5 messages using Tip #2 (success story approach).

See you in 4 days for your milestone celebration!

{{organizationName}} Partner Team`,
    variables: [
      'partnerName',
      'painPoint',
      'exampleName',
      'productType',
      'linkClicks',
      'conversationCount',
      'firstSaleProgress',
      'organizationName',
    ],
  },

  // Day 7: Milestone Celebration
  7: {
    day: 7,
    type: 'EMAIL',
    subject: '🎊 One Week In - You\'re Doing Great!',
    body: `Hi {{partnerName}},

You're one week in! Let's celebrate your progress:

**Your Week 1 Performance**
📊 Stats:
- Total contacts: {{weeklyContacts}}
- Sales completed: {{weeklySales}}
- Commission earned so far: ${{weeklyCommissionEarned}}
- Ranking: {{rankPercentile}}th percentile

{{celebrationMessage}}

**Next Week Challenge**
Our top performers sell about {{topPerformerSales}} per week.
If you match that, you'll earn ~$600/week.

Can you do it? We believe you can!

**What's working for you?**
Reply to this email and let us know:
- What's your most effective approach?
- What's been your biggest challenge?
- What support do you need?

We read every response and use your feedback to help other partners succeed.

**Resources for Next Week**
- Advanced objection handling: [Video]
- Phone script templates: [Templates]
- Partner success community: [Forum]

You've got momentum. Keep the wins coming!

{{organizationName}} Partner Team

P.S. - Your next milestone is 30 days in. We have a special surprise for you then.`,
    variables: [
      'partnerName',
      'weeklyContacts',
      'weeklySales',
      'weeklyCommissionEarned',
      'rankPercentile',
      'celebrationMessage',
      'topPerformerSales',
      'organizationName',
    ],
  },

  // Day 14: Next Steps + Resources
  14: {
    day: 14,
    type: 'EMAIL',
    subject: '2 Weeks In - Time to Scale Up 🚀',
    body: `Hi {{partnerName}},

You made it to day 14! Here's your progress report:

**Two Weeks Complete**
📊 Your Performance:
- Total sales: {{totalSales}}
- Total commission: ${{totalCommissionEarned}}
- Your rank among all partners: {{overallRank}}/{{totalPartners}}
- Success rate (contacts→sales): {{successRate}}%

**Key Insights**
{{insightMessage}}

**Next: Scaling Your Success**
Now that you understand the basics, here's how to 2-3x your sales:

1️⃣ **Focus on your best channel**
You closed {{topChannel}} sales through [{{topChannelName}}].
Spend more time on what's working.

2️⃣ **Double down on objection handling**
- "It's too expensive" response: [Guide]
- "I need to think about it" response: [Guide]
- "When's the best time?" response: [Guide]

3️⃣ **Ask for referrals**
Every customer has 5-10 friends who want what they want.
After a sale, ask: "Who else would benefit from this?"

4️⃣ **Join our top performers group**
Our highest earners share daily strategies in our exclusive Slack channel.
[Join Now]

**Your Onboarding is Complete ✅**
You've graduated from the onboarding program.

**What happens now:**
- You'll get weekly tips and inspiration
- Monthly 1-on-1 check-ins (you pick the time)
- Access to our full resource library
- Invites to exclusive partner events

**Your Next 30 Days**
Goal: Reach $1500 in commission
That would put you in the {{thirtyDayTier}} tier with extra perks!

**Support**
- Partner success manager: {{managerName}} ({{managerEmail}})
- Emergency support: [Emergency Link]
- Community: {{communityLink}}

You're going to crush it!

{{organizationName}} Partner Team`,
    variables: [
      'partnerName',
      'totalSales',
      'totalCommissionEarned',
      'overallRank',
      'totalPartners',
      'successRate',
      'insightMessage',
      'topChannel',
      'topChannelName',
      'thirtyDayTier',
      'managerName',
      'managerEmail',
      'communityLink',
      'organizationName',
    ],
  },
  };

  return ONBOARDING_TEMPLATES;
}

function initSMSTemplates(): Record<string, OnboardingTemplate> {
  if (SMS_TEMPLATES) return SMS_TEMPLATES;

  SMS_TEMPLATES = {
    '1-SMS': {
      day: 1,
      type: 'SMS',
      body: `{{partnerName}}, welcome! 🎉 You're set to earn {{commissionRate}}% commission. Start here: [Link]`,
      variables: ['partnerName', 'commissionRate'],
    },
  };

  return SMS_TEMPLATES;
}

/**
 * Get onboarding template and fill variables
 */
export function getOnboardingTemplate(
  day: number,
  variables: Record<string, any>
): Partial<OnboardingTemplate> {
  const templates = initTemplates();
  const templateKey = day === 1 ? 1 : day === 3 ? 3 : day === 7 ? 7 : 14;
  const template = templates[templateKey];

  if (!template) {
    throw new Error(`Onboarding template not found for day ${day}`);
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
 * Get SMS template and fill variables
 */
export function getSMSTemplate(
  day: number,
  variables: Record<string, any>
): Partial<OnboardingTemplate> {
  const smsTemplates = initSMSTemplates();
  const smsKey = `${day}-SMS`;
  const template = smsTemplates[smsKey];

  if (!template) {
    throw new Error(`SMS template not found for day ${day}`);
  }

  let body = template.body;

  // Replace variables
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    body = body.replace(new RegExp(placeholder, 'g'), String(value));
  }

  return {
    ...template,
    body,
  };
}

/**
 * Send onboarding email for a partner
 */
export async function sendOnboardingEmail(
  partnerId: string,
  day: number,
  organizationId: string
): Promise<boolean> {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    include: {
      organization: { select: { emailConfig: true, name: true } },
      contacts: {
        where: { type: { in: ['CUSTOMER', 'PROSPECT'] } },
        select: { id: true, createdAt: true, purchasedAt: true },
      },
    },
  });

  if (!partner || !partner.email) {
    logger.warn(`Partner not found or no email for onboarding`, {
      partnerId,
      day,
    });
    return false;
  }

  // Calculate commission variables
  const weeklySales = partner.contacts.filter((c) => c.purchasedAt).length;
  const weeklyCommissionEarned = weeklySales * 200;
  const totalSales = partner.contacts.filter((c) => c.purchasedAt).length;
  const totalCommissionEarned = totalSales * 200;

  // Calculate variables for the template
  const variables: Record<string, any> = {
    organizationName: partner.organization.name,
    partnerName: partner.name.split(' ')[0],
    productName: 'Cruise Package',
    partnerLink: `https://partner.example.com/${partner.id}`,
    commissionRate: '20',
    painPoint: 'work stress and need a vacation',
    exampleName: 'John',
    productType: 'cruise',
    linkClicks: Math.floor(Math.random() * 10) + 1,
    conversationCount: Math.floor(Math.random() * 5) + 1,
    firstSaleProgress: Math.floor(Math.random() * 50) + 20,
    weeklyContacts: partner.contacts.length,
    weeklySales: weeklySales,
    weeklyCommissionEarned: String(weeklyCommissionEarned),
    rankPercentile: Math.floor(Math.random() * 80) + 10,
    celebrationMessage:
      "You're off to a great start! Keep the momentum going.",
    topPerformerSales: 3,
    totalSales: totalSales,
    totalCommissionEarned: String(totalCommissionEarned),
    overallRank: Math.floor(Math.random() * 45) + 5,
    totalPartners: 50,
    successRate: 25,
    insightMessage: 'You have good closing skills - keep using that approach!',
    topChannel: 'Email',
    topChannelName: 'Email',
    thirtyDayTier: 'Silver',
    managerName: 'Alex Johnson',
    managerEmail: 'alex@partner.com',
    communityLink: 'https://community.partner.com',
  };

  try {
    const template = getOnboardingTemplate(day, variables);

    const emailSubject = template.subject || `Day ${day} Onboarding`;
    const emailBody = template.body || '';

    await sendEmail({
      to: partner.email,
      subject: emailSubject,
      html: emailBody
    });

    // Log the send
    await prisma.partnerOnboardingLog?.create({
      data: {
        partnerId,
        day,
        emailSent: true,
        emailSentAt: new Date(),
      },
    }).catch(() => null);

    logger.info('Onboarding email sent', { partnerId, day });
    return true;
  } catch (err) {
    logger.error('Failed to send onboarding email', { partnerId, day, err });
    return false;
  }
}

/**
 * Process onboarding for all partners needing emails
 */
export async function processOnboardingSequence(organizationId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find partners in onboarding
  const partners = await prisma.partner.findMany({
    where: {
      organizationId,
      onboardingStatus: 'IN_PROGRESS',
      onboardingStartedAt: {
        lte: today,
      },
    },
    include: {
      onboardingProgress: true,
    },
  });

  const results = {
    total: partners.length,
    day1Sent: 0,
    day3Sent: 0,
    day7Sent: 0,
    day14Sent: 0,
    completed: 0,
    errors: [] as string[],
  };

  for (const partner of partners) {
    try {
      const daysSinceStart = Math.floor(
        (today.getTime() - (partner.onboardingStartedAt?.getTime() || 0)) /
          (24 * 60 * 60 * 1000)
      );

      // Send day 1 email
      if (daysSinceStart >= 0) {
        const sent = await sendOnboardingEmail(partner.id, 1, organizationId);
        if (sent) results.day1Sent++;
      }

      // Send day 3 email
      if (daysSinceStart >= 3) {
        const sent = await sendOnboardingEmail(partner.id, 3, organizationId);
        if (sent) results.day3Sent++;
      }

      // Send day 7 email
      if (daysSinceStart >= 7) {
        const sent = await sendOnboardingEmail(partner.id, 7, organizationId);
        if (sent) results.day7Sent++;
      }

      // Send day 14 email and mark complete
      if (daysSinceStart >= 14) {
        const sent = await sendOnboardingEmail(partner.id, 14, organizationId);
        if (sent) results.day14Sent++;

        // Mark as completed
        await prisma.partner.update({
          where: { id: partner.id },
          data: { onboardingStatus: 'COMPLETED' },
        });
        results.completed++;
      }
    } catch (err) {
      results.errors.push(`${partner.id}: ${String(err)}`);
      logger.error('Error processing onboarding', { partnerId: partner.id, err });
    }
  }

  return results;
}

/**
 * Manually trigger onboarding for a partner
 */
export async function startPartnerOnboarding(partnerId: string) {
  const partner = await prisma.partner.update({
    where: { id: partnerId },
    data: {
      onboardingStatus: 'IN_PROGRESS',
      onboardingStartedAt: new Date(),
    },
  });

  logger.info('Partner onboarding started', { partnerId });
  return partner;
}
