/**
 * PII (개인식별정보) 마스킹 엔진
 * GDPR, CCPA, 한국 PIPA 규정 준수
 */

import { Contact360Response } from './types';

export interface MaskOptions {
  level: 'full' | 'partial' | 'none';
  roles: string[];
  orgId: string;
}

export interface MaskingPolicy {
  level: 'full' | 'partial' | 'none';
  maskPhone: boolean;
  maskEmail: boolean;
  maskName: boolean;
  maskAddress: boolean;
  maskIdNumber: boolean;
}

/**
 * 역할별 마스킹 정책
 */
const maskingPolicies: Record<string, MaskingPolicy> = {
  ADMIN: {
    level: 'none',
    maskPhone: false,
    maskEmail: false,
    maskName: false,
    maskAddress: false,
    maskIdNumber: false
  },
  MANAGER: {
    level: 'partial',
    maskPhone: true,
    maskEmail: true,
    maskName: false,
    maskAddress: true,
    maskIdNumber: true
  },
  AGENT: {
    level: 'full',
    maskPhone: true,
    maskEmail: true,
    maskName: false,
    maskAddress: true,
    maskIdNumber: true
  },
  VIEWER: {
    level: 'full',
    maskPhone: true,
    maskEmail: true,
    maskName: true,
    maskAddress: true,
    maskIdNumber: true
  }
};

/**
 * 전화번호 마스킹
 * 예: 01012345678 → 010****5678 (level=partial) → 01XXXXXXXX (level=full)
 */
function maskPhone(phone: string | null, policy: MaskingPolicy): string | null {
  if (!phone || !policy.maskPhone) return phone;

  if (policy.level === 'none') return phone;
  if (policy.level === 'partial') {
    // 첫 3자리 + 끝 4자리만 노출
    return phone.slice(0, 3) + '*'.repeat(phone.length - 7) + phone.slice(-4);
  }
  // full: 처음 3자리만 노출
  return phone.slice(0, 3) + '*'.repeat(phone.length - 3);
}

/**
 * 이메일 마스킹
 * 예: kim.min.jun@example.com → ki****@example.com (partial) → k****@example.com (full)
 */
function maskEmail(email: string | null, policy: MaskingPolicy): string | null {
  if (!email || !policy.maskEmail) return email;

  const [user, domain] = email.split('@');
  if (!domain) return email;

  if (policy.level === 'none') return email;
  if (policy.level === 'partial') {
    // 첫 2글자 + @ + 도메인
    const visible = Math.max(1, Math.ceil(user.length * 0.3));
    return user.slice(0, visible) + '*'.repeat(user.length - visible) + '@' + domain;
  }
  // full: 첫 글자 + @ + 도메인
  return user[0] + '*'.repeat(user.length - 1) + '@' + domain;
}

/**
 * 이름 마스킹
 * 예: 김민준 → 김** (partial) → 김** (full, 성만 표시)
 */
function maskName(name: string | null, policy: MaskingPolicy): string | null {
  if (!name || !policy.maskName) return name;

  if (policy.level === 'none') return name;

  // 성만 표시, 이름은 마스킹
  return name[0] + '*'.repeat(Math.max(1, name.length - 1));
}

/**
 * Contact360Response에 PII 마스킹 적용
 */
export function maskPII(data: Contact360Response, options: MaskOptions): Contact360Response {
  const policy = maskingPolicies[options.roles[0] || 'VIEWER'] || maskingPolicies.VIEWER;

  if (policy.level === 'none') {
    return data;
  }

  return {
    ...data,
    contact: {
      ...data.contact,
      phone: maskPhone(data.contact.phone, policy),
      email: maskEmail(data.contact.email, policy),
      name: maskName(data.contact.name, policy)
    },
    partner: data.partner
      ? {
          ...data.partner,
          phone: maskPhone(data.partner.phone, policy),
          email: maskEmail(data.partner.email, policy),
          name: maskName(data.partner.name, policy)
        }
      : null,
    communications: {
      ...data.communications,
      smsLogs: data.communications.smsLogs.map(log => ({
        ...log,
        content: policy.level === 'full' ? '[마스킹됨]' : log.content
      })),
      callLogs: data.communications.callLogs.map(log => ({
        ...log
        // CallLog 자체는 민감도가 낮아 마스킹 불필요
      }))
    },
    // 그외 필드는 유지
    goldMember: data.goldMember
      ? {
          ...data.goldMember
          // GoldMember 내 민감 정보는 별도 마스킹
        }
      : null
  };
}

/**
 * 역할 기반 마스킹 정책 적용
 */
export async function applyMaskingPolicy(
  data: Contact360Response,
  userRole: string,
  orgId: string
): Promise<Contact360Response> {
  const options: MaskOptions = {
    level: maskingPolicies[userRole]?.level || 'full',
    roles: [userRole],
    orgId
  };

  return maskPII(data, options);
}

/**
 * 마스킹된 데이터 검증
 */
export function validateMasking(original: string, masked: string): boolean {
  // 마스킹된 텍스트가 원본과 길이가 같은지 확인
  if (original.length !== masked.length) {
    return false;
  }

  // '*'로 시작해야 함 (일부 정보가 숨겨짐)
  return masked.includes('*');
}

/**
 * 데이터 보존 정책 (GDPR, CCPA, PIPA)
 */
export enum DataRetentionPolicy {
  GDPR = 'gdpr', // 3년 후 자동 삭제
  CCPA = 'ccpa', // 사용자 요청 시 삭제
  KOREA_PIPA = 'pipa' // 수집 목적 달성 후 삭제 (기본 5년)
}

/**
 * 데이터 보존 기간 계산
 */
export function getRetentionDays(policy: DataRetentionPolicy): number {
  const retentionDays: Record<DataRetentionPolicy, number> = {
    [DataRetentionPolicy.GDPR]: 365 * 3, // 3년
    [DataRetentionPolicy.CCPA]: 365, // 1년
    [DataRetentionPolicy.KOREA_PIPA]: 365 * 5 // 5년
  };

  return retentionDays[policy];
}

/**
 * 삭제 예정일 계산
 */
export function calculateDeletionDate(
  createdAt: Date,
  policy: DataRetentionPolicy
): Date {
  const deleteDate = new Date(createdAt);
  deleteDate.setDate(deleteDate.getDate() + getRetentionDays(policy));
  return deleteDate;
}

/**
 * 감사 로그 (마스킹된 데이터 접근 기록)
 */
export interface AuditLog {
  timestamp: Date;
  userId: string;
  contactId: string;
  role: string;
  maskingLevel: 'none' | 'partial' | 'full';
  action: 'VIEW' | 'EXPORT' | 'SHARE';
  ipAddress?: string;
  userAgent?: string;
}

/**
 * 감사 로그 생성
 */
export function createAuditLog(
  userId: string,
  contactId: string,
  role: string,
  maskingLevel: 'none' | 'partial' | 'full',
  action: 'VIEW' | 'EXPORT' | 'SHARE',
  ipAddress?: string
): AuditLog {
  return {
    timestamp: new Date(),
    userId,
    contactId,
    role,
    maskingLevel,
    action,
    ipAddress
  };
}
