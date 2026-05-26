# Schema Mismatches - Technical Specification

**Document Type**: Technical Reference  
**Created**: 2026-05-26  
**Purpose**: Complete enumeration of all schema mismatches with fix patterns  
**Status**: FINALIZED

---

## Executive Summary

This document catalogs all identified schema mismatches between TypeScript code and the Prisma database schema. Total mismatches: **12 categories** across **4 models**.

| Model | Field Mismatch | Type Mismatch | Total Issues |
|-------|---|---|---|
| SmsLog | 1 | 0 | 1 |
| CampaignCost | 2 | 8 | 10 |
| L1ABTestVariant | 1 | 1 | 2 |
| ContactLensSequence | 1 | 1 | 2 |
| **TOTAL** | **5** | **10** | **15** |

---

## 1. SMSLOG MODEL MISMATCHES

### Schema Definition
```prisma
model SmsLog {
  id             String   @id @default(cuid())
  organizationId String
  contactId      String?
  phone          String
  contentPreview String
  status         String   @default("SENT")
  blockReason    String?
  resultCode     String?
  msgId          String?
  channel        String   @default("FUNNEL")     // ← NOT campaignId
  sentAt         DateTime @default(now())

  @@index([organizationId, sentAt])
  @@index([contactId, sentAt])
  @@map("CrmSmsLog")
}
```

### Issue #1.1: Missing campaignId Field

| Property | Value |
|----------|-------|
| **Error Type** | Field Reference Error |
| **Severity** | HIGH |
| **Pattern** | `smsLog.campaignId` |
| **Actual Field** | `smsLog.channel` |
| **Reason** | SmsLog model was refactored; campaignId replaced with channel |
| **Impact** | Query failures, undefined field access |
| **Fix** | Replace `campaignId` references with `channel` |

**Code Pattern**:
```typescript
// ❌ WRONG
const logs = await prisma.smsLog.findMany({
  where: { campaignId: campaignId }
});

// ✅ CORRECT
const logs = await prisma.smsLog.findMany({
  where: { channel: "FUNNEL" } // or appropriate channel value
});
```

**Affected Files Count**: 3-5 files (estimated from API routes)

---

## 2. CAMPAIGNCOST MODEL MISMATCHES

### Schema Definition
```prisma
model CampaignCost {
  id               String               @id @default(cuid())
  campaignId       String               @unique
  organizationId   String
  smsSent          Int                  @default(0)
  smsRateCurrent   Decimal              @default(0.01) @db.Decimal(10, 2)
  smsCostTotal     Decimal              @default(0) @db.Decimal(12, 2)
  emailSent        Int                  @default(0)
  emailRateCurrent Decimal              @default(0.001) @db.Decimal(10, 4)
  emailCostTotal   Decimal              @default(0) @db.Decimal(12, 2)
  successCount     Int                  @default(0)
  failureCount     Int                  @default(0)
  costPerSuccess   Decimal              @default(0) @db.Decimal(12, 2)
  estimatedRevenue Decimal              @default(0) @db.Decimal(15, 2)
  estimatedRoi     Decimal              @default(0) @db.Decimal(7, 2)
  actualCostTotal  Decimal              @default(0) @db.Decimal(12, 2)
  calculatedAt     DateTime             @default(now())
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt
}
```

### Issue #2.1: Missing 'date' Field

| Property | Value |
|----------|-------|
| **Error Type** | Field Reference Error |
| **Severity** | HIGH |
| **Pattern** | `campaignCost.date` |
| **Actual Field** | `campaignCost.createdAt` or `calculatedAt` |
| **Reason** | Date field was split into createdAt/calculatedAt |
| **Impact** | Query failures, date filtering broken |
| **Fix** | Replace with `createdAt` (insertion time) or `calculatedAt` (computation time) |

**Code Pattern**:
```typescript
// ❌ WRONG
const cost = await prisma.campaignCost.findUnique({
  where: { campaignId: id }
});
const createdDate = cost.date;  // Undefined!

// ✅ CORRECT (choose based on business logic)
// For when cost was first recorded:
const createdDate = cost.createdAt;

// For when cost was last calculated:
const calculatedDate = cost.calculatedAt;
```

