import { BaseWebhookHandler, WebhookHandlerResult, WebhookEventPayload } from '../base';
import prisma from '@/lib/prisma';

export class MessagesWebhookHandler extends BaseWebhookHandler {
  webhookType = 'MESSAGE_SENT';

  async handle(payload: WebhookEventPayload, organizationId: string): Promise<WebhookHandlerResult> {
    try {
      const { messageId, status, deliveryStatus, sentAt, openedAt, clickedAt, convertedAt } = payload;

      if (!messageId) {
        return {
          success: false,
          statusCode: 400,
          durationMs: 0,
          errorMessage: 'Missing messageId',
        };
      }

      await prisma.smsLog.updateMany({
        where: {
          organizationId,
          msgId: messageId,
        },
        data: {
          status: deliveryStatus || status || 'SENT',
          ...(openedAt && { openedAt: new Date(openedAt) }),
          ...(clickedAt && { clickedAt: new Date(clickedAt) }),
          ...(convertedAt && { convertedAt: new Date(convertedAt) }),
        },
      });

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

export const messagesHandler = new MessagesWebhookHandler();
