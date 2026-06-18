/**
 * 감사 로거 라이브러리
 * Phase 4: 정산, 이의, 검증, 재계산 액션 로깅
 *
 * 특징:
 * - 성공/실패 모두 기록
 * - PII 자동 마스킹 (이메일, 이름, 전화번호)
 * - 성능 메트릭 추적 (실행 시간)
 * - 비동기 로깅 (메인 플로우 차단 안 함)
 * - 타입 안전
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ============================================================================
// Compliance AuditLog 함수 (BigInt ID AuditLog 모델 사용)
// ============================================================================

/**
 * 감사 로그 항목 기록 (Compliance & Monitoring 용)
 */
export async function logAuditEntry({
  action,
  table,
  userId,
  organizationId,
  status,
  reason,
  details,
  timestamp,
}: {
  action: string;
  table: string;
  userId?: string | null;
  organizationId?: string | null;
  status: 'ALLOWED' | 'DENIED' | 'SUCCESS' | 'FAILED';
  reason?: string;
  details?: Record<string, unknown>;
  timestamp?: Date;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        resourceType: table,
        userId: userId ?? undefined,
        organizationId: organizationId ?? undefined,
        status,
        reasonDescription: reason,
        piiValuesModified: details ? (details as object) : undefined,
        createdAt: timestamp ?? new Date(),
      },
    });
  } catch (err) {
    logger.error('[logAuditEntry] 감사 로그 저장 실패:', err);
  }
}

/**
 * 감사 로그 조회 권한 검증
 */
export async function checkAuditLogReadPermission(ctx: {
  role?: string | null;
  userId?: string | null;
  organizationId?: string | null;
}): Promise<{ allowed: boolean; reason?: string }> {
  if (ctx.role === 'GLOBAL_ADMIN') {
    return { allowed: true };
  }
  return { allowed: false, reason: '감사 로그 조회는 관리자 전용입니다.' };
}

/**
 * 커미션 정산 조회 권한 검증
 */
export async function checkCommissionLedgerSelectPermission(
  ctx: { role?: string | null; userId?: string | null; organizationId?: string | null },
  targetOrgId: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (ctx.role === 'GLOBAL_ADMIN') {
    return { allowed: true };
  }
  if (ctx.role === 'OWNER' && ctx.organizationId === targetOrgId) {
    return { allowed: true };
  }
  return { allowed: false, reason: '정산 조회 권한이 없습니다.' };
}

/**
 * 감사 로그 액션 유형
 */
export type AuditAction = 'SETTLE' | 'DISPUTE' | 'VERIFY' | 'RECALCULATE';

/**
 * 감사 로그 리소스 유형
 */
export type AuditResource = 'COMMISSION' | 'SETTLEMENT' | 'CONTACT' | 'SALES';

/**
 * 감사 로그 상태
 */
export type AuditStatus = 'SUCCESS' | 'FAILURE' | 'PENDING';

/**
 * PII 마스킹 규칙
 */
const maskPII = (value: any): any => {
  if (!value) return value;

  if (typeof value === 'string') {
    // 이메일 마스킹: user@example.com -> u***@example.com
    if (value.includes('@')) {
      const [localPart, domain] = value.split('@');
      return `${localPart.charAt(0)}***@${domain}`;
    }
    // 전화번호 마스킹: 010-1234-5678 -> 010-****-5678
    if (/^\d{3}-\d{4}-\d{4}/.test(value)) {
      return value.replace(/(\d{3})-(\d{4})-(\d{4})/, '$1-****-$4');
    }
    // 이름 마스킹: 김철수 -> 김*수 (2-3글자), 김철 -> 김*
    if (value.length <= 4 && /^[가-힣]+$/.test(value)) {
      return value.charAt(0) + '*'.repeat(value.length - 2) + value.charAt(value.length - 1);
    }
  }

  // 객체 재귀 처리
  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      return value.map(maskPII);
    }
    const masked: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      // 민감한 필드명 자동 마스킹
      if (['email', 'phone', 'name', 'password', 'ssn'].some(field => key.toLowerCase().includes(field))) {
        masked[key] = maskPII(val);
      } else if (typeof val === 'object') {
        masked[key] = maskPII(val);
      } else {
        masked[key] = val;
      }
    }
    return masked;
  }

  return value;
};

/**
 * 감사 로그 생성 (비동기 백그라운드)
 *
 * @param param0 감사 로그 파라미터
 *
 * 사용 예:
 * ```typescript
 * const startTime = Date.now();
 * try {
 *   // ... 작업 수행
 *   await createAuditLog({
 *     organizationId: 'org_123',
 *     userId: 'user_123',
 *     userEmail: 'admin@example.com',
 *     userName: '김철수',
 *     action: 'SETTLE',
 *     resource: 'COMMISSION',
 *     resourceId: 'settle_456',
 *     status: 'SUCCESS',
 *     changes: {
 *       before: { totalCommission: 5000000 },
 *       after: { totalCommission: 4800000 }
 *     },
 *     duration: Date.now() - startTime,
 *     recordCount: 25
 *   });
 * } catch (error) {
 *   await createAuditLog({
 *     organizationId: 'org_123',
 *     userId: 'user_123',
 *     userEmail: 'admin@example.com',
 *     action: 'SETTLE',
 *     resource: 'COMMISSION',
 *     status: 'FAILURE',
 *     errorCode: 'INVALID_SETTLEMENT',
 *     errorMessage: '정산 기간이 유효하지 않습니다',
 *     duration: Date.now() - startTime
 *   });
 * }
 * ```
 */
