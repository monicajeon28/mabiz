import { z } from 'zod';

export const automationLogActionTypes = [
  'import',
  'group_assigned',
  'funnel_started',
  'message_queued',
  'message_sent',
  'message_failed',
  'messages_paused',
  'messages_resumed',
  'messages_cancelled',
  'config_updated',
  'user_unsubscribed',
  'delivery_failed',
  'compliance_action',
] as const;

export const relatedTypes = [
  'message',
  'group',
  'contact',
  'funnel',
  'batch',
  'config',
] as const;

export const getAutomationLogsQuerySchema = z.object({
  organizationId: z.string().min(1),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  action: z.enum(automationLogActionTypes).optional(),
  relatedType: z.enum(relatedTypes).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().max(100).optional(),
  cursor: z.number().int().positive().optional(),
});

export const pauseMessagesSchema = z.object({
  organizationId: z.string().min(1),
  messageIds: z.array(z.number().int()).min(1).max(1000),
  note: z.string().max(500).optional(),
});

export const resumeMessagesSchema = z.object({
  organizationId: z.string().min(1),
  messageIds: z.array(z.number().int()).min(1).max(1000),
  note: z.string().max(500).optional(),
});

export const cancelMessagesSchema = z.object({
  organizationId: z.string().min(1),
  messageIds: z.array(z.number().int()).min(1).max(1000),
  reason: z.string().min(10).max(500),
});

export type AutomationLogQuery = z.infer<typeof getAutomationLogsQuerySchema>;
export type PauseMessagesRequest = z.infer<typeof pauseMessagesSchema>;
export type ResumeMessagesRequest = z.infer<typeof resumeMessagesSchema>;
export type CancelMessagesRequest = z.infer<typeof cancelMessagesSchema>;

export interface AutomationLogEntry {
  id: number;
  organizationId: string;
  action: (typeof automationLogActionTypes)[number];
  actionDetails: Record<string, any> | null;
  relatedId: number | null;
  relatedType: (typeof relatedTypes)[number] | null;
  createdBy: number;
  createdAt: Date;
  createdByUser?: {
    id: number;
    name: string | null;
    email: string | null;
  };
}

export interface PaginatedAutomationLogs {
  logs: AutomationLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}
