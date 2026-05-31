/**
 * 중앙 감시 로그 시스템 (Audit Logger)
 * 모든 PII 접근, 수정, 삭제 작업 기록
 * 규정 준수 증거용 (GDPR/CCPA/내규)
 *
 * 2026-05-27 Compliance Monitor Agent
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export type AuditAction =
  | 'READ' | 'WRITE' | 'DELETE' | 'EXPORT' | 'LOGIN' | 'LOGOUT'
  | 'APPROVE' | 'REJECT' | 'BULK_EXPORT' | 'BULK_DELETE';

export type ResourceType =
  | 'Contact' | 'OrganizationMember' | 'Document' | 'Affiliate'
  | 'Payment' | 'Contract' | 'SmsConfig' | 'EmailConfig';

export type AuditPurpose =
  | 'Business' | 'Compliance' | 'Support' | 'Investigation' | 'Training';

export interface AuditLogPayload {
  // 식별정보
  organizationId?: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;

  // 액션 정보
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;

  // PII 필드 추적
  piiFieldsAccessed?: string[];
  piiValuesBefore?: Record<string, unknown>;
  piiValuesAfter?: Record<string, unknown>;

  // 결과
  status?: 'SUCCESS' | 'FAILED' | 'DENIED';
  errorMessage?: string;

  // 목적/근거
  purpose?: AuditPurpose;
  reasonDescription?: string;

  // 성능
  durationMs?: number;
}

/**
 * 🔐 중앙 감시 로그 기록
 *
 * 사용 예시:
 * ```ts
 * await auditLog.record({
 *   organizationId: ctx.organizationId,
 *   userId: ctx.userId,
 *   action: 'READ',
 *   resourceType: 'Contact',
 *   resourceId: contactId,
 *   piiFieldsAccessed: ['phone', 'email', 'name'],
 *   purpose: 'Business',
 * });
 * ```
 */
export class AuditLogger {
  async record(payload: AuditLogPayload): Promise<void> {
    try {
      const startTime = Date.now();

      // PII 값 마스킹 (저장소에 민감한 값을 저장하지 않음)
      const maskedPayload: Record<string, any> = this.maskPiiValues({
        before: payload.piiValuesBefore,
        after: payload.piiValuesAfter,
      });

      // 데이터베이스 기록
      await prisma.auditLog.create({
        data: {
          organizationId: payload.organizationId,
          userId: payload.userId,
          sessionId: payload.sessionId,
          ipAddress: payload.ipAddress,
          userAgent: payload.userAgent?.substring(0, 500),  // 최대 500자 제한

          action: payload.action,
          resourceType: payload.resourceType,
          resourceId: payload.resourceId,

          piiFieldsAccessed: payload.piiFieldsAccessed || [],
          piiValuesModified: maskedPayload as any,

          status: payload.status || 'SUCCESS',
          errorMessage: payload.errorMessage?.substring(0, 500),

          purpose: payload.purpose,
          reasonDescription: payload.reasonDescription,

          durationMs: payload.durationMs || (Date.now() - startTime),
        },
      });

      // 심각한 PII 접근은 즉시 로깅
      if (this.isSensitiveAccess(payload)) {
        logger.warn('🔐 Sensitive PII Access', {
          action: payload.action,
          resourceType: payload.resourceType,
          userId: payload.userId,
          organizationId: payload.organizationId,
          piiFields: payload.piiFieldsAccessed,
        });
      }

    } catch (error) {
      // 감시 로그 기록 실패는 애플리케이션을 중단시키지 않음
      logger.error('❌ Audit Log Recording Failed', {
        error: error instanceof Error ? error.message : String(error),
        payload,
      });
    }
  }

