# Phase 1: 판매관리 페이지 역할별 대시보드 상세 설계 (2026-06-18)

## 목표
현재 **1개 통합 페이지** (`/dashboard/marketing/sales`)에서 모든 역할이 같은 화면을 봄.
→ **3개 페이지**로 분리 + 각 역할별 최적화된 UI 제공

---

## 📊 현재 상황 분석

### 기존 상태
```
페이지: /dashboard/marketing/sales
API: GET /api/marketing/sales (GLOBAL_ADMIN/OWNER만 허용)
역할: GLOBAL_ADMIN / OWNER / BRANCH_MANAGER / SALES_AGENT / FREE_SALES
현상: 403 접근거부 UI만 표시 (4개 역할 배제)
```

### API 응답 구조 (200 OK, GLOBAL_ADMIN/OWNER)
```typescript
{
  summary,           // 이번 달 전체 매출
  monthly,           // 6개월 추이
  byLanding,         // 랜딩페이지별 기여
  recent,            // 최근 20건 결제 (페이지네이션)
  orgBreakdown,      // 대리점별 매출 (GLOBAL_ADMIN 전용)
  adminPersonalSales, // 관리자 개인 링크 매출 (GLOBAL_ADMIN 전용)
  isGlobalAdmin,     // 서버가 명시적으로 내려주는 플래그
  pagination,        // 페이지네이션 정보
}
```

---

## 🎯 Phase 1 설계: 3개 페이지 분리

### ✅ 페이지 1: 관리자 대시보드
- **URL**: `/dashboard/marketing/sales`
- **대상 역할**: `GLOBAL_ADMIN`
- **핵심**: 전체 조직 통합 매출 + 개인 링크 매출 + 대리점별 분석
- **변경 사항**: 현재와 동일 (추가만)

#### 구성 요소
1. **제목**: "전체 랜딩페이지 매출 관리"
2. **KPI 카드 3개**
   - 전체 이번 달 매출
   - 결제 건수
   - 순매출 (환불 차감)
3. **월별 막대 그래프** (6개월)
4. **관리자 개인 링크 매출** (새 섹션)
   - 보라색 배경 강조
   - 3개 카드: 매출 / 환불 / 순매출
5. **대리점별 이번 달 매출** (새 섹션)
   - 테이블: 대리점명 / 이번 달 매출 / 결제건수 / 순매출
   - 전체 합계 행 (파란 배경)
6. **랜딩페이지별 매출 기여** (기존)
7. **최근 결제 내역** (기존, 마스킹 X)

#### UI 분리 로직
```javascript
// page.tsx 상단
const isGlobalAdmin = data?.isGlobalAdmin === true;

// 조건부 렌더링
{!loading && isGlobalAdmin && adminPersonalSales !== null && (
  <AdminPersonalSalesSection sales={adminPersonalSales} />
)}

{!loading && isGlobalAdmin && (
  <OrgBreakdownSection orgBreakdown={orgBreakdown} />
)}
```

---

### ✅ 페이지 2: 대리점장 대시보드 (신규)
- **URL**: `/dashboard/marketing/sales/branch`
- **대상 역할**: `BRANCH_MANAGER`
- **핵심**: 본인 소속 판매원들의 집계 매출만
- **권한 확인**: `ctx.organizationId` (소속 조직 ID)

#### 새 API 엔드포인트
```
GET /api/marketing/sales/branch?page=1&limit=20
```

#### API 요구사항
1. **페이지 검증**: organizationId 필수 (BRANCH_MANAGER)
2. **데이터 필터링**: `af.organizationId = ctx.organizationId` (어필리에이트 기준)
3. **응답 필드**
   - summary (이번 달 + 월별 + byLanding 동일)
   - recent (최근 20건)
   - salesByAgent (신규) — 판매원별 집계
   - salesByPage (신규) — 랜딩페이지별

#### 구성 요소
1. **제목**: "우리 조직 매출 현황" (조직명 표시)
2. **KPI 카드 3개**
   - 이번 달 매출
   - 결제 건수
   - 순매출
3. **판매원별 매출 기여** (테이블, 신규)
   - 판매원명 / 매출 / 건수 / 전환율(%)
   - 정렬: 매출 내림차순
