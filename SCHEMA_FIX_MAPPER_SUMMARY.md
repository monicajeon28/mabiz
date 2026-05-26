# Schema Fix Mapper - Quick Reference

**Created**: 2026-05-26  
**Status**: ✅ READY FOR DEPLOYMENT  
**Deliverables**: 3 main files + documentation

---

## Files Created

### 1. `src/lib/schema-fix-mapper.ts` (Core Mapper)

TypeScript module containing:
- `SCHEMA_FIXES` constant: Field name mappings (5 fixes)
- `DECIMAL_FIELDS` array: All Decimal fields needing conversion (9 fields)
- `convertToDecimal()` function: Convert any value to number safely
- `toDecimal()` function: Convert number to Decimal for database inserts
- `FILE_FIXES` object: File-by-file fix suggestions with line numbers
- `BATCH_FIX_CONFIG`: Automated fix rules for batch processing
- Helper functions: `applyFieldFix()`, `applyAllFieldFixes()`, `convertDecimalFields()`

**Usage**:
```typescript
import { convertToDecimal, SCHEMA_FIXES } from '@/lib/schema-fix-mapper';

// Convert Decimal to number
const cost = convertToDecimal(record.actualCostTotal);

// Apply field fixes
const fixed = applyAllFieldFixes(record, 'CampaignCost');
```

### 2. `scripts/apply-schema-fixes.ts` (Automated Fixer)

Batch processing script that:
- Scans all TypeScript files for schema mismatches
- Applies automatic replacements using regex patterns
- Adds required imports
- Verifies changes
- Supports dry-run mode

**Usage**:
```bash
# Preview changes
npx ts-node scripts/apply-schema-fixes.ts --dry-run

# Apply all fixes
npx ts-node scripts/apply-schema-fixes.ts

# Fix single file
npx ts-node scripts/apply-schema-fixes.ts --file src/lib/file.ts

# Verbose output
npx ts-node scripts/apply-schema-fixes.ts --verbose
```

### 3. Documentation Files

**SCHEMA_FIX_GUIDE.md**
- Complete user guide
- 10 sections covering overview, mismatches, utilities, validation
- Troubleshooting section
- Code review checklist
- Prevention strategies

**SCHEMA_MISMATCHES_TECHNICAL_SPEC.md**
- Complete technical reference
- All 15 mismatches detailed
- Conversion patterns by scenario
- Testing strategy
- Implementation checklist

**SCHEMA_FIX_MAPPER_SUMMARY.md**
- This file
- Quick reference
- Deployment checklist

---

## Identified Mismatches (Summary)

### 1. SmsLog Model
- ❌ `campaignId` field doesn't exist
- ✅ Use `channel` instead

### 2. CampaignCost Model
- ❌ `date` field doesn't exist → ✅ Use `createdAt` or `calculatedAt`
- ❌ `cost` field doesn't exist → ✅ Use `actualCostTotal`
- ❌ All 8 Decimal fields need type conversion → ✅ Use `convertToDecimal()`

### 3. L1ABTestVariant Model
- ❌ `variantName` field doesn't exist → ✅ Use `copyAngle`
- ❌ `conversionRate` (Float) needs conversion → ✅ Use `convertToDecimal()`

### 4. ContactLensSequence Model
- ❌ `revenue` field doesn't exist → ✅ Use `conversionRevenue`
- ❌ `conversionRevenue` (Decimal) needs conversion → ✅ Use `convertToDecimal()`

---

## Quick Start Guide

### Option A: Automated Fix (Recommended)

```bash
# Step 1: Dry run to preview changes
npx ts-node scripts/apply-schema-fixes.ts --dry-run

# Step 2: Review output and verify patterns are correct

# Step 3: Apply all fixes
npx ts-node scripts/apply-schema-fixes.ts

# Step 4: Validate
npm run type-check
npm run build
npm test
```

### Option B: Manual Fix

1. Read: `SCHEMA_FIX_GUIDE.md` section 4 (Manual Checklist)
2. For each affected file:
   - Replace field names from `SCHEMA_FIXES` mapping
   - Wrap Decimal fields with `convertToDecimal()`
   - Add import: `import { convertToDecimal } from '@/lib/schema-fix-mapper';`
3. Validate with type-check and build

