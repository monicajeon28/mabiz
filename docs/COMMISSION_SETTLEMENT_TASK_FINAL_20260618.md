# 판매관리 페이지: 역할별 권한 + 수당 정산 최종 작업지시서

**작성일**: 2026-06-18 | **버전**: 1.0 (최종) | **총 작업시간**: 8시간 | **팀**: Agent-Sales + Agent-Affiliate

---

## 📋 핵심 원칙 (초등학생 수준)

### "누가" → "뭘 봐야 하나?" → "뭘 할 수 있나?" → "뭘 기록할 건가?"

```
관리자 (회사대표)
  ├─ 봐야 할 것: 모든 대리점 판매액 (회사 전체)
  ├─ 할 수 있는 것: 월말 수당 지급 승인 + 검증
  └─ 기록할 것: "누가 얼마를 지급했는가" 감사로그

대리점장 (팀장)
  ├─ 봐야 할 것: 우리 팀 판매원들 판매액 (팀 내)
  ├─ 할 수 있는 것: 팀원 검증 + 이의 제기
  └─ 기록할 것: "검증 결과" (승인/거부)

판매원 (팀원)
  ├─ 봐야 할 것: 자기 판매액만 (자신 것)
  ├─ 할 수 있는 것: 자기 판매 보고 조회만
  └─ 기록할 것: 없음 (자동 기록됨)
```

---

## 🎯 5단계 구현 로드맵

### Phase 1️⃣: 페이지 구조 설계 (2시간)

#### 현재 문제
```
- 판매관리 페이지 없음 (대시보드만 있음)
- 역할별 권한 구분 안 됨
- 수당 검증 화면 없음
```

#### 개선안
```
/sales 페이지 (역할별 다른 화면)
├─ 관리자: 전체 판매 현황 + 월말 정산 (3개 탭)
├─ 대리점장: 팀 판매 현황 + 팀원 검증 (2개 탭)
└─ 판매원: 자기 판매 현황만 (1개 탭)
```

#### 구현 방법

**파일**: `src/app/(dashboard)/sales/page.tsx` (새로 만들기)

```typescript
// 1단계: 역할 확인
const session = await getSession();
const role = session.user.role; // "GLOBAL_ADMIN" | "BRANCH_MANAGER" | "AGENT"

// 2단계: 역할별 화면 렌더링
if (role === "GLOBAL_ADMIN") {
  return <AdminSalesPage />; // 관리자 화면
}
if (role === "BRANCH_MANAGER") {
  return <BranchManagerSalesPage />; // 대리점장 화면
}
return <AgentSalesPage />; // 판매원 화면
```

**3개 컴포넌트 만들기**:
1. `AdminSalesPage` — 회사 전체 판매액 + 월말 정산 버튼
2. `BranchManagerSalesPage` — 팀 판매액 + 팀원 검증 폼
3. `AgentSalesPage` — 자기 판매액만 (읽기 전용)

---

### Phase 2️⃣: API 필터링 (2시간)

#### 현재 문제
```
- 백엔드에서 권한 확인 안 함
- 누가 어디까지 봐야 할지 정의 안 됨
- 누가 "월말 정산" 버튼 클릭할지 명확 안 함
```

#### 개선안
```
API별 권한 체크 함수 만들기
→ "이 사람이 이 데이터를 볼 수 있나?" 확인
```

#### 구현 방법

**파일**: `src/lib/sales-permissions.ts` (새로 만들기)

```typescript
// 권한 확인 함수 4가지

// 함수 1: 관리자인가?
export function isAdmin(role: string): boolean {
  return role === "GLOBAL_ADMIN";
}

// 함수 2: 이 사람의 팀 판매원 데이터를 볼 수 있나?
export function canViewTeamData(
  userRole: string,
  userBranchId: string,
  targetBranchId: string
): boolean {
  if (userRole === "GLOBAL_ADMIN") return true; // 관리자는 모두 봄
  if (userRole === "BRANCH_MANAGER") {
    return userBranchId === targetBranchId; // 대리점장은 자기 팀만
  }
  return false; // 판매원은 못 봄
}

// 함수 3: 월말 정산을 할 수 있나?
export function canSettleCommission(role: string): boolean {
  return role === "GLOBAL_ADMIN"; // 관리자만 가능
}

// 함수 4: 이의 제기를 할 수 있나?
export function canDispute(role: string, userBranchId: string, targetBranchId: string): boolean {
  if (role === "GLOBAL_ADMIN") return true; // 관리자 항상 가능
  if (role === "BRANCH_MANAGER") {
    return userBranchId === targetBranchId; // 대리점장은 자기 팀만 가능
  }
  return false; // 판매원은 불가능
}
```

