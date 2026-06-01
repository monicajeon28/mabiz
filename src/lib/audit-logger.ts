import 'server-only';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { MabizAuthContext } from '@/lib/auth';

/**
 * 감시 로그 엔트리 타입
 */
export interface AuditLogEntry {
  action: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  recordId?: string | number;
  userId: string;
  organizationId: string | null;
  status: 'ALLOWED' | 'DENIED';
  reason?: string;
  details?: Record<string, any>;
  timestamp: Date;
}

/**
 * 보안 알림 이벤트
 */
export interface SecurityEvent {
  type: 'UNAUTHORIZED_ACCESS' | 'PERMISSION_DENIED' | 'SUSPICIOUS_ACTIVITY' | 'PRIVILEGE_ESCALATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId: string;
  organizationId: string | null;
  description: string;
  details: Record<string, any>;
  timestamp: Date;
}

/**
 * 감시 로그 저장
 * 모든 데이터베이스 접근을 기록합니다.
 */
export async function logAuditEntry(entry: AuditLogEntry): Promise<void> {
  try {
    // 메모리 로그 (console)
    logger.info('AUDIT_LOG', {
      action: entry.action,
      table: entry.table,
      recordId: entry.recordId,
      userId: entry.userId,
      organizationId: entry.organizationId,
      status: entry.status,
      reason: entry.reason,
      timestamp: entry.timestamp.toISOString(),
    });

    // 데이터베이스 저장 (AuditLog 테이블 추가 예정)
    // await prisma.auditLog.create({
    //   data: {
    //     action: entry.action,
    //     table: entry.table,
    //     recordId: entry.recordId?.toString(),
    //     userId: entry.userId,
    //     organizationId: entry.organizationId,
    //     status: entry.status,
    //     reason: entry.reason,
    //     details: entry.details,
    //     createdAt: entry.timestamp,
    //   },
    // });
  } catch (error) {
    logger.error('AUDIT_LOG_ERROR', { error, entry });
  }
}

/**
 * 보안 이벤트 저장 및 알림
 * 권한 거부, 무단 접근, 의심 활동 등을 기록하고 알림을 발송합니다.
 */
export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  try {
    // 콘솔 로그
    const logLevel = event.severity === 'CRITICAL' ? 'error' : event.severity === 'HIGH' ? 'warn' : 'info';
    logger[logLevel]('SECURITY_EVENT', {
      type: event.type,
      severity: event.severity,
      userId: event.userId,
      organizationId: event.organizationId,
      description: event.description,
      details: event.details,
      timestamp: event.timestamp.toISOString(),
    });

    // 데이터베이스 저장 (SecurityEvent 테이블 추가 예정)
    // await prisma.securityEvent.create({
    //   data: {
    //     type: event.type,
    //     severity: event.severity,
    //     userId: event.userId,
    //     organizationId: event.organizationId,
    //     description: event.description,
    //     details: event.details,
    //     createdAt: event.timestamp,
    //   },
    // });

    // CRITICAL 또는 HIGH 심각도인 경우 실시간 알림
    if (['CRITICAL', 'HIGH'].includes(event.severity)) {
      await notifySecurityTeam(event);
    }
  } catch (error) {
    logger.error('SECURITY_EVENT_ERROR', { error, event });
  }
}

/**
 * 보안팀에 실시간 알림 전송
 * CRITICAL/HIGH 보안 이벤트를 보안팀에 즉시 알립니다.
 */
export async function notifySecurityTeam(event: SecurityEvent): Promise<void> {
  try {
    logger.warn('SECURITY_TEAM_NOTIFICATION', {
      type: event.type,
      severity: event.severity,
      userId: event.userId,
      organizationId: event.organizationId,
      description: event.description,
      timestamp: event.timestamp.toISOString(),
    });

    // TODO: 실제 알림 채널 구현
    // - Slack 웹훅
    // - 메일 발송
    // - SMS 경고
    // - 관리자 대시보드 푸시 알림
  } catch (error) {
    logger.error('SECURITY_NOTIFICATION_ERROR', { error, event });
  }
}

/**
 * RLS 권한 검증
 * CommissionLedger 접근 권한을 검증합니다.
 */
export interface RLSCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * CommissionLedger SELECT 권한 검증
 */