4. **이번 달 판매원별 순위** (상위 3명, 신규, 카드 형태)
5. **랜딩페이지별 매출 기여** (기존, 데이터만 필터)
6. **최근 결제 내역** (기존, 마스킹 O)

#### 파일 구조
```
src/app/(dashboard)/marketing/sales/
├── page.tsx          (기존: GLOBAL_ADMIN 용 - 수정)
├── branch/
│   └── page.tsx      (신규: BRANCH_MANAGER 용)
└── agent/
    └── page.tsx      (신규: SALES_AGENT 용)
```

---

### ✅ 페이지 3: 판매원 대시보드 (신규)
- **URL**: `/dashboard/marketing/sales/agent`
- **대상 역할**: `SALES_AGENT`, `FREE_SALES`
- **핵심**: 본인이 생성한 랜딩페이지 매출만 (개인 성과)
- **권한 확인**: `ctx.userId` (작성자 기준)

#### 새 API 엔드포인트
```
GET /api/marketing/sales/agent?page=1&limit=20
```

#### API 요구사항
1. **페이지 검증**: 역할 확인 (SALES_AGENT / FREE_SALES 허용)
2. **데이터 필터링**: `lp.createdByUserId = ctx.userId` (랜딩페이지 작성자 기준)
3. **응답 필드**
   - summary (이번 달)
   - monthly (6개월)
   - byLanding (내 랜딩페이지별)
   - recent (최근 20건)
   - topPage (상위 1개 페이지, 신규)
   - totalPages (내가 만든 랜딩페이지 총 개수, 신규)

#### 구성 요소
1. **제목**: "내 판매 성과" 또는 "{이름}의 판매 대시보드"
2. **KPI 카드 2개** (더 심플)
   - 이번 달 매출
   - 순매출
3. **성과 하이라이트** (카드 2개, 신규)
   - 🏆 최고 매출 페이지: {페이지명} ({매출})
   - 📄 운영 중인 페이지: {총 개수}개
4. **월별 추이** (막대 그래프)
5. **내 페이지별 매출** (테이블)
   - 페이지명 / 매출 / 건수 / 전환율(%)
6. **최근 결제 내역** (최근 10건, 간단)
   - 구매자명 / 금액 / 결제일

#### 파일 구조 (위에 기재)

---

## 🔧 개발 계획 (Phase 1 - Total ~650줄)

### Step 1: API 확장 (신규 2개 엔드포인트, ~280줄)

#### 1-1. `/api/marketing/sales/branch` (BRANCH_MANAGER용)
**파일**: `src/app/api/marketing/sales/branch/route.ts` (신규)

```typescript
// GET /api/marketing/sales/branch?page=1&limit=20
// 역할: BRANCH_MANAGER만
// 필터: organizationId = ctx.organizationId

Response: {
  ok: boolean;
  summary: SalesSummary;
  monthly: MonthlyRow[];
  byLanding: LandingRow[];
  salesByAgent: {
    agentName: string;
    agentId: string;
    revenue: number;
    count: number;
    conversionRate: string;  // (count / 조회수 * 100).toFixed(1) + '%'
  }[];
  topAgents: {
    rank: 1 | 2 | 3;
    agentName: string;
    revenue: number;
  }[];
  recent: RecentRow[];
  pagination: { page; limit; totalCount; totalPages };
}
```

**구현 상세**:
1. 역할 검증 (BRANCH_MANAGER)
2. organizationId 필수 확인
3. COUNT 쿼리: `af.organizationId` 필터
4. 판매원별 집계: CrmAffiliateSale → agentId/소속자 JOIN
5. topAgents: ORDER BY revenue DESC LIMIT 3
6. 페이지네이션 LIMIT/OFFSET (기존과 동일)

**예상 줄 수**: ~140줄

---

#### 1-2. `/api/marketing/sales/agent` (SALES_AGENT/FREE_SALES용)
**파일**: `src/app/api/marketing/sales/agent/route.ts` (신규)

