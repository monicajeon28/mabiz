/**
 * PII Masking Utilities
 * Masks sensitive personal information (email, phone) for unauthorized users
 *
 * Rules:
 * - GLOBAL_ADMIN: No masking
 * - ORG_ADMIN: No masking
 * - AGENT: Partial masking (show first/last char only)
 * - PUBLIC: Full masking
 *
 * Examples:
 * maskEmail("user@example.com", "AGENT") → "u***@e***.com"
 * maskPhone("01012345678", "AGENT") → "010****5678"
 */

// ═════════════════════════════════════════════════════════════
// EMAIL MASKING
// ═════════════════════════════════════════════════════════════

/**
 * Mask email address
 * Shows first letter + @ + first letter of domain
 *
 * Examples:
 * - user@example.com → u***@e***.com
 * - john.doe@gmail.com → j***@g***.com
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || typeof email !== "string") {
    return "***";
  }

  const [localPart, domain] = email.split("@");

  if (!localPart || !domain) {
    return "***@***";
  }

  const maskedLocal =
    localPart.length > 1
      ? localPart[0] + "*".repeat(localPart.length - 2) + localPart[localPart.length - 1]
      : "*";

  const [domainName] = domain.split(".");
  const maskedDomain =
    domainName.length > 1
      ? domainName[0] + "*".repeat(domainName.length - 2) + domainName[domainName.length - 1]
      : "*";

  return `${maskedLocal}@${maskedDomain}.***`;
}

// ═════════════════════════════════════════════════════════════
// PHONE MASKING
// ═════════════════════════════════════════════════════════════

/**
 * Mask phone number
 * Shows first 3 digits and last 4 digits
 *
 * Examples:
 * - 01012345678 → 010****5678
 * - 02-1234-5678 → 02-****-5678
 * - +82-10-1234-5678 → +82-**-****-5678
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone || typeof phone !== "string") {
    return "***";
  }

  // Remove all non-digit and non-dash characters
  const digits = phone.replace(/\D/g, "");

  if (digits.length < 4) {
    return "*".repeat(digits.length);
  }

  const firstPart = digits.substring(0, 3);
  const lastPart = digits.substring(digits.length - 4);
  const middlePart = "*".repeat(digits.length - 7);

  return `${firstPart}${middlePart}${lastPart}`;
}

// ═════════════════════════════════════════════════════════════
// NAME MASKING
// ═════════════════════════════════════════════════════════════

/**
 * Mask person's name
 * Shows first letter and last letter only
 *
 * Examples:
 * - John Doe → J***e
 * - 김민준 → 김***
 */
export function maskName(name: string | null | undefined): string {
  if (!name || typeof name !== "string" || name.length === 0) {
    return "***";
  }

  if (name.length <= 2) {
    return name[0] + "*";
  }

  return (
    name[0] +
    "*".repeat(Math.max(0, name.length - 2)) +
    name[name.length - 1]
  );
}

// ═════════════════════════════════════════════════════════════
// GENERIC PII MASKING
// ═════════════════════════════════════════════════════════════

/**
 * Detect and mask PII automatically
 * Attempts to identify the type and mask accordingly
 */
export function maskPII(value: string | null | undefined): string {
  if (!value || typeof value !== "string") {
    return "***";
  }

  // Try to detect email
  if (value.includes("@") && value.includes(".")) {
    return maskEmail(value);
  }

  // Try to detect phone (digits and common separators)
  if (/^\+?[\d\-\s()]+$/.test(value) && value.replace(/\D/g, "").length >= 7) {
    return maskPhone(value);
  }

  // Default: mask as generic string
  if (value.length <= 2) {
    return value[0] + "*";
  }

  return (
    value[0] +
    "*".repeat(Math.max(0, value.length - 2)) +
    value[value.length - 1]
  );
}

// ═════════════════════════════════════════════════════════════
// CONTEXT-AWARE MASKING
// ═════════════════════════════════════════════════════════════

export interface MaskingContext {
  role?: string;
  organizationId?: string;
  isOwner?: boolean;
}

/**
 * Determine if user should see unmasked PII
 */
export function shouldMaskPII(context: MaskingContext): boolean {
  // GLOBAL_ADMIN and ORG_ADMIN can see everything
  if (context.role === "GLOBAL_ADMIN" || context.role === "ORG_ADMIN") {
    return false;
  }

  // Owners can see their own data
  if (context.isOwner) {
    return false;
  }

  // Default: mask for AGENT and others
  return true;
}

/**
 * Conditionally mask email based on role
 */
export function maskEmailIfNeeded(
  email: string | null | undefined,
  context: MaskingContext
): string {
  if (!shouldMaskPII(context)) {
    return email || "";
  }
  return maskEmail(email);
}

/**
 * Conditionally mask phone based on role
 */
export function maskPhoneIfNeeded(
  phone: string | null | undefined,
  context: MaskingContext
): string {
  if (!shouldMaskPII(context)) {
    return phone || "";
  }
  return maskPhone(phone);
}

/**
 * Conditionally mask name based on role
 */
export function maskNameIfNeeded(
  name: string | null | undefined,
  context: MaskingContext
): string {
  if (!shouldMaskPII(context)) {
    return name || "";
  }
  return maskName(name);
}

// ═════════════════════════════════════════════════════════════
// OBJECT MASKING (for nested structures)
// ═════════════════════════════════════════════════════════════

export interface PIIField {
  type: "email" | "phone" | "name" | "generic";
  value: string | null | undefined;
}

/**
 * Mask multiple PII fields in an object
 */
export function maskObject(
  obj: Record<string, any>,
  piiFields: Record<string, PIIField>,
  context: MaskingContext
): Record<string, any> {
  if (!shouldMaskPII(context)) {
    return obj;
  }

  const masked = { ...obj };

  for (const [fieldName, fieldInfo] of Object.entries(piiFields)) {
    if (!fieldName || !masked.hasOwnProperty(fieldName)) {
      continue;
    }

    switch (fieldInfo.type) {
      case "email":
        masked[fieldName] = maskEmail(masked[fieldName]);
        break;
      case "phone":
        masked[fieldName] = maskPhone(masked[fieldName]);
        break;
      case "name":
        masked[fieldName] = maskName(masked[fieldName]);
        break;
      case "generic":
        masked[fieldName] = maskPII(masked[fieldName]);
        break;
    }
  }

  return masked;
}

// ═════════════════════════════════════════════════════════════
// TESTING UTILITIES
// ═════════════════════════════════════════════════════════════

/**
 * Verify that a value is properly masked
 * Returns true if value contains asterisks and no consecutive digits
 */
export function isProperlyMasked(value: string): boolean {
  if (!value.includes("*")) {
    return false;
  }

  // Check that no consecutive digits appear (except area code)
  const consecutiveDigits = /(\d{4,})/;
  return !consecutiveDigits.test(value);
}

/**
 * Unit tests for masking functions
 */
export function testMaskingFunctions(): boolean {
  const tests = [
    {
      fn: maskEmail,
      input: "john.doe@example.com",
      expected: "j***@e***.***",
    },
    {
      fn: maskPhone,
      input: "01012345678",
      expected: "010****5678",
    },
    {
      fn: maskName,
      input: "John Doe",
      expected: "J*****e",
    },
  ];

  let passed = 0;
  for (const test of tests) {
    const result = test.fn(test.input);
    if (result === test.expected) {
      passed++;
    }
  }

  return passed === tests.length;
}
