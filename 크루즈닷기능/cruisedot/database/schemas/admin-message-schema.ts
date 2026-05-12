import { z } from 'zod';

// 로그 조회 쿼리 파라미터
export const getMessagesLogsSchema = z.object({
  organizationId: z.string().min(1, '조직 ID는 필수입니다'),
  page: z.string()
    .optional()
    .transform(v => v ? parseInt(v, 10) : 1)
    .refine(val => Number.isInteger(val) && val >= 1, '페이지는 1 이상의 정수여야 합니다'),
  limit: z.string()
    .optional()
    .transform(v => v ? parseInt(v, 10) : 50)
    .refine(val => Number.isInteger(val) && val >= 1 && val <= 100, '제한은 1~100 사이의 정수여야 합니다'),
  status: z.enum(['PENDING', 'WAITING', 'SENT', 'FAILED']).optional(),
  channel: z.enum(['SMS', 'Email', 'Kakao']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string()
    .max(100, '검색어는 100자 이하여야 합니다')
    .optional(),
});

export type GetMessagesLogsInput = z.infer<typeof getMessagesLogsSchema>;

// 로그 응답 엔트리
export interface MessageLogEntry {
  id: number;
  userId: number;
  name: string;
  phone: string;
  status: 'PENDING' | 'WAITING' | 'SENT' | 'FAILED';
  channel: string;
  sentAt: Date;
  scheduledAt: Date;
  stageNumber: number;
  errorMessage?: string | null;
}

// 페이지네이션 정보
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

// 전체 응답
export interface MessageLogsResponse {
  ok: boolean;
  data?: {
    logs: MessageLogEntry[];
    pagination: PaginationInfo;
  };
  error?: string;
}
