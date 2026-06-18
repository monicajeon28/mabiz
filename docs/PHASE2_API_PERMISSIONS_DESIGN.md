# Phase 2: 판매 대시보드 API 권한 필터링 설계 (2026-06-18)

**목표**: 판매원/대리점장/관리자가 각자 볼 수 있는 데이터만 API에서 반환하기
**난이도**: 초등학생 수준으로 설명 (기술용어 최소화)
**예상 라인 수**: 700줄 (4명 병렬 3시간)

---

## 📋 쉬운 설명

### 역할 3가지 이해하기

```
┌─────────────────────────────────────────┐
│ 관리자 (모니카, 저스틴)                  │
│ → 회사 전체 모든 데이터 봄               │
│ → 대리점 3개 모두 조회                    │
│ → 판매원 20명 모두 조회                   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 대리점장 (예: Team A 팀장)               │
│ → 자기 팀만 봄 (Team A)                  │
│ → Team A 판매원 5명만 조회               │
│ → Team A의 주문만 조회                   │
│ → 다른 팀 데이터는 보이지 않음           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 판매원 (예: 김철수)                     │
│ → 자기가 만든 페이지의 주문만 봄         │
│ → 다른 판매원 데이터는 보이지 않음       │
│ → 팀 전체 정산은 볼 수 없음              │
└─────────────────────────────────────────┘
```

---

## 🛠️ 구현할 파일 4개

### 1. `src/lib/sales-permissions.ts` (권한 함수 모음, ~150줄)

**목적**: "이 사람이 이 데이터를 봐도 되나?" 판단하는 함수들

```typescript
// ============================================
// 📌 권한 함수 1: 팀 데이터 조회 권한
// ============================================

export function canViewTeamData(userRole: string, userTeamId: string | null): boolean {
  // 관리자? → YES (전체 조회 권한)
  if (userRole === 'GLOBAL_ADMIN') return true;
  
  // 대리점장/판매원? → 자기 팀만 가능
  return !!userTeamId;
  
  // userTeamId가 없으면 → NO (팀 미배정)
}

// ============================================
// 📌 권한 함수 2: 월말 정산 권한 (관리자만)
// ============================================

export function canSettleCommission(userRole: string): boolean {
  // 관리자만 가능
  return userRole === 'GLOBAL_ADMIN';
}

// ============================================
// 📌 권한 함수 3: 이의 제기 권한
// ============================================

export function canDispute(userRole: string): boolean {
  // 관리자 또는 대리점장만 가능
  return userRole === 'GLOBAL_ADMIN' || userRole === 'OWNER';
}

// ============================================
// 📌 권한 함수 4: 데이터 필터 자동 생성
// ============================================

export function getAppliedFilters(
  userRole: string,
  userId: string,
  userTeamId: string | null
) {
  // 관리자? → 필터 없음 (모든 데이터)
  if (userRole === 'GLOBAL_ADMIN') {
    return {};
  }

  // 대리점장? → 자기 팀만
  if (userRole === 'OWNER') {
    return { teamId: userTeamId };
  }

  // 판매원? → 자기가 만든 것만
  if (userRole === 'AGENT') {
    return { createdBy: userId };
  }

  // 그 외? → 권한 없음
  return null;
}

// ============================================
// 📌 권한 함수 5: 데이터 마스킹
// ============================================

export function maskSensitiveData(data: any, userRole: string) {
  // 관리자가 아니면?
  if (userRole !== 'GLOBAL_ADMIN') {
    // 다른 사람의 비밀번호 숨김
    if (data.password) delete data.password;
    // 다른 사람의 이메일 숨김
    if (data.email) data.email = '***@***.***';
  }
  
  return data;
}
```

---

### 2. `src/app/api/sales/summary/route.ts` (대시보드 통계, ~120줄)

**목적**: "회사 전체/팀 전체/내 주문" 통계를 권한에 맞게 반환