export async function checkCommissionLedgerSelectPermission(
  ctx: MabizAuthContext | null,
  organizationId: string,
  profileId?: number
): Promise<RLSCheckResult> {
  // 인증 확인
  if (!ctx) {
    await logSecurityEvent({
      type: 'UNAUTHORIZED_ACCESS',
      severity: 'HIGH',
      userId: 'ANONYMOUS',
      organizationId: null,
      description: 'CommissionLedger SELECT without authentication',
      details: { organizationId, profileId },
      timestamp: new Date(),
    });
    return { allowed: false, reason: 'UNAUTHENTICATED' };
  }

  // GLOBAL_ADMIN는 모든 조직의 데이터 접근 가능
  if (ctx.role === 'GLOBAL_ADMIN') {
    return { allowed: true };
  }

  // 조직 소유자/관리자는 자신의 조직 데이터만 접근 가능
  if (ctx.role === 'OWNER') {
    if (ctx.organizationId !== organizationId) {
      await logSecurityEvent({
        type: 'PERMISSION_DENIED',
        severity: 'HIGH',
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        description: 'CommissionLedger SELECT denied: mismatched organizationId',
        details: { requestedOrgId: organizationId },
        timestamp: new Date(),
      });
      return { allowed: false, reason: 'CROSS_ORGANIZATION_ACCESS' };
    }
    return { allowed: true };
  }

  // AGENT는 자신의 프로필 데이터만 접근 가능
  if (ctx.role === 'AGENT' || ctx.role === 'FREE_SALES') {
    if (ctx.organizationId !== organizationId) {
      await logSecurityEvent({
        type: 'PERMISSION_DENIED',
        severity: 'HIGH',
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        description: 'CommissionLedger SELECT denied: mismatched organizationId',
        details: { requestedOrgId: organizationId },
        timestamp: new Date(),
      });
      return { allowed: false, reason: 'CROSS_ORGANIZATION_ACCESS' };
    }

    // 자신의 프로필 데이터만 조회 가능
    // Check if profileId is specified and doesn't match user's profile
    if (profileId && ctx.mallUser) {
      if (ctx.mallUser.affiliateProfileId !== profileId) {
        await logSecurityEvent({
          type: 'PERMISSION_DENIED',
          severity: 'MEDIUM',
          userId: ctx.userId,
          organizationId: ctx.organizationId,
          description: 'CommissionLedger SELECT denied: mismatched profileId',
          details: { requestedProfileId: profileId, userProfileId: ctx.mallUser.affiliateProfileId },
          timestamp: new Date(),
        });
        return { allowed: false, reason: 'CROSS_PROFILE_ACCESS' };
      }
    }
    return { allowed: true };
  }

  await logSecurityEvent({
    type: 'PERMISSION_DENIED',
    severity: 'MEDIUM',
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    description: 'CommissionLedger SELECT denied: unknown role',
    details: { role: ctx.role },
    timestamp: new Date(),
  });
  return { allowed: false, reason: 'UNKNOWN_ROLE' };
}

/**
 * CommissionLedger INSERT/UPDATE 권한 검증
 */
export async function checkCommissionLedgerModifyPermission(
  ctx: MabizAuthContext | null,
  organizationId: string
): Promise<RLSCheckResult> {
  // 인증 확인
  if (!ctx) {
    await logSecurityEvent({
      type: 'UNAUTHORIZED_ACCESS',
      severity: 'CRITICAL',
      userId: 'ANONYMOUS',
      organizationId: null,
      description: 'CommissionLedger INSERT/UPDATE without authentication',
      details: { organizationId },
      timestamp: new Date(),
    });
    return { allowed: false, reason: 'UNAUTHENTICATED' };
  }

  // GLOBAL_ADMIN만 수정 가능
  if (ctx.role !== 'GLOBAL_ADMIN') {
    await logSecurityEvent({
      type: 'PERMISSION_DENIED',
      severity: 'CRITICAL',
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      description: 'CommissionLedger INSERT/UPDATE denied: insufficient privilege',
      details: { role: ctx.role },
      timestamp: new Date(),
    });
    return { allowed: false, reason: 'INSUFFICIENT_PRIVILEGE' };
  }

  return { allowed: true };
}

/**
 * CommissionLedger DELETE 권한 검증 (원칙적으로 금지)
 */
export async function checkCommissionLedgerDeletePermission(
  ctx: MabizAuthContext | null,
  organizationId: string
): Promise<RLSCheckResult> {
  // DELETE는 원칙적으로 금지
  await logSecurityEvent({
    type: 'SUSPICIOUS_ACTIVITY',
    severity: 'CRITICAL',
    userId: ctx?.userId || 'ANONYMOUS',
    organizationId: ctx?.organizationId || null,
    description: 'CommissionLedger DELETE attempted (operation not permitted)',
    details: { organizationId, role: ctx?.role },
    timestamp: new Date(),
  });

  return { allowed: false, reason: 'DELETE_NOT_PERMITTED' };
}

/**
 * 감사 로그 조회 권한 검증
 */
export async function checkAuditLogReadPermission(
  ctx: MabizAuthContext | null
): Promise<RLSCheckResult> {
  if (!ctx) {
    return { allowed: false, reason: 'UNAUTHENTICATED' };
  }

  // GLOBAL_ADMIN만 조회 가능
  if (ctx.role !== 'GLOBAL_ADMIN') {
    await logSecurityEvent({
      type: 'PERMISSION_DENIED',
      severity: 'HIGH',
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      description: 'AuditLog READ denied: insufficient privilege',
      details: { role: ctx.role },
      timestamp: new Date(),
    });
    return { allowed: false, reason: 'INSUFFICIENT_PRIVILEGE' };
  }

  return { allowed: true };
}
