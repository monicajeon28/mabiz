# Menu #48 Metrics Route Type Error Fix

## Problem

`src/app/api/menu-48/metrics/route.ts` had 3 functions with incorrect names that violated Next.js routing conventions:

```typescript
export async function GET_BREAKDOWN(request: NextRequest) { }  // ❌ Invalid
export async function GET_SMS_PERFORMANCE(request: NextRequest) { }  // ❌ Invalid
```

TypeScript error: **"'GET_BREAKDOWN' is incompatible with index signature"**

## Root Cause

Next.js only accepts standard HTTP method exports in route files:
- `GET`, `POST`, `PATCH`, `DELETE`, `PUT`, `HEAD`, `OPTIONS`

Custom function names like `GET_BREAKDOWN` are not recognized as valid route handlers and cause type errors.

## Solution

**Split into separate route files** following Next.js App Router conventions:

### File Structure (After Fix)

```
src/app/api/menu-48/metrics/
├── route.ts                  (Main endpoint: GET /api/menu-48/metrics)
├── breakdown/
│   └── route.ts              (Breakdown: GET /api/menu-48/metrics/breakdown)
└── sms-performance/
    └── route.ts              (SMS: GET /api/menu-48/metrics/sms-performance)
```

### Changes Made

#### 1. Main Route - `/metrics/route.ts`
- Kept: `export async function GET()`
- Removed: `GET_BREAKDOWN()`, `GET_SMS_PERFORMANCE()`
- Endpoint: `GET /api/menu-48/metrics`

#### 2. New Route - `/metrics/breakdown/route.ts`
- Created with: `export async function GET()` (renamed from `GET_BREAKDOWN`)
- Endpoint: `GET /api/menu-48/metrics/breakdown`
- Returns: `{ stages: Array<{ stage: string; count: number }> }`

#### 3. New Route - `/metrics/sms-performance/route.ts`
- Created with: `export async function GET()` (renamed from `GET_SMS_PERFORMANCE`)
- Endpoint: `GET /api/menu-48/metrics/sms-performance`
- Returns: `{ smsPerformance: Array<{ day: number; openRate: number; ... }> }`

## Benefits

1. ✅ **Type safety** - No more TypeScript errors
2. ✅ **Next.js compliance** - Follows official App Router patterns
3. ✅ **Separation of concerns** - Each endpoint in its own file
4. ✅ **Maintainability** - Easier to test and modify individual endpoints
5. ✅ **Scalability** - Easy to add new metrics endpoints

## Client Usage

No changes required to API client code - URLs remain the same:

```typescript
// Unchanged
fetch('/api/menu-48/metrics')
fetch('/api/menu-48/metrics/breakdown')
fetch('/api/menu-48/metrics/sms-performance')
```

## Files Modified

| File | Status | Change |
|------|--------|--------|
| `src/app/api/menu-48/metrics/route.ts` | Modified | Removed 2 functions |
| `src/app/api/menu-48/metrics/breakdown/route.ts` | Created | New route file |
| `src/app/api/menu-48/metrics/sms-performance/route.ts` | Created | New route file |

## Verification

Run TypeScript compiler to verify fix:

```bash
npm run build
# or
yarn build
```

No type errors should appear for menu-48 metrics routes.
