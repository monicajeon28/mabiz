/**
 * Passport SMS API 공통 라이브러리
 *
 * 목적:
 * - Aligo SMS 발송 래퍼
 * - 여권 상태 조회 최적화
 * - 로깅 및 에러 처리 통합
 */

import prisma from '@/lib/prisma';
import { sendSms, resolveUserSmsConfig } from '@/lib/aligo';
import type { AligoConfig } from '@/lib/aligo';
import { logger } from '@/lib/logger';

export interface PassportCustomer {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  passportStatus: 'MISSING' | 'PENDING' | 'SUBMITTED' | 'APPROVED';
}

export interface PassportSmsLog {
  userId: number;
  status: 'SENT' | 'FAILED' | 'BLOCKED';
  messageId?: string;
  errorReason?: string;
}

/**
 * 여권 상태 조회 (단일 사용자)
 * @param userId - GmUser ID
 * @param tripId - GmTrip ID (선택)
 * @returns 여권 상태: MISSING | PENDING | SUBMITTED | APPROVED
 */
export async function getPassportStatus(
  userId: number,
  tripId?: number
): Promise<'MISSING' | 'PENDING' | 'SUBMITTED' | 'APPROVED'> {
  const submission = await prisma.gmPassportSubmission.findFirst({
    where: {
      userId,
      ...(tripId && { tripId }),
    },
    select: {
      isSubmitted: true,
      tokenExpiresAt: true,
    },
  });

  if (!submission) return 'MISSING';
  if (submission.isSubmitted) return 'SUBMITTED';
  if (submission.tokenExpiresAt && submission.tokenExpiresAt > new Date()) {
    return 'PENDING';
  }
  return 'MISSING';
}

/**
 * 여권 상태 일괄 조회 (성능 최적화)
 * @param tripId - GmTrip ID
 * @returns userId → 여권상태 맵
 */
export async function getPassportStatusMap(
  tripId: number
): Promise<Map<number, 'MISSING' | 'PENDING' | 'SUBMITTED' | 'APPROVED'>> {
  const submissions = await prisma.gmPassportSubmission.findMany({
    where: { tripId },
    select: {
      userId: true,
      isSubmitted: true,
      tokenExpiresAt: true,
    },
  });

  const statusMap = new Map<
    number,
    'MISSING' | 'PENDING' | 'SUBMITTED' | 'APPROVED'
  >();

  submissions.forEach((s) => {
    let status: 'MISSING' | 'PENDING' | 'SUBMITTED' | 'APPROVED' = 'MISSING';
    if (s.isSubmitted) {
      status = 'SUBMITTED';
    } else if (s.tokenExpiresAt && s.tokenExpiresAt > new Date()) {
      status = 'PENDING';
    }
    statusMap.set(s.userId, status);
  });

  return statusMap;
}

/**
 * 중복 발송 체크 (최근 24시간)
 * @param userId - GmUser ID
 * @param tripId - GmTrip ID
 * @returns true = 최근 발송 있음
 */
export async function isDuplicateSendAllowed(
  userId: number,
  tripId?: number
): Promise<boolean> {
  const recentLog = await prisma.gmPassportRequestLog.findFirst({
    where: {
      userId,
      status: 'SENT',
      sentAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24시간
      },
    },
    orderBy: { sentAt: 'desc' },
  });

  return !!recentLog;
}

/**
 * SMS 발송 + 로그 기록
 * @param params - 발송 파라미터
 * @returns 발송 결과
 */
export interface SendPassportSmsParams {
  smsConfig: AligoConfig | null;
  userId: number;
  phone: string;
  message: string;
  adminId?: number;
  tripId?: number;
}

