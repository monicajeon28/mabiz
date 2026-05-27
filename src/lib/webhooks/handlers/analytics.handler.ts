import { BaseWebhookHandler, WebhookHandlerResult, WebhookEventPayload } from '../base';
import prisma from '@/lib/prisma';

export class AnalyticsWebhookHandler extends BaseWebhookHandler {
  webhookType = 'ANALYTICS_UPDATED';

  async handle(payload: WebhookEventPayload, organizationId: string): Promise<WebhookHandlerResult> {
    try {
      const { campaignId, metrics, timestamp } = payload;

      if (!campaignId) {
        return {
          success: false,
          statusCode: 400,
          durationMs: 0,
          errorMessage: 'Missing campaignId',
        };
      }

      const campaign = await prisma.crmMarketingCampaign.findUnique({
        where: { id: campaignId },
      });

      if (!campaign || campaign.organizationId !== organizationId) {
        return {
          success: false,
          statusCode: 404,
          durationMs: 0,
          errorMessage: 'Campaign not found',
        };
      }

      if (metrics) {
        await prisma.crmMarketingCampaign.update({
          where: { id: campaignId },
          data: {
            metrics: {
              ...(campaign.metrics as any),
              ...metrics,
              lastUpdated: new Date(timestamp || Date.now()).toISOString(),
            },
          },
        });
      }

      return {
        success: true,
        statusCode: 200,
        durationMs: 0,
        responseBody: { processed: true },
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        statusCode: 500,
        durationMs: 0,
        errorMessage: err.message,
      };
    }
  }
}

export const analyticsHandler = new AnalyticsWebhookHandler();