```typescript
// GET /api/marketing/sales/agent?page=1&limit=20
// 역할: SALES_AGENT, FREE_SALES
// 필터: lp.createdByUserId = ctx.userId

Response: {
  ok: boolean;
  summary: SalesSummary;
  monthly: MonthlyRow[];
  byLanding: LandingRow[];
  topPage: {
    landingPageId: string;
    landingPageTitle: string;
    revenue: number;
    count: number;
  } | null;
  totalPages: number;  // 내가 만든 랜딩페이지 총 개수
  recent: RecentRow[];
  pagination: { page; limit; totalCount; totalPages };
}
```

**구현 상세**:
1. 역할 검증 (SALES_AGENT / FREE_SALES)
2. userId 확인
3. COUNT 쿼리: `lp.createdByUserId` 필터
4. 상위 페이지: ORDER BY revenue DESC LIMIT 1
5. totalPages: COUNT(DISTINCT lp.id) WHERE createdByUserId = ctx.userId
6. 페이지네이션

**예상 줄 수**: ~140줄

---

### Step 2: UI 컴포넌트 (신규 2페이지 + 기존 1개 수정, ~270줄)

#### 2-1. 기존 파일 수정: `page.tsx` (GLOBAL_ADMIN용)
**파일**: `src/app/(dashboard)/marketing/sales/page.tsx` (수정)
**변경**: 없음 (이미 GLOBAL_ADMIN 분기 처리 완료) ✅
**줄 수**: +0 (기존 코드 재사용)

---

#### 2-2. 새 파일: BRANCH_MANAGER 대시보드
**파일**: `src/app/(dashboard)/marketing/sales/branch/page.tsx` (신규)

```typescript
// "use client"
// 권한 확인 (BRANCH_MANAGER)
// API 호출: /api/marketing/sales/branch
// 구성요소:
// - 제목 + 조직명
// - KPI 3개 (매출 / 건수 / 순매출)
// - 판매원별 테이블 (4열)
// - 상위 3명 카드
// - 랜딩페이지별 테이블 (3열)
// - 최근 결제 (테이블 또는 카드)
// - 페이지네이션

// 리팩토링: RecentPaymentTable, RecentPaymentCard 재사용
```

**예상 줄 수**: ~130줄 (컴포넌트 재사용)

---

#### 2-3. 새 파일: SALES_AGENT 대시보드
**파일**: `src/app/(dashboard)/marketing/sales/agent/page.tsx` (신규)

```typescript
// "use client"
// 권한 확인 (SALES_AGENT / FREE_SALES)
// API 호출: /api/marketing/sales/agent
// 구성요소:
// - 제목 ("내 판매 성과")
// - KPI 2개 (매출 / 순매출)
// - 성과 하이라이트 2개 (최고 매출 페이지 / 운영 페이지 수)
// - 월별 그래프 (기존 SalesBarChart 재사용)
// - 내 페이지 테이블 (4열)
// - 최근 결제 (카드 또는 테이블)

// 리팩토링: SalesBarChart 재사용
```

**예상 줄 수**: ~100줄

---

### Step 3: 타입 확장 (유틸 함수 기존 재사용, ~20줄)
**파일**: `src/types/marketing.ts` (기존)

**추가 타입** (선택사항, 기존 조합으로 충분할 수 있음):
```typescript
// 판매원별 집계
export interface AgentSalesRow {
  agentName: string;
  agentId: string;
  revenue: number;
  count: number;
  conversionRate: string;
}

// 브랜치 API 응답
export interface BranchSalesApiData extends SalesApiData {
  salesByAgent: AgentSalesRow[];
  topAgents: { rank: 1|2|3; agentName: string; revenue: number }[];
}

// 에이전트 API 응답
export interface AgentSalesApiData extends SalesApiData {
  topPage: LandingRow | null;
  totalPages: number;
}
```

---

## 📋 구현 체크리스트 (우선순위 순)

### P0 (필수)
- [ ] API 1-1: `/api/marketing/sales/branch` 완성 (역할, 필터링, 판매원별)
- [ ] API 1-2: `/api/marketing/sales/agent` 완성 (역할, 필터링, topPage)
- [ ] UI 2-2: `/branch/page.tsx` 완성 (판매원 테이블)
- [ ] UI 2-3: `/agent/page.tsx` 완성 (KPI + 하이라이트)
- [ ] 타입 확장 (선택사항)
- [ ] TSC: 0 에러
- [ ] 모든 역할 403 접근거부 제거 ✅

