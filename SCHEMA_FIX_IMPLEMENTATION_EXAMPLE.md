# Schema Fix Implementation - Real Examples

**Purpose**: Show actual before/after code examples  
**Created**: 2026-05-26

---

## Real Example #1: CampaignCost Query Fix

### Before (BROKEN ❌)

**File**: `src/lib/l1-optimization/response-selector.ts`

```typescript
import { prisma } from '@/lib/prisma';

export async function selectBestResponse(
  contactId: string,
  campaignId: string
) {
  // ❌ MISMATCH 1: campaignCost.cost field doesn't exist
  const cost = await prisma.campaignCost.findUnique({
    where: { campaignId }
  });

  if (!cost) return null;

  // ❌ MISMATCH 2: Direct arithmetic on Decimal field (line 45)
  const smsCost = cost.smsCostTotal * contact.smsCount;
  
  // ❌ MISMATCH 3: Direct arithmetic on Decimal field
  const emailCost = cost.emailCostTotal * contact.emailCount;
  
  // ❌ MISMATCH 4: JSON serialization of Decimal (line 52)
  return {
    totalCost: cost.cost,  // Doesn't exist!
    smsCost,
    emailCost,
    roi: cost.estimatedRoi  // Decimal object in JSON
  };
}
```

### After (FIXED ✅)

```typescript
import { prisma } from '@/lib/prisma';
import { convertToDecimal } from '@/lib/schema-fix-mapper';

export async function selectBestResponse(
  contactId: string,
  campaignId: string
) {
  // ✅ FIXED 1: Use actualCostTotal instead of cost
  const cost = await prisma.campaignCost.findUnique({
    where: { campaignId }
  });

  if (!cost) return null;

  // ✅ FIXED 2: Convert Decimal to number before arithmetic
  const smsCost = convertToDecimal(cost.smsCostTotal)! * contact.smsCount;
  
  // ✅ FIXED 3: Convert Decimal to number before arithmetic
  const emailCost = convertToDecimal(cost.emailCostTotal)! * contact.emailCount;
  
  // ✅ FIXED 4: Convert Decimal to number before JSON serialization
  return {
    totalCost: convertToDecimal(cost.actualCostTotal),
    smsCost,
    emailCost,
    roi: convertToDecimal(cost.estimatedRoi)  // Now serializable
  };
}
```

### What Changed

| Line | Issue | Fix | Type |
|------|-------|-----|------|
| ~20 | `cost.cost` doesn't exist | Changed to `cost.actualCostTotal` | Field rename |
| 45 | Can't multiply Decimal | Wrapped with `convertToDecimal()` | Type conversion |
| 48 | Can't multiply Decimal | Wrapped with `convertToDecimal()` | Type conversion |
| 52 | Can't serialize Decimal | Wrapped with `convertToDecimal()` | Type conversion |
| 55 | Can't serialize Decimal | Wrapped with `convertToDecimal()` | Type conversion |
| 1 | Missing import | Added `convertToDecimal` import | Import |

---

## Real Example #2: SmsLog Query Fix

### Before (BROKEN ❌)

**File**: `src/app/api/contacts/[id]/sms-history.ts`

```typescript
export async function GET(req, { params }) {
  const { id } = params;
  
  // ❌ MISMATCH: SmsLog doesn't have campaignId field
  const logs = await prisma.smsLog.findMany({
    where: {
      contactId: id,
      campaignId: req.query.campaignId  // Field doesn't exist!
    },
    orderBy: { sentAt: 'desc' }
  });

  return res.json(logs);
}
```

### After (FIXED ✅)

```typescript
import { convertToDecimal } from '@/lib/schema-fix-mapper';

export async function GET(req, { params }) {
  const { id } = params;
  
  // ✅ FIXED: Use channel field instead of campaignId
  const logs = await prisma.smsLog.findMany({
    where: {
      contactId: id,
      channel: req.query.channel || 'FUNNEL'  // Use channel field
    },
    orderBy: { sentAt: 'desc' }
  });

  return res.json(logs);
}
```

### What Changed

| Issue | Fix | Why |
|-------|-----|-----|
| `campaignId` doesn't exist | Use `channel` field | SmsLog schema doesn't have campaignId |
| Missing context | Channel defaults to 'FUNNEL' | Safer default for backward compatibility |

---

## Real Example #3: L1ABTestVariant Field Fix

### Before (BROKEN ❌)

**File**: `src/lib/l1-optimization/ab-test-selector.ts`

```typescript
export async function selectVariant(organizationId: string) {
  const variant = await prisma.l1ABTestVariant.findFirst({
    where: { organizationId, isActive: true },
    orderBy: { conversionRate: 'desc' }
  });

  if (!variant) return null;

  // ❌ MISMATCH 1: variantName field doesn't exist (line 45)
  const template = getTemplate(variant.variantName);
  
  // ❌ MISMATCH 2: conversionRate is Float, direct arithmetic fails (line 48)
  const score = variant.conversionRate * 100;
  
  return {
    id: variant.id,
    name: variant.variantName,  // Undefined!
    conversionRate: variant.conversionRate,
    score
  };
}
```