### Issue #2.2: Missing 'cost' Field (Ambiguous)

| Property | Value |
|----------|-------|
| **Error Type** | Field Reference Error |
| **Severity** | HIGH |
| **Pattern** | `campaignCost.cost` |
| **Actual Field** | `campaignCost.actualCostTotal` (most common), or specific type (smsCostTotal, emailCostTotal) |
| **Reason** | Generic 'cost' field split into specific cost categories |
| **Impact** | Ambiguous field access, calculation errors |
| **Fix** | Use specific cost field based on context |

**Code Pattern**:
```typescript
// ❌ WRONG
const totalCost = cost.cost;  // Which cost? Ambiguous!

// ✅ CORRECT
const totalCost = cost.actualCostTotal;  // All costs combined
const smsCost = cost.smsCostTotal;       // SMS only
const emailCost = cost.emailCostTotal;   // Email only
```

### Issues #2.3-#2.10: Decimal Type Conversions

All Decimal fields in CampaignCost must be converted to number before arithmetic operations or JSON serialization.

#### Issue #2.3: smsRateCurrent

| Property | Value |
|----------|-------|
| **Error Type** | Type Conversion Error |
| **Severity** | HIGH |
| **Field** | `smsRateCurrent` |
| **Database Type** | Decimal(10, 2) |
| **Expected JS Type** | number |
| **Problem** | Decimal object cannot be used directly in arithmetic |
| **Fix** | `convertToDecimal(record.smsRateCurrent)` |

#### Issue #2.4: smsCostTotal

| Property | Value |
|----------|-------|
| **Error Type** | Type Conversion Error |
| **Severity** | HIGH |
| **Field** | `smsCostTotal` |
| **Database Type** | Decimal(12, 2) |
| **Fix Pattern** | `convertToDecimal(record.smsCostTotal) || 0` |
| **Usage Example** | `const totalSmsCost = convertToDecimal(cost.smsCostTotal) * multiplier;` |

#### Issue #2.5: emailRateCurrent

| Property | Value |
|----------|-------|
| **Error Type** | Type Conversion Error |
| **Severity** | HIGH |
| **Field** | `emailRateCurrent` |
| **Database Type** | Decimal(10, 4) |
| **Fix Pattern** | `convertToDecimal(record.emailRateCurrent)` |

#### Issue #2.6: emailCostTotal

| Property | Value |
|----------|-------|
| **Error Type** | Type Conversion Error |
| **Severity** | HIGH |
| **Field** | `emailCostTotal` |
| **Database Type** | Decimal(12, 2) |
| **Fix Pattern** | `convertToDecimal(record.emailCostTotal)` |

#### Issue #2.7: costPerSuccess

| Property | Value |
|----------|-------|
| **Error Type** | Type Conversion Error |
| **Severity** | HIGH |
| **Field** | `costPerSuccess` |
| **Database Type** | Decimal(12, 2) |
| **Common Usage** | API responses, comparisons |
| **Fix Pattern** | Convert before serialization: `convertToDecimal(record.costPerSuccess)` |

#### Issue #2.8: estimatedRevenue

| Property | Value |
|----------|-------|
| **Error Type** | Type Conversion Error |
| **Severity** | MEDIUM |
| **Field** | `estimatedRevenue` |
| **Database Type** | Decimal(15, 2) |
| **Fix Pattern** | `convertToDecimal(record.estimatedRevenue)` |

#### Issue #2.9: estimatedRoi

| Property | Value |
|----------|-------|
| **Error Type** | Type Conversion Error |
| **Severity** | HIGH |
| **Field** | `estimatedRoi` |
| **Database Type** | Decimal(7, 2) |
| **Common Bug** | Used in comparisons without conversion: `if (cost.estimatedRoi > 1.0)` |
| **Fix Pattern** | `convertToDecimal(record.estimatedRoi)! > 1.0` |

#### Issue #2.10: actualCostTotal

| Property | Value |
|----------|-------|
| **Error Type** | Type Conversion Error |
| **Severity** | HIGH |
| **Field** | `actualCostTotal` |
| **Database Type** | Decimal(12, 2) |
| **Common Bug** | Used in arithmetic: `total = cost.actualCostTotal * rate` fails |
| **Fix Pattern** | `convertToDecimal(record.actualCostTotal)! * rate` |