**API 4가지 만들기**:

1. `GET /api/sales/summary` — 판매 현황 조회
   ```
   요청: { role, userId, branchId, month }
   응답: {
     totalRevenue: 150000000,
     byBranch: [
       { branchId: "B1", name: "서울지점", revenue: 50000000 },
       { branchId: "B2", name: "부산지점", revenue: 100000000 }
     ]
   }
   
   권한 확인:
   - GLOBAL_ADMIN: 모든 지점 데이터
   - BRANCH_MANAGER: 자신 지점만
   - AGENT: 에러 (접근 불가)
   ```

2. `GET /api/sales/team-members` — 팀 판매원 목록 + 수당
   ```
   요청: { branchId, month }
   응답: [
     { agentId: "A1", name: "김철수", revenue: 10000000, commission: 1500000, status: "pending" },
     { agentId: "A2", name: "이영희", revenue: 8000000, commission: 1200000, status: "approved" }
   ]
   
   권한 확인:
   - GLOBAL_ADMIN: 모든 팀원 조회 가능
   - BRANCH_MANAGER: 자신 지점 팀원만 조회 가능
   - AGENT: 에러
   ```

3. `POST /api/sales/commission-settle` — 월말 정산 실행
   ```
   요청: { month, year, approverId }
   응답: { settledCount: 15, totalAmount: 22500000, status: "completed" }
   
   권한 확인:
   - GLOBAL_ADMIN만 가능
   - 다른 역할: 에러 (403 Forbidden)
   
   동작:
   - 모든 CommissionLedger 합산
   - MonthlySettlement 기록
   - 각 팀원에게 수당 지급 (자동이체 또는 카드)
   ```

4. `POST /api/sales/dispute` — 이의 제기
   ```
   요청: { agentId, month, reason, comments }
   응답: { disputeId: "D123", status: "pending_review" }
   
   권한 확인:
   - GLOBAL_ADMIN: 모든 이의 제기 가능
   - BRANCH_MANAGER: 자신 지점 팀원만 가능
   - AGENT: 불가능
   
   동작:
   - DisputeLog 기록 (감사추적)
   - 관리자에게 알림
   - 상태: pending_review → approved/rejected
   ```

---

### Phase 3️⃣: 버튼 권한 구분 (2시간)

#### 현재 문제
```
- UI에서 권한 확인 안 함
- 권한 없는 사람도 버튼 클릭 가능
- 어떤 버튼을 누를 수 있는지 명확하지 않음
```

#### 개선안
```
각 버튼마다 권한 확인
→ 권한 없으면 버튼 숨기거나 비활성화
```

#### 구현 방법

**파일**: `src/lib/button-permissions.ts` (새로 만들기)

```typescript
// 버튼 권한 확인 함수

export const buttonPermissions = {
  // 버튼 1: "월말 정산하기"
  canSettleCommission: (role: string) => role === "GLOBAL_ADMIN",
  
  // 버튼 2: "이의 제기하기"
  canDispute: (role: string, userBranchId: string, targetBranchId: string) => {
    if (role === "GLOBAL_ADMIN") return true;
    if (role === "BRANCH_MANAGER") return userBranchId === targetBranchId;
    return false;
  },
  
  // 버튼 3: "검증 완료"
  canApproveDispute: (role: string) => role === "GLOBAL_ADMIN",
  
  // 버튼 4: "엑셀 다운로드"
  canDownloadExcel: (role: string) => role === "GLOBAL_ADMIN" || role === "BRANCH_MANAGER",
  
  // 버튼 5: "재계산"
  canRecalculate: (role: string) => role === "GLOBAL_ADMIN",
};
```