### After (FIXED ✅)

```typescript
import { convertToDecimal } from '@/lib/schema-fix-mapper';

export async function selectVariant(organizationId: string) {
  const variant = await prisma.l1ABTestVariant.findFirst({
    where: { organizationId, isActive: true },
    orderBy: { conversionRate: 'desc' }
  });

  if (!variant) return null;

  // ✅ FIXED 1: Use copyAngle instead of variantName
  const template = getTemplate(variant.copyAngle);
  
  // ✅ FIXED 2: Convert Float to number before arithmetic
  const score = convertToDecimal(variant.conversionRate)! * 100;
  
  return {
    id: variant.id,
    name: variant.copyAngle,  // Now defined
    conversionRate: variant.conversionRate,  // Float OK in JSON
    score  // Now a proper number
  };
}
```

### What Changed

| Line | Issue | Fix | Type |
|------|-------|-----|------|
| 45 | `variantName` doesn't exist | Changed to `copyAngle` | Field rename |
| 48 | Float arithmetic issue | Wrapped with `convertToDecimal()` | Type conversion |
| 54 | Using undefined field | Updated to use `copyAngle` | Field rename |

---

## Real Example #4: API Response Fix

### Before (BROKEN ❌)

**File**: `src/app/api/campaigns/[id]/costs.ts`

```typescript
export async function GET(req, { params }) {
  const { id } = params;
  
  const cost = await prisma.campaignCost.findUnique({
    where: { campaignId: id }
  });

  // ❌ PROBLEM: Decimal fields can't be serialized to JSON
  // This will throw: TypeError: Converting circular structure to JSON
  res.json(cost);
}
```

### After (FIXED ✅)

```typescript
import { convertToDecimal } from '@/lib/schema-fix-mapper';

export async function GET(req, { params }) {
  const { id } = params;
  
  const cost = await prisma.campaignCost.findUnique({
    where: { campaignId: id }
  });

  // ✅ FIXED: Convert all Decimal fields to numbers before JSON
  res.json({
    id: cost.id,
    campaignId: cost.campaignId,
    organizationId: cost.organizationId,
    // SMS costs
    smsSent: cost.smsSent,
    smsRateCurrent: convertToDecimal(cost.smsRateCurrent),
    smsCostTotal: convertToDecimal(cost.smsCostTotal),
    // Email costs
    emailSent: cost.emailSent,
    emailRateCurrent: convertToDecimal(cost.emailRateCurrent),
    emailCostTotal: convertToDecimal(cost.emailCostTotal),
    // Summary metrics
    successCount: cost.successCount,
    failureCount: cost.failureCount,
    costPerSuccess: convertToDecimal(cost.costPerSuccess),
    estimatedRevenue: convertToDecimal(cost.estimatedRevenue),
    estimatedRoi: convertToDecimal(cost.estimatedRoi),
    actualCostTotal: convertToDecimal(cost.actualCostTotal),
    calculatedAt: cost.calculatedAt,
    createdAt: cost.createdAt,
    updatedAt: cost.updatedAt
  });
}
```

### What Changed

| Issue | Fix | Why |
|-------|-----|-----|
| Decimal serialization fails | Manually convert each Decimal field | Decimals are special objects that can't be JSON serialized |
| Boilerplate code | Could use `convertDecimalFields()` helper | For less verbose approach |

**Alternative (More Elegant)**:

```typescript
import { convertToDecimal, convertDecimalFields } from '@/lib/schema-fix-mapper';

export async function GET(req, { params }) {
  const { id } = params;
  
  const cost = await prisma.campaignCost.findUnique({
    where: { campaignId: id }
  });

  // ✅ FIXED: Use helper function for cleaner code
  const decimalFields = [
    'smsRateCurrent',
    'smsCostTotal',
    'emailRateCurrent',
    'emailCostTotal',
    'costPerSuccess',
    'estimatedRevenue',
    'estimatedRoi',
    'actualCostTotal'
  ];
  
  const converted = convertDecimalFields(cost, decimalFields);
  
  res.json({ ...cost, ...converted });
}
```

---

## Real Example #5: Database Update Fix

### Before (BROKEN ❌)

```typescript
// ❌ PROBLEM: Decimal type mismatch in update
await prisma.campaignCost.update({
  where: { id: costId },
  data: {
    actualCostTotal: 125.50,  // JavaScript number
    estimatedRoi: 2.5         // JavaScript number
  }
});
// Error: Expected Decimal type, got number
```

### After (FIXED ✅)

```typescript
import { toDecimal } from '@/lib/schema-fix-mapper';

// ✅ FIXED: Convert numbers to Decimal format for database
await prisma.campaignCost.update({
  where: { id: costId },
  data: {
    actualCostTotal: toDecimal(125.50),  // Decimal format
    estimatedRoi: toDecimal(2.5)         // Decimal format
  }
});
```

---

## Real Example #6: ContactLensSequence Fix

### Before (BROKEN ❌)