```typescript
import { getServerSession } from 'next-auth/next';
import { canViewTeamData, getAppliedFilters } from '@/lib/sales-permissions';
import prisma from '@/lib/prisma';

// ============================================
// GET /api/sales/summary
// 예) /api/sales/summary?period=month
// ============================================

export async function GET(request: Request) {
  try {
    // 📌 Step 1: 현재 사용자 정보 가져오기
    const session = await getServerSession();
    
    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({ error: '로그인이 필요합니다' }),
        { status: 401 }
      );
    }

    // 현재 사용자의 역할, 팀 정보
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        teamId: true,
      },
    });

    if (!user) {
      return new Response(
        JSON.stringify({ error: '사용자를 찾을 수 없습니다' }),
        { status: 404 }
      );
    }

    // 📌 Step 2: 권한 체크
    if (!canViewTeamData(user.role, user.teamId)) {
      return new Response(
        JSON.stringify({ error: '팀 데이터를 볼 권한이 없습니다' }),
        { status: 403 }
      );
    }

    // 📌 Step 3: 필터 자동 적용
    const filters = getAppliedFilters(user.role, user.id, user.teamId);

    // 데이터를 못 조회하면 에러
    if (filters === null) {
      return new Response(
        JSON.stringify({ error: '권한이 없습니다' }),
        { status: 403 }
      );
    }

    // 📌 Step 4: 데이터 조회 (필터 적용됨)
    const summary = await prisma.order.groupBy({
      by: ['status'],
      where: filters, // ← 권한에 맞는 필터 자동 적용
      _count: {
        id: true,
      },
      _sum: {
        totalPrice: true,
      },
    });

    // 📌 Step 5: 응답 반환
    return new Response(
      JSON.stringify({
        success: true,
        data: summary,
        appliedRole: user.role, // 디버깅용: 누구로 조회했는지
      }),
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ /api/sales/summary 오류:', error);
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했습니다' }),
      { status: 500 }
    );
  }
}
```

---

### 3. `src/app/api/sales/team-members/route.ts` (팀원 목록, ~140줄)

**목적**: 관리자는 전체 팀원, 대리점장은 자기 팀원만 조회

```typescript
import { getServerSession } from 'next-auth/next';
import { canViewTeamData, getAppliedFilters, maskSensitiveData } from '@/lib/sales-permissions';
import prisma from '@/lib/prisma';

// ============================================
// GET /api/sales/team-members
// 예) /api/sales/team-members?teamId=team_123
// ============================================

export async function GET(request: Request) {
  try {
    // 📌 Step 1: 사용자 정보 가져오기
    const session = await getServerSession();
    
    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({ error: '로그인이 필요합니다' }),
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        teamId: true,
      },
    });

    if (!user) {
      return new Response(
        JSON.stringify({ error: '사용자를 찾을 수 없습니다' }),
        { status: 404 }
      );
    }

    // 📌 Step 2: URL에서 팀ID 가져오기
    const { searchParams } = new URL(request.url);
    const requestedTeamId = searchParams.get('teamId');

    // 📌 Step 3: 권한 체크 (자신의 팀이 아닌데 조회하려면?)
    if (user.role !== 'GLOBAL_ADMIN' && requestedTeamId && requestedTeamId !== user.teamId) {
      return new Response(
        JSON.stringify({ 
          error: '다른 팀의 데이터를 볼 권한이 없습니다' 
        }),
        { status: 403 }
      );
    }

    // 📌 Step 4: 데이터 조회
    let teamFilter = {};

    if (user.role === 'GLOBAL_ADMIN') {
      // 관리자 → 전체 또는 특정 팀만
      if (requestedTeamId) {
        teamFilter = { teamId: requestedTeamId };
      }
    } else {
      // 대리점장/판매원 → 자기 팀만
      teamFilter = { teamId: user.teamId };
    }

    const teamMembers = await prisma.user.findMany({
      where: teamFilter,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        teamId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // 📌 Step 5: 데이터 마스킹 (비밀 정보 숨김)
    const maskedMembers = teamMembers.map(member =>
      maskSensitiveData(member, user.role)
    );

    // 📌 Step 6: 응답 반환
    return new Response(
      JSON.stringify({
        success: true,
        count: maskedMembers.length,
        data: maskedMembers,
      }),
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ /api/sales/team-members 오류:', error);
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했습니다' }),
      { status: 500 }
    );
  }
}
```

---

### 4. `src/app/api/sales/commission-settle/route.ts` (월말 정산, ~150줄)

**목적**: 관리자만 월말 정산 기록 생성/조회

