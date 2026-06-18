# Phase 2-3 통합 구현 가이드 (2026-06-18)

**대상**: 4명 병렬 개발자 (6-8시간, 100% 자동화 전제)
**난이도**: 초등학생 수준 코드 (주석 완전 포함)
**검증**: TSC 0에러 + API 테스트 3개

---

## 📋 구현 순서 (병렬 실행)

```
Phase 2: API 권한 필터링 (3시간)
├── Agent-LIB   → src/lib/sales-permissions.ts      (150줄)
├── Agent-API-1 → src/app/api/sales/summary/route.ts      (120줄)
├── Agent-API-2 → src/app/api/sales/team-members/route.ts (140줄)
└── Agent-API-3 → src/app/api/sales/commission-settle/route.ts (150줄)

Phase 3: 프론트엔드 UI (4시간)
├── Agent-UI-1 → src/app/(dashboard)/sales/page.tsx (220줄)
├── Agent-UI-2 → src/components/sales/DashboardHero.tsx (180줄)
├── Agent-UI-3 → src/components/sales/OrderStatusTabs.tsx (200줄)
└── Agent-UI-4 → src/components/sales/CommissionSection.tsx (200줄)
```

---

## ⚙️ Phase 2: API 권한 필터링 (3시간)

### Task 1: Agent-LIB (src/lib/sales-permissions.ts)

**목적**: 5가지 권한 함수 만들기

**체크리스트**:
```
- [ ] 파일 생성: src/lib/sales-permissions.ts
- [ ] 함수 1: canViewTeamData() → boolean (팀 조회 권한)
- [ ] 함수 2: canSettleCommission() → boolean (정산 권한)
- [ ] 함수 3: canDispute() → boolean (이의 제기 권한)
- [ ] 함수 4: getAppliedFilters() → object (자동 필터 생성)
- [ ] 함수 5: maskSensitiveData() → object (민감정보 숨김)
- [ ] 임포트: export { ... }
- [ ] 검증: npx tsc --noEmit
```

**코드 템플릿**:
```typescript
// 📌 함수 1: 팀 조회 권한
export function canViewTeamData(userRole: string, userTeamId: string | null): boolean {
  if (userRole === 'GLOBAL_ADMIN') return true;
  return !!userTeamId;
}

// 📌 함수 2: 정산 권한 (관리자만)
export function canSettleCommission(userRole: string): boolean {
  return userRole === 'GLOBAL_ADMIN';
}

// 📌 함수 3: 이의 제기 권한 (관리자, 대리점장)
export function canDispute(userRole: string): boolean {
  return userRole === 'GLOBAL_ADMIN' || userRole === 'OWNER';
}

// 📌 함수 4: 데이터 필터 자동 생성
export function getAppliedFilters(
  userRole: string,
  userId: string,
  userTeamId: string | null
) {
  if (userRole === 'GLOBAL_ADMIN') return {};
  if (userRole === 'OWNER') return { teamId: userTeamId };
  if (userRole === 'AGENT') return { createdBy: userId };
  return null;
}

// 📌 함수 5: 민감정보 숨김
export function maskSensitiveData(data: any, userRole: string) {
  if (userRole !== 'GLOBAL_ADMIN') {
    if (data.password) delete data.password;
    if (data.email) data.email = '***@***.***';
  }
  return data;
}
```

**소요 시간**: 30분

---

### Task 2: Agent-API-1 (src/app/api/sales/summary/route.ts)

**목적**: 대시보드 통계 API (GET만)

**폴더 생성**:
```
src/app/api/sales/
└── summary/
    └── route.ts
```

**체크리스트**:
```
- [ ] 폴더 생성: src/app/api/sales/summary/
- [ ] 파일 생성: route.ts
- [ ] Step 1: 세션 확인 (로그인 여부)
- [ ] Step 2: 사용자 정보 조회 (role, teamId)
- [ ] Step 3: canViewTeamData() 권한 체크
- [ ] Step 4: getAppliedFilters() 필터 적용
- [ ] Step 5: prisma.order.groupBy() 데이터 조회
- [ ] Step 6: JSON 응답 반환
- [ ] 에러 처리: 401, 403, 404, 500
- [ ] 검증: npx tsc --noEmit
```

