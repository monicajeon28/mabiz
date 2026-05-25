# Family Routes Fix Plan - 4개 API 에러 파일 복구

## 개요
4개의 API 라우트 파일이 존재하지 않는 함수 `validateOrganizationRequest`를 `@/lib/auth-utils`에서 import하려고 해서 빌드 에러 발생.

**문제 파일:**
1. `src/app/api/my/family-analytics/route.ts`
2. `src/app/api/my/family-assessment/route.ts`
3. `src/app/api/my/family-assessment/score/route.ts`
4. `src/app/api/sms/family-persuasion/route.ts`

---

## 분석 결과

### 1. 오류 원인
각 파일에서 Line 3:
```typescript
import { validateOrganizationRequest } from '@/lib/auth-utils';
```

**문제점:**
- `auth-utils.ts` 파일이 존재하지 않음
- `validateOrganizationRequest` 함수는 어디에도 정의되지 않음
- 코드베이스의 auth 패턴과 맞지 않음

### 2. 사용 위치
각 파일의 POST/GET 핸들러에서:
```typescript
const { organizationId } = await validateOrganizationRequest(req);
```

**함수의 목적:**
- NextRequest를 받아서 organizationId를 추출
- 세션 검증 및 조직 ID 강제 획득

### 3. 올바른 패턴 (코드베이스에서 검증됨)

**현재 코드베이스의 올바른 패턴:**
```typescript
// src/app/api/my/affiliate/route.ts
import { getAuthContext, requireOrgId } from '@/lib/rbac';

export async function GET() {
  const ctx = await getAuthContext();  // 세션 검증 + 권한 로드
  const orgId = requireOrgId(ctx);     // organizationId 강제 획득
  // ...
}
```

**관련 파일 위치:**
- `src/lib/rbac.ts` - `getAuthContext()`, `requireOrgId()` 정의
- `src/lib/auth.ts` - `getMabizSession()` 정의 (내부용)

---

## 각 파일별 수정 방법

### File 1: `src/app/api/my/family-analytics/route.ts`

**현재 (에러):**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateOrganizationRequest } from '@/lib/auth-utils';  // ❌ 에러
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await validateOrganizationRequest(req);
    // ...
```

**수정 후:**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const organizationId = requireOrgId(ctx);
    // ...
```

**변경 사항:**
- Line 3: `import { validateOrganizationRequest } from '@/lib/auth-utils'` → `import { getAuthContext, requireOrgId } from '@/lib/rbac'`
- Line 7-8: 두 줄의 함수 호출을 `getAuthContext()` 및 `requireOrgId()` 호출로 변경

---

### File 2: `src/app/api/my/family-assessment/route.ts`

**현재 (에러):**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateOrganizationRequest } from '@/lib/auth-utils';  // ❌ 에러
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const { organizationId } = await validateOrganizationRequest(req);
    // ...
```

**수정 후:**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const organizationId = requireOrgId(ctx);
    // ...
```

**변경 사항:**
- Line 3: 동일 import 경로 변경
- Line 8-9: 함수 호출 변경 (POST와 GET 두 곳 모두)

**GET 함수도 동일하게 수정:**
```typescript
export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const organizationId = requireOrgId(ctx);
    // ...
```

---

### File 3: `src/app/api/my/family-assessment/score/route.ts`

**현재 (에러):**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateOrganizationRequest } from '@/lib/auth-utils';  // ❌ 에러
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const { organizationId } = await validateOrganizationRequest(req);
    // ...
```

**수정 후:**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const organizationId = requireOrgId(ctx);
    // ...
```

**변경 사항:**
- Line 3: 동일 import 경로 변경
- Line 8-9: 함수 호출 변경

---

### File 4: `src/app/api/sms/family-persuasion/route.ts`

**현재 (에러):**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateOrganizationRequest } from '@/lib/auth-utils';  // ❌ 에러
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const { organizationId } = await validateOrganizationRequest(req);
    // ...