```typescript
import { getServerSession } from 'next-auth/next';
import { canSettleCommission } from '@/lib/sales-permissions';
import prisma from '@/lib/prisma';

// ============================================
// GET /api/sales/commission-settle
// 예) /api/sales/commission-settle?month=202406
// ============================================

export async function GET(request: Request) {
  try {
    // 📌 Step 1: 사용자 정보 가져오기
    const session = await getServerSession();
    
    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({ error: '로그인이 필요합니다' }),
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      return new Response(
        JSON.stringify({ error: '사용자를 찾을 수 없습니다' }),
        { status: 404 }
      );
    }

    // 📌 Step 2: 권한 체크 (관리자만)
    if (!canSettleCommission(user.role)) {
      return new Response(
        JSON.stringify({ 
          error: '정산 권한이 없습니다 (관리자만 가능)' 
        }),
        { status: 403 }
      );
    }

    // 📌 Step 3: 월별 정산 데이터 조회
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || '202406'; // YYYYMM 형식

    const settlements = await prisma.commissionSettlement.findMany({
      where: {
        // Month 필터 (202406 → 2024-06)
        month: month,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 📌 Step 4: 응답 반환
    return new Response(
      JSON.stringify({
        success: true,
        month: month,
        count: settlements.length,
        data: settlements,
      }),
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ /api/sales/commission-settle 오류:', error);
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했습니다' }),
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/sales/commission-settle
// 목적: 월말 정산 생성 (관리자만)
// 예) POST { month: '202406' }
// ============================================

export async function POST(request: Request) {
  try {
    // 📌 Step 1: 사용자 정보 가져오기
    const session = await getServerSession();
    
    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({ error: '로그인이 필요합니다' }),
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      return new Response(
        JSON.stringify({ error: '사용자를 찾을 수 없습니다' }),
        { status: 404 }
      );
    }

    // 📌 Step 2: 권한 체크 (관리자만)
    if (!canSettleCommission(user.role)) {
      return new Response(
        JSON.stringify({ 
          error: '정산 권한이 없습니다 (관리자만 가능)' 
        }),
        { status: 403 }
      );
    }

    // 📌 Step 3: 요청 데이터 파싱
    const body = await request.json();
    const { month } = body;

    if (!month || !/^\d{6}$/.test(month)) {
      return new Response(
        JSON.stringify({ error: '월 형식이 잘못되었습니다 (YYYYMM)' }),
        { status: 400 }
      );
    }

    // 📌 Step 4: 중복 체크 (같은 달 정산 이미 있나?)
    const existing = await prisma.commissionSettlement.findFirst({
      where: { month: month },
    });

    if (existing) {
      return new Response(
        JSON.stringify({ 
          error: `${month}월 정산이 이미 있습니다` 
        }),
        { status: 400 }
      );
    }

    // 📌 Step 5: 정산 기록 생성
    const settlement = await prisma.commissionSettlement.create({
      data: {
        month: month,
        status: 'PENDING', // 검토 대기 중
        createdBy: user.id,
      },
    });

    // 📌 Step 6: 응답 반환
    return new Response(
      JSON.stringify({
        success: true,
        data: settlement,
      }),
      { status: 201 }
    );

  } catch (error) {
    console.error('❌ /api/sales/commission-settle POST 오류:', error);
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했습니다' }),
      { status: 500 }
    );
  }
}
```

---

## 🎯 TypeScript 타입 정의 추가 (선택, ~100줄)

`src/types/sales.ts`에 아래 타입 추가:

```typescript
// ============================================
// 📌 역할 타입
// ============================================

export type UserRole = 'GLOBAL_ADMIN' | 'OWNER' | 'AGENT' | 'FREE_SALES';

export interface SalesUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teamId: string | null;
}

// ============================================
// 📌 권한 체크 결과
// ============================================

export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
  appliedFilters?: Record<string, any>;
}

// ============================================
// 📌 API 응답 타입
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  appliedRole?: UserRole;
}

export interface OrderSummary {
  status: string;
  _count: { id: number };
  _sum: { totalPrice: number | null };
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teamId: string | null;
  createdAt: Date;
}

export interface CommissionSettlement {
  id: string;
  month: string;
  status: 'PENDING' | 'APPROVED' | 'PAID';
  createdBy: string;
  createdAt: Date;
}
```

---

## 📊 구현 순서 & 체크리스트

### Phase 2 구현 (3시간, 4명 병렬)

| 에이전트 | 파일 | 라인 | 작업 내용 |
|---------|------|------|---------|
| **Agent-LIB** | `src/lib/sales-permissions.ts` | 150줄 | 5가지 권한 함수 구현 |
| **Agent-API-1** | `src/app/api/sales/summary/route.ts` | 120줄 | 대시보드 통계 API |
| **Agent-API-2** | `src/app/api/sales/team-members/route.ts` | 140줄 | 팀원 목록 API |
| **Agent-API-3** | `src/app/api/sales/commission-settle/route.ts` | 150줄 | 정산 API (GET/POST) |
| **(선택)** | `src/types/sales.ts` | 100줄 | TypeScript 타입 (검증용) |

### 구현 전 체크리스트

- [ ] Prisma 스키마에 `CommissionSettlement` 모델 있나?
  ```prisma
  model CommissionSettlement {
    id        String   @id @default(cuid())
    month     String   // "202406" 형식
    status    String   // PENDING | APPROVED | PAID
    createdBy String
    createdAt DateTime @default(now())
    user      User     @relation(fields: [createdBy], references: [id])
  }
  ```