**코드 템플릿**:
```typescript
import { getServerSession } from 'next-auth/next';
import { canViewTeamData, getAppliedFilters } from '@/lib/sales-permissions';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    // Step 1: 세션 확인
    const session = await getServerSession();
    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({ error: '로그인이 필요합니다' }),
        { status: 401 }
      );
    }

    // Step 2: 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, teamId: true },
    });

    if (!user) {
      return new Response(
        JSON.stringify({ error: '사용자를 찾을 수 없습니다' }),
        { status: 404 }
      );
    }

    // Step 3: 권한 체크
    if (!canViewTeamData(user.role, user.teamId)) {
      return new Response(
        JSON.stringify({ error: '권한이 없습니다' }),
        { status: 403 }
      );
    }

    // Step 4: 필터 생성
    const filters = getAppliedFilters(user.role, user.id, user.teamId);
    if (filters === null) {
      return new Response(
        JSON.stringify({ error: '권한이 없습니다' }),
        { status: 403 }
      );
    }

    // Step 5: 데이터 조회
    const summary = await prisma.order.groupBy({
      by: ['status'],
      where: filters,
      _count: { id: true },
      _sum: { totalPrice: true },
    });

    // Step 6: 응답 반환
    return new Response(
      JSON.stringify({ success: true, data: summary }),
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ API 오류:', error);
    return new Response(
      JSON.stringify({ error: '서버 오류' }),
      { status: 500 }
    );
  }
}
```

**소요 시간**: 45분

---

### Task 3: Agent-API-2 (src/app/api/sales/team-members/route.ts)

**목적**: 팀원 목록 API (GET만, 권한 체크 엄격)

**폴더 생성**:
```
src/app/api/sales/
└── team-members/
    └── route.ts
```

**체크리스트**:
```
- [ ] 폴더 생성: src/app/api/sales/team-members/
- [ ] 파일 생성: route.ts
- [ ] Step 1: 세션 확인
- [ ] Step 2: 사용자 정보 조회
- [ ] Step 3: URL 파라미터 teamId 추출
- [ ] Step 4: 권한 체크 (자신의 팀이 아니면 403)
- [ ] Step 5: prisma.user.findMany() 팀원 조회
- [ ] Step 6: maskSensitiveData() 민감정보 숨김
- [ ] Step 7: JSON 응답 반환
- [ ] 에러 처리: 401, 403, 404, 500
- [ ] 검증: npx tsc --noEmit
```

**코드 템플릿** (위의 PHASE2 문서 참고):
```typescript
// URL 파라미터 추출
const { searchParams } = new URL(request.url);
const requestedTeamId = searchParams.get('teamId');

// 권한 체크 (자신의 팀이 아니면?)
if (user.role !== 'GLOBAL_ADMIN' && requestedTeamId !== user.teamId) {
  return new Response(
    JSON.stringify({ error: '다른 팀 데이터는 볼 수 없습니다' }),
    { status: 403 }
  );
}
```

**소요 시간**: 45분

---

### Task 4: Agent-API-3 (src/app/api/sales/commission-settle/route.ts)

**목적**: 정산 API (GET + POST, 관리자만)

**폴더 생성**:
```
src/app/api/sales/
└── commission-settle/
    └── route.ts
```

**체크리스트**:
```
- [ ] 폴더 생성: src/app/api/sales/commission-settle/
- [ ] 파일 생성: route.ts

GET 함수:
- [ ] Step 1: 세션 확인
- [ ] Step 2: 사용자 정보 조회
- [ ] Step 3: canSettleCommission() 관리자 권한 체크
- [ ] Step 4: URL 파라미터 month 추출 (YYYYMM)
- [ ] Step 5: 정산 데이터 조회
- [ ] Step 6: JSON 응답

POST 함수:
- [ ] Step 1: 세션 확인
- [ ] Step 2: 사용자 정보 조회
- [ ] Step 3: canSettleCommission() 관리자 권한 체크
- [ ] Step 4: 요청 body 파싱
- [ ] Step 5: month 형식 검증 (YYYYMM)
- [ ] Step 6: 중복 체크 (같은 달 정산 있나?)
- [ ] Step 7: 정산 기록 생성
- [ ] Step 8: JSON 응답 (201)
- [ ] 에러 처리: 401, 403, 404, 400, 500
- [ ] 검증: npx tsc --noEmit
```