```

**수정 후:**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const organizationId = requireOrgId(ctx);
    // ...
```

**변경 사항:**
- Line 3: 동일 import 경로 변경
- Line 8-9: 함수 호출 변경

---

## 요약 테이블

| 파일 | Import 변경 | 함수 호출 변경 |
|-----|-----------|-------------|
| `family-analytics/route.ts` | ✅ `@/lib/auth-utils` → `@/lib/rbac` | ✅ `validateOrganizationRequest(req)` → `getAuthContext()` + `requireOrgId(ctx)` |
| `family-assessment/route.ts` | ✅ 동일 | ✅ 동일 (POST + GET 2곳) |
| `family-assessment/score/route.ts` | ✅ 동일 | ✅ 동일 |
| `family-persuasion/route.ts` | ✅ 동일 | ✅ 동일 |

---

## 왜 이 패턴인가?

### 1. **getAuthContext()**
- 현재 사용자의 세션을 검증
- **실패하면:** Error throw → 자동으로 catch 블록에서 처리 → 500 응답
- 회원 정보, 역할, 조직 ID 등을 포함하는 `AuthContext` 반환

### 2. **requireOrgId(ctx)**
- AuthContext에서 organizationId를 추출
- **실패하면:** Error throw (organizationId가 null이면)
- 자동으로 catch 블록에서 처리 → 500 응답

### 3. **기존 코드의 에러 처리**
```typescript
catch (error) {
    logger.error('[POST /api/my/family-assessment]', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return NextResponse.json(
      { error: 'Failed to complete family assessment' },
      { status: 500 }
    );
}
```
- getAuthContext() / requireOrgId()의 Error도 자동으로 catch됨
- 500 응답으로 통일됨 ✅

---

## 검증: 기존 패턴 확인

**`src/app/api/my/sales/route.ts` (작동 중):**
```typescript
import { getAuthContext, requireOrgId } from '@/lib/rbac';

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const { searchParams } = new URL(req.url);
    // 코드...
  } catch (error) {
    // 에러 처리
  }
}
```

**`src/app/api/my/affiliate/route.ts` (작동 중):**
```typescript
import { getAuthContext } from '@/lib/rbac';

export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (ctx.mallUser) {
      // ...
    }
  }
}
```

→ 4개 에러 파일도 동일한 패턴으로 변경하면 빌드 성공 ✅

---

## 실행 순서

1. **`src/app/api/my/family-analytics/route.ts`** 수정
2. **`src/app/api/my/family-assessment/route.ts`** 수정
3. **`src/app/api/my/family-assessment/score/route.ts`** 수정
4. **`src/app/api/sms/family-persuasion/route.ts`** 수정
5. 빌드 테스트: `npm run build` 또는 `yarn build`
6. (선택) 로컬 테스트: `npm run dev` → API 엔드포인트 호출 테스트

---

## 추가 정보: 권한 검증

필요시 추가 권한 검증:

```typescript
const ctx = await getAuthContext();
const organizationId = requireOrgId(ctx);

// 조직만 접근 가능한 API (AGENT도 가능)
if (ctx.role === 'FREE_SALES') {
  return NextResponse.json({ error: 'No access' }, { status: 403 });
}

// OWNER 이상만 (관리 권한)
if (ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
  return NextResponse.json({ error: 'Owner required' }, { status: 403 });
}
```

**현재 4개 파일:** 권한 검증 불필요 (조직 내 모든 구성원이 가족 설득 기능 사용 가능)

---

## 결론

| 항목 | 설명 |
|-----|------|
| **근본 원인** | 비존재 함수 `validateOrganizationRequest` import |
| **올바른 함수** | `getAuthContext()` + `requireOrgId()` from `@/lib/rbac` |
| **영향받는 파일** | 4개 |
| **예상 수정 시간** | ~5분 |
| **테스트 방법** | `npm run build` 또는 `yarn build` |