- [ ] User 모델에 `teamId` 필드 있나?
- [ ] Order 모델에 `createdBy`, `teamId` 필드 있나?

### 구현 후 검증 (TSC)

```powershell
# 타입 체크 (dev 서버 실행 중에도 안전)
npx tsc --noEmit

# Prisma 타입 재생성
npx prisma generate
```

### 권한 테스트 시나리오

```
1️⃣ 관리자 (GLOBAL_ADMIN)
   GET /api/sales/summary → 전체 데이터 조회 ✅
   GET /api/sales/team-members → 모든 팀원 조회 ✅
   POST /api/sales/commission-settle → 정산 생성 ✅

2️⃣ 대리점장 (OWNER, Team A)
   GET /api/sales/summary → Team A 데이터만 조회 ✅
   GET /api/sales/team-members?teamId=team_a → Team A 팀원만 ✅
   GET /api/sales/team-members?teamId=team_b → 403 권한 없음 ✅
   POST /api/sales/commission-settle → 403 권한 없음 ✅

3️⃣ 판매원 (AGENT, 김철수)
   GET /api/sales/summary → 자신의 주문만 조회 ✅
   GET /api/sales/team-members → 403 권한 없음 ✅
   POST /api/sales/commission-settle → 403 권한 없음 ✅
```

---

## 🚀 구현 지시사항 (구현자용)

### Agent-LIB (sales-permissions.ts)

```
1. 새 파일 생성: src/lib/sales-permissions.ts

2. 5가지 함수 복사 (위 코드에서)
   - canViewTeamData()
   - canSettleCommission()
   - canDispute()
   - getAppliedFilters()
   - maskSensitiveData()

3. 각 함수에 주석 포함 (이미 위에 있음)

4. 타입 추가 (선택)
   export interface SalesPermission { ... }

5. 엑스포트
   export { canViewTeamData, canSettleCommission, ... }

6. 검증
   npx tsc --noEmit
```

### Agent-API-1 (summary/route.ts)

```
1. 새 폴더: src/app/api/sales/summary/
2. 새 파일: route.ts (위 코드 복사)
3. 임포트 수정
   - @/lib/sales-permissions
   - @/lib/prisma
   - next-auth/next
4. GET 함수만 먼저 구현
5. 테스트: GET http://localhost:3000/api/sales/summary
6. 검증: npx tsc --noEmit
```

### Agent-API-2 (team-members/route.ts)

```
1. 새 폴더: src/app/api/sales/team-members/
2. 새 파일: route.ts (위 코드 복사)
3. 임포트 수정
4. GET 함수 구현
5. 테스트: GET http://localhost:3000/api/sales/team-members
6. 권한 테스트 (다른 팀ID로)
7. 검증: npx tsc --noEmit
```

### Agent-API-3 (commission-settle/route.ts)

```
1. 새 폴더: src/app/api/sales/commission-settle/
2. 새 파일: route.ts (위 코드 복사)
3. GET + POST 함수 모두 구현
4. 테스트: 
   - GET /api/sales/commission-settle?month=202406
   - POST /api/sales/commission-settle { month: "202406" }
5. 중복 체크 확인
6. 검증: npx tsc --noEmit
```

---

## ⚠️ 주의사항

### 절대 하면 안 되는 것

```
❌ npm run build 하면 안 됨 (EBUSY 오류)
❌ prisma/schema.prisma 수정하면 안 됨 (이미 정의됨)
❌ 다른 도메인 파일 건드리면 안 됨
❌ getAppliedFilters 함수 이름 바꾸면 안 됨 (다른 곳에서 사용)
❌ Role 타입 값 바꾸면 안 됨 (DB와 일치해야 함)
```

### TSC 검증 (필수)

```powershell
# 파일 저장 후 반드시 실행
npx tsc --noEmit

# 오류 0개가 나올 때까지
# 만약 오류 나면:
# - 임포트 경로 확인
# - 함수 시그니처 확인
# - null 타입 체크
```

---

## 📚 참고자료

- **User 모델**: `prisma/schema.prisma` (role, teamId 필드 확인)
- **Order 모델**: `prisma/schema.prisma` (createdBy, teamId, totalPrice 필드 확인)
- **테스트**: `/tests/api/sales/` (예제 테스트 파일)

---

**최종 검증**:
```
✅ TSC 0에러
✅ API 4개 모두 테스트
✅ 권한 3가지 (관리자/대리점장/판매원) 테스트
✅ 403, 404, 400 에러 케이스 확인
✅ 데이터 마스킹 확인
```

---

**작성 일**: 2026-06-18
**버전**: 1.0 (Phase 2 초기 설계)
**다음**: Phase 3 프론트엔드 UI 설계
