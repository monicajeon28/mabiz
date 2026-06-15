import { z } from "zod";

// Phase 6: 입력필드 Zod 스키마
const contractInputFieldSchema = z.object({
  id: z.string().min(1, "필드 ID는 필수입니다"),
  type: z.enum(["text", "checkbox", "date", "dropdown"]),
  label: z.string().min(1, "필드 라벨은 필수입니다").max(255),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  options: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
    })
  ).optional(),
  contactFieldName: z.string().nullable().optional(),
  maxLength: z.number().int().positive().optional(),
  minLength: z.number().int().nonnegative().optional(),
  pattern: z.string().optional(),
  patternError: z.string().optional(),
  order: z.number().int().nonnegative(),
  helpText: z.string().optional(),
  visibilityCondition: z.object({
    fieldId: z.string(),
    value: z.union([z.string(), z.boolean()]),
  }).optional(),
});

export const createContractTemplateSchema = z.object({
  name: z.string().min(1, "템플릿명은 필수입니다").max(255),
  description: z.string().optional(),
  category: z.enum(["CRUISE", "RENTAL", "HOTEL", "PACKAGE", "OTHER"]),
  htmlContent: z.string().min(1, "HTML 콘텐츠는 필수입니다"),
  fieldMapping: z.record(z.string(), z.any()).optional(),
  // Phase 6: inputFields 스키마 추가
  inputFields: z.array(contractInputFieldSchema).optional(),
  psychologyLenses: z.array(z.enum([
    "L0_REACTIVATION",
    "L1_PRICE_OBJECTION",
    "L2_COMPLEXITY_ANXIETY",
    "L3_DIFFERENTIATION",
    "L4_FEATURES",
    "L5_SELF_PROJECTION",
    "L6_TIMING_LOSS_AVERSION",
    "L7_COMPANION_PERSUASION",
    "L8_REPURCHASE_HABITUAL",
    "L9_HEALTH_MEDICAL_TRUST",
    "L10_IMMEDIATE_PURCHASE",
  ])).default([]),
  smsDay0TemplateId: z.string().optional(),
  smsDay1TemplateId: z.string().optional(),
  smsDay2TemplateId: z.string().optional(),
  smsDay3TemplateId: z.string().optional(),
  visibility: z
    .enum(["ORGANIZATION", "MANAGER_ONLY", "PERSONAL"])
    .default("ORGANIZATION"),
  status: z.enum(["ACTIVE", "DRAFT"]).default("ACTIVE"),
});

export const updateContractTemplateSchema = createContractTemplateSchema.partial();

export const createContractInstanceSchema = z.object({
  templateId: z.string().min(1, "템플릿 ID는 필수입니다"),
  contactId: z.string().optional(),
  boundData: z.record(z.string(), z.any()).optional(),
  // Phase 6: inputValues 스키마 추가
  inputValues: z.record(z.string(), z.any()).optional(),
  autoSendSms: z.boolean().default(true),
});

export const listContractTemplatesQuerySchema = z.object({
  category: z.string().optional(),
  status: z.string().optional(),
  lens: z.string().optional(),
  sort: z
    .enum(["recent", "mostUsed", "alphabetical"])
    .default("recent"),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const listContractInstancesQuerySchema = z.object({
  status: z.string().optional(),
  templateId: z.string().optional(),
  contactId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateContractTemplateInput = z.infer<
  typeof createContractTemplateSchema
>;
export type UpdateContractTemplateInput = z.infer<
  typeof updateContractTemplateSchema
>;
export type CreateContractInstanceInput = z.infer<
  typeof createContractInstanceSchema
>;
export type ListContractTemplatesQuery = z.infer<
  typeof listContractTemplatesQuerySchema
>;
export type ListContractInstancesQuery = z.infer<
  typeof listContractInstancesQuerySchema
>;