**소요 시간**: 60분

---

## 🎨 Phase 3: 프론트엔드 UI (4시간)

### Task 5: Agent-UI-1 (src/app/(dashboard)/sales/page.tsx)

**목적**: 메인 대시보드 페이지

**폴더 생성**:
```
src/app/(dashboard)/sales/
└── page.tsx
```

**체크리스트**:
```
- [ ] 폴더 생성: src/app/(dashboard)/sales/
- [ ] 파일 생성: page.tsx (ClientComponent)
- [ ] 'use client' 선언
- [ ] useSession() 훅 사용
- [ ] useEffect() 데이터 로드
  - [ ] GET /api/sales/summary
  - [ ] GET /api/sales/team-members (팀장만)
- [ ] 상태 관리: loading, summary, teamMembers, error
- [ ] 로딩 상태 UI
- [ ] 에러 상태 UI
- [ ] 메인 UI 렌더링
  - [ ] <h1> 제목
  - [ ] <DashboardHero />
  - [ ] <OrderStatusTabs />
  - [ ] <TeamMembersSection /> (조건부)
  - [ ] <CommissionSection /> (관리자만)
- [ ] Tailwind 스타일 적용 (bg-gray-50, p-6, etc)
- [ ] 검증: npx tsc --noEmit
```

**코드 템플릿** (위의 PHASE3 문서 참고):
```typescript
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import DashboardHero from '@/components/sales/DashboardHero';
import OrderStatusTabs from '@/components/sales/OrderStatusTabs';

export default function SalesDashboard() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // API 호출
  }, [session]);

  if (loading) return <div>로딩 중...</div>;
  if (error) return <div>에러: {error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        📊 판매 대시보드
      </h1>
      <DashboardHero data={summary} />
      {/* ... */}
    </div>
  );
}
```

**소요 시간**: 60분

---

### Task 6: Agent-UI-2 (src/components/sales/DashboardHero.tsx)

**목적**: 상단 4개 통계 카드

**폴더 생성**:
```
src/components/sales/
└── DashboardHero.tsx
```

**체크리스트**:
```
- [ ] 폴더 생성: src/components/sales/
- [ ] 파일 생성: DashboardHero.tsx
- [ ] props: { data: any }
- [ ] 4개 통계 배열 정의
  - [ ] 이번 달 판매액 (파랑, 💵)
  - [ ] 대기 중인 주문 (노랑, ⏳)
  - [ ] 완료된 주문 (초록, ✅)
  - [ ] 전환율 (보라, 📈)
- [ ] formatValue() 함수
  - [ ] currency: 100000 → 100K
  - [ ] percent: 0.5 → 50%
  - [ ] number: 1000 → 1,000
- [ ] getCardColor() 색상 맵핑
- [ ] UI 렌더링
  - [ ] grid 4칼럼 (반응형)
  - [ ] 카드 hover 효과
  - [ ] 아이콘 + 제목 + 큰 숫자 + 설명
- [ ] Tailwind 스타일 (p-6, rounded-lg, border-2, etc)
- [ ] 검증: npx tsc --noEmit
```

**소요 시간**: 50분

---

### Task 7: Agent-UI-3 (src/components/sales/OrderStatusTabs.tsx)

**목적**: 주문 상태 탭 (신청 / 진행 / 완료)

**폴더**: src/components/sales/

**체크리스트**:
```
- [ ] 파일 생성: OrderStatusTabs.tsx
- [ ] 상태 관리
  - [ ] activeTab: 'pending' | 'processing' | 'completed'
  - [ ] orders: array
  - [ ] loading: boolean
- [ ] tabs 배열 정의
  - [ ] { id, label, icon, color }
- [ ] useEffect() 탭 변경 시 데이터 로드
  - [ ] GET /api/sales/orders?status={activeTab}
- [ ] getTabColor() 색상 함수
- [ ] UI 렌더링
  - [ ] 탭 버튼 flex row
  - [ ] 탭 선택 상태 (border-b-4)
  - [ ] 테이블 (주문ID, 고객명, 금액, 신청일, 상세보기)
  - [ ] 로딩 상태
  - [ ] 빈 상태 (주문이 없습니다)
- [ ] Tailwind 스타일 (flex, border-b, hover:bg-gray-50, etc)
- [ ] 검증: npx tsc --noEmit
```