### P1 (권장)
- [ ] 판매원별 리더보드 (TOP 3 카드) 스타일
- [ ] 모바일 반응형 (테이블 → 카드 변환)
- [ ] 데이터 로딩 애니메이션 (스켈레톤)

### P2 (향후)
- [ ] 상위 페이지 상세 보기
- [ ] 내보내기 (CSV)
- [ ] 날짜 범위 필터

---

## 🎨 UI 설계 규칙 (Steve Jobs 50대 친화)

### 판매원별 테이블 (BRANCH_MANAGER 페이지)
```
┌─────────────────────────────────────────────────────────┐
│ 판매원별 매출 현황                                       │
├──────────┬──────────┬──────────┬──────────────────────┤
│ 판매원명 │  이번달  │  건수   │   전환율             │
├──────────┼──────────┼──────────┼──────────────────────┤
│ 김철수   │ 500,000원│  5건   │ 25.0% ⬆️ (전월 대비) │
│ 이영희   │ 300,000원│  3건   │ 15.0%               │
│ 박준호   │ 100,000원│  1건   │  5.0% ⬇️            │
└──────────┴──────────┴──────────┴──────────────────────┘
```

**컬럼 너비**:
- 판매원명: 25% (텍스트 정렬: 좌)
- 매출: 25% (숫자 정렬: 우)
- 건수: 20% (숫자 정렬: 우)
- 전환율: 30% (비교 바 + 퍼센트)

**스타일**:
- 헤더: 14px, 진회색, 배경 연회색
- 행 높이: 48px
- 마우스 호버: bg-blue-50 (연파랑)
- 전환율 바: 0-100% 길이 (초록색)

---

### 상위 3명 리더보드 (BRANCH_MANAGER 페이지)
```
┌──────────────────────────────────┐
│ 🏆 판매원 TOP 3                  │
├──────────────────────────────────┤
│ 🥇 1위: 김철수                   │
│    500,000원                     │
├──────────────────────────────────┤
│ 🥈 2위: 이영희                   │
│    300,000원                     │
├──────────────────────────────────┤
│ 🥉 3위: 박준호                   │
│    100,000원                     │
└──────────────────────────────────┘
```

**스타일**:
- 카드: 3칼럼 (모바일: 1칼럼)
- 배경: 순위별 색상 변화
  - 1위: 황금색 배경 (rgb(255, 215, 0) 투명)
  - 2위: 은색 배경 (rgb(192, 192, 192) 투명)
  - 3위: 동색 배경 (rgb(184, 115, 51) 투명)
- 텍스트: 카드 중앙, 18px 굵음

---

### 성과 하이라이트 (SALES_AGENT 페이지)
```
┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│ 🏆 최고 매출 페이지              │  │ 📄 운영 중인 페이지              │
│ "크루즈 여행 완벽 가이드"        │  │                                  │
│ 1,250,000원                      │  │ 12개                             │
│ (이번 달)                        │  │ (총 만든 페이지)                 │
└──────────────────────────────────┘  └──────────────────────────────────┘
```

**스타일**:
- 2칼럼 (모바일: 1칼럼)
- 배경: 파랑 + 녹색 (구분)
- 아이콘 + 제목 + 수치 (큼)
- 패딩: 16px

---

## 📝 구현 지시사항 (개발자용)

### 1단계: 역할 검증 함수 재사용
```typescript
// 기존 RBAC 함수 재사용
import { getMabizSession } from "@/lib/auth";
import { resolveOrgIdOrNull } from "@/lib/rbac";

const ctx = await getMabizSession();
if (ctx.role === 'BRANCH_MANAGER') {
  const orgId = ctx.organizationId;  // 필수
}
if (ctx.role === 'SALES_AGENT' || ctx.role === 'FREE_SALES') {
  const userId = ctx.userId;  // 필수
}
```

### 2단계: SQL 쿼리 패턴 (기존 route.ts에서 복사)
- COUNT 쿼리: `af.organizationId` 또는 `lp.createdByUserId` 필터 추가
- SELECT 쿼리: 같은 필터 + INNER JOIN 유지
- GROUP BY: `af.organizationId` (판매원별) 또는 유지

