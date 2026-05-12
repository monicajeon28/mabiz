/**
 * admin-control-schema.ts
 * 관리자 메시지 제어 API 스키마
 *
 * 역할:
 * - 통계 쿼리 검증
 * - 재발송 요청 검증
 * - 타입 정의 (MessageStats, ResendResponse)
 */

import { z } from 'zod';

/**
 * 통계 쿼리 스키마
 * 용도: GET /api/admin/messages/stats
 */
export const getStatsSchema = z.object({
  organizationId: z.string().min(1, '조직 ID는 필수입니다').optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  groupBy: z.enum(['status', 'channel', 'hour']).optional(),
});

export type GetStatsInput = z.infer<typeof getStatsSchema>;

/**
 * 재발송 요청 스키마
 * 용도: POST /api/admin/messages/{id}/resend
 */
export const resendMessageSchema = z.object({
  messageLogId: z.number().int().positive('Message ID는 양수여야 합니다'),
  organizationId: z.string().min(1, '조직 ID는 필수입니다'),
});

export type ResendMessageInput = z.infer<typeof resendMessageSchema>;

/**
 * 메시지 발송 통계
 */
export interface MessageStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  waiting: number;
  successRate: string; // 소수점 2자리
  byChannel: {
    sms: number;
    email: number;
    kakao: number;
  };
  byStatus: {
    PENDING: number;
    WAITING: number;
    SENT: number;
    FAILED: number;
  };
  topFailureReasons: Array<{
    reason: string;
    count: number;
  }>;
}

/**
 * 재발송 응답
 */
export interface ResendResponse {
  ok: boolean;
  data?: {
    messageLogId: number;
    status: string;
    retryCount: number;
    nextRetryAt?: Date | null;
  };
  error?: string;
}

/**
 * 통계 응답
 */
export interface StatsResponse {
  ok: boolean;
  data?: MessageStats;
  error?: string;
}