**UI 컴포넌트 (React)**:

```typescript
// 예시: 월말 정산 버튼
import { buttonPermissions } from "@/lib/button-permissions";

export function SettleButton({ role, month }: Props) {
  const canSettle = buttonPermissions.canSettleCommission(role);
  
  return (
    <button
      onClick={handleSettle}
      disabled={!canSettle}
      title={canSettle ? "월말 정산 실행" : "관리자만 가능합니다"}
      className={canSettle ? "btn-primary" : "btn-disabled"}
    >
      {canSettle ? "✓ 월말 정산하기" : "🔒 관리자만 가능"}
    </button>
  );
}

// 예시: 팀원 검증 버튼
export function DisputeButton({ role, userBranchId, targetBranchId }: Props) {
  const canDispute = buttonPermissions.canDispute(role, userBranchId, targetBranchId);
  
  return (
    <button
      onClick={handleDispute}
      disabled={!canDispute}
      className={canDispute ? "btn-secondary" : "btn-hidden"}
    >
      {canDispute ? "⚠️ 이의 제기" : ""}
    </button>
  );
}
```

**버튼 권한 매핑표**:

| 버튼 | 관리자 | 대리점장 | 판매원 |
|------|--------|---------|--------|
| **월말 정산** | ✅ 클릭 가능 | ❌ 숨김 | ❌ 숨김 |
| **이의 제기** | ✅ 모두 가능 | ✅ 자기팀만 | ❌ 숨김 |
| **검증 완료** | ✅ 클릭 가능 | ❌ 숨김 | ❌ 숨김 |
| **엑셀 다운로드** | ✅ 전체 | ✅ 팀 전체 | ❌ 숨김 |
| **재계산** | ✅ 클릭 가능 | ❌ 숨김 | ❌ 숨김 |

---

### Phase 4️⃣: 감사 로그 (2시간)

#### 현재 문제
```
- 누가 뭘 했는지 기록 없음
- 수당 조정 내역이 안 보임
- 월말에 "누가 정산을 했는가" 증거 없음
```

#### 개선안
```
모든 중요한 행동 자동 기록
→ "누가" "언제" "뭘 했는가" 증거 남기기
```

#### 구현 방법

**파일**: `src/lib/audit-log.ts` (새로 만들기)

```typescript
// 감사 로그 기록 함수

export async function logAudit(
  action: string,        // "settle_commission" | "dispute_created" | "dispute_resolved"
  userId: string,        // 누가 했는가
  resourceId: string,    // 어디에 (agentId, branchId 등)
  details: object,       // 상세 내용
  result: "success" | "failed"
) {
  await db.auditLog.create({
    data: {
      action,
      userId,
      userRole: session.user.role,
      resourceId,
      details: JSON.stringify(details),
      result,
      timestamp: new Date(),
      ipAddress: req.headers["x-forwarded-for"] || "unknown"
    }
  });
}
```

**DB 스키마 (Prisma)**:

```prisma
model AuditLog {
  id            String   @id @default(cuid())
  action        String   // "settle_commission", "dispute_created" 등
  userId        String   // 누가 했는가
  userRole      String   // "GLOBAL_ADMIN", "BRANCH_MANAGER", "AGENT"
  resourceId    String   // 영향받은 객체 ID (agentId, branchId 등)
  details       String   @db.LongText // JSON 상세 내용
  result        String   // "success" | "failed"
  timestamp     DateTime @default(now())
  ipAddress     String   // IP 주소
  
  @@index([userId])
  @@index([action])
  @@index([timestamp])
}
```

**기록할 행동들**:

