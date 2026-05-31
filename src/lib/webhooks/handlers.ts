import { BaseWebhookHandler, WebhookEventPayload, WebhookHandlerResult } from './base';

/**
 * Admin webhook handler stub
 * NOTE: This is a placeholder for missing handlers
 */
class AdminHandler extends BaseWebhookHandler {
  webhookType = 'ADMIN_ACTION';

  async handle(_payload: WebhookEventPayload, _organizationId: string): Promise<WebhookHandlerResult> {
    return {
      success: true,
      statusCode: 200,
      durationMs: 0,
    };
  }
}

/**
 * Analytics webhook handler stub
 */
class AnalyticsHandler extends BaseWebhookHandler {
  webhookType = 'ANALYTICS';

  async handle(_payload: WebhookEventPayload, _organizationId: string): Promise<WebhookHandlerResult> {
    return {
      success: true,
      statusCode: 200,
      durationMs: 0,
    };
  }
}

/**
 * Messages webhook handler stub
 */
class MessagesHandler extends BaseWebhookHandler {
  webhookType = 'MESSAGES';

  async handle(_payload: WebhookEventPayload, _organizationId: string): Promise<WebhookHandlerResult> {
    return {
      success: true,
      statusCode: 200,
      durationMs: 0,
    };
  }
}

export const adminHandler = new AdminHandler();
export const analyticsHandler = new AnalyticsHandler();
export const messagesHandler = new MessagesHandler();