**소요 시간**: 55분

---

### Task 8: Agent-UI-4 (src/components/sales/CommissionSection.tsx)

**목적**: 정산 관리 섹션 (관리자만)

**폴더**: src/components/sales/

**체크리스트**:
```
- [ ] 파일 생성: CommissionSection.tsx
- [ ] 상태 관리
  - [ ] months: array
  - [ ] selectedMonth: string (YYYYMM)
  - [ ] settlements: array
  - [ ] loading: boolean
  - [ ] creatingNew: boolean
- [ ] useEffect() 최근 6개월 목록 생성
  - [ ] 202406, 202405, 202404, ...
- [ ] useEffect() 월별 정산 데이터 로드
  - [ ] GET /api/sales/commission-settle?month={selectedMonth}
- [ ] handleCreateSettlement() 새 정산 생성
  - [ ] POST /api/sales/commission-settle { month }
  - [ ] 중복 체크 메시지 처리
- [ ] UI 렌더링
  - [ ] <select> 월 선택
  - [ ] <button> + 새로 만들기 (green)
  - [ ] 정산 테이블
    - [ ] 팀원 이름 / 판매액 / 수수료 / 상태 / 작업
    - [ ] 상태별 배지 (PENDING/APPROVED/PAID)
    - [ ] [승인] [거절] 버튼 (PENDING만)
  - [ ] 로딩/빈 상태
- [ ] Tailwind 스타일
- [ ] 검증: npx tsc --noEmit
```

**소요 시간**: 60분

---

## ✅ 최종 검증 체크리스트

### Phase 2 API 검증

```
1️⃣ TSC 타입 체크
   npx tsc --noEmit
   → 에러 0개 ✅

2️⃣ GET /api/sales/summary
   curl http://localhost:3000/api/sales/summary
   ✅ 200 응답
   ✅ data 필드 있음
   ✅ appliedRole 필드 있음

3️⃣ GET /api/sales/team-members
   curl http://localhost:3000/api/sales/team-members
   ✅ 200 응답
   ✅ count 필드 있음
   ✅ data 배열 있음

4️⃣ GET /api/sales/commission-settle?month=202406
   curl http://localhost:3000/api/sales/commission-settle?month=202406
   ✅ 200 응답
   ✅ data 배열 있음

5️⃣ POST /api/sales/commission-settle
   curl -X POST http://localhost:3000/api/sales/commission-settle \
     -H "Content-Type: application/json" \
     -d '{"month":"202406"}'
   ✅ 201 응답 (새 정산)
   ✅ 또는 400 (중복 에러)

6️⃣ 권한 테스트
   - 관리자로 로그인 → 전체 데이터 조회 ✅
   - 대리점장으로 로그인 → 자기 팀만 조회 ✅
   - 판매원으로 로그인 → 자신의 데이터만 조회 ✅
   - 권한 없는 요청 → 403 응답 ✅
```

### Phase 3 UI 검증

```
1️⃣ 페이지 로드
   http://localhost:3000/sales
   ✅ 페이지 렌더링 (에러 없음)

2️⃣ 컴포넌트 렌더링
   ✅ <DashboardHero /> 4개 카드 표시
   ✅ <OrderStatusTabs /> 탭 3개 표시
   ✅ <TeamMembersSection /> 팀장만 표시
   ✅ <CommissionSection /> 관리자만 표시

3️⃣ 데이터 바인딩
   ✅ API에서 받은 데이터가 UI에 표시됨
   ✅ 숫자 포맷 (K, %, 날짜)
   ✅ 로딩 상태 (로딩 중... 표시)
   ✅ 빈 상태 (데이터 없음 메시지)

4️⃣ 인터랙션
   ✅ 탭 클릭 → 데이터 변경
   ✅ 월 선택 → 정산 데이터 로드
   ✅ [새로 만들기] → 정산 생성 (관리자만)
   ✅ [상세보기] → 페이지 이동

5️⃣ 스타일
   ✅ 배경색 gray-50
   ✅ 텍스트 크기 (14px, 16px, 20px, 32px)
   ✅ 버튼 크기 (최소 48px × 48px)
   ✅ 간격 (p-6, mb-8, gap-6)
   ✅ 색상 (파랑, 초록, 빨강, 노랑)

6️⃣ 반응형
   ✅ 모바일 (1칼럼)
   ✅ 태블릿 (2칼럼)
   ✅ 데스크톱 (4칼럼)

7️⃣ 에러 처리
   ✅ API 실패 → 에러 메시지
   ✅ 권한 없음 → 403 표시
   ✅ 네트워크 오류 → 재시도 버튼
```

