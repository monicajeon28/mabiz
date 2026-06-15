/**
 * Email Funnel Zod 스키마 (입력 검증)
 *
 * 2026-06-16 Elon Musk: Email Funnel
 */

import { z } from "zod";

// ============================================================================
// GroupEmailConfig 스키마
// ============================================================================

export const CreateGroupEmailConfigSchema = z
  .object({
    groupId: z.string().cuid("Invalid group ID"),
    emailProvider: z.enum(["GMAIL", "SMTP", "SENDGRID", "MAILGUN"]),
    senderName: z
      .string()
      .min(1, "Sender name is required")
      .max(100, "Sender name must be less than 100 characters"),
    senderEmail: z
      .string()
      .email("Invalid sender email")
      .max(255, "Sender email must be less than 255 characters"),
    replyToEmail: z.string().email("Invalid reply-to email").optional(),

    // SMTP 설정
    smtpHost: z
      .string()
      .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Invalid SMTP host (must be domain)")
      .optional(),
    smtpPort: z
      .number()
      .int("Port must be integer")
      .min(1)
      .max(65535)
      .optional(),
    smtpUsername: z.string().min(1).optional(),
    smtpPassword: z.string().min(4, "Password must be at least 4 characters").optional(),
    smtpSecure: z.boolean().optional(),

    // Gmail OAuth
    gmailAccessToken: z.string().optional(),
    gmailRefreshToken: z.string().optional(),

    // SendGrid API
    sendGridApiKey: z.string().min(10, "SendGrid API key is invalid").optional(),

    // Mailgun API
    mailgunApiKey: z.string().min(10, "Mailgun API key is invalid").optional(),
    mailgunDomain: z.string().optional(),
  })
  .refine(
    (data) => {
      // SMTP 선택 시 필수 필드 확인
      if (data.emailProvider === "SMTP") {
        return (
          data.smtpHost &&
          data.smtpPort &&
          data.smtpUsername &&
          data.smtpPassword
        );
      }
      if (data.emailProvider === "SENDGRID") {
        return data.sendGridApiKey;
      }
      if (data.emailProvider === "MAILGUN") {
        return data.mailgunApiKey && data.mailgunDomain;
      }
      if (data.emailProvider === "GMAIL") {
        return data.gmailAccessToken && data.gmailRefreshToken;
      }
      return true;
    },
    {
      message: "Missing required fields for selected email provider",
      path: ["emailProvider"],
    }
  );

export type CreateGroupEmailConfigInput = z.infer<typeof CreateGroupEmailConfigSchema>;

// ============================================================================
// GroupEmailFunnel 스키마
// ============================================================================

export const CreateGroupEmailFunnelSchema = z.object({
  groupId: z.string().cuid("Invalid group ID"),
  emailConfigId: z.string().cuid("Invalid email config ID"),
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title must be less than 255 characters"),
  description: z.string().max(1000, "Description must be less than 1000 characters").optional(),
  lensTypes: z
    .array(z.enum(["L0", "L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10"]))
    .default(["L0", "L1", "L3", "L6", "L10"]),
  isPasonaBased: z.boolean().default(true),
  isActive: z.boolean().default(false),
});

export type CreateGroupEmailFunnelInput = z.infer<typeof CreateGroupEmailFunnelSchema>;

// ============================================================================
// GroupEmailFunnelMessage 스키마
// ============================================================================

export const CreateGroupEmailFunnelMessageSchema = z.object({
  emailFunnelId: z.string().cuid("Invalid email funnel ID"),
  day: z.number().int().min(0).max(3, "Day must be 0-3"),
  order: z.number().int().min(0).default(0),
  pasonaStage: z.enum(["PROBLEM", "SOLUTION", "OFFER", "ACTION"]),
  subject: z
    .string()
    .min(1, "Subject is required")
    .max(200, "Subject must be less than 200 characters"),
  bodyHtml: z
    .string()
    .min(10, "Body HTML must be at least 10 characters")
    .max(10000, "Body HTML must be less than 10000 characters"),
  previewText: z.string().max(150, "Preview text must be less than 150 characters").optional(),
  targetLensTypes: z
    .array(z.enum(["L0", "L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10"]))
    .default([]),
});

export type CreateGroupEmailFunnelMessageInput = z.infer<
  typeof CreateGroupEmailFunnelMessageSchema
>;

// ============================================================================
// 이메일 미리보기 스키마
// ============================================================================

export const PreviewEmailFunnelSchema = z.object({
  emailFunnelId: z.string().cuid(),
  contactName: z
    .string()
    .min(1, "Contact name is required")
    .max(100)
    .optional()
    .default("고객"),
  productName: z
    .string()
    .min(1, "Product name is required")
    .max(100)
    .optional()
    .default("크루즈"),
  lensType: z
    .enum(["L0", "L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10"])
    .optional()
    .default("L0"),
  day: z.number().int().min(0).max(3).optional(),
});

export type PreviewEmailFunnelInput = z.infer<typeof PreviewEmailFunnelSchema>;

// ============================================================================
// 테스트 이메일 스키마
// ============================================================================

export const TestSmtpConnectionSchema = z.object({
  emailConfigId: z.string().cuid("Invalid email config ID"),
  testEmail: z.string().email("Invalid test email"),
});

export type TestSmtpConnectionInput = z.infer<typeof TestSmtpConnectionSchema>;

// ============================================================================
// 이메일 발송 스키마
// ============================================================================

export const SendEmailFunnelSchema = z.object({
  emailFunnelId: z.string().cuid("Invalid email funnel ID"),
  groupId: z.string().cuid("Invalid group ID"),
  contactIds: z.array(z.string().cuid()).min(1, "At least one contact is required"),
  lensFilter: z
    .enum(["L0", "L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10"])
    .optional(),
  day: z.number().int().min(0).max(3),
  dryRun: z.boolean().default(false), // true면 발송하지 않고 미리보기만
});

export type SendEmailFunnelInput = z.infer<typeof SendEmailFunnelSchema>;

// ============================================================================
// 감사 로그 조회 스키마
// ============================================================================

export const QueryEmailAuditLogsSchema = z.object({
  groupId: z.string().cuid().optional(),
  action: z
    .enum([
      "CREATE_CONFIG",
      "UPDATE_SMTP",
      "TEST_EMAIL",
      "VERIFY_SMTP",
      "DELETE_CONFIG",
      "SEND_EMAIL",
    ])
    .optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type QueryEmailAuditLogsInput = z.infer<typeof QueryEmailAuditLogsSchema>;