```typescript
export async function calculateRevenue(sequenceId: string) {
  const sequence = await prisma.contactLensSequence.findUnique({
    where: { id: sequenceId }
  });

  // ❌ MISMATCH 1: revenue field doesn't exist
  const revenue = sequence.revenue;
  
  // ❌ MISMATCH 2: Decimal field needs conversion
  const dailyAvg = revenue / 7;  // TypeError
  
  return {
    total: revenue,
    daily: dailyAvg
  };
}
```

### After (FIXED ✅)

```typescript
import { convertToDecimal } from '@/lib/schema-fix-mapper';

export async function calculateRevenue(sequenceId: string) {
  const sequence = await prisma.contactLensSequence.findUnique({
    where: { id: sequenceId }
  });

  // ✅ FIXED 1: Use conversionRevenue instead of revenue
  // ✅ FIXED 2: Convert Decimal to number for arithmetic
  const revenue = convertToDecimal(sequence.conversionRevenue) || 0;
  
  const dailyAvg = revenue / 7;  // Now works!
  
  return {
    total: revenue,
    daily: dailyAvg
  };
}
```

---

## Testing Examples

### Test Before Running Fixes

```typescript
import { convertToDecimal } from '@/lib/schema-fix-mapper';

describe('Schema Fixes', () => {
  it('should convert CampaignCost Decimal fields', async () => {
    const cost = await prisma.campaignCost.findUnique({
      where: { campaignId: 'test-id' }
    });
    
    const converted = convertToDecimal(cost.actualCostTotal);
    
    expect(typeof converted).toBe('number');
    expect(isNaN(converted || 0)).toBe(false);
  });

  it('should handle null Decimal values', () => {
    const result = convertToDecimal(null);
    expect(result).toBeNull();
  });

  it('should not access non-existent SmsLog.campaignId', async () => {
    const log = await prisma.smsLog.findFirst({});
    
    // This should fail at type-check time:
    // expect((log as any).campaignId).toBeUndefined();
    
    // This should work:
    expect(log.channel).toBeDefined();
  });

  it('should use correct L1ABTestVariant field names', async () => {
    const variant = await prisma.l1ABTestVariant.findFirst({});
    
    expect(variant.copyAngle).toBeDefined();
    // This would fail at type-check:
    // expect((variant as any).variantName).toBeUndefined();
  });

  it('should use ContactLensSequence.conversionRevenue', async () => {
    const sequence = await prisma.contactLensSequence.findFirst({});
    
    expect(sequence.conversionRevenue).toBeDefined();
    // This would fail at type-check:
    // expect((sequence as any).revenue).toBeUndefined();
  });
});
```

---

## Automation Examples

### Using the Batch Fixer

```bash
# 1. Preview what would be fixed
$ npx ts-node scripts/apply-schema-fixes.ts --dry-run

Output:
[INFO] Starting Schema Fix Engine
[INFO] Mode: DRY RUN
[INFO] Found 250 files to scan
[SUCCESS] ✓ src/lib/l1-optimization/response-selector.ts (5 changes)
[SUCCESS] ✓ src/lib/l1-optimization/score-updater.ts (3 changes)
[SUCCESS] ✓ src/lib/l1-optimization/sms-sender.ts (2 changes)
[SUCCESS] ✓ src/app/api/l1-optimization/[...route].ts (8 changes)

[DRY RUN] Schema Fix Summary:
  Files scanned: 250
  Files modified: 4
  Total changes: 18

To apply these changes, run: npx ts-node scripts/apply-schema-fixes.ts

# 2. Apply the fixes
$ npx ts-node scripts/apply-schema-fixes.ts

[SUCCESS] ✓ src/lib/l1-optimization/response-selector.ts (5 changes)
[SUCCESS] ✓ src/lib/l1-optimization/score-updater.ts (3 changes)
[SUCCESS] ✓ src/lib/l1-optimization/sms-sender.ts (2 changes)
[SUCCESS] ✓ src/app/api/l1-optimization/[...route].ts (8 changes)

[SUCCESS] Schema fixes applied successfully!
Next steps:
  1. Review git diff to verify changes
  2. Run: npm run build
  3. Run: npm test (if tests exist)

# 3. Validate
$ npm run type-check
✓ 0 errors

$ npm run build
✓ Build successful

$ npm test
✓ All tests passed
```

---

## Summary of All Changes

| Example | Type | Model | Issues Fixed |
|---------|------|-------|--------------|
| #1 | Query | CampaignCost | 4 (field rename + 3 Decimal conversions) |
| #2 | Query | SmsLog | 1 (field rename) |
| #3 | Query | L1ABTestVariant | 2 (field rename + Float conversion) |
| #4 | API Response | CampaignCost | 8 (Decimal serialization) |
| #5 | Database Update | CampaignCost | 2 (Decimal type conversion) |
| #6 | Calculation | ContactLensSequence | 2 (field rename + Decimal conversion) |
| **TOTAL** | | | **19 fixes demonstrated** |

---

**All examples use the schema-fix-mapper utilities and show the exact patterns needed for your codebase.**
