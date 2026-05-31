/**
 * Proactive Workflow Engine
 * Auto-creates and manages workflows based on predictions
 * Workflows: VIP Save (Churn), Upgrade (Upsell), Come Back (Win-Back)
 * Features: Smart scheduling, A/B testing, opt-out respecting, delivery optimization
 */

import { prisma } from '@/lib/prisma';
import { Contact, ScheduledSms } from '@prisma/client';
import { ChurnPredictor, ChurnPrediction } from '@/lib/ai/churn-predictor';
import { UpsellPredictor, UpsellOpportunity } from '@/lib/ai/upsell-predictor';
import { WinBackPredictor, WinBackOpportunity } from '@/lib/ai/winback-predictor';

export interface WorkflowConfig {
  type: 'VIP_SAVE' | 'UPGRADE' | 'COME_BACK';
  contactId: string;
  organizationId: string;
  triggerData: ChurnPrediction | UpsellOpportunity | WinBackOpportunity;
  abTestVariant?: 'A' | 'B'; // A/B test variant
  maxMessages: number; // Max number of messages in workflow
}

export interface ProactiveWorkflow {
  id: string;
  contactId: string;
  organizationId: string;
  workflowType: 'VIP_SAVE' | 'UPGRADE' | 'COME_BACK';
  status: 'PENDING' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  stage: number; // Current stage (0, 1, 2, 3...)
  startedAt: Date;
  completedAt: Date | null;
  abTestVariant: string;
  messagesSent: number;
  expectedRevenue: number;
  actualRevenue: number | null;
  conversionTracking: Record<string, any>;
}

export class ProactiveWorkflowEngine {
  private churnPredictor = new ChurnPredictor();
  private upsellPredictor = new UpsellPredictor();
  private winBackPredictor = new WinBackPredictor();

  /**
   * Create VIP Save workflow for high-churn customers
   */
  private async createVipSaveWorkflow(
    config: WorkflowConfig,
    prediction: ChurnPrediction
  ): Promise<void> {
    const contact = await prisma.contact.findUnique({
      where: { id: config.contactId }
    });

    if (!contact) throw new Error(`Contact not found: ${config.contactId}`);

    // Respect opt-outs (contact.optOutAt = opted out of all)
    if (contact.optOutAt) {
      console.log(`Contact ${config.contactId} opted out - skipping workflow`);
      return;
    }

    const workflow = await prisma.proactiveWorkflow.create({
      data: {
        contactId: config.contactId,
        organizationId: config.organizationId,
        workflowType: 'VIP_SAVE',
        status: 'PENDING',
        stage: 0,
        startedAt: new Date(),
        abTestVariant: config.abTestVariant || this.randomVariant(),
        messagesSent: 0,
        expectedRevenue: contact.ltvTotal * 0.5, // Expect to retain 50% of LTV
        actualRevenue: null,
        conversionTracking: {}
      }
    });

    // Schedule Day 0 message: Personal call attempt
    await this.scheduleVipSaveDay0(workflow, contact, prediction);

    // Schedule Day 1 message: Exclusive offer email
    await this.scheduleVipSaveDay1(workflow, contact, prediction);

    // Schedule Day 2 message: Last chance SMS
    await this.scheduleVipSaveDay2(workflow, contact, prediction);
  }

  /**
   * Schedule VIP Save Day 0: Personal engagement
   */
  private async scheduleVipSaveDay0(
    workflow: any,
    contact: Contact,
    prediction: ChurnPrediction
  ): Promise<void> {
    const scheduleTime = new Date();
    scheduleTime.setHours(10, 0, 0, 0); // 10 AM

    const messages = {
      A: `Hi ${contact.name}, we noticed you haven't booked with us lately. Your VIP account qualifies for exclusive benefits. Can we help with anything? - CRM Team`,
      B: `${contact.name}, we'd love to welcome you back! Special offer inside. [LINK] - Reply YES for details`
    };

    const variant = workflow.abTestVariant as 'A' | 'B';
    const message = messages[variant];

    await prisma.scheduledSms.create({
      data: {
        organizationId: workflow.organizationId,
        contactId: contact.id,
        message: message,
        scheduledAt: scheduleTime,
        status: 'PENDING',
        channel: 'SMS'
      }
    });
  }

