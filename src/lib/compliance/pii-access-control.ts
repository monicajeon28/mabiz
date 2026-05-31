/**
 * PII 필드 접근 제어 (Role-Based Access Control for PII)
 * GDPR/CCPA 규정 준수
 *
 * 2026-05-27 Compliance Monitor Agent
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getAuthContext } from '@/lib/rbac';

export type Role = 'GLOBAL_ADMIN' | 'OWNER' | 'AGENT' | 'ANALYST' | 'READONLY';

export interface PiiField {
  name: string;
  readable: boolean;
  writable: boolean;
  requiresApproval?: boolean;
  maskInLogs?: boolean;
}

/**
 * 기본 PII 필드 정의
 */
export const PII_FIELD_REGISTRY: Record<string, PiiField> = {
  phone: { name: 'phone', readable: true, writable: true, requiresApproval: false, maskInLogs: true },
  email: { name: 'email', readable: true, writable: true, requiresApproval: false, maskInLogs: true },
  name: { name: 'name', readable: true, writable: true, requiresApproval: false, maskInLogs: false },
  phoneEncrypted: { name: 'phoneEncrypted', readable: false, writable: false, requiresApproval: true },
  phoneHash: { name: 'phoneHash', readable: false, writable: false, requiresApproval: true },
  emailEncrypted: { name: 'emailEncrypted', readable: false, writable: false, requiresApproval: true },
  nameEncrypted: { name: 'nameEncrypted', readable: false, writable: false, requiresApproval: true },
  bankAccount: { name: 'bankAccount', readable: false, writable: false, requiresApproval: true },
  idNumber: { name: 'idNumber', readable: false, writable: false, requiresApproval: true },
  passport: { name: 'passport', readable: false, writable: false, requiresApproval: true },
  creditCard: { name: 'creditCard', readable: false, writable: false, requiresApproval: true },
};

/**
 * 🔐 PII 접근 제어 시스템
 *
 * 역할별 기본 권한:
 * - GLOBAL_ADMIN: 모든 PII 필드 읽기/쓰기 (감시 로그 기록)
 * - OWNER: 조직 내 연락처 기본 PII (phone, email, name)
 * - AGENT: 담당 연락처만 기본 PII
 * - ANALYST: 읽기 전용, 승인 필요
 * - READONLY: 모든 접근 거부
 */
export class PiiAccessControl {
  /**
   * ✅ 필드 접근 권한 확인
   */
  async canAccessField(
    role: Role,
    field: string,
    action: 'read' | 'write',
    organizationId?: string,
  ): Promise<boolean> {
    try {
      // 기본 권한 확인
      const piiField = PII_FIELD_REGISTRY[field];
      if (!piiField) return true;  // PII가 아닌 필드는 접근 허용

      // 역할별 기본 권한
      if (!this.hasRolePermission(role, piiField, action)) {
        return false;
      }

      // 조직별 커스텀 정책 확인
      if (organizationId) {
        const policy = await this.getAccessPolicy(organizationId, role);
        if (action === 'read' && !policy.allowedPiiFields.includes(field)) {
          return false;
        }
        if (action === 'write' && !policy.modifiablePiiFields.includes(field)) {
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('❌ PII Access Check Failed', { error, role, field });
      return false;
    }
  }

  /**
   * ✅ 다중 필드 접근 권한 확인 (벌크 조회용)
   */
  async filterAccessibleFields(
    role: Role,
    fields: string[],
    action: 'read' | 'write',
    organizationId?: string,
  ): Promise<string[]> {
    try {
      const accessible: string[] = [];

      for (const field of fields) {
        if (await this.canAccessField(role, field, action, organizationId)) {
          accessible.push(field);
        }
      }

      return accessible;
    } catch (error) {
      logger.error('❌ Field Filter Failed', { error, role, fields });
      return [];
    }
  }

  /**
   * 🚫 접근 차단: 대량 데이터 수출 제한
   */
  async checkBulkExportLimit(
    role: Role,
    exportRowCount: number,
    organizationId?: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const policy = await this.getAccessPolicy(organizationId || 'default', role);

      if (exportRowCount > policy.maxBulkExportRows) {
        return {
          allowed: false,
          reason: `수출 제한: 최대 ${policy.maxBulkExportRows}행까지만 가능 (요청: ${exportRowCount}행)`,
        };
      }

      return { allowed: true };
    } catch (error) {
      logger.error('❌ Bulk Export Check Failed', { error });
      return { allowed: false, reason: '시스템 오류' };
    }
  }

  /**
   * 🚫 접근 차단: 쿼리 결과 크기 제한
   */
  async checkQueryResultLimit(
    role: Role,
    resultCount: number,
    organizationId?: string,
  ): Promise<{ allowed: boolean; maxResults: number }> {
    try {
      const policy = await this.getAccessPolicy(organizationId || 'default', role);

      return {
        allowed: resultCount <= policy.maxQueryResults,
        maxResults: policy.maxQueryResults,
      };
    } catch (error) {
      logger.error('❌ Query Limit Check Failed', { error });
      return { allowed: false, maxResults: 0 };
    }
  }

  /**
   * 📋 PII 필드 마스킹 (UI 출력용)
   *
   * 예: "010-1234-5678" -> "010-****-5678"
   */
  maskPiiValue(field: string, value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value !== 'string') return String(value);

    const piiField = PII_FIELD_REGISTRY[field];
    if (!piiField?.maskInLogs) return value;

    switch (field) {
      case 'phone':
      case 'phoneEncrypted':
        return value.replace(/(\d{3})-?(\d{3,4})-?(\d{4})/, '$1-****-$3');

      case 'email':
      case 'emailEncrypted':
        const [name, domain] = value.split('@');
        return `${name?.[0]}***@${domain}`;

      case 'name':
      case 'nameEncrypted':
        return `${value?.[0]}***`;

      case 'bankAccount':
        return value.slice(-4).padStart(value.length, '*');

      case 'idNumber':
      case 'passport':
      case 'creditCard':
        return '[MASKED]';

      default:
        return value;
    }
  }

