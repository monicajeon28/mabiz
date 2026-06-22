import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { timingSafeEqual } from "crypto";

/**
 * M4-3: Ebbinghaus 망각곡선 SMS 발송
 *
 * 심리학:
 * - L6 (손실회피): "여권 데이터 손실 방지"
 * - L8 (반복 습관): "정기적 백업 권장" (간격을 늘려가며 상기)
 *
 * Ebbinghaus 간격:
 * - Day 1: 초기 복구 후 1일 (기억 강화)
 * - Day 3: 3일 (재확인)
 * - Day 7: 7일 (중기 유지)
 * - Day 30: 30일 (장기 습habit화)
 */

/**
 * Ebbinghaus 망각곡선 SMS 템플릿 (50대 친화, 초등학생 수준 한글)
 */
export interface PassportBackupSmsTemplate {
  dayOffset: number;
  subject: string; // SMS 제목 없음, LMS일 때만 사용
  message: string;
  psychologyLens: string; // 적용된 심리학 렌즈 (로깅용)
}

/**
 * 각 발송 단계별 SMS 텍스트
 *
 * 특징:
 * - "여권정보" (마비즈 표준용어, Contact 필드명)
 * - 긍정 마인드 (손실회피가 아닌 긍정 강화)
 * - 정보 최소화 (초등학생 수준, 50대 친화)
 * - CTA 없음 (이미 백업 완료 후이므로)
 */
export const PASSPORT_BACKUP_SMS_TEMPLATES: Record<number, PassportBackupSmsTemplate> = {
  1: {
    dayOffset: 1,
    subject: "여권정보 백업 확인",
    message:
      "여권정보 백업이 완료됐어요!\n지금은 자동복구 가능합니다. (사용자 승인 후 복구)\n걱정하지 마세요!",
    psychologyLens: "L8 (반복 습관) + 안심 강조",
  },
  3: {
    dayOffset: 3,
    subject: "여권정보 재확인",
    message:
      "혹시 여권정보를 다시 확인해봤나요?\n이미 안전하게 보관 중입니다. (확인만 하셔도 좋습니다)\n계속 안전해요!",
    psychologyLens: "L6 (손실회피 해소) + 정기 확인 권장",
  },
  7: {
    dayOffset: 7,
    subject: "여권정보 1주간 유지",
    message:
      "여권정보 한 주 유지 중입니다.\n추가 입력은 안 해도 돼요! (자동 보관 중)\n언제든 복구 가능합니다.",
    psychologyLens: "L8 (습관화) + 편안함 강조",
  },
  30: {
    dayOffset: 30,
    subject: "여권정보 1개월 안전",
    message:
      "여권정보 1개월 안전! 이제 안심할 수 있어요.\n언제든 필요하면 바로 복구하세요. (1초 완료)\n계속 보호 중입니다!",
    psychologyLens: "L8 (장기 습관화) + 신뢰감",
  },
};

/**
 * 발송 대상 조회: PassportBackupReminderLog에서 오늘의 발송 대상 찾기
 *
 * @param dayOffset 1, 3, 7, 30 중 선택
 * @returns 발송 대상 (organizationId, contactId, passportOCRBackupLogId)
 */
export async function findBackupReminderTargets(dayOffset: number) {
  const template = PASSPORT_BACKUP_SMS_TEMPLATES[dayOffset as 1 | 3 | 7 | 30];
  if (!template) {
    throw new Error(`[PassportBackupReminder] 템플릿 ${dayOffset}일 없음`);
  }

  // 발송 조건:
  // 1. firstBackupAt이 정확히 dayOffset일 전
  // 2. 해당 필드 (day1Sent, day3Sent 등)가 false
  // 3. contactId가 null이 아님 (복구 완료 대상)

  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() - dayOffset);
  targetDate.setHours(0, 0, 0, 0); // 자정 기준

  const dayEndDate = new Date(targetDate);
  dayEndDate.setDate(dayEndDate.getDate() + 1);
  dayEndDate.setHours(0, 0, 0, 0);

  const sentField = `day${dayOffset}Sent` as const;

  // PassportBackupReminderLog에서 해당 필드 = false인 대상 조회
  const where: any = {
    contactId: { not: null }, // 복구 완료 대상만
    firstBackupAt: {
      gte: targetDate,
      lt: dayEndDate,
    },
    [sentField]: false, // 이번 발송 미처리
  };

  const targets = await prisma.passportBackupReminderLog.findMany({
    where,
    select: {
      id: true,
      organizationId: true,
      contactId: true,
      passportOCRBackupLogId: true,
    },
    take: 100, // 배치 크기 제한
  });

  return targets;
}

