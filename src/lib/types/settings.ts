/**
 * Settings 관련 타입 정의
 * Menu #46 (설정) API 엔드포인트용
 */

/**
 * 사용자 프로필 설정
 */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  timezone: string;
  language: "ko" | "en";
  status: "ACTIVE" | "INACTIVE";
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 조직 정보 설정
 */
export interface OrganizationSettings {
  id: string;
  name: string;
  companyName?: string;
  businessRegistration?: string;
  industry?: string;
  size?: "SOLO" | "SMALL" | "MEDIUM" | "LARGE" | "ENTERPRISE";
  website?: string;
  logo?: string;
  primaryColor?: string;
  address?: string;
  phone?: string;
  contactEmail?: string;
  timezone: string;
  language: "ko" | "en";
  status: "ACTIVE" | "INACTIVE" | "TRIAL" | "SUSPENDED";
  trialEndsAt?: Date;
  planType: "FREE" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE";
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 알림 설정 카테고리
 */
export type NotificationCategory =
  | "CONTACT_ACTIVITY"
  | "SALES_UPDATE"
  | "SMS_CAMPAIGN"
  | "SYSTEM_ALERT"
  | "TEAM_ACTIVITY"
  | "REPORT_SCHEDULED"
  | "BILLING"
  | "SECURITY";

/**
 * 알림 채널
 */
export type NotificationChannel = "EMAIL" | "SMS" | "IN_APP" | "PUSH";

/**
 * 개별 알림 설정
 */
export interface NotificationPreference {
  category: NotificationCategory;
  channels: {
    email: boolean;
    sms: boolean;
    inApp: boolean;
    push: boolean;
  };
  enabled: boolean;
  frequency?: "IMMEDIATE" | "HOURLY" | "DAILY" | "WEEKLY";
  quiet?: {
    startTime: string; // HH:mm
    endTime: string;   // HH:mm
  };
}

/**
 * 전체 알림 설정
 */
export interface NotificationSettings {
  id: string;
  organizationId: string;
  userId: string;
  preferences: NotificationPreference[];
  allowMarketing: boolean;
  allowNotifications: boolean;
  summary?: "NONE" | "DAILY" | "WEEKLY";
  unsubscribedCategories: NotificationCategory[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * API 응답 구조
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * 페이지네이션 응답
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
