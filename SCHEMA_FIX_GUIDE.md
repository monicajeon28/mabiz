# Schema Fix Mapper - Complete Guide

**Created**: 2026-05-26  
**Purpose**: Prevent infinite loop errors from schema mismatches  
**Status**: READY FOR DEPLOYMENT

---

## Overview

This guide documents all identified schema mismatches between TypeScript code and the Prisma database schema, with automated fixes to prevent infinite loops during development and CI/CD.

---

## 1. IDENTIFIED SCHEMA MISMATCHES

### 1.1 SmsLog Model

**File**: `prisma/schema.prisma` (line 836)

| Field | Type | Issue | Fix |
|-------|------|-------|-----|
| `channel` | String | Code tries to access non-existent `campaignId` field | Map `campaignId` → `channel` |
| `sentAt` | DateTime | Already correct | No action |

**Affected Files**:
- `src/app/api/contacts/[id]/sms-history.ts`
- Any file querying `SmsLog.campaignId`

**Error Pattern**:
```typescript
// ❌ WRONG - campaignId doesn't exist in SmsLog
const logs = await prisma.smsLog.findMany({
  where: { campaignId: id }
});

// ✅ CORRECT - use channel field
const logs = await prisma.smsLog.findMany({
  where: { channel: "FUNNEL" }
});
```

---

### 1.2 CampaignCost Model

**File**: `prisma/schema.prisma` (line 5020)