  /**
   * 📊 감시 로그 조회 (관리자용)
   */
  async queryLogs(filter: {
    organizationId?: string;
    userId?: string;
    action?: AuditAction;
    resourceType?: ResourceType;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    try {
      const logs = await prisma.auditLog.findMany({
        where: {
          organizationId: filter.organizationId,
          userId: filter.userId,
          action: filter.action,
          resourceType: filter.resourceType,
          status: filter.status,
          createdAt: {
            gte: filter.startDate,
            lte: filter.endDate,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: filter.limit || 100,
      });

      return logs;
    } catch (error) {
      logger.error('❌ Audit Log Query Failed', { error });
      throw error;
    }
  }

  /**
   * 🚨 이상 탐지: PII 대량 접근
   */
  async checkPiiBulkAccess(
    organizationId: string,
    userId: string,
    timeWindowMinutes: number = 60,
  ): Promise<boolean> {
    try {
      const timeAgo = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

      const bulkAccessCount = await prisma.auditLog.count({
        where: {
          organizationId,
          userId,
          action: 'READ',
          createdAt: { gte: timeAgo },
          piiFieldsAccessed: {
            isEmpty: false,  // PII 접근만 세기
          },
        },
      });

      // 1시간에 100건 이상의 PII 접근은 이상으로 판단
      const isBulkAccess = bulkAccessCount > 100;

      if (isBulkAccess) {
        logger.warn('🚨 Potential PII Bulk Access Detected', {
          organizationId,
          userId,
          bulkAccessCount,
          timeWindowMinutes,
        });
      }

      return isBulkAccess;
    } catch (error) {
      logger.error('❌ Bulk Access Check Failed', { error });
      return false;
    }
  }

  /**
   * 🚨 이상 탐지: 실패한 로그인 시도
   */
  async checkFailedLoginAttempts(
    userId: string,
    timeWindowMinutes: number = 60,
  ): Promise<number> {
    try {
      const timeAgo = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

      const failedAttempts = await prisma.auditLog.count({
        where: {
          userId,
          action: 'LOGIN',
          status: 'FAILED',
          createdAt: { gte: timeAgo },
        },
      });

      if (failedAttempts >= 5) {
        logger.warn('🚨 Multiple Failed Login Attempts', {
          userId,
          failedAttempts,
          timeWindowMinutes,
        });

        // 자동 이상 탐지 기록
        await this.recordAnomaly({
          organizationId: undefined,
          userId,
          anomalyType: 'FAILED_LOGINS',
          riskScore: Math.min(100, failedAttempts * 20),
          details: {
            failedAttempts,
            timeWindowMinutes,
          },
        });
      }

      return failedAttempts;
    } catch (error) {
      logger.error('❌ Failed Login Check Failed', { error });
      return 0;
    }
  }

  /**
   * 🚨 이상 탐지: 비정상 접근 시간 (야간 접근)
   */
  async checkUnusualAccessTime(
    userId: string,
    organizationId?: string,
  ): Promise<boolean> {
    try {
      const now = new Date();
      const hour = now.getHours();

      // 한국 표준시 기준: 0시-5시 야간 접근
      const isUnusualTime = hour >= 0 && hour < 5;

      if (isUnusualTime) {
        logger.warn('🚨 Unusual Access Time Detected', {
          userId,
          organizationId,
          hour,
        });

        await this.recordAnomaly({
          organizationId,
          userId,
          anomalyType: 'UNUSUAL_TIME',
          riskScore: 30,
          details: { hour, date: now.toISOString() },
        });
      }

      return isUnusualTime;
    } catch (error) {
      logger.error('❌ Unusual Time Check Failed', { error });
      return false;
    }
  }

  /**
   * 🚨 이상 탐지 기록
   */
  private async recordAnomaly(payload: {
    organizationId?: string;
    userId: string;
    anomalyType: string;
    riskScore: number;
    details: Record<string, unknown>;
  }): Promise<void> {
    try {
      await prisma.anomalyDetection.create({
        data: {
          organizationId: payload.organizationId || 'unknown',
          userId: payload.userId,
          anomalyType: payload.anomalyType,
          severity: this.calculateSeverity(payload.riskScore),
          details: payload.details as any,
          riskScore: payload.riskScore,
          status: 'PENDING',
        },
      });
    } catch (error) {
      logger.error('❌ Anomaly Recording Failed', { error });
    }
  }

  /**
   * 민감한 PII 접근 판단
   */
  private isSensitiveAccess(payload: AuditLogPayload): boolean {
    const sensitivePiiFields = ['phone', 'email', 'bankAccount', 'idNumber'];

    return Boolean(
      payload.piiFieldsAccessed?.some(field => sensitivePiiFields.includes(field)) &&
      (payload.action === 'EXPORT' || payload.action === 'BULK_EXPORT')
    );
  }

  /**
   * PII 값 마스킹 (저장소에 원본 값 저장 금지)
   * 예: "010-1234-5678" -> "010-****-5678"
   */
  private maskPiiValues(values: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  }): Record<string, unknown> {
    const maskValue = (key: string, value: unknown): unknown => {
      if (typeof value !== 'string') return '[MASKED]';

      if (key === 'phone') {
        return value.replace(/(\d{3})-?(\d{3,4})-?(\d{4})/, '$1-****-$3');
      }
      if (key === 'email') {
        const [name, domain] = value.split('@');
        return `${name?.[0]}***@${domain}`;
      }
      if (key === 'name') {
        return `${value?.[0]}***`;
      }
      if (['bankAccount', 'idNumber', 'passport'].includes(key)) {
        return '[MASKED]';
      }

      return value;
    };

    return {
      before: values.before
        ? Object.fromEntries(
            Object.entries(values.before).map(([k, v]) => [k, maskValue(k, v)])
          )
        : undefined,
      after: values.after
        ? Object.fromEntries(
            Object.entries(values.after).map(([k, v]) => [k, maskValue(k, v)])
          )
        : undefined,
    };
  }

  /**
   * 위험도 점수에 따른 심각도 산정
   */
  private calculateSeverity(riskScore: number): string {
    if (riskScore >= 80) return 'CRITICAL';
    if (riskScore >= 60) return 'HIGH';
    if (riskScore >= 40) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * 📊 일일 감시 리포트 생성
   */
  async generateDailyReport(
    organizationId: string,
    date: Date = new Date(),
  ): Promise<{
    totalActions: number;
    piiAccessCount: number;
    suspiciousActivities: number;
    failedActions: number;
  }> {
    try {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const [totalActions, piiAccessCount, failedActions] = await Promise.all([
        prisma.auditLog.count({
          where: {
            organizationId,
            createdAt: { gte: dayStart, lte: dayEnd },
          },
        }),
        prisma.auditLog.count({
          where: {
            organizationId,
            piiFieldsAccessed: { isEmpty: false },
            createdAt: { gte: dayStart, lte: dayEnd },
          },
        }),
        prisma.auditLog.count({
          where: {
            organizationId,
            status: 'FAILED',
            createdAt: { gte: dayStart, lte: dayEnd },
          },
        }),
      ]);

      const suspiciousActivities = await prisma.anomalyDetection.count({
        where: {
          organizationId,
          createdAt: { gte: dayStart, lte: dayEnd },
        },
      });

      return {
        totalActions,
        piiAccessCount,
        suspiciousActivities,
        failedActions,
      };
    } catch (error) {
      logger.error('❌ Daily Report Generation Failed', { error });
      throw error;
    }
  }
}

// Singleton instance
export const auditLogger = new AuditLogger();
