import { z } from 'zod';

// ─────────────────────────────────────────────
// Group Assignment (그룹 배정) 검증 스키마
// ─────────────────────────────────────────────

// ─── 단일 그룹 배정 ──
export const GroupAssignmentSchema = z.object({
  contactIds: z.array(z.string().cuid('유효한 Contact ID 형식이 아닙니다.'))
    .min(1, '최소 1명의 고객을 선택해야 합니다.')
    .max(1000, '최대 1000명까지 일괄 배정 가능합니다.'),

  groupId: z.string()
    .cuid('유효한 Group ID 형식이 아닙니다.')
    .min(1, '그룹은 필수입니다.'),

  assignmentReason: z.enum(
    ['MANUAL', 'AUTO_MATCHING', 'IMPORT', 'MIGRATION']
  ).default('MANUAL').describe('배정 사유를 선택하세요.'),

  notes: z.string()
    .max(200, '비고는 200자 이내여야 합니다.')
    .transform(v => v.trim())
    .optional()
    .or(z.literal('')),
}).strict();

// ─── 일괄 그룹 배정 ──
export const BulkGroupAssignmentSchema = z.object({
  assignments: z.array(GroupAssignmentSchema)
    .min(1, '최소 1개 배정 작업이 필요합니다.')
    .max(100, '최대 100개 배정까지 일괄 처리 가능합니다.'),
}).strict();

// ─── 그룹 배정 취소 ──
export const UnassignGroupSchema = z.object({
  contactIds: z.array(z.string().cuid('유효한 Contact ID 형식이 아닙니다.'))
    .min(1, '최소 1명의 고객을 선택해야 합니다.')
    .max(1000, '최대 1000명까지 일괄 처리 가능합니다.'),

  groupId: z.string()
    .cuid('유효한 Group ID 형식이 아닙니다.')
    .min(1, '그룹은 필수입니다.'),
}).strict();

// ─── 그룹 배정 목록 조회 쿼리 ──
export const ListGroupAssignmentsQuerySchema = z.object({
  groupId: z.string().cuid('유효한 Group ID 형식이 아닙니다.').optional(),
  contactId: z.string().cuid('유효한 Contact ID 형식이 아닙니다.').optional(),
  reason: z.enum(['MANUAL', 'AUTO_MATCHING', 'IMPORT', 'MIGRATION']).optional(),
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(1000).default(50),
  sortBy: z.enum(['assignedAt', 'createdAt']).default('assignedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).strict();

// ─────────────────────────────────────────────
// Export types
// ─────────────────────────────────────────────

export type GroupAssignmentInput = z.infer<typeof GroupAssignmentSchema>;
export type BulkGroupAssignmentInput = z.infer<typeof BulkGroupAssignmentSchema>;
export type UnassignGroupInput = z.infer<typeof UnassignGroupSchema>;
export type ListGroupAssignmentsQuery = z.infer<typeof ListGroupAssignmentsQuerySchema>;