### 3단계: 컴포넌트 재사용
```typescript
// 기존 컴포넌트 재사용
import { SalesBarChart } from "@/components/marketing/SalesBarChart";
import { KpiCard } from "@/components/marketing/KpiCard";
import { RecentPaymentTable } from "./RecentPaymentTable";  // 기존 함수

// branch/page.tsx
<SalesBarChart monthly={monthly} />
<KpiCard label="..." value={...} color="bg-blue-50" />
<RecentPaymentTable recent={recent} loading={loading} />
```

### 4단계: 역할별 조건부 렌더링
```typescript
// page.tsx (기존)
const isGlobalAdmin = data?.isGlobalAdmin === true;
{!loading && isGlobalAdmin && <AdminPersonalSalesSection ... />}

// branch/page.tsx (신규)
const isBranchManager = data?.isBranchManager === true;  // API에서 명시적으로
{!loading && isBranchManager && salesByAgent.length > 0 && <AgentTable ... />}

// agent/page.tsx (신규)
{!loading && topPage && <HighlightCard ... />}
```

---

## 🧪 테스트 계획 (수동)

### 관리자 로그인
```
계정: admin1@mabiz.com (GLOBAL_ADMIN)
URL: /dashboard/marketing/sales
기대: 
  ✅ 전체 매출 보임
  ✅ 대리점별 분석 보임
  ✅ 개인 링크 매출 보임
```

### 대리점장 로그인
```
계정: branch@mabiz.com (BRANCH_MANAGER, org=uuid-1)
URL: /dashboard/marketing/sales/branch
기대:
  ✅ 자신 조직 매출만 보임
  ✅ 판매원별 테이블 보임
  ✅ TOP 3 리더보드 보임
  ❌ 다른 조직 데이터 X
```

### 판매원 로그인
```
계정: agent@mabiz.com (SALES_AGENT, userId=user-1)
URL: /dashboard/marketing/sales/agent
기대:
  ✅ 본인 페이지 매출만 보임
  ✅ 성과 하이라이트 보임
  ✅ 최고 매출 페이지 표시
  ❌ 다른 판매원 데이터 X
```

---

## 📊 예상 메트릭스 (배포 후 KPI)

### 관리자 (GLOBAL_ADMIN)
- 페이지 로드 시간: < 2.5s (LCP)
- 월별 그래프 렌더링: < 500ms
- 대리점별 정렬: < 200ms

### 대리점장 (BRANCH_MANAGER)
- 판매원별 정렬: < 300ms
- TOP 3 리더보드: 즉시 렌더링
- 페이지네이션: < 200ms

### 판매원 (SALES_AGENT)
- 성과 카드: 즉시 렌더링
- 월별 그래프: < 500ms
- 하이라이트 업데이트: 실시간 (5분 주기)

---

## 🚀 배포 순서

### Week 1
1. API 2개 완성 + 테스트 (1-1, 1-2)
2. UI 2페이지 완성 + 스타일 (2-2, 2-3)
3. TSC 0에러 확인

### Week 2
1. E2E 테스트 (3가지 역할)
2. 모바일 반응형 확인
3. Lighthouse 성능 검증 (90+ 목표)
4. 배포 (Vercel)

---

## 📌 참고 파일

| 파일 | 현재 상태 | 변경 |
|------|---------|------|
| `page.tsx` | ✅ 완성 | 변경 없음 |
| `branch/page.tsx` | 신규 | +130줄 |
| `agent/page.tsx` | 신규 | +100줄 |
| `api/.../branch/route.ts` | 신규 | +140줄 |
| `api/.../agent/route.ts` | 신규 | +140줄 |
| `types/marketing.ts` | 확장 | +20줄 (선택) |

**총 예상 줄 수**: ~530-650줄

---

## ✅ Phase 1 완료 기준

- [ ] 3개 페이지 모두 접근 가능 (역할별)
- [ ] 2개 신규 API 완성 + 권한 검증
- [ ] 모든 역할 403 접근거부 제거
- [ ] 데이터 필터링 정확성 확인
- [ ] 마스킹 규칙 유지 (관리자만 풀 정보)
- [ ] TSC 0에러
- [ ] 모바일 반응형 확인
- [ ] Lighthouse 90+ 달성

---

**작성일**: 2026-06-18  
**버전**: 1.0  
**상태**: 구현 대기 중
