/**
 * 이메일 퍼널 라이브러리
 * - Group별 SMTP 설정 관리 (Gmail/SMTP/SendGrid/Mailgun)
 * - Day 0-3 PASONA 시퀀스 렌더링
 * - 동적변수 치환
 * - 보안: KMS 암호화, 입력 검증, 감사 로그
 *
 * 2026-06-16 Elon Musk: Email Funnel
 */

import { logger } from "@/lib/logger";
import { encrypt, decrypt } from "@/lib/crypto";
import * as nodemailer from "nodemailer";

// ============================================================================
// 타입 정의
// ============================================================================

export type EmailProvider = "GMAIL" | "SMTP" | "SENDGRID" | "MAILGUN";

export interface GroupEmailConfigData {
  organizationId: string;
  groupId: string;
  emailProvider: EmailProvider;
  senderName: string;
  senderEmail: string;
  replyToEmail?: string;

  // Gmail OAuth
  gmailAccessToken?: string;
  gmailRefreshToken?: string;
  gmailExpireAt?: Date;

  // SMTP
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPasswordEncrypted?: string;
  smtpSecure?: boolean; // true: TLS(587), false: SSL(465)

  // SendGrid
  sendGridApiKeyEncrypted?: string;

  // Mailgun
  mailgunApiKeyEncrypted?: string;
  mailgunDomain?: string;
}

export interface EmailFunnelMessageData {
  day: number; // 0, 1, 2, 3
  order: number;
  pasonaStage: "PROBLEM" | "SOLUTION" | "OFFER" | "ACTION";
  subject: string;
  bodyHtml: string;
  previewText?: string;
  targetLensTypes?: string[]; // 공백 = 모든 렌즈
}

export interface DynamicVariables {
  name?: string;
  email?: string;
  phone?: string;
  product?: string;
  price?: string;
  lensType?: string;
  daysSinceJoined?: number;
  joinedDate?: string;
  groupName?: string;
  urgencyTone?: "high" | "medium" | "low";
}