**Unified Fix Pattern for All Decimal Fields**:
```typescript
import { convertToDecimal } from '@/lib/schema-fix-mapper';

// ❌ WRONG - TypeError at runtime
const total = record.smsCostTotal + record.emailCostTotal;
const roi = record.estimatedRoi > 1 ? "positive" : "negative";
res.json({ cost: record.actualCostTotal });

// ✅ CORRECT
const total = convertToDecimal(record.smsCostTotal)! + convertToDecimal(record.emailCostTotal)!;
const roi = convertToDecimal(record.estimatedRoi)! > 1 ? "positive" : "negative";
res.json({ cost: convertToDecimal(record.actualCostTotal) });
```

---

## 3. L1ABTESTVARIANT MODEL MISMATCHES

### Schema Definition
```prisma
model L1ABTestVariant {
  id              String   @id @default(cuid())
  organizationId  String
  objectiveType   String   @db.VarChar(50)
  variantType     String   @db.VarChar(10)  // "A" or "B"
  messageTemplate String   @db.Text
  copyAngle       String   @db.VarChar(100)  // ← NOT variantName
  psychologyLens  String   @db.VarChar(50)
  totalSent       Int      @default(0)
  totalConverted  Int      @default(0)
  conversionRate  Float    @default(0)       // ← Float, not Decimal
  avgResponseTime Int?
  winningSince    DateTime?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### Issue #3.1: Missing 'variantName' Field

| Property | Value |
|----------|-------|
| **Error Type** | Field Reference Error |
| **Severity** | HIGH |
| **Pattern** | `variant.variantName` |
| **Actual Field** | `variant.copyAngle` |
| **Reason** | variantName was renamed to copyAngle for clarity |
| **Impact** | Undefined field access, template rendering fails |
| **Fix** | Replace `variantName` with `copyAngle` |

**Code Pattern**:
```typescript
// ❌ WRONG
const template = variant.variantName;  // undefined!
const message = `Using: ${variant.variantName}`;

// ✅ CORRECT
const template = variant.copyAngle;  // "가치재정의"
const message = `Using: ${variant.copyAngle}`;
```

### Issue #3.2: conversionRate Type Mismatch

| Property | Value |
|----------|-------|
| **Error Type** | Type Conversion Error |
| **Severity** | HIGH |
| **Field** | `conversionRate` |
| **Database Type** | Float (not Decimal) |
| **Expected JS Type** | number |
| **Problem** | Float may need precision handling; not directly usable in arithmetic without explicit conversion |
| **Fix** | `convertToDecimal(record.conversionRate)` |

**Code Pattern**:
```typescript
// ❌ POTENTIALLY WRONG - Float precision issues
const score = variant.conversionRate * 100;

// ✅ CORRECT - Explicit conversion for safety
const score = convertToDecimal(variant.conversionRate)! * 100;
```

---

## 4. CONTACTLENSSEQUENCE MODEL MISMATCHES

### Schema Definition
```prisma
model ContactLensSequence {
  id                String    @id @default(cuid())
  contactId         String
  organizationId    String
  classificationId  String
  sequenceType      String    @db.VarChar(20)
  lensType          String?   @db.VarChar(3)
  // ... day 0-3 fields ...
  conversionRevenue Decimal?  @db.Decimal(15, 2)  // ← NOT revenue
  status            String    @default("PENDING")
  // ... other fields ...
}
```

### Issue #4.1: Missing 'revenue' Field

| Property | Value |
|----------|-------|
| **Error Type** | Field Reference Error |
| **Severity** | MEDIUM |
| **Pattern** | `sequence.revenue` |
| **Actual Field** | `sequence.conversionRevenue` |
| **Reason** | Field was renamed for clarity |
| **Impact** | Revenue calculations fail |
| **Fix** | Replace `revenue` with `conversionRevenue` |

### Issue #4.2: conversionRevenue Type Mismatch

| Property | Value |
|----------|-------|
| **Error Type** | Type Conversion Error |
| **Severity** | HIGH |
| **Field** | `conversionRevenue` |
| **Database Type** | Decimal(15, 2), nullable |
| **Fix Pattern** | `convertToDecimal(record.conversionRevenue) || 0` |

**Code Pattern**:
```typescript
// ❌ WRONG
const totalRevenue = sequence.revenue || 0;
const avgRevenue = sequence.revenue / count;  // TypeError