```
1️⃣ 월말 정산
   ├─ action: "settle_commission"
   ├─ userId: "admin_1"
   ├─ details: {
   │    month: "2026-06",
   │    settledCount: 15,
   │    totalAmount: 22500000,
   │    byBranch: [
   │      { branchId: "B1", amount: 7500000 },
   │      { branchId: "B2", amount: 15000000 }
   │    ]
   │  }
   └─ result: "success"

2️⃣ 이의 제기
   ├─ action: "dispute_created"
   ├─ userId: "branch_mgr_1"
   ├─ resourceId: "agent_5"
   ├─ details: {
   │    month: "2026-06",
   │    reason: "판매액 누락",
   │    comment: "6월 20일 계약 건이 미반영됨"
   │  }
   └─ result: "success"

3️⃣ 이의 검증 완료
   ├─ action: "dispute_resolved"
   ├─ userId: "admin_1"
   ├─ resourceId: "dispute_123"
   ├─ details: {
   │    status: "approved",
   │    adjustedAmount: 1500000,
   │    comment: "계약서 확인 완료, 수당 조정"
   │  }
   └─ result: "success"
```

**감사 로그 조회 화면** (관리자만):

```
/admin/audit-logs
├─ 필터: 날짜, 행동, 사용자
├─ 표: 시간 | 사용자 | 행동 | 대상 | 결과
├─ 클릭하면 상세 내용 (JSON 포맷)
└─ 다운로드: CSV/Excel
```

---

### Phase 5️⃣: 월말 정산 자동화 (필요시 참고)

#### 현재 문제
```
- 월말에 누가 수당을 지급할지 명확하지 않음
- 수당 지급 순서가 안 정해짐
- "정산 완료" 상태가 안 보임
```

#### 개선안
```
월말 정산 1단계씩 정확하게 진행
1단계: CommissionLedger 합산
2단계: MonthlySettlement 기록
3단계: 지급 (자동이체/카드 처리)
4단계: 확인서 발송
```

#### 구현 방법

**파일**: `src/app/api/sales/commission-settle/route.ts`

```typescript
export async function POST(req: Request) {
  // 1단계: 권한 확인
  const session = await getSession();
  if (session.user.role !== "GLOBAL_ADMIN") {
    return Response.json({ error: "권한 없음" }, { status: 403 });
  }

  const { month, year } = await req.json();

  try {
    // 2단계: CommissionLedger 합산
    const ledgers = await db.commissionLedger.findMany({
      where: {
        createdAt: {
          gte: new Date(`${year}-${month}-01`),
          lt: new Date(`${year}-${month + 1}-01`)
        }
      },
      include: { agent: true }
    });

    // 3단계: 지점별 합산
    const byBranch = {};
    ledgers.forEach((ledger) => {
      const branchId = ledger.agent.branchId;
      if (!byBranch[branchId]) {
        byBranch[branchId] = { amount: 0, agentCount: 0 };
      }
      byBranch[branchId].amount += ledger.amount;
      byBranch[branchId].agentCount++;
    });

    // 4단계: MonthlySettlement 기록
    const settlement = await db.monthlySettlement.create({
      data: {
        month: new Date(`${year}-${month}-01`),
        totalAmount: Object.values(byBranch).reduce(
          (sum, b: any) => sum + b.amount,
          0
        ),
        details: JSON.stringify(byBranch),
        status: "completed",
        settledBy: session.user.id,
        settledAt: new Date()
      }
    });

    // 5단계: 감사 로그 기록
    await logAudit(
      "settle_commission",
      session.user.id,
      "global",
      {
        month: `${year}-${month}`,
        byBranch,
        totalAmount: settlement.totalAmount
      },
      "success"
    );

    return Response.json({
      success: true,
      settlementId: settlement.id,
      totalAmount: settlement.totalAmount,
      byBranch
    });
  } catch (error) {
    await logAudit(
      "settle_commission",
      session.user.id,
      "global",
      { error: error.message },
      "failed"
    );
    throw error;
  }
}
```

---

## 📊 실제 UI 화면 (초등학생 수준)

### 관리자 화면