### 최종 TSC 검증 (중요!)

```powershell
# 모든 파일 저장 후
npx tsc --noEmit

# 출력:
# (아무것도 안 나오면 성공)
# 또는
# 0 errors found

# 만약 에러가 나면:
# - "Cannot find module '@/lib/sales-permissions'"
#   → import 경로 확인 (@ 별칭)
#
# - "Property 'user' does not exist on type '{}'
#   → session 타입 확인 (next-auth 타입)
#
# - "Expected 2-3 arguments, but got 0"
#   → 함수 매개변수 개수 확인
```

---

## 🔧 트러블슈팅

### 에러 1: "Cannot find module '@/lib/prisma'"

```typescript
// 해결책
// 1. prisma 클라이언트 위치 확인
//    ls src/lib/prisma.ts
//
// 2. import 경로 확인
import prisma from '@/lib/prisma';  // ✅
import prisma from './lib/prisma';  // ❌
```

### 에러 2: "Property 'user' does not exist"

```typescript
// 해결책
// next-auth 타입 확인
import { getServerSession } from 'next-auth/next';

// session 타입
const session = await getServerSession();
if (!session?.user?.id) { ... }  // ✅ 안전한 접근
```

### 에러 3: "EBUSY: resource busy or locked"

```
❌ npm run build (금지!)
✅ npx tsc --noEmit (안전)

이유: dev 서버가 파일을 잠그고 있음
```

### 에러 4: "module not found: next-auth"

```powershell
# 설치 확인
npm list next-auth

# 없으면 설치
npm install next-auth@latest
```

---

## 📚 파일 참고자료

### Prisma 스키마 확인

```bash
cat prisma/schema.prisma | grep -A 5 "model User\|model Order\|model CommissionSettlement"
```

필수 필드:
- `User.role` (string)
- `User.teamId` (string | null)
- `Order.status` (string)
- `Order.totalPrice` (Int)
- `Order.createdBy` (string)
- `CommissionSettlement` (모델 있나?)

### 환경 변수 확인

```bash
cat .env.local | grep -i "auth\|database"
```

필수:
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `DATABASE_URL`

---

## 🚀 배포 전 최종 체크

```
✅ Phase 2 API (4개)
   - [ ] src/lib/sales-permissions.ts
   - [ ] src/app/api/sales/summary/route.ts
   - [ ] src/app/api/sales/team-members/route.ts
   - [ ] src/app/api/sales/commission-settle/route.ts

✅ Phase 3 UI (4개)
   - [ ] src/app/(dashboard)/sales/page.tsx
   - [ ] src/components/sales/DashboardHero.tsx
   - [ ] src/components/sales/OrderStatusTabs.tsx
   - [ ] src/components/sales/CommissionSection.tsx

✅ 검증
   - [ ] npx tsc --noEmit → 0 errors
   - [ ] npm test (선택)
   - [ ] http://localhost:3000/sales → 렌더링 확인
   - [ ] 권한 3가지 테스트 (관리자/대리점장/판매원)
   - [ ] API 4개 모두 응답 확인

✅ 코드 품질
   - [ ] 주석 완전함
   - [ ] 에러 처리 완전함
   - [ ] 타입 안전함
   - [ ] 스타일 일관성 있음
```

---

**작성 일**: 2026-06-18
**버전**: 1.0
**다음**: 4명 병렬 구현 시작