// ✅ CORRECT
const totalRevenue = convertToDecimal(sequence.conversionRevenue) || 0;
const avgRevenue = (convertToDecimal(sequence.conversionRevenue) || 0) / count;
```

---

## 5. CONVERSION PATTERNS BY SCENARIO

### Pattern 1: Reading from Database (Query)

```typescript
import { convertToDecimal } from '@/lib/schema-fix-mapper';

// Get record
const record = await prisma.campaignCost.findUnique({ ... });

// Convert all Decimal fields immediately
const converted = {
  smsCostTotal: convertToDecimal(record.smsCostTotal),
  actualCostTotal: convertToDecimal(record.actualCostTotal),
  estimatedRoi: convertToDecimal(record.estimatedRoi),
};

// Use converted values
const total = converted.smsCostTotal! + converted.actualCostTotal!;
```

### Pattern 2: Arithmetic Operations

```typescript
// ❌ WRONG
const multiplied = record.conversionRate * 100;

// ✅ CORRECT
const multiplied = convertToDecimal(record.conversionRate)! * 100;

// ✅ ALSO CORRECT - with null safety
const multiplied = (convertToDecimal(record.conversionRate) || 0) * 100;
```

### Pattern 3: API Response Serialization

```typescript
import { convertToDecimal } from '@/lib/schema-fix-mapper';

// ❌ WRONG - Decimal serialization fails
res.json({
  cost: record.actualCostTotal,  // TypeError: Cannot convert to JSON
  roi: record.estimatedRoi
});

// ✅ CORRECT - Convert before serialization
res.json({
  cost: convertToDecimal(record.actualCostTotal),
  roi: convertToDecimal(record.estimatedRoi)
});
```

### Pattern 4: Database Inserts/Updates

```typescript
import { toDecimal } from '@/lib/schema-fix-mapper';

// ✅ CORRECT - Convert number back to Decimal for database
await prisma.campaignCost.update({
  where: { id },
  data: {
    actualCostTotal: toDecimal(125.50),
    estimatedRoi: toDecimal(2.5)
  }
});
```

### Pattern 5: Comparisons

```typescript
// ❌ WRONG - Type mismatch in comparison
if (record.estimatedRoi > 1.0) { ... }

// ✅ CORRECT - Convert before comparing
if (convertToDecimal(record.estimatedRoi)! > 1.0) { ... }
```

---

## 6. AFFECTED CODE LOCATIONS

### High-Risk Files (MUST FIX IMMEDIATELY)

```
1. src/lib/l1-optimization/response-selector.ts
   - Lines with: campaignCost.smsCostTotal, campaignCost.actualCostTotal
   - Fix: Wrap all Decimal fields with convertToDecimal()

2. src/lib/l1-optimization/score-updater.ts
   - Lines with: scoreRecord.currentScore
   - Fix: Convert Float field to number

3. src/lib/l1-optimization/sms-sender.ts
   - Lines with: variant.conversionRate, campaignCost.actualCostTotal
   - Fix: Convert both fields

4. src/app/api/l1-optimization/[...route].ts
   - Lines with: campaignCost.costPerSuccess, campaignCost.estimatedRoi
   - Fix: Convert before JSON response
```

### Medium-Risk Files (SHOULD FIX BEFORE RELEASE)

```
5. src/app/api/campaign/route.ts
   - If querying CampaignCost, verify all Decimal fields are converted

6. src/lib/crm-automation/contact-classifier.ts
   - If using ContactLensSequence.revenue, rename to conversionRevenue

7. src/lib/l1-optimization/ab-test-selector.ts
   - If using variant.variantName, replace with copyAngle