```
┌─────────────────────────────────────┐
│ 판매 현황 (2026년 6월)             │
├─────────────────────────────────────┤
│                                     │
│ 회사 전체 판매액: 15,000만원       │ ← 큼 (관리자가 봐야 할 숫자)
│ ┌─────────────────────────────────┐│
│ │ 지점별 판매액                   ││
│ ├─────────────────────────────────┤│
│ │ 서울지점: 5,000만원 ↓ 67%     ││
│ │ 부산지점: 10,000만원 ↑ 133%   ││
│ └─────────────────────────────────┘│
│                                     │
│ 월별 정산                           │
│ ┌─────────────────────────────────┐│
│ │ 5월: 1,400만원 (완료)           ││
│ │ 6월: 2,250만원 (대기중)         ││ ← 상태 명시
│ │                                 ││
│ │ [✓ 월말 정산 실행]  [다운로드]  ││ ← 큰 버튼 (48px)
│ └─────────────────────────────────┘│
│                                     │
└─────────────────────────────────────┘

↓

[✓ 월말 정산 실행] 클릭

↓

┌─────────────────────────────────────┐
│ 확인하세요                          │
├─────────────────────────────────────┤
│                                     │
│ 2026년 6월 정산을 시작합니다.      │
│                                     │
│ 대상 판매원: 15명                  │
│ 합계 수당: 2,250만원               │
│                                     │
│ 정산 완료 후 되돌릴 수 없습니다.   │
│                                     │
│ [확인]  [취소]                      │ ← 재확인 필수
│                                     │
└─────────────────────────────────────┘

↓

┌─────────────────────────────────────┐
│ ✅ 정산 완료                        │
├─────────────────────────────────────┤
│                                     │
│ 지점별 지급 현황:                   │
│ • 서울지점 (5명): 750만원 ✓        │
│ • 부산지점 (10명): 1,500만원 ✓    │
│                                     │
│ 정산 시간: 2026-06-30 14:23:45    │
│ 정산 담당자: 관리자 (홍길동)       │
│                                     │
└─────────────────────────────────────┘
```

### 대리점장 화면

```
┌─────────────────────────────────────┐
│ 우리 팀 판매 현황 (서울지점)       │
├─────────────────────────────────────┤
│                                     │
│ 팀 전체 판매액: 5,000만원          │
│ 팀 전체 수당: 750만원              │
│                                     │
│ 팀원별 판매액 & 수당:              │
│ ┌─────────────────────────────────┐│
│ │ 이름      판매액      수당   상태 ││
│ ├─────────────────────────────────┤│
│ │ 김철수   1,000만   150만  ✓    ││
│ │ 이영희   800만    120만  ⚠️   ││ ← "⚠️"는 이의 검토 중
│ │ 박민수   600만    90만   ✓    ││
│ │ ...                             ││
│ └─────────────────────────────────┘│
│                                     │
│ 이영희 행에 마우스 올리면:         │
│ ┌─────────────────────────────────┐│
│ │ [💬 이의 제기] [상세 보기]      ││ ← 작은 버튼
│ └─────────────────────────────────┘│
│                                     │
└─────────────────────────────────────┘

↓

[💬 이의 제기] 클릭

↓

┌─────────────────────────────────────┐
│ 이의 제기 작성                      │
├─────────────────────────────────────┤
│                                     │
│ 대상: 이영희 (2026년 6월)         │
│                                     │
│ 문제: ○ 판매액 누락                │
│      ○ 수당 계산 오류              │
│      ○ 기타 (직접 입력)            │
│                                     │
│ 상세 설명:                          │
│ ┌─────────────────────────────────┐│
│ │ 6월 20일 계약 건이 미반영됨    ││
│ │ 계약서 번호: CT-2026-0620-001  ││
│ │                                 ││
│ │                                 ││
│ └─────────────────────────────────┘│
│                                     │
│ [제출] [취소]                      │
│                                     │
└─────────────────────────────────────┘
```

### 판매원 화면

```
┌─────────────────────────────────────┐
│ 내 판매 현황 (2026년 6월)          │
├─────────────────────────────────────┤
│                                     │
│ 이름: 김철수                        │
│ 소속: 서울지점                      │
│                                     │
│ 💰 내 판매액: 1,000만원           │
│ 💵 내 수당: 150만원 ✓              │
│                                     │
│ 판매 내역:                          │
│ ┌─────────────────────────────────┐│
│ │ 날짜      상품        판매액    ││
│ ├─────────────────────────────────┤│
│ │ 6/01  크루즈 7박    300만원    ││
│ │ 6/05  여행보험      50만원     ││
│ │ 6/10  크루즈 5박    250만원    ││
│ │ ...                             ││
│ └─────────────────────────────────┘│
│                                     │
│ ✅ 정산 완료 (2026-06-30)         │
│ 입금 예정일: 2026-07-05           │
│                                     │
└─────────────────────────────────────┘
```

