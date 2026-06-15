/**
 * 계약서 서명 재전송 (Day 7+ Follow-up) 헬퍼 함수
 *
 * Grant Cardone L6 (타이밍 손실회피) + L10 (긴박감) 심리학 적용
 * - Day 7: 첫 번째 재전송 (7일 경과)
 * - Day 14: 두 번째 재전송 (최대 3회)
 * - Day 21: 세 번째 재전송 (종료)
 */

import prisma from "@/lib/prisma";
import { sendByChannel, resolveUserSmsConfig, AligoConfig } from "@/lib/aligo";
import { sendSystemEmail } from "@/lib/system-email";
import { logger } from "@/lib/logger";

/**
 * 7일 이상 경과한 SENT 상태 계약서 조회
 * @param organizationId 조직 ID
 * @param maxReminderCount 최대 재전송 횟수 (기본 3회)
 * @returns 경과한 계약서 목록
 */
export async function getOverdueContracts(
  organizationId: string,
  maxReminderCount: number = 3
) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  return prisma.contractInstance.findMany({
    where: {
      organizationId,
      status: "SENT",
      createdAt: { lte: sevenDaysAgo },
      reminderCount: { lt: maxReminderCount },
    },
    include: {
      template: { select: { name: true } },
      organization: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * SMS 재발송 (Aligo sendByChannel 사용)
 * @param contractInstance 계약 인스턴스
 * @param smsConfig SMS 설정
 * @returns 발송 성공 여부
 */
export async function resendContractSms(
  contractInstance: any,
  smsConfig: AligoConfig | null
): Promise<boolean> {
  if (!smsConfig) {
    logger.warn("[resendContractSms] SMS 설정 없음", {
      instanceId: contractInstance.id,
    });
    return false;
  }

  const boundData =
    contractInstance.boundData && typeof contractInstance.boundData === "object"
      ? (contractInstance.boundData as Record<string, unknown>)
      : {};

  const signerPhone =
    typeof boundData.signerPhone === "string"
      ? boundData.signerPhone
      : typeof boundData.phone === "string"
      ? boundData.phone
      : null;

  if (!signerPhone) {
    logger.warn("[resendContractSms] 연락처 없음", {
      instanceId: contractInstance.id,
    });
    return false;
  }

  const signerName =
    typeof boundData.signerName === "string" ? boundData.signerName : "고객";

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "https://mabizcruisedot.com";
  const signUrl = `${baseUrl}/contract/sign/instance/${contractInstance.id}`;

  // Grant Cardone L6 (손실회피) + L10 (긴박감)
  const smsMessage = `⏰ ${signerName}님, 아직 서명이 완료되지 않았습니다. 지금 바로 서명해주세요: ${signUrl}`;

  try {
    const result = await sendByChannel({
      channel: "SMS",
      smsConfig,
      receiver: signerPhone,
      msg: smsMessage,
      organizationId: contractInstance.organizationId,
      contactId: contractInstance.contactId || undefined,
    });

    const resultCode = Number(result.result_code);
    if (resultCode === 1) {
      logger.log("[resendContractSms] SMS 발송 성공", {
        instanceId: contractInstance.id,
      });
      return true;
    } else {
      logger.warn("[resendContractSms] SMS 발송 실패", {
        instanceId: contractInstance.id,
        resultCode,
      });
      return false;
    }
  } catch (err) {
    logger.error("[resendContractSms] SMS 발송 예외", {
      instanceId: contractInstance.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Email 재발송 (System Email 사용)
 * @param contractInstance 계약 인스턴스
 * @returns 발송 성공 여부
 */
export async function resendContractEmail(
  contractInstance: any
): Promise<boolean> {
  const boundData =
    contractInstance.boundData && typeof contractInstance.boundData === "object"
      ? (contractInstance.boundData as Record<string, unknown>)
      : {};

  const signerEmail =
    typeof boundData.email === "string"
      ? boundData.email
      : typeof boundData.buyerEmail === "string"
      ? boundData.buyerEmail
      : null;

  if (!signerEmail) {
    logger.warn("[resendContractEmail] 이메일 없음", {
      instanceId: contractInstance.id,
    });
    return false;
  }

  // 이메일 형식 검증
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail)) {
    logger.warn("[resendContractEmail] 유효하지 않은 이메일", {
      instanceId: contractInstance.id,
      signerEmail,
    });
    return false;
  }

  const signerName =
    typeof boundData.buyerName === "string"
      ? boundData.buyerName
      : typeof boundData.signerName === "string"
      ? boundData.signerName
      : "고객";

  const templateName = contractInstance.template?.name ?? "계약서";

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "https://mabizcruisedot.com";
  const signUrl = `${baseUrl}/contract/sign/instance/${contractInstance.id}`;

  function escHtml(s: string): string {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const emailHtml = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Apple SD Gothic Neo', '맑은 고딕', Arial, sans-serif; background: #f5f7fa; margin: 0; padding: 24px; }
    .card { background: #ffffff; border-radius: 12px; max-width: 560px; margin: 0 auto; padding: 40px 36px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    h1 { color: #d32f2f; font-size: 22px; margin: 0 0 8px; }
    p { color: #4a5568; font-size: 15px; line-height: 1.7; margin: 0 0 16px; }
    .urgency { background: #ffebee; border-left: 4px solid #d32f2f; padding: 16px; margin: 16px 0; border-radius: 4px; color: #c62828; font-weight: 600; }
    .btn { display: inline-block; background: #d32f2f; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; margin: 8px 0 24px; }
    .note { font-size: 13px; color: #718096; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px; }
    .url { font-size: 12px; color: #a0aec0; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🕐 ${escHtml(templateName)} 서명 재요청</h1>
    <p>안녕하세요, <strong>${escHtml(signerName)}</strong>님!</p>
    <div class="urgency">
      아직 계약서가 서명되지 않았습니다. 지금 바로 서명을 완료해주세요.
    </div>
    <p>더 이상 지연할 수 없습니다. 아래 버튼을 클릭하여 5~10분 내에 간편하게 전자서명을 완료하실 수 있습니다.</p>
    <a href="${signUrl}" class="btn">⚡ 지금 바로 서명하기</a>
    <p>버튼이 작동하지 않는 경우 아래 주소를 직접 복사하여 브라우저에 붙여넣기 해주세요.</p>
    <p class="url">${signUrl}</p>
    <div class="note">
      본 이메일은 마비즈 CRM에서 자동 발송된 메일입니다. 문의사항은 담당자에게 연락해 주세요.
    </div>
  </div>
</body>
</html>`;

  try {
    const sent = await sendSystemEmail({
      to: signerEmail,
      subject: `[마비즈] 🚨 마지막 확인: ${signerName}님, ${templateName} 서명 재요청`,
      html: emailHtml,
    });

    if (sent) {
      logger.log("[resendContractEmail] 이메일 발송 성공", {
        instanceId: contractInstance.id,
        signerEmail,
      });
      return true;
    } else {
      logger.warn("[resendContractEmail] 이메일 발송 실패", {
        instanceId: contractInstance.id,
        signerEmail,
      });
      return false;
    }
  } catch (err) {
    logger.error("[resendContractEmail] 이메일 발송 예외", {
      instanceId: contractInstance.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * 계약서 재전송 상태 업데이트
 * @param contractInstanceId 계약 인스턴스 ID
 * @param reminderCount 재전송 횟수 (증가시키면 기본값만 사용)
 */
export async function updateReminderStatus(
  contractInstanceId: string,
  reminderCount?: number
): Promise<void> {
  try {
    await prisma.contractInstance.update({
      where: { id: contractInstanceId },
      data: {
        lastReminderSentAt: new Date(),
        ...(reminderCount !== undefined && { reminderCount }),
      },
    });

    logger.log("[updateReminderStatus] 상태 업데이트 완료", {
      instanceId: contractInstanceId,
      reminderCount,
    });
  } catch (err) {
    logger.error("[updateReminderStatus] 상태 업데이트 실패", {
      instanceId: contractInstanceId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