export async function createAuditLog({
  organizationId,
  userId,
  userEmail,
  userName,
  action,
  resource,
  resourceId,
  status,
  errorCode,
  errorMessage,
  changes,
  metadata,
  duration,
  recordCount,
}: {
  organizationId: string;
  userId: string;
  userEmail: string;
  userName?: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  status: AuditStatus;
  errorCode?: string;
  errorMessage?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  duration: number;
  recordCount?: number;
}): Promise<void> {
  // 백그라운드 비동기 실행 (메인 플로우 차단 안 함)
  setImmediate(async () => {
    try {
      // PII 마스킹 적용
      const maskedChanges = changes ? maskPII(changes) : undefined;
      const maskedMetadata = metadata ? maskPII(metadata) : undefined;

      // 데이터베이스 저장 (첫 번째 AuditLog 모델 필드에 매핑)
      await prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          action,
          resourceType: resource,
          resourceId,
          status,
          errorMessage: [errorCode, errorMessage].filter(Boolean).join(': ') || undefined,
          piiValuesModified: {
            ...(maskedChanges ? { changes: maskedChanges } : {}),
            ...(maskedMetadata ? { metadata: maskedMetadata } : {}),
            ...(userEmail ? { userEmail } : {}),
            ...(userName ? { userName: maskPII(userName) } : {}),
            ...(recordCount !== undefined ? { recordCount } : {}),
            ...(duration !== undefined ? { duration } : {}),
          },
          durationMs: duration,
        },
      });

      // 실패 이벤트 로깅
      if (status === 'FAILURE') {
        logger.warn(
          `[AuditLog] ${action} ${resource} 실패 (${errorCode || 'UNKNOWN'}): ${errorMessage}`
        );
      }
    } catch (error) {
      // 감사 로그 자체 실패는 메인 플로우 차단 안 함
      logger.error(`[AuditLog] 감사 로그 저장 실패:`, error);
    }
  });
}

/**
 * 감사 로그 조회 필터
 */
export interface AuditLogQuery {
  organizationId: string;
  action?: AuditAction;
  resource?: AuditResource;
  status?: AuditStatus;
  userId?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

/**
 * 감사 로그 조회
 *
 * @param query 필터 조건
 * @returns 감사 로그 목록 및 메타데이터
 *
 * 사용 예:
 * ```typescript
 * const result = await getAuditLogs({
 *   organizationId: 'org_123',
 *   action: 'SETTLE',
 *   status: 'SUCCESS',
 *   page: 1,
 *   limit: 20
 * });
 * ```
 */
export async function getAuditLogs(query: AuditLogQuery) {
  const {
    organizationId,
    action,
    resource,
    status,
    userId,
    resourceId,
    startDate,
    endDate,
    page = 1,
    limit = 20,
  } = query;

  // 페이지네이션
  const skip = Math.max(0, (page - 1) * limit);
  const take = Math.max(1, Math.min(limit, 100)); // 최대 100개

  // 필터 구성 (첫 번째 AuditLog 모델 필드에 매핑)
  const where: Record<string, any> = { organizationId };

  if (action) where.action = action;
  if (resource) where.resourceType = resource; // resource → resourceType
  if (status) where.status = status;
  if (userId) where.userId = userId;
  if (resourceId) where.resourceId = resourceId;

  // 시간 범위 필터
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  // 병렬 조회
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      select: {
        id: true,
        userId: true,
        action: true,
        resourceType: true,
        resourceId: true,
        status: true,
        errorMessage: true,
        piiValuesModified: true,
        durationMs: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit: take,
      total,
      pages: Math.ceil(total / take),
    },
  };
}

/**
 * 액션별 감사 로그 통계
 */
export async function getAuditStats(
  organizationId: string,
  startDate?: Date,
  endDate?: Date
) {
  const where: Record<string, any> = { organizationId };

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  // 액션별 집계
  const byAction = await prisma.auditLog.groupBy({
    by: ['action', 'status'],
    where,
    _count: { id: true },
    _avg: { durationMs: true },
  });

  // 리소스별 집계 (resource → resourceType)
  const byResource = await prisma.auditLog.groupBy({
    by: ['resourceType', 'status'],
    where,
    _count: { id: true },
  });

  // 실패율 계산
  const allLogs = await prisma.auditLog.groupBy({
    by: ['status'],
    where,
    _count: { id: true },
  });

  const successCount = allLogs.find(r => r.status === 'SUCCESS')?._count.id || 0;
  const failureCount = allLogs.find(r => r.status === 'FAILURE')?._count.id || 0;
  const totalCount = successCount + failureCount;

  return {
    byAction,
    byResource,
    summary: {
      total: totalCount,
      success: successCount,
      failure: failureCount,
      successRate: totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(2) : 'N/A',
    },
  };
}

/**
 * 특정 사용자의 감사 로그 조회
 */
export async function getUserAuditLogs(
  organizationId: string,
  userId: string,
  limit = 50
) {
  return prisma.auditLog.findMany({
    where: {
      organizationId,
      userId,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * 특정 리소스의 감사 추적 이력
 */
export async function getResourceAuditTrail(
  organizationId: string,
  resourceId: string
) {
  return prisma.auditLog.findMany({
    where: {
      organizationId,
      resourceId,
    },
    orderBy: { createdAt: 'desc' },
  });
}