/**
 * SMS 발송 대상에 대한 Contact 정보 조회
 */
export async function enrichTargetsWithContactInfo(
  targets: Array<{
    id: string;
    organizationId: string;
    contactId: string | null;
    passportOCRBackupLogId: string;
  }>
) {
  if (targets.length === 0) return [];

  const contactIds = targets
    .map((t) => t.contactId)
    .filter((id): id is string => id !== null);

  if (contactIds.length === 0) return [];

  const contacts = await prisma.contact.findMany({
    where: { id: { in: contactIds } },
    select: {
      id: true,
      name: true,
      phone: true,
      organizationId: true,
    },
  });

  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  return targets
    .map((t) => {
      const contact = t.contactId ? contactMap.get(t.contactId) : null;
      return {
        ...t,
        contact,
      };
    })
    .filter((t) => t.contact !== null);
}

/**
 * Aligo를 통한 SMS 발송
 */
export async function sendPassportBackupSms(params: {
  phone: string;
  message: string;
  dayOffset: number;
  organizationId: string;
  reminderId: string;
}): Promise<{ success: boolean; error?: string; msgId?: string }> {
  const { phone, message, dayOffset, organizationId, reminderId } = params;

  const apiKey = process.env.ALIGO_API_KEY;
  const aligoUserId = process.env.ALIGO_USER_ID;
  const senderPhone = process.env.ALIGO_SENDER_PHONE;

  if (!apiKey || !aligoUserId || !senderPhone) {
    logger.error("[PassportBackupReminder] Aligo 환경변수 미설정", {
      organizationId,
      dayOffset,
    });
    return { success: false, error: "Aligo config missing" };
  }

  try {
    // SMS / LMS 자동 선택 (90자 기준)
    const msgType: "SMS" | "LMS" = new Blob([message]).size > 90 ? "LMS" : "SMS";

    const formData = new URLSearchParams();
    formData.append("key", apiKey);
    formData.append("user_id", aligoUserId);
    formData.append("sender", senderPhone);
    formData.append("receiver", phone);
    formData.append("msg", message);
    formData.append("msg_type", msgType);

    if (msgType === "LMS") {
      formData.append("title", `여권정보 보관 안내 (${dayOffset}일)`);
    }

    const response = await fetch("https://apis.aligo.in/send/", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error("[PassportBackupReminder] Aligo HTTP 오류", {
        status: response.status,
        text,
        reminderId,
      });
      return { success: false, error: `HTTP ${response.status}: ${text}` };
    }

    const json = (await response.json()) as {
      result_code?: string | number;
      message?: string;
      msg_id?: string;
    };

    if (String(json.result_code) !== "1") {
      const errMsg = json.message ?? `result_code: ${json.result_code}`;
      logger.warn("[PassportBackupReminder] Aligo 발송 실패", {
        reminderId,
        resultCode: json.result_code,
        message: errMsg,
      });
      return { success: false, error: errMsg };
    }

    logger.log("[PassportBackupReminder] SMS 발송 성공", {
      reminderId,
      dayOffset,
      msgId: json.msg_id,
    });

    return { success: true, msgId: json.msg_id };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error("[PassportBackupReminder] SMS 발송 예외", {
      reminderId,
      error: errMsg,
    });
    return { success: false, error: errMsg };
  }
}

/**
 * 발송 기록 업데이트
 */
export async function updateReminderLogAfterSend(params: {
  reminderId: string;
  dayOffset: 1 | 3 | 7 | 30;
  success: boolean;
}) {
  const { reminderId, dayOffset, success } = params;

  const sentField = `day${dayOffset}Sent` as const;
  const sentAtField = `day${dayOffset}SentAt` as const;

  try {
    await prisma.passportBackupReminderLog.update({
      where: { id: reminderId },
      data: {
        [sentField]: success,
        [sentAtField]: success ? new Date() : null,
        ...(success && { smsCount: { increment: 1 } }),
      },
    });
  } catch (err) {
    logger.error("[PassportBackupReminder] 기록 업데이트 실패", {
      reminderId,
      dayOffset,
      err,
    });
  }
}

/**
 * 타이밍 안전 인증 (Cron 시크릿 검증)
 */
export function validateCronSecret(authHeader: string): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const expected = `Bearer ${secret}`;
  try {
    return (
      authHeader.length === expected.length &&
      timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
    );
  } catch {
    return false;
  }
}