export interface SmtpConnectionParams {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

// ============================================================================
// 암호화/복호화 (KMS 기반)
// ============================================================================

/**
 * SMTP 비밀번호 암호화 (KMS)
 */
export function encryptSmtpPassword(password: string, groupId: string): string {
  try {
    return encrypt(password, `SMTP_${groupId}`);
  } catch (err) {
    logger.error("[EmailFunnel] 암호화 실패", { err, groupId });
    throw err;
  }
}

/**
 * SMTP 비밀번호 복호화 (KMS)
 */
export function decryptSmtpPassword(encrypted: string, groupId: string): string {
  try {
    return decrypt(encrypted, `SMTP_${groupId}`);
  } catch (err) {
    logger.error("[EmailFunnel] 복호화 실패", { err, groupId });
    throw err;
  }
}

/**
 * SendGrid API 키 암호화
 */
export function encryptSendGridApiKey(apiKey: string, groupId: string): string {
  return encrypt(apiKey, `SENDGRID_${groupId}`);
}

/**
 * SendGrid API 키 복호화
 */
export function decryptSendGridApiKey(encrypted: string, groupId: string): string {
  return decrypt(encrypted, `SENDGRID_${groupId}`);
}

/**
 * Mailgun API 키 암호화
 */
export function encryptMailgunApiKey(apiKey: string, groupId: string): string {
  return encrypt(apiKey, `MAILGUN_${groupId}`);
}

/**
 * Mailgun API 키 복호화
 */
export function decryptMailgunApiKey(encrypted: string, groupId: string): string {
  return decrypt(encrypted, `MAILGUN_${groupId}`);
}

// ============================================================================
// 입력 검증
// ============================================================================

/**
 * SMTP 설정 검증
 */
export function validateSmtpConfig(config: {
  host: string;
  port: number;
  username: string;
  password: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 호스트 검증 (도메인 형식)
  if (!config.host.match(/^[a-z0-9.-]+\.[a-z]{2,}$/i)) {
    errors.push("Invalid SMTP host (must be domain format)");
  }

  // 포트 검증 (1-65535)
  if (config.port < 1 || config.port > 65535) {
    errors.push("Invalid SMTP port (must be 1-65535)");
  }

  // 사용자명 검증
  if (!config.username || config.username.length < 1) {
    errors.push("SMTP username is required");
  }

  // 비밀번호 검증 (최소 4자)
  if (!config.password || config.password.length < 4) {
    errors.push("SMTP password must be at least 4 characters");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 이메일 주소 검증 (RFC 5322)
 */
export function validateEmail(email: string): boolean {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email);
}

/**
 * 발신자명 검증 (길이 1-100, 특수문자 제한)
 */
export function validateSenderName(name: string): boolean {
  return name.length >= 1 && name.length <= 100;
}

// ============================================================================
// SMTP 연결 테스트
// ============================================================================

/**
 * SMTP 연결 테스트 (nodemailer)
 */
export async function testSmtpConnection(
  config: SmtpConnectionParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = nodemailer.createTransport(config);
    await transporter.verify();
    logger.log("[EmailFunnel] SMTP 연결 성공", { host: config.host });
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error("[EmailFunnel] SMTP 연결 실패", { error: errorMsg });
    return { success: false, error: errorMsg };
  }
}

// ============================================================================
// 동적변수 렌더링 (Handlebars 스타일)
// ============================================================================

/**
 * 이메일 템플릿에서 {{variable}} 치환
 */
export function renderEmailTemplate(
  template: string,
  variables: DynamicVariables
): string {
  let result = template;

  // {{variable}} 패턴 찾아서 치환
  const pattern = /\{\{(\w+)\}\}/g;
  result = result.replace(pattern, (match, key) => {
    const value = variables[key as keyof DynamicVariables];
    return value !== undefined && value !== null ? String(value) : match;
  });

  return result;
}

/**
 * 미리보기용 더미 변수 생성
 */
export function generatePreviewVariables(
  contactName: string = "고객",
  productName: string = "크루즈",
  lensType: string = "L0"
): DynamicVariables {
  const now = new Date();
  const joinDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7일 전

  return {
    name: contactName,
    email: "customer@example.com",
    phone: "010-1234-5678",
    product: productName,
    price: "$2,500",
    lensType,
    daysSinceJoined: 7,
    joinedDate: joinDate.toLocaleDateString("ko-KR"),
    groupName: "마비즈 크루즈",
    urgencyTone: "high",
  };
}

// ============================================================================
// 이메일 발송
// ============================================================================

export interface SendEmailFunnelParams {
  toEmail: string;
  subject: string;
  bodyHtml: string;
  senderName: string;
  senderEmail: string;
  replyToEmail?: string;
  provider: EmailProvider;
  config: GroupEmailConfigData;
}

/**
 * SMTP를 통한 이메일 발송 (SMTP, Gmail, SendGrid, Mailgun)
 *
 * 주의:
 * - Gmail: OAuth 토큰 필요 (복잡하므로 나중에 구현)
 * - SMTP: 직접 호스트/포트/사용자/비밀번호 사용
 * - SendGrid: API 키 사용
 * - Mailgun: API 키 + 도메인 사용
 */
export async function sendEmailFunnel(
  params: SendEmailFunnelParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { provider, config, toEmail, subject, bodyHtml, senderEmail, senderName, replyToEmail } = params;

  try {
    if (provider === "SMTP") {
      return sendEmailViaSMTP({
        host: config.smtpHost!,
        port: config.smtpPort!,
        username: config.smtpUsername!,
        passwordEncrypted: config.smtpPasswordEncrypted!,
        groupId: config.groupId,
        toEmail,
        subject,
        bodyHtml,
        senderEmail,
        senderName,
        replyToEmail,
      });
    } else if (provider === "SENDGRID") {
      // SendGrid는 HTTP API 사용 (나중 구현)
      logger.warn("[EmailFunnel] SendGrid 아직 미구현");
      return { success: false, error: "SendGrid not implemented yet" };
    } else if (provider === "MAILGUN") {
      // Mailgun은 HTTP API 사용 (나중 구현)
      logger.warn("[EmailFunnel] Mailgun 아직 미구현");
      return { success: false, error: "Mailgun not implemented yet" };
    } else if (provider === "GMAIL") {
      // Gmail OAuth (나중 구현)
      logger.warn("[EmailFunnel] Gmail OAuth 아직 미구현");
      return { success: false, error: "Gmail OAuth not implemented yet" };
    }

    return { success: false, error: "Unknown provider" };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error("[EmailFunnel] 이메일 발송 실패", { provider, toEmail, error: errorMsg });
    return { success: false, error: errorMsg };
  }
}

/**
 * SMTP를 통한 이메일 발송 (구현)
 */
async function sendEmailViaSMTP(params: {
  host: string;
  port: number;
  username: string;
  passwordEncrypted: string;
  groupId: string;
  toEmail: string;
  subject: string;
  bodyHtml: string;
  senderEmail: string;
  senderName: string;
  replyToEmail?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const password = decryptSmtpPassword(params.passwordEncrypted, params.groupId);
    const transporter = nodemailer.createTransport({
      host: params.host,
      port: params.port,
      secure: params.port === 465, // 465 = SSL, 587 = TLS
      auth: {
        user: params.username,
        pass: password,
      },
    });

    const info = await transporter.sendMail({
      from: `"${params.senderName}" <${params.senderEmail}>`,
      to: params.toEmail,
      replyTo: params.replyToEmail,
      subject: params.subject,
      html: params.bodyHtml,
    });

    logger.log("[EmailFunnel] SMTP 발송 성공", {
      to: params.toEmail,
      messageId: info.messageId,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error("[EmailFunnel] SMTP 발송 실패", { error: errorMsg });
    return { success: false, error: errorMsg };
  }
}

// ============================================================================
// PASONA 프레임워크 가이드
// ============================================================================

/**
 * PASONA 4단계 이메일 퍼널 템플릿 가이드
 * - Day 0: P(Problem) + A(Agitate) — 고객 상황 재현 + 자극
 * - Day 1: S(Solution) — 해결책 제시
 * - Day 2: O(Offer) — 구체적 오퍼 + 한정성 (L6 손실회피)
 * - Day 3: N(Narrow) + A(Action) — 최종 결정 촉구
 */

export const PASONA_FRAMEWORK = {
  PROBLEM: {
    day: 0,
    stage: "PROBLEM" as const,
    description: "고객의 문제/욕망을 자극하는 단계",
    tips: [
      "고객의 상황을 구체적으로 재현 (예: 가족과 함께 특별한 시간 갖고 싶으신가요?)",
      "감정적 트리거 사용 (가족, 꿈, 기억)",
      "짧고 임팩트 있는 헤드라인",
    ],
  },
  SOLUTION: {
    day: 1,
    stage: "SOLUTION" as const,
    description: "문제의 해결책을 제시하는 단계",
    tips: [
      "고객의 문제를 어떻게 해결할 수 있는지 설명",
      "혜택(benefit) 중심으로 설명 (기능이 아닌)",
      "렌즈별 심리학 활용 (L0=재활성화, L6=타이밍 손실회피)",
    ],
  },
  OFFER: {
    day: 2,
    stage: "OFFER" as const,
    description: "구체적 오퍼와 한정성 강조",
    tips: [
      "구체적 가격/조건 제시",
      "한정성 강조 (남은 좌석, 마감일, 한정 할인)",
      "L6 손실회피 렌즈: '지금 신청하지 않으면...'",
      "사회증명 (고객 리뷰, 만족도)",
    ],
  },
  ACTION: {
    day: 3,
    stage: "ACTION" as const,
    description: "최종 결정 촉구",
    tips: [
      "명확한 CTA (Call to Action) 버튼",
      "마지막 기회 강조",
      "이의 대응 (가격, 준비, 기항지 등)",
      "L10 즉시 구매 클로징: 3가지 선택지 제시",
    ],
  },
};

export const LENS_EMAIL_VARIATIONS = {
  L0: {
    name: "부재중 고객 재활성화",
    tone: "부드러운 복귀 초대",
    strategy: "옛 추억 + 신상품 소개",
  },
  L1: {
    name: "가격 이의 고객",
    tone: "가치 재정의",
    strategy: "할부제안, 비용 최소화",
  },
  L3: {
    name: "경쟁사 비교 고객",
    tone: "차별성 강조",
    strategy: "경쟁사 대비 우월성 구체 제시",
  },
  L6: {
    name: "타이밍/손실회피",
    tone: "긴박감 + 공포 마케팅",
    strategy: "마감일, 남은 좌석, 건강 윈도우",
  },
  L10: {
    name: "즉시 구매 클로징",
    tone: "결정 강화",
    strategy: "삼택일, 감정적 마무리",
  },
};