```

---

## 7. AUTOMATED FIX RULES

### Rule Set 1: Field Replacements

| Pattern | Replacement | Reason |
|---------|------------|--------|
| `\.campaignId` | `.channel` | SmsLog schema change |
| `\.cost([^A-Za-z])` | `.actualCostTotal$1` | CampaignCost field rename |
| `\.date([^A-Za-z])` | `.createdAt$1` | CampaignCost field rename |
| `\.variantName` | `.copyAngle` | L1ABTestVariant schema change |
| `\.revenue([^A-Za-z])` | `.conversionRevenue$1` | ContactLensSequence rename |

### Rule Set 2: Type Conversions

| Pattern | Replacement | Reason |
|---------|------------|--------|
| `campaignCost\.smsCostTotal` | `convertToDecimal(campaignCost.smsCostTotal)` | Decimal → number |
| `campaignCost\.emailCostTotal` | `convertToDecimal(campaignCost.emailCostTotal)` | Decimal → number |
| `campaignCost\.actualCostTotal` | `convertToDecimal(campaignCost.actualCostTotal)` | Decimal → number |
| `variant\.conversionRate` | `convertToDecimal(variant.conversionRate)` | Float precision |
| `sequence\.conversionRevenue` | `convertToDecimal(sequence.conversionRevenue)` | Decimal → number |

---

## 8. TESTING STRATEGY

### Test Case 1: CampaignCost Decimal Conversion

```typescript
describe('CampaignCost Decimal Conversions', () => {
  it('should convert smsCostTotal to number', async () => {
    const record = await prisma.campaignCost.findUnique({ ... });
    const converted = convertToDecimal(record.smsCostTotal);
    expect(typeof converted).toBe('number');
    expect(isNaN(converted || 0)).toBe(false);
  });

  it('should handle null conversion safely', async () => {
    const result = convertToDecimal(null);
    expect(result).toBeNull();
  });
});
```

### Test Case 2: L1ABTestVariant Field Names

```typescript
describe('L1ABTestVariant Field Names', () => {
  it('should use copyAngle not variantName', async () => {
    const variant = await prisma.l1ABTestVariant.findFirst({});
    expect(variant.copyAngle).toBeDefined();
    expect((variant as any).variantName).toBeUndefined();
  });
});
```

### Test Case 3: SmsLog Channel Field

```typescript
describe('SmsLog Channel Field', () => {
  it('should query by channel not campaignId', async () => {
    const logs = await prisma.smsLog.findMany({
      where: { channel: "FUNNEL" }
    });
    expect(logs.every(l => l.channel === "FUNNEL")).toBe(true);
  });
});
```

---

## 9. REFERENCE TABLES

### Complete Decimal Fields List

| Model | Field | Type | Precision | Null |
|-------|-------|------|-----------|------|
| CampaignCost | smsRateCurrent | Decimal | 10,2 | No |
| CampaignCost | smsCostTotal | Decimal | 12,2 | No |
| CampaignCost | emailRateCurrent | Decimal | 10,4 | No |
| CampaignCost | emailCostTotal | Decimal | 12,2 | No |
| CampaignCost | costPerSuccess | Decimal | 12,2 | No |
| CampaignCost | estimatedRevenue | Decimal | 15,2 | No |
| CampaignCost | estimatedRoi | Decimal | 7,2 | No |
| CampaignCost | actualCostTotal | Decimal | 12,2 | No |
| ContactLensSequence | conversionRevenue | Decimal | 15,2 | Yes |

### Complete Float Fields List

| Model | Field | Null |
|-------|-------|------|
| L1ABTestVariant | conversionRate | No |
| L1OptimizationScore | currentScore | No |
| L1OptimizationScore | successRate | No |
| Contact | ltvTotal | No |

---

## 10. IMPLEMENTATION CHECKLIST

- [ ] Review all 5 field replacement patterns
- [ ] Review all 10 Decimal/Float conversion patterns
- [ ] Run automated fix script: `npx ts-node scripts/apply-schema-fixes.ts --dry-run`
- [ ] Review proposed changes
- [ ] Apply fixes: `npx ts-node scripts/apply-schema-fixes.ts`
- [ ] Run type check: `npm run type-check`
- [ ] Run build: `npm run build`
- [ ] Run tests: `npm test`
- [ ] Review git diff
- [ ] Commit and push changes
- [ ] Monitor staging environment for runtime errors

---

**Document Status**: COMPLETE  
**Version**: 1.0  
**Last Updated**: 2026-05-26