  /**
   * 📊 조직별 PII 접근 정책 조회
   */
  private async getAccessPolicy(
    organizationId: string,
    role: Role,
  ) {
    try {
      const policy = await prisma.piiAccessPolicy.findUnique({
        where: {
          organizationId_roleName: {
            organizationId,
            roleName: role,
          },
        },
      });

      if (policy) {
        return {
          allowedPiiFields: policy.allowedPiiFields,
          modifiablePiiFields: policy.modifiablePiiFields,
          maxBulkExportRows: policy.maxBulkExportRows,
          maxQueryResults: policy.maxQueryResults,
          requiresApproval: policy.requiresApproval,
        };
      }

      // 기본 정책
      return this.getDefaultPolicy(role);
    } catch (error) {
      logger.error('❌ Policy Lookup Failed', { error });
      return this.getDefaultPolicy(role);
    }
  }

  /**
   * 기본 PII 접근 정책
   */
  private getDefaultPolicy(role: Role) {
    const policies: Record<Role, any> = {
      GLOBAL_ADMIN: {
        allowedPiiFields: Object.keys(PII_FIELD_REGISTRY),
        modifiablePiiFields: ['phone', 'email', 'name'],
        maxBulkExportRows: 100000,
        maxQueryResults: 100000,
        requiresApproval: false,
      },
      OWNER: {
        allowedPiiFields: ['phone', 'email', 'name'],
        modifiablePiiFields: ['phone', 'email', 'name'],
        maxBulkExportRows: 1000,
        maxQueryResults: 10000,
        requiresApproval: false,
      },
      AGENT: {
        allowedPiiFields: ['phone', 'email', 'name'],
        modifiablePiiFields: ['phone', 'email', 'name'],
        maxBulkExportRows: 100,
        maxQueryResults: 1000,
        requiresApproval: false,
      },
      ANALYST: {
        allowedPiiFields: ['phone', 'email'],
        modifiablePiiFields: [],
        maxBulkExportRows: 100,
        maxQueryResults: 1000,
        requiresApproval: true,
      },
      READONLY: {
        allowedPiiFields: [],
        modifiablePiiFields: [],
        maxBulkExportRows: 0,
        maxQueryResults: 100,
        requiresApproval: true,
      },
    };

    return policies[role];
  }

  /**
   * 역할별 기본 권한 확인
   */
  private hasRolePermission(role: Role, field: PiiField, action: 'read' | 'write'): boolean {
    if (role === 'READONLY') return false;
    if (role === 'GLOBAL_ADMIN') return true;

    if (action === 'read') {
      return field.readable && !field.requiresApproval;
    }

    return field.writable && !field.requiresApproval;
  }
}

// Singleton instance
export const piiAccessControl = new PiiAccessControl();

/**
 * 🔐 Express 미들웨어: 모든 요청에 대한 PII 접근 제어
 *
 * 사용 예시:
 * ```ts
 * app.use(piiAccessControlMiddleware);
 * ```
 */
export async function piiAccessControlMiddleware(
  req: any,
  res: any,
  next: any,
) {
  try {
    const ctx = await getAuthContext();
    const role = ctx.role as Role;

    // 요청 객체에 PII 필터 함수 추가
    req.piiControl = {
      canAccess: async (field: string, action: 'read' | 'write' = 'read') =>
        piiAccessControl.canAccessField(role, field, action, ctx.organizationId ?? undefined),

      filterFields: async (fields: string[], action: 'read' | 'write' = 'read') =>
        piiAccessControl.filterAccessibleFields(role, fields, action, ctx.organizationId ?? undefined),

      maskValue: (field: string, value: any) =>
        piiAccessControl.maskPiiValue(field, value),
    };

    next();
  } catch (error) {
    logger.error('❌ PII Middleware Error', { error });
    next();
  }
}
