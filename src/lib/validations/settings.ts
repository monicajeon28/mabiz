import { z } from "zod";

/**
 * 한국 휴대폰 발신번호 스키마 (관대한 입력 → 정규화 후 검증)
 * 사용자가 공백/하이픈을 섞어 넣어도 통과하도록 trim + 공백/하이픈 제거 후 검증한다.
 * (예: " 010-1234-5678 ", "010 1234 5678", "01012345678" 모두 허용)
 */
const koreanSenderPhone = z.preprocess(
  (val) => (typeof val === "string" ? val.trim().replace(/[\s-]/g, "") : val),
  z
    .string()
    .regex(
      /^01[0-9]\d{3,4}\d{4}$/,
      "발신번호는 유효한 한국 휴대폰 형식이어야 합니다 (예: 010-1234-5678)"
    )
);

/**
 * 프로필 수정 검증 스키마
 */
export const updateUserProfileSchema = z.object({
  name: z.string().min(1, "이름은 필수입니다").max(255).optional(),
  phone: z.string().optional(),
  avatar: z.string().url("유효한 이미지 URL이 필요합니다").optional(),
  timezone: z
    .string()
    .refine(
      (val) => Intl.supportedValuesOf("timeZone").includes(val),
      "유효한 타임존이 필요합니다"
    )
    .optional(),
  language: z.enum(["ko", "en"]).optional(),
});

export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;

/**
 * 조직 정보 수정 검증 스키마
 */
export const updateOrganizationSettingsSchema = z.object({
  name: z.string().min(1, "조직명은 필수입니다").max(255).optional(),
  companyName: z.string().max(255).optional(),
  businessRegistration: z
    .string()
    .regex(/^\d{3}-\d{2}-\d{5}$/, "사업자등록번호 형식이 올바르지 않습니다")
    .optional(),
  industry: z.string().max(100).optional(),
  size: z.enum(["SOLO", "SMALL", "MEDIUM", "LARGE", "ENTERPRISE"]).optional(),
  website: z.string().url("유효한 URL이 필요합니다").optional(),
  logo: z.string().url("유효한 이미지 URL이 필요합니다").optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, "유효한 16진수 컬러 코드가 필요합니다")
    .optional(),
  address: z.string().max(500).optional(),
  phone: z.string().optional(),
  contactEmail: z.string().email("유효한 이메일이 필요합니다").optional(),
  timezone: z
    .string()
    .refine(
      (val) => Intl.supportedValuesOf("timeZone").includes(val),
      "유효한 타임존이 필요합니다"
    )
    .optional(),
  language: z.enum(["ko", "en"]).optional(),
});

export type UpdateOrganizationSettingsInput = z.infer<
  typeof updateOrganizationSettingsSchema
>;

/**
 * 개별 알림 설정 검증 스키마
 */
export const notificationPreferenceSchema = z.object({
  category: z.enum([
    "CONTACT_ACTIVITY",
    "SALES_UPDATE",
    "SMS_CAMPAIGN",
    "SYSTEM_ALERT",
    "TEAM_ACTIVITY",
    "REPORT_SCHEDULED",
    "BILLING",
    "SECURITY",
  ]),
  channels: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    inApp: z.boolean(),
    push: z.boolean(),
  }),
  enabled: z.boolean(),
  frequency: z
    .enum(["IMMEDIATE", "HOURLY", "DAILY", "WEEKLY"])
    .optional(),
  quiet: z
    .object({
      startTime: z
        .string()
        .regex(/^\d{2}:\d{2}$/, "HH:mm 형식이 필요합니다"),
      endTime: z
        .string()
        .regex(/^\d{2}:\d{2}$/, "HH:mm 형식이 필요합니다"),
    })
    .optional(),
});

/**
 * 알림 설정 수정 검증 스키마
 */
export const updateNotificationSettingsSchema = z.object({
  preferences: z.array(notificationPreferenceSchema).optional(),
  allowMarketing: z.boolean().optional(),
  allowNotifications: z.boolean().optional(),
  summary: z.enum(["NONE", "DAILY", "WEEKLY"]).optional(),
  unsubscribedCategories: z
    .array(
      z.enum([
        "CONTACT_ACTIVITY",
        "SALES_UPDATE",
        "SMS_CAMPAIGN",
        "SYSTEM_ALERT",
        "TEAM_ACTIVITY",
        "REPORT_SCHEDULED",
        "BILLING",
        "SECURITY",
      ])
    )
    .optional(),
});

export type UpdateNotificationSettingsInput = z.infer<
  typeof updateNotificationSettingsSchema
>;

/**
 * 알림 설정 조회 쿼리 검증
 */
export const getNotificationSettingsQuerySchema = z.object({
  category: z.string().optional(),
  channelType: z.enum(["EMAIL", "SMS", "IN_APP", "PUSH"]).optional(),
});

export type GetNotificationSettingsQuery = z.infer<
  typeof getNotificationSettingsQuerySchema
>;

/**
 * SMS 설정 저장 검증 (조직 레벨)
 */
export const orgSmsSettingsSchema = z.object({
  aligoKey: z
    .string()
    .min(10, "API Key는 최소 10자 이상이어야 합니다")
    .max(255, "API Key는 255자 이하여야 합니다"),
  aligoUserId: z
    .string()
    .min(2, "User ID는 최소 2자 이상이어야 합니다")
    .max(100, "User ID는 100자 이하여야 합니다"),
  senderPhone: koreanSenderPhone,
});

export type OrgSmsSettingsInput = z.infer<typeof orgSmsSettingsSchema>;

/**
 * SMS 테스트 발송 검증
 */
export const smsSendTestSchema = z.object({
  testPhone: z.preprocess(
    (val) => (typeof val === "string" ? val.trim().replace(/[\s-]/g, "") : val),
    z
      .string()
      .regex(
        /^01[0-9]\d{3,4}\d{4}$/,
        "수신 전화번호는 유효한 한국 휴대폰 형식이어야 합니다 (예: 010-1234-5678)"
      )
  ),
});

export type SmsSendTestInput = z.infer<typeof smsSendTestSchema>;

/**
 * SMS 재진입 메시지 검증
 */
export const smsReEngageMessagesSchema = z.object({
  reEngageMsg1: z
    .string()
    .max(1000, "메시지 1은 1000자 이하여야 합니다")
    .nullable()
    .optional(),
  reEngageMsg2: z
    .string()
    .max(1000, "메시지 2는 1000자 이하여야 합니다")
    .nullable()
    .optional(),
});

export type SmsReEngageMessagesInput = z.infer<
  typeof smsReEngageMessagesSchema
>;

/**
 * 개인 SMS 설정 저장 검증 (사용자 레벨)
 */
export const userSmsSettingsSchema = z.object({
  aligoKey: z
    .string()
    .min(10, "API Key는 최소 10자 이상이어야 합니다")
    .max(255, "API Key는 255자 이하여야 합니다")
    .optional(),
  aligoUserId: z
    .string()
    .min(2, "User ID는 최소 2자 이상이어야 합니다")
    .max(100, "User ID는 100자 이하여야 합니다"),
  senderPhone: koreanSenderPhone,
});

export type UserSmsSettingsInput = z.infer<typeof userSmsSettingsSchema>;
