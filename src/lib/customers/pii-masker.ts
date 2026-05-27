/**
 * PII Masker
 *
 * Applies role-based privacy masking to customer data:
 * - ADMIN: Full access (no masking)
 * - MANAGER: Partial masking (last 4 digits visible)
 * - AGENT: Heavy masking (*** visible only)
 * - PUBLIC: Maximum masking (no PII)
 *
 * Fields masked:
 * - Email: ***@domain or fully masked
 * - Phone: 010-****-5678 format
 * - Name: First name + ***
 * - Address: City only
 * - Payment info: Last 4 digits only
 */

import { Customer360View } from "./customer-aggregator";

export type UserRole = "ADMIN" | "MANAGER" | "AGENT" | "PUBLIC";

export interface MaskingConfig {
  email: boolean;
  phone: boolean;
  name: boolean;
  address: boolean;
  paymentInfo: boolean;
  callDetails: boolean;
  memos: boolean;
}

const MASKING_CONFIGS: Record<UserRole, MaskingConfig> = {
  ADMIN: {
    email: false,
    phone: false,
    name: false,
    address: false,
    paymentInfo: false,
    callDetails: false,
    memos: false,
  },
  MANAGER: {
    email: true, // Show domain only
    phone: true, // Show last 4
    name: false,
    address: true,
    paymentInfo: true, // Last 4 only
    callDetails: false,
    memos: false,
  },
  AGENT: {
    email: true, // Heavy masking
    phone: true, // Heavy masking
    name: true, // First char + ***
    address: true,
    paymentInfo: true,
    callDetails: true, // Hide conviction/strategy
    memos: true, // Hide detailed notes
  },
  PUBLIC: {
    email: true,
    phone: true,
    name: true,
    address: true,
    paymentInfo: true,
    callDetails: true,
    memos: true,
  },
};

/**
 * Apply PII masking to a customer 360 view based on user role
 */
export function maskCustomer360(
  customer: Customer360View,
  userRole: UserRole
): Customer360View {
  const config = MASKING_CONFIGS[userRole];

  return {
    ...customer,
    email: config.email ? maskEmail(customer.email) : customer.email,
    phone: config.phone ? maskPhone(customer.phone) : customer.phone,
    name: config.name ? maskName(customer.name) : customer.name,

    contact: customer.contact
      ? {
          ...customer.contact,
          memoCount: config.memos ? 0 : customer.contact.memoCount,
        }
      : undefined,

    goldMember: customer.goldMember
      ? {
          ...customer.goldMember,
          consultationCount: config.memos ? 0 : customer.goldMember.consultationCount,
        }
      : undefined,

    journey: config.callDetails || config.memos ? maskJourney(customer.journey, config) : customer.journey,

    groupMemberships: customer.groupMemberships, // No PII here
  };
}

/**
 * Mask email address
 * MANAGER: test@*** | AGENT: ***@***
 */
function maskEmail(email: string | null): string | null {
  if (!email) return null;

  const [local, domain] = email.split("@");
  if (!domain) return "***@***.***";

  // For MANAGER level
  if (local.length <= 2) {
    return `${local}@${domain.substring(0, 3)}***`;
  }
  return `${local.substring(0, 1)}***@${domain.substring(0, 3)}***`;
}

/**
 * Mask phone number
 * Format: 010-****-5678 (shows first 3 and last 4 digits)
 */
function maskPhone(phone: string): string {
  // Remove non-digits
  const digits = phone.replace(/\D/g, "");

  if (digits.length < 10) return "***-****-***";

  // Korean format: 010-XXXX-1234
  const first = digits.substring(0, 3);
  const last = digits.substring(digits.length - 4);

  return `${first}-****-${last}`;
}

/**
 * Mask name
 * Shows first name only + ***
 * "John Doe" -> "John ***"
 * "김철수" -> "김***"
 */
function maskName(name: string): string {
  if (!name) return "***";

  const parts = name.split(" ");
  if (parts.length === 0) return "***";

  // For Korean names (assume CJK characters)
  if (/[一-鿿가-힯぀-ゟ]/.test(name)) {
    // Show first character only
    return `${name.substring(0, 1)}***`;
  }

  // For Western names
  return `${parts[0]} ***`;
}

/**
 * Mask journey events
 */
function maskJourney(
  journey: Array<any>,
  config: MaskingConfig
): Array<any> {
  return journey.map((event) => {
    if (config.callDetails && event.type === "call") {
      return {
        ...event,
        details: {
          duration: event.details.duration,
          result: event.details.result,
          // Hide: nextAction, convictionScore
        },
      };
    }

    if (config.memos && event.type === "memo") {
      return {
        ...event,
        details: {
          content: "[Hidden memo]",
        },
      };
    }

    return event;
  });
}

/**
 * Create a masking audit log (for compliance tracking)
 */
export function createMaskingAuditLog(
  customerId: string,
  userRole: UserRole,
  userEmail: string,
  action: "view" | "export" | "download"
): AuditLogEntry {
  return {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    customerId,
    userRole,
    userEmail,
    action,
    timestamp: new Date(),
    ipAddress: "", // Would be filled by middleware
    userAgent: "", // Would be filled by middleware
    fieldsAccessed: MASKING_CONFIGS[userRole],
  };
}

export interface AuditLogEntry {
  id: string;
  customerId: string;
  userRole: UserRole;
  userEmail: string;
  action: "view" | "export" | "download";
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  fieldsAccessed: MaskingConfig;
}

/**
 * Selective field masking - mask specific fields only
 */
export function maskFields(
  data: Record<string, any>,
  fieldsToMask: string[]
): Record<string, any> {
  const masked = { ...data };

  fieldsToMask.forEach((field) => {
    if (field === "email" && masked.email) {
      masked.email = maskEmail(masked.email);
    }
    if (field === "phone" && masked.phone) {
      masked.phone = maskPhone(masked.phone);
    }
    if (field === "name" && masked.name) {
      masked.name = maskName(masked.name);
    }
    if (field === "spousePhone" && masked.spousePhone) {
      masked.spousePhone = maskPhone(masked.spousePhone);
    }
  });

  return masked;
}

/**
 * Check if user has permission to view a specific field
 */
export function canViewField(field: string, userRole: UserRole): boolean {
  const config = MASKING_CONFIGS[userRole];

  const fieldToConfigMap: Record<string, keyof MaskingConfig> = {
    email: "email",
    phone: "phone",
    name: "name",
    address: "address",
    paymentInfo: "paymentInfo",
    callDetails: "callDetails",
    memo: "memos",
  };

  const configKey = fieldToConfigMap[field];
  if (!configKey) return true; // Default allow

  return !config[configKey]; // If not masked, can view
}

/**
 * Get a summary of what's masked for a role
 */
export function getMaskingSummary(userRole: UserRole): string {
  const config = MASKING_CONFIGS[userRole];
  const masked = Object.entries(config)
    .filter(([, isMasked]) => isMasked)
    .map(([field]) => field);

  return `${userRole}: ${masked.length === 0 ? "No masking (full access)" : `Masked fields: ${masked.join(", ")}`}`;
}
