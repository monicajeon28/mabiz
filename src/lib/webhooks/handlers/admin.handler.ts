import { BaseWebhookHandler, WebhookHandlerResult, WebhookEventPayload } from '../base';
import prisma from '@/lib/prisma';

export class AdminWebhookHandler extends BaseWebhookHandler {
  webhookType = 'ADMIN_ACTION';

  async handle(payload: WebhookEventPayload, organizationId: string): Promise<WebhookHandlerResult> {
    try {
      const { actionType, targetId, targetType, metadata } = payload;

      if (!actionType || !targetId || !targetType) {
        return {
          success: false,
          statusCode: 400,
          durationMs: 0,
          errorMessage: 'Missing required fields: actionType, targetId, targetType',
        };
      }

      await prisma.adminMessage.create({
        data: {
          organizationId,
          title: `${actionType}: ${targetType}`,
          content: JSON.stringify(metadata || {}),
          messageType: 'SYSTEM',
          isRead: false,
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

export const adminHandler = new AdminWebhookHandler();
