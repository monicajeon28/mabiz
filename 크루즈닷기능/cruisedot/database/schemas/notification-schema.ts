import { z } from 'zod';

// C-1: 알림 API 입력 검증 스키마
export const notificationQuerySchema = z.object({
  includeRead: z.enum(['true', 'false']).optional().default('false'),
  limit: z.string()
    .transform(val => {
      const parsed = parseInt(val, 10);
      if (isNaN(parsed)) return 20;
      // 범위 제한: 1-100 (N+1 쿼리 방지)
      return Math.max(1, Math.min(100, parsed));
    })
    .default('20'),
});

export const markNotificationReadSchema = z.object({
  notificationId: z.string().trim().min(1, '알림 ID는 필수입니다'),
  markAllAsRead: z.boolean().optional().default(false),
});

export const markAllAsReadSchema = z.object({
  markAllAsRead: z.literal(true),
  notificationId: z.string().optional(),
});

// 읽음 처리 요청은 두 가지 경우 중 하나
export const notificationPostSchema = z.union([
  markAllAsReadSchema,
  markNotificationReadSchema,
]);

// 알림 응답 타입
export const notificationResponseSchema = z.object({
  id: z.string(),
  notificationType: z.string(),
  title: z.string(),
  content: z.string(),
  relatedCustomerId: z.number().nullable().optional(),
  relatedNoteId: z.string().nullable().optional(),
  relatedMessageId: z.string().nullable().optional(),
  isRead: z.boolean(),
  readAt: z.string().nullable(),
  priority: z.string().optional(),
  createdAt: z.string(),
});

export type NotificationQuery = z.infer<typeof notificationQuerySchema>;
export type NotificationPostRequest = z.infer<typeof notificationPostSchema>;
export type NotificationResponse = z.infer<typeof notificationResponseSchema>;