  /**
   * Schedule VIP Save Day 1: Exclusive offer
   */
  private async scheduleVipSaveDay1(
    workflow: any,
    contact: Contact,
    prediction: ChurnPrediction
  ): Promise<void> {
    const scheduleTime = new Date();
    scheduleTime.setDate(scheduleTime.getDate() + 1);
    scheduleTime.setHours(14, 0, 0, 0); // Day 1, 2 PM

    const offers = {
      A: '🎁 15% OFF - Come back to us! Valid 48hrs only → [LINK]',
      B: '✨ Exclusive VIP Offer: Free cabin upgrade (limited seats) → [LINK]'
    };

    const variant = workflow.abTestVariant as 'A' | 'B';
    const offer = offers[variant];

    await prisma.scheduledSms.create({
      data: {
        organizationId: workflow.organizationId,
        contactId: contact.id,
        message: offer,
        scheduledAt: scheduleTime,
        status: 'PENDING',
        channel: 'SMS'
      }
    });
  }

  /**
   * Schedule VIP Save Day 2: Last chance
   */
  private async scheduleVipSaveDay2(
    workflow: any,
    contact: Contact,
    prediction: ChurnPrediction
  ): Promise<void> {
    const scheduleTime = new Date();
    scheduleTime.setDate(scheduleTime.getDate() + 2);
    scheduleTime.setHours(18, 0, 0, 0); // Day 2, 6 PM

    const messages = {
      A: `${contact.name}, your exclusive offer expires in 24 hours. Secure your spot now → [LINK]`,
      B: `⏰ Last chance to book with your VIP discount! Offer ends tomorrow at midnight → [LINK]`
    };

    const variant = workflow.abTestVariant as 'A' | 'B';
    const message = messages[variant];

    await prisma.scheduledSms.create({
      data: {
        organizationId: workflow.organizationId,
        contactId: contact.id,
        message: message,
        scheduledAt: scheduleTime,
        status: 'PENDING',
        channel: 'SMS'
      }
    });
  }

  /**
   * Create Upgrade workflow for upsell opportunities
   */
  private async createUpgradeWorkflow(
    config: WorkflowConfig,
    opportunity: UpsellOpportunity
  ): Promise<void> {
    const contact = await prisma.contact.findUnique({
      where: { id: config.contactId }
    });

    if (!contact) throw new Error(`Contact not found: ${config.contactId}`);

    if (contact.optOutAt) return;

    const workflow = await prisma.proactiveWorkflow.create({
      data: {
        contactId: config.contactId,
        organizationId: config.organizationId,
        workflowType: 'UPGRADE',
        status: 'PENDING',
        stage: 0,
        startedAt: new Date(),
        abTestVariant: config.abTestVariant || this.randomVariant(),
        messagesSent: 0,
        expectedRevenue: opportunity.recommendedProduct.expectedRevenue,
        actualRevenue: null,
        conversionTracking: { productName: opportunity.recommendedProduct.name }
      }
    });

    // Day 0: Product recommendation
    await this.scheduleUpgradeDay0(workflow, contact, opportunity);

    // Day 2: Case study/social proof email
    await this.scheduleUpgradeDay2(workflow, contact, opportunity);

    // Day 3: Limited-time offer SMS
    await this.scheduleUpgradeDay3(workflow, contact, opportunity);
  }