### Option C: Code Review First

1. Share `SCHEMA_MISMATCHES_TECHNICAL_SPEC.md` with team
2. Discuss impact in section 6 (Affected Locations)
3. Assign fixes to team members
4. Review against section 9 (Implementation Checklist)

---

## Validation Checklist

Before deploying to production:

```bash
# Type checking
npm run type-check  # Should pass with 0 errors

# Build test
npm run build       # Should complete successfully

# Unit tests
npm test            # All tests should pass

# Lint
npm run lint        # Should pass

# Manual review
git diff            # Review all changes

# Verify fixes
npx ts-node scripts/apply-schema-fixes.ts --dry-run --verbose
# Should show 0 remaining issues
```

---

## Key Statistics

| Metric | Value |
|--------|-------|
| Total Mismatches | 15 |
| Models Affected | 4 |
| Field Name Errors | 5 |
| Type Conversion Errors | 10 |
| High Priority Files | 4 |
| Medium Priority Files | 3 |
| Decimal Fields | 9 |
| Float Fields | 4 |
| Estimated Fix Time (manual) | 1-2 hours |
| Estimated Fix Time (automated) | 5 minutes |

---

## Prevention Going Forward

### Code Review Checklist

When reviewing PRs affecting these models:

- [ ] Field names match schema.prisma exactly
- [ ] All Decimal fields wrapped with `convertToDecimal()`
- [ ] All Float fields used in arithmetic wrapped with `convertToDecimal()`
- [ ] No direct JSON serialization of Decimal objects
- [ ] Import statement includes utility functions

### Pre-commit Hook

Add to `.husky/pre-commit`:
```bash
#!/bin/sh
npx ts-node scripts/apply-schema-fixes.ts --dry-run --verbose || exit 1
```

### Testing Template

```typescript
it('should convert Decimal fields to numbers', async () => {
  const record = await prisma.model.findUnique({ ... });
  const num = convertToDecimal(record.decimalField);
  expect(typeof num).toBe('number');
});
```

---

## Support & Troubleshooting

### Common Issues

**Q: "Cannot multiply Decimal with number"**  
A: Wrap Decimal with `convertToDecimal()`: `convertToDecimal(field)! * num`

**Q: "Field is undefined"**  
A: Check field name against schema.prisma; use correct name from SCHEMA_FIXES mapping

**Q: "JSON serialization fails"**  
A: Convert Decimal to number before JSON.stringify(): `convertToDecimal(field)`

### More Help

- See: `SCHEMA_FIX_GUIDE.md` section 8 (Troubleshooting)
- See: `SCHEMA_MISMATCHES_TECHNICAL_SPEC.md` section 5 (Conversion Patterns)

---

## Deployment Path

1. **Day 1**: Review documentation, understand scope
2. **Day 2**: Run automated fixes with dry-run
3. **Day 3**: Apply fixes, run validation
4. **Day 4**: Code review and testing
5. **Day 5**: Deploy to staging
6. **Day 6**: Smoke testing on staging
7. **Day 7**: Deploy to production

---

## Files Reference

```
D:\mabiz-crm\
├── src\lib\
│   └── schema-fix-mapper.ts                    (Core mapper - 400 lines)
├── scripts\
│   └── apply-schema-fixes.ts                   (Auto-fixer - 300 lines)
├── SCHEMA_FIX_GUIDE.md                         (User guide - 400 lines)
├── SCHEMA_MISMATCHES_TECHNICAL_SPEC.md         (Technical spec - 700 lines)
└── SCHEMA_FIX_MAPPER_SUMMARY.md                (This file)
```

**Total Documentation**: ~1,800 lines  
**Total Code**: ~700 lines

---

## Success Criteria

✅ All 15 schema mismatches identified and documented  
✅ Automated fix script created and tested  
✅ Conversion utilities implemented  
✅ Complete documentation provided  
✅ Manual fix checklist available  
✅ Testing strategy defined  
✅ Prevention mechanisms in place  
✅ Deployment path documented  

---

## Version History

| Date | Version | Status | Notes |
|------|---------|--------|-------|
| 2026-05-26 | 1.0 | ✅ FINAL | Initial release with all 15 mismatches |

---

**Ready for deployment!** 🚀

Questions? See the detailed documentation files or contact the development team.
