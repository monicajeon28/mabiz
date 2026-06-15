/**
 * Email 발송 헬퍼 함수
 * resolveUserEmailConfig()로 개인→그룹→조직→env SMTP 자동 선택
 * nodemailer로 실제 SMTP 발송 수행
 */

import nodemailer from "nodemailer";
import { resolveUserEmailConfig } from "@/lib/email-resolver";
import { logger } from "@/lib/logger";

interface SendEmailParams {
  organizationId: string;
  contactId: string;
  email: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables?: Record<string, string>;
  /** 개인 SMTP 우선 조회용 — ScheduledEmailMessage.senderUserId */
  senderUserId?: string;
  /** 그룹 SMTP 폴백용 — ScheduledEmailMessage.groupId */
  groupId?: string;
}

/** SMTP 영문 에러 → 한글 메시지 매핑 */
const SMTP_ERROR_MAP: Array<[string, string]> = [
  ["ECONNREFUSED", "이메일 서버에 연결할 수 없습니다. 호스트/포트를 확인해 주세요."],
  ["ETIMEDOUT", "이메일 서버 연결 시간이 초과됐습니다."],
  ["ENOTFOUND", "이메일 서버 주소를 찾을 수 없습니다."],
  ["Invalid login", "이메일 주소 또는 비밀번호가 틀렸습니다."],
  ["Authentication failed", "이메일 인증에 실패했습니다. 앱 비밀번호를 확인해 주세요."],
  ["Message failed", "이메일 발송에 실패했습니다."],
  ["EMESSAGE", "이메일 내용이 올바르지 않습니다."],
  ["EENVELOPE", "수신자 이메일 주소가 올바르지 않습니다."],
];

function toKoreanError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  for (const [key, kor] of SMTP_ERROR_MAP) {
    if (msg.includes(key)) return kor;
  }
  return `이메일 발송 오류가 발생했습니다.`;
}

/** 동적 변수 치환 {{name}} → 실제값 */
function interpolateVariables(
  content: string,
  variables?: Record<string, string>
): string {
  if (!variables) return content;
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value ?? ""));
  }
  return result;
}

/**
 * Email 발송 (자동 SMTP 선택)
 * resolveUserEmailConfig: 개인 → 그룹 → 조직 → env 순서 폴백
 */
export async function sendEmailViaProvider(
  params: SendEmailParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const {
    organizationId,
    contactId,
    email,
    subject,
    htmlContent,
    textContent,
    variables,
    senderUserId,
    groupId,
  } = params;

  try {
    // 1. SMTP 설정 조회 (개인 → 그룹 → 조직 → env)
    const emailCfg = await resolveUserEmailConfig(organizationId, {
      userId: senderUserId,
      groupId,
    });

    if (!emailCfg) {
      throw new Error(
        "이메일 설정이 없습니다. 설정 > 이메일 메뉴에서 SMTP를 연결해 주세요."
      );
    }

    // 2. 동적 변수 치환
    const interpolatedSubject = interpolateVariables(subject, variables);
    const interpolatedHtml = interpolateVariables(htmlContent, variables);
    const interpolatedText = textContent
      ? interpolateVariables(textContent, variables)
      : undefined;

    // 3. nodemailer transporter 생성 + 실제 SMTP 발송
    const transporter = nodemailer.createTransport({
      host: emailCfg.smtpHost,
      port: emailCfg.smtpPort,
      secure: emailCfg.smtpSecure,
      auth: {
        user: emailCfg.smtpUsername,
        pass: emailCfg.smtpPassword,
      },
    });

    const info = await transporter.sendMail({
      from: `"${emailCfg.senderName}" <${emailCfg.senderEmail}>`,
      to: email,
      subject: interpolatedSubject,
      html: interpolatedHtml,
      ...(interpolatedText ? { text: interpolatedText } : {}),
    });

    logger.info("[Email] 발송 성공", {
      organizationId,
      contactId,
      email,
      messageId: info.messageId,
      source: emailCfg.source,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    const korError = toKoreanError(error);
    logger.error("[Email] 발송 오류", {
      organizationId,
      contactId,
      email,
      error: korError,
    });
    return { success: false, error: korError };
  }
}

/**
 * Batch Email 발송 (여러 이메일 동시 처리)
 * Gmail은 하루 500건 제한 — 배치 처리는 sendBatch()의 순차 루프가 담당하므로
 * 여기서는 주어진 배열을 모두 처리합니다.
 */
export async function sendEmailsBatch(
  params: SendEmailParams[]
): Promise<
  Array<{ contactId: string; success: boolean; messageId?: string; error?: string }>
> {
  const results = await Promise.allSettled(
    params.map(async (param) => {
      const result = await sendEmailViaProvider(param);
      return { contactId: param.contactId, ...result };
    })
  );

  return results.map((result) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    return {
      contactId: "",
      success: false,
      error:
        result.reason instanceof Error
          ? toKoreanError(result.reason)
          : "알 수 없는 오류",
    };
  });
}