  /**
   * Schedule Upgrade Day 0: Product recommendation
   */
  private async scheduleUpgradeDay0(
    workflow: any,
    contact: Contact,
    opportunity: UpsellOpportunity
  ): Promise<void> {
    const scheduleTime = new Date();
    scheduleTime.setHours(10, 0, 0, 0);

    const messages = {
      A: `Recommended for you: ${opportunity.recommendedProduct.name}. Personalized based on your cruise history → [LINK]`,
      B: `${contact.name}, since you loved your last cruise, we think you'd enjoy: ${opportunity.recommendedProduct.name} → [LINK]`
    };

    const variant = workflow.abTestVariant as 'A' | 'B';

    await prisma.scheduledSms.create({
      data: {
        organizationId: workflow.organizationId,
        contactId: contact.id,
        message: messages[variant],
        scheduledAt: scheduleTime,
        status: 'PENDING',
        channel: 'EMAIL'
      }
    });
  }

  /**
   * Schedule Upgrade Day 2: Social proof
   */
  private async scheduleUpgradeDay2(
    workflow: any,
    contact: Contact,
    opportunity: UpsellOpportunity
  ): Promise<void> {
    const scheduleTime = new Date();
    scheduleTime.setDate(scheduleTime.getDate() + 2);
    scheduleTime.setHours(14, 0, 0, 0);

    const messages = {
      A: `See why 1,200+ customers upgraded to ${opportunity.recommendedProduct.name}. Read their stories → [LINK]`,
      B: `⭐ 4.8/5 stars - Customers love ${opportunity.recommendedProduct.name}. See why → [LINK]`
    };

    const variant = workflow.abTestVariant as 'A' | 'B';

    await prisma.scheduledSms.create({
      data: {
        organizationId: workflow.organizationId,
        contactId: contact.id,
        message: messages[variant],
        scheduledAt: scheduleTime,
        status: 'PENDING',
        channel: 'EMAIL'
      }
    });
  }

  /**
   * Schedule Upgrade Day 3: Limited-time offer
   */
  private async scheduleUpgradeDay3(
    workflow: any,
    contact: Contact,
    opportunity: UpsellOpportunity
  ): Promise<void> {
    const scheduleTime = new Date();
    scheduleTime.setDate(scheduleTime.getDate() + 3);
    scheduleTime.setHours(18, 0, 0, 0);

    const offers = {
      A: `⏰ Special pricing on ${opportunity.recommendedProduct.name} expires in 24hrs → [LINK]`,
      B: `Last chance: Get ${opportunity.recommendedProduct.name} at our special rate → [LINK]`
    };

    const variant = workflow.abTestVariant as 'A' | 'B';

    await prisma.scheduledSms.create({
      data: {
        organizationId: workflow.organizationId,
        contactId: contact.id,
        message: offers[variant],
        scheduledAt: scheduleTime,
        status: 'PENDING',
        channel: 'SMS'
      }
    });
  }

  /**
   * Create Come Back workflow for win-back opportunities
   */
  private async createComeBackWorkflow(
    config: WorkflowConfig,
    opportunity: WinBackOpportunity
  ): Promise<void> {
    const contact = await prisma.contact.findUnique({
      where: { id: config.contactId }
    });

    if (!contact) throw new Error(`Contact not found: ${config.contactId}`);

    if (contact.optOutAt) return;

    const workflow = await prisma.proactiveWorkflow.create({
      data: {
        contactId: config.contactId,
        organizationId: config.organizationId,
        workflowType: 'COME_BACK',
        status: 'PENDING',
        stage: 0,
        startedAt: new Date(),
        abTestVariant: config.abTestVariant || this.randomVariant(),
        messagesSent: 0,
        expectedRevenue: opportunity.expectedReactivationValue,
        actualRevenue: null,
        conversionTracking: { offerType: opportunity.bestOffer.type }
      }
    });

    // Day 0: "We miss you" message
    await this.scheduleComeBackDay0(workflow, contact, opportunity);

    // Day 2: Special reactivation offer
    await this.scheduleComeBackDay2(workflow, contact, opportunity);

    // Day 5: "Last chance" SMS
    await this.scheduleComeBackDay5(workflow, contact, opportunity);
  }