| Field | Type | Issue | Fix |
|-------|------|-------|-----|
| `date` | (doesn't exist) | Code references non-existent `date` field | Map to `createdAt` or `calculatedAt` |
| `cost` | (doesn't exist) | Code references non-existent `cost` field | Map to `actualCostTotal` |
| All Decimal fields | Decimal(12,2) | Must convert to number before arithmetic | Use `convertToDecimal()` |

**Decimal Fields Requiring Conversion**:
```
- smsRateCurrent: Decimal(10,2)
- smsCostTotal: Decimal(12,2)
- emailRateCurrent: Decimal(10,4)
- emailCostTotal: Decimal(12,2)
- costPerSuccess: Decimal(12,2)
- estimatedRevenue: Decimal(15,2)
- estimatedRoi: Decimal(7,2)
- actualCostTotal: Decimal(12,2)
```

**Error Pattern**:
```typescript
// ❌ WRONG - date field doesn't exist, cost is ambiguous
const cost = await prisma.campaignCost.findUnique({
  where: { campaignId: id }
});
const amount = cost.cost;  // Field doesn't exist!

// ✅ CORRECT - use actualCostTotal, convert to number
import { convertToDecimal } from '@/lib/schema-fix-mapper';

const cost = await prisma.campaignCost.findUnique({
  where: { campaignId: id }
});
const amount = convertToDecimal(cost.actualCostTotal); // Decimal → number
```

---

### 1.3 L1ABTestVariant Model

**File**: `prisma/schema.prisma` (line 4835)

| Field | Type | Issue | Fix |
|-------|------|-------|-----|
| `variantName` | (doesn't exist) | Code uses non-existent `variantName` | Map to `copyAngle` |
| `conversionRate` | Float | Must convert before arithmetic | Use `convertToDecimal()` |

**Error Pattern**:
```typescript
// ❌ WRONG - variantName doesn't exist
const variant = variants[0];
console.log(variant.variantName);  // undefined!

// ✅ CORRECT - use copyAngle
const variant = variants[0];
console.log(variant.copyAngle);  // "가치재정의"
```

---

### 1.4 ContactLensSequence Model

**File**: `prisma/schema.prisma` (line 445)

| Field | Type | Issue | Fix |
|-------|------|-------|-----|
| `revenue` | (doesn't exist) | Code may reference `revenue` | Map to `conversionRevenue` |
| `conversionRevenue` | Decimal(15,2) | Must convert before calculations | Use `convertToDecimal()` |

---

## 2. CONVERSION UTILITIES

### 2.1 convertToDecimal()

Convert any value (number, string, Decimal) to a number safely.

```typescript
import { convertToDecimal } from '@/lib/schema-fix-mapper';

// Usage examples
const num1 = convertToDecimal(campaignCost.actualCostTotal);  // Decimal → number
const num2 = convertToDecimal("123.45");                       // String → number
const num3 = convertToDecimal(null);                           // null → null
const num4 = convertToDecimal(456);                            // number → number

// With arithmetic
const total = convertToDecimal(cost.smsCostTotal)! * 1.1;
```

### 2.2 toDecimal()

Create a Decimal-compatible object from a number (for database inserts).

```typescript
import { toDecimal } from '@/lib/schema-fix-mapper';

// For inserts/updates
await prisma.campaignCost.update({
  where: { id },
  data: {
    actualCostTotal: toDecimal(125.50)  // Converts to Decimal format
  }
});
```

---

## 3. AUTOMATED FIX APPLICATION

### 3.1 Using the Batch Fix Script

**Dry Run** (preview changes without applying):
```bash
npx ts-node scripts/apply-schema-fixes.ts --dry-run
```

**Apply All Fixes**:
```bash
npx ts-node scripts/apply-schema-fixes.ts
```

**Fix Single File**:
```bash
npx ts-node scripts/apply-schema-fixes.ts --file src/lib/l1-optimization/response-selector.ts
```

**Verbose Output**:
```bash
npx ts-node scripts/apply-schema-fixes.ts --verbose
```

### 3.2 What the Script Does

1. **Scans** all TypeScript files matching patterns
2. **Identifies** problematic field references and type conversions
3. **Applies** automatic replacements:
   - `campaignCost.cost` → `campaignCost.actualCostTotal`
   - `campaignCost.date` → `campaignCost.createdAt`
   - `variant.variantName` → `variant.copyAngle`
   - `campaignCost.smsCostTotal` → `convertToDecimal(campaignCost.smsCostTotal)`
   - `variant.conversionRate` → `convertToDecimal(variant.conversionRate)`
4. **Adds** required imports (`convertToDecimal` from `@/lib/schema-fix-mapper`)
5. **Verifies** changes were applied correctly

---

## 4. MANUAL FIX CHECKLIST

If applying fixes manually, use this checklist:

### 4.1 For CampaignCost Files

- [ ] Replace all `campaignCost.cost` with `campaignCost.actualCostTotal`
- [ ] Replace all `campaignCost.date` with `campaignCost.createdAt` or `calculatedAt`
- [ ] Wrap all Decimal field accesses with `convertToDecimal()`:
  - [ ] `smsCostTotal`
  - [ ] `emailCostTotal`
  - [ ] `actualCostTotal`
  - [ ] `costPerSuccess`
  - [ ] `estimatedRevenue`
  - [ ] `estimatedRoi`
  - [ ] `smsRateCurrent`
  - [ ] `emailRateCurrent`
- [ ] Add import: `import { convertToDecimal } from '@/lib/schema-fix-mapper';`

### 4.2 For SmsLog Files

- [ ] Replace all `smsLog.campaignId` with `smsLog.channel`
- [ ] Update WHERE clauses to use `channel: 'FUNNEL'` or appropriate value

### 4.3 For L1ABTestVariant Files

- [ ] Replace all `variant.variantName` with `variant.copyAngle`
- [ ] Wrap `conversionRate` with `convertToDecimal()`:
  ```typescript
  const rate = convertToDecimal(variant.conversionRate);
  ```

### 4.4 For ContactLensSequence Files

- [ ] Replace all `sequence.revenue` with `sequence.conversionRevenue`
- [ ] Wrap `conversionRevenue` with `convertToDecimal()`:
  ```typescript
  const revenue = convertToDecimal(sequence.conversionRevenue);
  ```

---

## 5. VALIDATION

### 5.1 After Applying Fixes

Run the following checks:

```bash
# Type check
npm run type-check

# Build test
npm run build

# Unit tests (if available)
npm test

# Lint
npm run lint
```

### 5.2 Known Issues to Watch For

| Issue | Solution |
|-------|----------|
| Import path errors | Ensure `@/lib/schema-fix-mapper` resolves correctly |
| Decimal serialization | Always convert Decimals to numbers before JSON.stringify() |
| TypeScript errors on field access | Use `convertToDecimal()` wrapper function |
| Database update failures | Ensure Decimal fields are wrapped with `toDecimal()` |

---

## 6. FILE-BY-FILE REFERENCE

### High Priority Files (MUST FIX)

| File | Issues | Fix |
|------|--------|-----|
| `src/lib/l1-optimization/response-selector.ts` | CampaignCost Decimal fields | Line 45, 52: Wrap with convertToDecimal() |
| `src/lib/l1-optimization/score-updater.ts` | L1OptimizationScore Float field | Line 38: Wrap currentScore |
| `src/lib/l1-optimization/sms-sender.ts` | CampaignCost + L1ABTestVariant | Line 89: Convert both fields |
| `src/app/api/l1-optimization/[...route].ts` | API response serialization | Lines 156, 173: Convert before JSON |

### Medium Priority Files (SHOULD FIX)

| File | Issues |
|------|--------|
| `src/app/api/campaign/route.ts` | Verify CampaignCost usage |
| `src/lib/crm-automation/contact-classifier.ts` | Check ContactLensSequence.revenue |
| `src/lib/l1-optimization/ab-test-selector.ts` | Verify L1ABTestVariant field access |

---

## 7. PREVENTION FOR FUTURE

### 7.1 Code Review Checklist

When reviewing PRs that modify CampaignCost, SmsLog, or L1ABTestVariant:

- [ ] All field names match schema.prisma exactly
- [ ] All Decimal fields are wrapped with `convertToDecimal()`
- [ ] All Float fields used in arithmetic are wrapped with `convertToDecimal()`
- [ ] No direct JSON serialization of Decimal fields
- [ ] Import statement includes required utilities

### 7.2 Pre-commit Hook

Add to `.husky/pre-commit`:
```bash
npx ts-node scripts/apply-schema-fixes.ts --dry-run || exit 1
```

### 7.3 Testing Strategy

For any code that uses Decimal or Float fields:

```typescript
// ✅ DO test with actual database values
it('should handle decimal conversion', async () => {
  const cost = await prisma.campaignCost.findUnique({ ... });
  const num = convertToDecimal(cost.actualCostTotal);
  expect(typeof num).toBe('number');
});

// ❌ DON'T ignore type mismatches
// it('should work', async () => {
//   const cost = await db.campaignCost.findOne(...);
//   const sum = cost.actualCostTotal + 100; // Fails silently!
// });
```

---

## 8. TROUBLESHOOTING

### Problem: "campaignId is not exported from schema"

**Cause**: `SmsLog.campaignId` doesn't exist in Prisma schema  
**Solution**: Use `channel` field instead
```typescript
// ❌ Wrong
where: { campaignId: id }

// ✅ Correct
where: { channel: "FUNNEL" }
```

### Problem: "Cannot multiply Decimal with number"

**Cause**: Not converting Decimal field to number before arithmetic  
**Solution**: Wrap with `convertToDecimal()`
```typescript
// ❌ Wrong
const total = record.actualCostTotal * 1.1;

// ✅ Correct
const total = convertToDecimal(record.actualCostTotal)! * 1.1;
```

### Problem: "variantName is undefined"

**Cause**: Using non-existent field name  
**Solution**: Use correct field name
```typescript
// ❌ Wrong
variant.variantName

// ✅ Correct
variant.copyAngle
```

### Problem: "JSON serialization fails"

**Cause**: Attempting to JSON.stringify() a Decimal object  
**Solution**: Convert before serialization
```typescript
// ❌ Wrong
res.json({ cost: record.actualCostTotal });

// ✅ Correct
res.json({ cost: convertToDecimal(record.actualCostTotal) });
```

---

## 9. REFERENCES

- Schema file: `D:\mabiz-crm\prisma\schema.prisma`
- Mapper file: `D:\mabiz-crm\src\lib\schema-fix-mapper.ts`
- Fix script: `D:\mabiz-crm\scripts\apply-schema-fixes.ts`
- Prisma Decimal docs: https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#decimal

---

## 10. MAINTENANCE

**Last Updated**: 2026-05-26  
**Maintainer**: CRM Development Team  
**Review Schedule**: Monthly (or as needed when schema changes)

To update this guide:
1. Update schema mismatches as you discover them
2. Add new file references to section 6
3. Update troubleshooting section as issues arise
4. Test all fixes in staging environment before production

---

**Status**: ✅ Ready for automated or manual application
