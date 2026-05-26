/**
 * Schema Fix Mapper
 *
 * Provides comprehensive mappings for schema mismatches found across the codebase.
 * This file is used by automated batch fixing tools to resolve field name mismatches,
 * type conversions, and Decimal field handling.
 *
 * Generated: 2026-05-26
 * Purpose: Prevent infinite loops by providing one-shot automatic fixes
 */

// ============================================================================
// 1. FIELD REPLACEMENT MAP
// ============================================================================
// Maps old field names to new field names for models with schema changes

export const SCHEMA_FIXES = {
  // SmsLog model fixes (channel field exists, no campaignId)
  "SmsLog.campaignId": "channel",

  // CampaignCost model fixes (date field changed)
  "CampaignCost.date": "createdAt",
  "CampaignCost.cost": "actualCostTotal",

  // L1ABTestVariant model fixes (variantName → copyAngle)
  "L1ABTestVariant.variantName": "copyAngle",
  "L1ABTestVariant.name": "copyAngle",

  // ContactLensSequence model fixes (Decimal field renaming)
  "ContactLensSequence.revenue": "conversionRevenue",

  // ExecutionLog model fixes
  "ExecutionLog.channel": "channel", // Already correct, but verify

  // CrmMarketingCampaign model fixes (if any)
  "CrmMarketingCampaign.costPerClick": "estimatedRoi", // Example if exists

  // Organization model fixes (verify no schema mismatches)
  "Organization.createdAt": "createdAt", // Already correct

  // Contact model fixes (verify DateTime fields are properly typed)
  "Contact.createdAt": "createdAt",
  "Contact.updatedAt": "updatedAt",
} as const;

// ============================================================================
// 2. DECIMAL/NUMBER CONVERSION RULES
// ============================================================================
// Fields with Decimal type that require Number() wrapping or Decimal handling

export const DECIMAL_FIELDS = [
  // CampaignCost model - ALL Decimal fields
  "CampaignCost.smsRateCurrent",
  "CampaignCost.smsCostTotal",
  "CampaignCost.emailRateCurrent",
  "CampaignCost.emailCostTotal",
  "CampaignCost.costPerSuccess",
  "CampaignCost.estimatedRevenue",
  "CampaignCost.estimatedRoi",
  "CampaignCost.actualCostTotal",

  // ContactLensSequence model - Decimal field
  "ContactLensSequence.conversionRevenue",

  // LensTemplate model - Decimal fields (if exist)
  "LensTemplate.expectedClickRate",

  // Contact model - Float fields (not Decimal, but numeric)
  "Contact.ltvTotal",

  // L1OptimizationScore model - Float fields
  "L1OptimizationScore.currentScore",
  "L1OptimizationScore.successRate",

  // L1ABTestVariant model - Float fields
  "L1ABTestVariant.conversionRate",
] as const;

// ============================================================================
// 3. DECIMAL CONVERSION UTILITY FUNCTIONS
// ============================================================================

/**
 * Safely convert a value to a number for Decimal fields
 * Handles null, undefined, string, number, and Decimal inputs
 */
export function convertToDecimal(value: any): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  // If already a number
  if (typeof value === "number") {
    return value;
  }

  // If it's a Decimal object from Prisma
  if (value && typeof value === "object") {
    // Decimal.js toNumber() method
    if (typeof value.toNumber === "function") {
      return value.toNumber();
    }
    // Fallback to string conversion
    if (typeof value.toString === "function") {
      const parsed = parseFloat(value.toString());
      return isNaN(parsed) ? null : parsed;
    }
  }

  // String conversion
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}

/**
 * Create a Decimal-compatible object from a number
 * For use when inserting into database
 */
export function toDecimal(value: number | string | null | undefined): {
  toString: () => string;
  toNumber: () => number;
} | null {
  if (value === null || value === undefined) {
    return null;
  }

  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) {
    return null;
  }

  return {
    toString: () => num.toFixed(2),
    toNumber: () => num,
  };
}

// ============================================================================
// 4. FILE-BY-FILE FIX SUGGESTIONS (GENERATED FROM ANALYSIS)
// ============================================================================

export const FILE_FIXES: Record<
  string,
  Array<{
    lineNumber: number;
    currentCode: string;
    fixedCode: string;
    description: string;
    priority: "high" | "medium" | "low";
  }>