export async function sendPassportSms(
  params: SendPassportSmsParams
): Promise<PassportSmsLog> {
  const { smsConfig, userId, phone, message, adminId, tripId } = params;

  if (!smsConfig) {
    throw new Error('[PassportSms] SMS 설정 없음 - 발송 불가');
  }

  try {
    const result = await sendSms({
      config: smsConfig,
      receiver: phone,
      msg: message,
      msgType: message.length > 90 ? 'LMS' : 'SMS',
      channel: 'MANUAL',
    });

    const status = result.result_code === 1 ? 'SENT' : 'FAILED';

    // 로그 기록
    await prisma.gmPassportRequestLog.create({
      data: {
        userId,
        adminId,
        messageBody: message,
        messageChannel: 'SMS',
        status,
        errorReason: status === 'FAILED' ? result.message : null,
        sentAt: new Date(),
      },
    });

    logger.log('[PassportSms] 발송 완료', {
      userId,
      status,
      resultCode: result.result_code,
    });

    return {
      userId,
      status,
      messageId: result.msg_id,
    };
  } catch (error) {
    logger.error('[PassportSms] 발송 실패', { userId, error });

    // 에러 로그
    await prisma.gmPassportRequestLog.create({
      data: {
        userId,
        adminId,
        messageBody: message,
        messageChannel: 'SMS',
        status: 'FAILED',
        errorReason: String(error),
        sentAt: new Date(),
      },
    });

    return {
      userId,
      status: 'FAILED',
      errorReason: String(error),
    };
  }
}

/**
 * SMS 템플릿 함수
 */
export interface SmsTemplateParams {
  name?: string | null;
  cruiseName?: string | null;
  departureDate?: Date;
  passportLink?: string;
}

export function getSmsTemplate(
  type: 'basic' | 'reminder' | 'urgent',
  params: SmsTemplateParams
): string {
  const { name = '고객님', cruiseName = '여행', passportLink = 'passport.mabiz.co.kr' } =
    params;

  switch (type) {
    case 'reminder':
      return `[마비즈크루즈] ${name}님, ${cruiseName} 여권 제출이 남았습니다. 🔗 ${passportLink}`;

    case 'urgent':
      return `[마비즈크루즈] ⚠️ ${name}님, 여권 제출 기한이 임박했습니다. 지금 제출해주세요. 🔗 ${passportLink}`;

    case 'basic':
    default:
      return `[마비즈크루즈] ${name}님, ${cruiseName} 예약이 확정되었습니다. 여권을 제출해주세요. 🔗 ${passportLink}`;
  }
}

/**
 * 전화번호 마스킹 (권한 기반)
 * @param phone - 원본 전화번호
 * @param role - 사용자 역할
 * @returns 마스킹된 전화번호 또는 원본
 */
export function maskPhoneNumber(
  phone: string | null,
  role: string | null
): string | null {
  if (!phone) return null;

  // 관리자: 전체 공개
  if (['GLOBAL_ADMIN', 'OWNER'].includes(role ?? '')) return phone;

  // 기타: 마스킹
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 11) {
    return digits.slice(0, 3) + '-****-' + digits.slice(7); // 010-****-5678
  }
  if (digits.length === 10) {
    return digits.slice(0, 2) + '-****-' + digits.slice(6); // 02-****-5678
  }
  return digits.slice(0, 3) + '-****-****'; // 부분 마스킹
}

/**
 * SMS 발송 통계
 */
export interface SmsStats {
  totalSent: number;
  totalFailed: number;
  totalBlocked: number;
  successRate: number;
}

export async function getSmsStats(
  tripId: number,
  days: number = 7
): Promise<SmsStats> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const logs = await prisma.gmPassportRequestLog.findMany({
    where: {
      sentAt: { gte: cutoff },
    },
    select: { status: true },
  });

  const sent = logs.filter((l) => l.status === 'SENT').length;
  const failed = logs.filter((l) => l.status === 'FAILED').length;
  const blocked = logs.filter((l) => l.status === 'BLOCKED').length;
  const total = sent + failed + blocked;

  return {
    totalSent: sent,
    totalFailed: failed,
    totalBlocked: blocked,
    successRate: total > 0 ? (sent / total) * 100 : 0,
  };
}