---

## 🛠️ 구현 체크리스트

### Phase 1: 페이지 구조 (2시간)
- [ ] `src/app/(dashboard)/sales/page.tsx` 생성
- [ ] 역할별 3가지 컴포넌트 만들기 (`AdminSalesPage`, `BranchManagerSalesPage`, `AgentSalesPage`)
- [ ] 역할 확인 로직 추가 (getSession 사용)
- [ ] Prisma: `MonthlySettlement` 스키마 확인
- [ ] tsc --noEmit 0에러

### Phase 2: API 필터링 (2시간)
- [ ] `src/lib/sales-permissions.ts` 생성 (권한 함수 4가지)
- [ ] `src/app/api/sales/summary/route.ts` (판매 현황 조회)
- [ ] `src/app/api/sales/team-members/route.ts` (팀 판매원 목록)
- [ ] `src/app/api/sales/commission-settle/route.ts` (월말 정산)
- [ ] `src/app/api/sales/dispute/route.ts` (이의 제기)
- [ ] 각 API에서 권한 확인 (canViewTeamData 등 사용)
- [ ] tsc --noEmit 0에러

### Phase 3: 버튼 권한 (2시간)
- [ ] `src/lib/button-permissions.ts` 생성 (버튼 권한 함수)
- [ ] AdminSalesPage에 버튼 5가지 추가 + 권한 확인
  - "월말 정산하기" (GLOBAL_ADMIN만)
  - "이의 제기" (GLOBAL_ADMIN + BRANCH_MANAGER)
  - "검증 완료" (GLOBAL_ADMIN만)
  - "엑셀 다운로드" (GLOBAL_ADMIN + BRANCH_MANAGER)
  - "재계산" (GLOBAL_ADMIN만)
- [ ] BranchManagerSalesPage에 버튼 2가지 추가
  - "팀원 검증" (자기팀만)
  - "엑셀 다운로드"
- [ ] 권한 없으면 버튼 숨기거나 회색 처리
- [ ] 마우스 올려도 텍스트 "관리자만 가능합니다" 표시
- [ ] tsc --noEmit 0에러

### Phase 4: 감사 로그 (2시간)
- [ ] Prisma: `AuditLog` 스키마 생성
  ```prisma
  model AuditLog {
    id String @id @default(cuid())
    action String // "settle_commission", "dispute_created" 등
    userId String
    userRole String
    resourceId String
    details String @db.LongText
    result String // "success" | "failed"
    timestamp DateTime @default(now())
    ipAddress String
    @@index([userId])
    @@index([action])
    @@index([timestamp])
  }
  ```
- [ ] `src/lib/audit-log.ts` 생성 (logAudit 함수)
- [ ] 모든 API에서 중요한 행동 기록
  - commission-settle: "settle_commission" 기록
  - dispute: "dispute_created" 기록
- [ ] `src/app/(dashboard)/admin/audit-logs/page.tsx` (감사 로그 조회)
  - 필터: 날짜, 행동, 사용자
  - 표: 시간 | 사용자 | 행동 | 대상 | 결과
  - 클릭하면 상세 내용 (JSON)
  - 다운로드: CSV/Excel
- [ ] tsc --noEmit 0에러

### Phase 5: 테스트
- [ ] 역할별 UI 화면 렌더링 확인
  - 관리자 로그인 → 모든 버튼 보임
  - 대리점장 로그인 → 일부 버튼만
  - 판매원 로그인 → 읽기만
- [ ] API 권한 확인 테스트
  - 판매원이 `/api/sales/commission-settle` 호출 → 403 에러
  - 관리자가 호출 → 성공
- [ ] 감사 로그 기록 확인
  - 정산 후 AuditLog 테이블 확인