> = {
  // ========================================================================
  // src/lib/l1-optimization/response-selector.ts
  // ========================================================================
  "src/lib/l1-optimization/response-selector.ts": [
    {
      lineNumber: 45,
      currentCode:
        'const cost = record.campaignCost?.smsCostTotal || 0;',
      fixedCode:
        'const cost = convertToDecimal(record.campaignCost?.smsCostTotal) || 0;',
      description:
        "Convert Decimal field to number before calculation (smsCostTotal is Decimal(12,2))",
      priority: "high",
    },
    {
      lineNumber: 52,
      currentCode:
        'const roi = campaignCost.estimatedRoi;',
      fixedCode:
        'const roi = convertToDecimal(campaignCost.estimatedRoi);',
      description:
        "Convert Decimal estimatedRoi to number for comparison operations",
      priority: "high",
    },
  ],

  // ========================================================================
  // src/lib/l1-optimization/score-updater.ts
  // ========================================================================
  "src/lib/l1-optimization/score-updater.ts": [
    {
      lineNumber: 38,
      currentCode:
        "return scoreRecord.currentScore * 0.95;",
      fixedCode:
        "return convertToDecimal(scoreRecord.currentScore)! * 0.95;",
      description:
        "Convert Float currentScore to number for arithmetic operations",
      priority: "high",
    },
    {
      lineNumber: 67,
      currentCode:
        'const newScore = calculateNewScore(contact);',
      fixedCode:
        'const newScore = calculateNewScore(contact); // Ensure result is number',
      description:
        "Verify calculateNewScore returns a number, not Decimal or Float",
      priority: "medium",
    },
  ],

  // ========================================================================
  // src/lib/l1-optimization/sms-sender.ts
  // ========================================================================
  "src/lib/l1-optimization/sms-sender.ts": [
    {
      lineNumber: 89,
      currentCode:
        'const totalCost = variant.conversionRate * campaignCost.actualCostTotal;',
      fixedCode:
        'const totalCost = convertToDecimal(variant.conversionRate)! * convertToDecimal(campaignCost.actualCostTotal)!;',
      description:
        "Convert both Decimal and Float fields to numbers for multiplication",
      priority: "high",
    },
  ],

  // ========================================================================
  // src/app/api/l1-optimization/[...route].ts
  // ========================================================================
  "src/app/api/l1-optimization/[...route].ts": [
    {
      lineNumber: 156,
      currentCode:
        'response.costPerSuccess = campaignCost.costPerSuccess;',
      fixedCode:
        'response.costPerSuccess = convertToDecimal(campaignCost.costPerSuccess);',
      description:
        "Convert Decimal costPerSuccess before JSON serialization in API response",
      priority: "high",
    },
    {
      lineNumber: 173,
      currentCode:
        'const rates = { sms: cost.smsRateCurrent, email: cost.emailRateCurrent };',
      fixedCode:
        'const rates = { sms: convertToDecimal(cost.smsRateCurrent), email: convertToDecimal(cost.emailRateCurrent) };',
      description:
        "Convert both Decimal rate fields for API response",
      priority: "high",
    },
  ],

  // ========================================================================
  // src/app/api/campaign/route.ts (if exists)
  // ========================================================================
  "src/app/api/campaign/route.ts": [
    {
      lineNumber: 0,
      currentCode: "PLACEHOLDER - verify if file contains CampaignCost queries",
      fixedCode:
        "Use convertToDecimal() for all Decimal field conversions before serialization",
      description: "Apply Decimal conversion pattern if this file queries CampaignCost",
      priority: "medium",
    },
  ],

  // ========================================================================
  // src/lib/crm-automation/contact-classifier.ts
  // ========================================================================
  "src/lib/crm-automation/contact-classifier.ts": [
    {
      lineNumber: 0,
      currentCode:
        "PLACEHOLDER - check if ContactLensSequence.conversionRevenue is used",
      fixedCode:
        "Apply: conversionRevenue = convertToDecimal(record.conversionRevenue);",
      description:
        "If querying ContactLensSequence with revenue calculations, convert Decimal field",
      priority: "medium",
    },
  ],

  // ========================================================================
  // src/app/api/contacts/[id]/sms-history.ts
  // ========================================================================
  "src/app/api/contacts/[id]/sms-history.ts": [
    {
      lineNumber: 0,
      currentCode:
        "PLACEHOLDER - check SmsLog field references",
      fixedCode:
        "If using SmsLog.campaignId, map to SmsLog.channel instead",
      description:
        "SmsLog model does not have campaignId field; use channel (default: 'FUNNEL')",
      priority: "high",
    },
  ],

  // ========================================================================
  // src/lib/l1-optimization/ab-test-selector.ts
  // ========================================================================
  "src/lib/l1-optimization/ab-test-selector.ts": [
    {
      lineNumber: 0,
      currentCode:
        "PLACEHOLDER - check L1ABTestVariant field usage",
      fixedCode:
        "Replace variantName → copyAngle, verify all field accesses match schema",
      description:
        "L1ABTestVariant uses copyAngle, not variantName; verify conversion logic",
      priority: "high",
    },
    {
      lineNumber: 0,
      currentCode:
        "variant.conversionRate usage",
      fixedCode:
        "const rate = convertToDecimal(variant.conversionRate);",
      description:
        "L1ABTestVariant.conversionRate is Float; convert before arithmetic",
      priority: "medium",
    },
  ],
};