  /**
   * Schedule Come Back Day 0: Nostalgia/welcome message
   */
  private async scheduleComeBackDay0(
    workflow: any,
    contact: Contact,
    opportunity: WinBackOpportunity
  ): Promise<void> {
    const messages = {
      A: `${contact.name}, we miss you! Your favorite cruise destination is calling. Come back → [LINK]`,
      B: `We've got great memories from your last cruise with us. Let's create more → [LINK]`
    };

    const variant = workflow.abTestVariant as 'A' | 'B';

    await prisma.scheduledSms.create({
      data: {
        organizationId: workflow.organizationId,
        contactId: contact.id,
        message: messages[variant],
        scheduledAt: opportunity.optimalContactTime,
        status: 'PENDING',
        channel: 'SMS'
      }
    });
  }

  /**
   * Schedule Come Back Day 2: Offer
   */
  private async scheduleComeBackDay2(
    workflow: any,
    contact: Contact,
    opportunity: WinBackOpportunity
  ): Promise<void> {
    const scheduleTime = new Date(opportunity.optimalContactTime);
    scheduleTime.setDate(scheduleTime.getDate() + 2);

    const offerText = {
      DISCOUNT: `${opportunity.bestOffer.incentiveValue}% OFF your next cruise`,
      SPECIAL_GIFT: `Free onboard credit + exclusive gift`,
      EXCLUSIVE_ACCESS: `VIP priority booking + cabin upgrade`,
      LOYALTY_RECOGNITION: `Loyalty rewards - book now and save`
    };

    const messages = {
      A: `We saved you a spot! ${offerText[opportunity.bestOffer.type]}. Valid for 7 days → [LINK]`,
      B: `Special welcome back offer: ${offerText[opportunity.bestOffer.type]} → [LINK]`
    };

    const variant = workflow.abTestVariant as 'A' | 'B';

    await prisma.scheduledSms.create({
      data: {
        organizationId: workflow.organizationId,
        contactId: contact.id,
        message: messages[variant],
        scheduledAt: scheduleTime,
        status: 'PENDING',
        channel: 'EMAIL'
      }
    });
  }

  /**
   * Schedule Come Back Day 5: Last chance
   */
  private async scheduleComeBackDay5(
    workflow: any,
    contact: Contact,
    opportunity: WinBackOpportunity
  ): Promise<void> {
    const scheduleTime = new Date(opportunity.optimalContactTime);
    scheduleTime.setDate(scheduleTime.getDate() + 5);
    scheduleTime.setHours(18, 0, 0, 0);

    const messages = {
      A: `Last chance! Your special offer expires tomorrow. Book now → [LINK]`,
      B: `⏰ Only 24 hours left to claim your welcome back offer → [LINK]`
    };

    const variant = workflow.abTestVariant as 'A' | 'B';

    await prisma.scheduledSms.create({
      data: {
        organizationId: workflow.organizationId,
        contactId: contact.id,
        message: messages[variant],
        scheduledAt: scheduleTime,
        status: 'SCHEDULED',
        channel: 'SMS',
        proactiveWorkflowId: workflow.id,
        workflowStage: 2,
        abTestVariant: variant
      }
    });
  }

  /**
   * Create workflow from prediction
   */
  async createWorkflowFromPrediction(config: WorkflowConfig): Promise<void> {
    const { type, triggerData } = config;

    switch (type) {
      case 'VIP_SAVE':
        await this.createVipSaveWorkflow(config, triggerData as ChurnPrediction);
        break;
      case 'UPGRADE':
        await this.createUpgradeWorkflow(config, triggerData as UpsellOpportunity);
        break;
      case 'COME_BACK':
        await this.createComeBackWorkflow(config, triggerData as WinBackOpportunity);
        break;
    }
  }

  /**
   * Helper: random variant selector
   */
  private randomVariant(): 'A' | 'B' {
    return Math.random() > 0.5 ? 'A' : 'B';
  }
}
