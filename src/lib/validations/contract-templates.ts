import { z } from "zod";

export const createContractTemplateSchema = z.object({
  name: z.string().min(1, "템플릿명은 필수입니다").max(255),
  description: z.string().optional(),
  category: z.enum(["CRUISE", "RENTAL", "HOTEL", "PACKAGE", "OTHER"]),
  htmlContent: z.string().min(1, "HTML 콘텐츠는 필수입니다"),
  fieldMapping: z.record(z.string()),
  psychologyLenses: z.array(z.string()).default([]),
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
  boundData: z.record(z.string()),
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