// ============================================================================
// 5. BATCH FIX EXECUTOR (for automated application)
// ============================================================================

/**
 * Configuration for automated batch fixing
 * Used by CI/CD or local scripts to apply fixes
 */
export const BATCH_FIX_CONFIG = {
  // Skip files that are in these directories (safety check)
  skipDirs: [
    "node_modules",
    "dist",
    ".next",
    ".prisma",
    "coverage",
  ],

  // File patterns to scan for fixes
  filePatternsToScan: [
    "src/app/api/**/*.ts",
    "src/lib/**/*.ts",
    "src/components/**/*.tsx",
  ],

  // Automatic field replacements (regex patterns)
  autoFieldReplacements: [
    {
      pattern: /campaignCost\.smsCostTotal/g,
      replacement: "convertToDecimal(campaignCost.smsCostTotal)",
      reason: "Convert Decimal smsCostTotal to number",
    },
    {
      pattern: /campaignCost\.emailCostTotal/g,
      replacement: "convertToDecimal(campaignCost.emailCostTotal)",
      reason: "Convert Decimal emailCostTotal to number",
    },
    {
      pattern: /campaignCost\.actualCostTotal/g,
      replacement: "convertToDecimal(campaignCost.actualCostTotal)",
      reason: "Convert Decimal actualCostTotal to number",
    },
    {
      pattern: /variant\.conversionRate/g,
      replacement: "convertToDecimal(variant.conversionRate)",
      reason: "Convert Float conversionRate to number",
    },
    {
      pattern: /variant\.variantName/g,
      replacement: "variant.copyAngle",
      reason: "L1ABTestVariant uses copyAngle, not variantName",
    },
  ],

  // Check these functions exist and are imported
  requiredImports: [
    {
      source: "@/lib/schema-fix-mapper",
      names: ["convertToDecimal", "SCHEMA_FIXES", "DECIMAL_FIELDS"],
      reason: "Required for Decimal field conversion",
    },
  ],

  // Validation checks to run after applying fixes
  postFixValidation: {
    checkPrismaTypes: true,
    checkJsonSerialization: true,
    checkArithmeticOperations: true,
    checkDecimalFields: true,
  },
};

// ============================================================================
// 6. MIGRATION HELPER
// ============================================================================

/**
 * Apply a field fix to an object
 * Usage: applyFieldFix(record, "SmsLog.campaignId")
 */
export function applyFieldFix<T extends Record<string, any>>(
  record: T,
  fixKey: string
): void {
  const [model, oldField] = fixKey.split(".");
  const newField = SCHEMA_FIXES[fixKey as keyof typeof SCHEMA_FIXES];

  if (!newField || !record.hasOwnProperty(oldField)) {
    return;
  }

  // If old field exists, copy to new field (if different)
  if (oldField !== newField) {
    (record as any)[newField] = record[oldField];
    delete (record as any)[oldField];
  }
}

/**
 * Apply all relevant fixes to a record
 */
export function applyAllFieldFixes<T extends Record<string, any>>(
  record: T,
  modelName: string
): T {
  const fixes = Object.keys(SCHEMA_FIXES).filter((key) =>
    key.startsWith(`${modelName}.`)
  );

  const result = { ...record };
  fixes.forEach((fixKey) => applyFieldFix(result, fixKey));

  return result;
}

/**
 * Convert all Decimal fields in a record to numbers
 * Usage: convertDecimalFields(campaignCost, ["actualCostTotal", "smsCostTotal"])
 */
export function convertDecimalFields<T extends Record<string, any>>(
  record: T,
  fields: string[]
): Partial<T> {
  const result: Partial<T> = {};

  fields.forEach((field) => {
    if (record.hasOwnProperty(field)) {
      result[field as keyof T] = convertToDecimal(
        record[field]
      ) as any;
    }
  });

  return result;
}

export default {
  SCHEMA_FIXES,
  DECIMAL_FIELDS,
  convertToDecimal,
  toDecimal,
  FILE_FIXES,
  BATCH_FIX_CONFIG,
  applyFieldFix,
  applyAllFieldFixes,
  convertDecimalFields,
};
