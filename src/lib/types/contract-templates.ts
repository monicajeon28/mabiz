// 계약서 템플릿 관련 타입 정의

export type CategoryType = "CRUISE" | "RENTAL" | "HOTEL" | "PACKAGE" | "OTHER";
export type VisibilityType = "ORGANIZATION" | "MANAGER_ONLY" | "PERSONAL";
export type StatusType = "ACTIVE" | "ARCHIVED" | "DRAFT";
export type InstanceStatusType = "DRAFT" | "SENT" | "SIGNED" | "COMPLETED";

export interface ContractTemplateInput {
  name: string;
  description?: string;
  category: CategoryType;
  htmlContent: string;
  fieldMapping: Record<string, string>;
  psychologyLenses: string[];
  smsDay0TemplateId?: string;
  smsDay1TemplateId?: string;
  smsDay2TemplateId?: string;
  smsDay3TemplateId?: string;
  visibility?: VisibilityType;
  status?: StatusType;
}

export interface ContractTemplateResponse {
  id: string;
  name: string;
  description: string | null;
  category: string;
  htmlContent: string | null;
  fieldMapping: Record<string, any>;
  psychologyLenses: string[];
  smsDay0TemplateId: string | null;
  smsDay1TemplateId: string | null;
  smsDay2TemplateId: string | null;
  smsDay3TemplateId: string | null;
  visibility: string;
  status: string;
  version: number;
  isSystemTemplate: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractInstanceInput {
  templateId: string;
  contactId?: string;
  boundData: Record<string, string>;
  autoSendSms?: boolean;
}

export interface ContractInstanceResponse {
  id: string;
  templateId: string;
  templateName: string;
  contactId: string | null;
  contactName: string | null;
  status: string;
  expiresAt: string | null;
  timeRemaining: string;
  smsStatus: {
    day0Sent: boolean;
    day0SentAt: string | null;
    day1Sent: boolean;
    day1SentAt: string | null;
    day2Sent: boolean;
    day2SentAt: string | null;
    day3Sent: boolean;
    day3SentAt: string | null;
  };
  createdAt: string;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
  error?: string;
}