- [ ] tsc --noEmit 0에러
- [ ] Lighthouse 90+ (성능)

---

## 📈 성과 지표 (완료 후)

| 지표 | 현재 | 목표 | 효과 |
|------|------|------|------|
| **권한 오류** | ? | 0개 | 무단 접근 0% |
| **수당 오류** | ? | 0개 | 정산 신뢰도 100% |
| **감사 추적** | 없음 | 100% | 규제 준수 ✅ |
| **정산 시간** | 30분 | 5분 | 자동화 효율 600% ↑ |
| **팀원 이의 해결** | 2일 | 1시간 | 분쟁 해결 시간 480% ↓ |

---

## 🎯 심리학 적용 (선택사항)

### Grant Cardone 10렌즈 중 3가지 적용

**L1: 가격 민감도** → 수당 명시
```
"이영희의 판매액: 800만원"
"계산된 수당: 120만원" ← 명확하게 보이기
→ 신뢰도 ↑
```

**L6: 타이밍 손실회피** → 긴박감
```
"6월 정산이 4일 남았습니다"
"지금 이의를 제기하면 6월 정산에 반영됩니다" ← 긴박감
→ 빨리 결정하게 함
```

**L10: 즉시 구매 클로징** → 월말 정산 알림
```
"✓ 월말 정산하기" 버튼 (녹색, 큼)
"지금 클릭하면 7월 5일 입금 시작됩니다" ← 즉시성
→ 관리자가 빨리 실행하도록 함
```

---

## 📅 구현 순서 (권장)

**1일차 (4시간)**:
- Phase 1 + Phase 2 병렬 (API 역할 확인)

**2일차 (4시간)**:
- Phase 3 + Phase 4 (UI 버튼 + 감사 로그)

**총 2일 (8시간)** → 배포 완료

---

## 🔗 참고 파일

- `src/lib/sales-permissions.ts` ← 새 파일
- `src/lib/button-permissions.ts` ← 새 파일
- `src/lib/audit-log.ts` ← 새 파일
- `src/app/(dashboard)/sales/page.tsx` ← 새 파일
- `src/app/(dashboard)/admin/audit-logs/page.tsx` ← 새 파일
- `src/app/api/sales/summary/route.ts` ← 새 파일
- `src/app/api/sales/team-members/route.ts` ← 새 파일
- `src/app/api/sales/commission-settle/route.ts` ← 새 파일
- `src/app/api/sales/dispute/route.ts` ← 새 파일
- `prisma/schema.prisma` ← `AuditLog` 스키마 추가

---

## ✅ 최종 체크리스트

```
Phase 1: 페이지 구조
  ✅ 역할별 3가지 화면 (관리자/대리점장/판매원)
  ✅ 역할 확인 로직 (getSession)

Phase 2: API 필터링
  ✅ 권한 함수 4가지 (isAdmin, canViewTeamData 등)
  ✅ API 4가지 (summary, team-members, commission-settle, dispute)
  ✅ 각 API에서 권한 확인 + 403 에러 처리

Phase 3: 버튼 권한
  ✅ 버튼 5가지 권한 확인 함수
  ✅ 권한 없으면 숨기거나 회색 처리
  ✅ 마우스 올려도 설명 표시

Phase 4: 감사 로그
  ✅ AuditLog DB 스키마
  ✅ logAudit 함수
  ✅ 감사 로그 조회 화면 + 필터 + 다운로드

Phase 5: 테스트
  ✅ 역할별 UI 확인
  ✅ API 권한 테스트
  ✅ 감사 로그 기록 확인
  ✅ tsc --noEmit 0에러
  ✅ Lighthouse 90+

배포 준비
  ✅ 모든 변경사항 커밋
  ✅ 프로덕션 환경 변수 확인 (.env.production)
  ✅ 감사 로그 백업 계획 (월별 아카이빙)
```

---

**총 작업시간**: 8시간  
**예상 완료일**: 2026-06-18 (오늘) → 2026-06-19 내일 완료  
**팀**: Agent-Sales (판매관리 페이지) + Agent-Affiliate (수당 정산)
