// lib/audit-logger.ts
// 감사 로그 시스템 - 중요 작업 추적

import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';

export interface AuditLogParams {
  userId: number;
  action: string;
  targetType: string;
  targetId: string | number;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
}

/**
 * 감사 로그 기록
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    // AuditLog 테이블이 없으면 콘솔에만 기록
    logger.log('[AUDIT]', {
      timestamp: new Date().toISOString(),
      userId: params.userId,
      action: params.action,
      targetType: params.targetType,
      targetId: String(params.targetId),
      oldValue: params.oldValue,
      newValue: params.newValue,
      ipAddress: params.ipAddress,
      metadata: params.metadata,
    });

    // TODO: AuditLog 테이블 생성 후 활성화
    // await prisma.auditLog.create({
    //   data: {
    //     userId: params.userId,
    //     action: params.action,
    //     targetType: params.targetType,
    //     targetId: String(params.targetId),
    //     oldValue: params.oldValue || null,
    //     newValue: params.newValue || null,
    //     ipAddress: params.ipAddress || null,
    //     userAgent: params.userAgent || null,
    //     metadata: params.metadata || null,
    //   },
    // });
  } catch (error) {
    logger.error('[AUDIT ERROR]', error);
    // 감사 로그 실패는 서비스를 중단하지 않음
  }
}

/**
 * Request에서 클라이언트 정보 추출
 */
export function getClientInfo(req: Request): { ipAddress: string; userAgent: string } {
  const headers = new Headers(req.headers);
  return {
    ipAddress: headers.get('x-forwarded-for')?.split(',')[0].trim()
      || headers.get('x-real-ip')
      || 'unknown',
    userAgent: headers.get('user-agent') || 'unknown',
  };
}

// 액션 타입 상수
export const AUDIT_ACTIONS = {
  // 수당 관련
  COMMISSION_ADJUST: 'commission_adjust',
  COMMISSION_APPROVE: 'commission_approve',
  COMMISSION_REJECT: 'commission_reject',

  // 판매 관련
  SALE_APPROVE: 'sale_approve',
  SALE_REJECT: 'sale_reject',
  SALE_CREATE: 'sale_create',
  SALE_UPDATE: 'sale_update',

  // 정산 관련
  SETTLEMENT_CREATE: 'settlement_create',
  SETTLEMENT_PAID: 'settlement_paid',

  // 파트너 관련
  PARTNER_APPROVE: 'partner_approve',
  PARTNER_SUSPEND: 'partner_suspend',

  // 파일 관련
  FILE_UPLOAD: 'file_upload',
  FILE_DELETE: 'file_delete',
} as const;

// 대상 타입 상수
export const AUDIT_TARGET_TYPES = {
  AFFILIATE_SALE: 'AffiliateSale',
  AFFILIATE_SETTLEMENT: 'AffiliateSettlement',
  AFFILIATE_PARTNER: 'AffiliatePartner',
  COMMISSION_LEDGER: 'CommissionLedger',
  COMMISSION_ADJUSTMENT: 'CommissionAdjustment',
} as const;
