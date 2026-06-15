/**
 * Email 발송 헬퍼 함수 (병렬 처리용)
 * 조직별 Email 설정(SMTP/GMAIL/SENDGRID)에 따라 자동 라우팅
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface SendEmailParams {
  organizationId: string;
  contactId: string;
  email: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables?: Record<string, any>;
}

/**
 * Email 동적 변수 치환
 */
function interpolateVariables(
  content: string,
  variables?: Record<string, any>
): string {
  if (!variables) return content;

  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, "g");
    result = result.replace(regex, String(value));
  }
  return result;
}

/**
 * Email 발송 (자동 provider 라우팅)
 */
export async function sendEmailViaProvider(
  params: SendEmailParams
): Promise<{
  success: boolean;
  messageId?: string;
  trackingId?: string;
  error?: string;
}> {
  const { organizationId, email, subject, htmlContent, textContent, variables } =
    params;

  try {
    // 1. 조직의 Email 설정 조회
    const emailConfig = await prisma.orgEmailConfig.findUnique({
      where: { organizationId },
    });

    if (!emailConfig || !emailConfig.isActive) {
      throw new Error("Email configuration not found or inactive");
    }

    // 2. 동적 변수 치환
    const interpolatedSubject = interpolateVariables(subject, variables);
    const interpolatedHtml = interpolateVariables(htmlContent, variables);
    const interpolatedText = textContent
      ? interpolateVariables(textContent, variables)
      : undefined;

    // 3. Provider별 발송
    // TODO: 실제 SMTP/Gmail/Sendgrid 구현
    // 현재: 로그만 기록
    logger.info("[Email] Email 발송 시뮬레이션", {
      organizationId,
      email,
      subject: interpolatedSubject,
      provider: emailConfig.smtpHost,
    });

    // 4. 성공 응답 (mock)
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const trackingId = `trk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      messageId,
      trackingId,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("[Email] 발송 오류:", {
      organizationId,
      email,
      error: errorMsg,
    });

    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Batch Email 발송 (여러 이메일 동시 발송)
 */
export async function sendEmailsBatch(
  params: SendEmailParams[]
): Promise<Array<{
  contactId: string;
  success: boolean;
  messageId?: string;
  error?: string;
}>> {
  const results = await Promise.allSettled(
    params.map(async (param) => {
      const result = await sendEmailViaProvider(param);
      return {
        contactId: param.contactId,
        ...result,
      };
    })
  );

  return results.map((result) => {
    if (result.status === "fulfilled") {
      return result.value;
    } else {
      return {
        contactId: "",
        success: false,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      };
    }
  });
}
