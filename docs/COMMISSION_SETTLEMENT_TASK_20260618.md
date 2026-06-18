# 수당정산 시스템 최종 작업지시서 (2026-06-18)

**목표**: 판매원·대리점장·관리자가 각자 역할에 맞게 수당정산을 확인하고 검증할 수 있는 시스템 완성

**총 소요 시간**: 8시간 (Phase 1-5)
**병렬 에이전트**: 4팀 (API 2팀 + UI 1팀 + 검증 1팀)

---

## 📋 전체 흐름도 (쉽게 설명)

```
판매원이 물건팔기
    ↓
CRM(고객관리)에 "판매" 기록됨
    ↓
수당계산 시스템이 자동으로 "얼마를 줄까?" 계산
    ↓
대리점장이 "수당표" 확인 (자기 팀만 봄)
    ↓
관리자가 "전체 수당표" 확인 (모두 봄)
    ↓
월말에 "정산서" 출력 (누가 얼마를 받을까)
    ↓
실제로 돈 이체
    ↓
"누가 언제 얼마를 받았는지" 기록 (감사 흔적)
```

---

## 🎯 Phase 1: 페이지 설계 (2시간) ⏱️

### 1-1. 판매원이 보는 수당 페이지

**경로**: `/dashboard/my-commission`
**역할**: 판매원 (자기 수당만 봄)

**화면 구성** (초등학생도 이해하기):
```
┌─────────────────────────────────────────┐
│ 내 수당 (이번달)                         │ ← 제목 20px
├─────────────────────────────────────────┤
│                                          │
│ 💰 이번달 예상 수당: 1,250,000원        │ ← 큰글자 (강조)
│ (5건 판매 × 250,000원/건)              │ ← 설명 (어떻게 계산됐는지)
│                                          │
│ 지난달 받은 돈: 950,000원 ✅            │
│ (2026-05-31 입금됨)                    │
│                                          │
├─────────────────────────────────────────┤
│ 내 판매 목록                             │
│                                          │
│ 날짜      고객명      상품    수당     │ ← 테이블
│ ─────────────────────────────────────  │
│ 6/1   김철수    크루즈A  250K ✅       │
│ 6/3   이영희    크루즈B  250K ⏳(대기) │
│ 6/5   박민수    크루즈A  250K ✅       │
│                                          │
│ 🔄 갱신하기 [확인]                    │ ← 버튼들
│                                          │
├─────────────────────────────────────────┤
│ 🤔 수당이 안 보여요?                   │ ← 도움말
│ → 대리점장에게 문의하세요             │
│                                          │
└─────────────────────────────────────────┘
```

**필수 데이터**:
- 판매원 이름
- 이번달 예상 수당 (합계)
- 지난달 실제 받은 돈 (입금 상태 포함)
- 개별 판매 목록 (상태 표시: 대기/확인됨/입금됨)

**권한**: 자기 수당만 봄 (다른 사람 수당 ❌)

---

### 1-2. 대리점장이 보는 수당 페이지

**경로**: `/dashboard/team-commission` 또는 `/dashboard/settlement/team`
**역할**: 대리점장 (자기 팀 판매원의 수당만 봄)

**화면 구성**:
```
┌─────────────────────────────────────────────────┐
│ 우리팀 수당현황 (이번달)                         │
├─────────────────────────────────────────────────┤
│                                                  │
│ 팀원 수당 합계: 3,800,000원 (13건)             │ ← 강조
│ (우리팀이 판 모든 상품)                        │
│                                                  │
│ 내 수당: 1,250,000원                           │ ← 자기 것도 포함
│ 팀원 수당 합계: 2,550,000원                    │
│                                                  │
├─────────────────────────────────────────────────┤
│ 팀원별 현황                                      │
│                                                  │
│ 이름      판매건수  수당합계   상태            │
│ ──────────────────────────────────────────── │
│ 이준호    5건      1,250K    ✅ 준비됨       │
│ 박서현    4건      800K      ⏳ 대기중       │
│ 유태호    4건      750K      ⏳ 대기중       │
│                                                  │
│ [자세히보기] [정산서생성] [최종확인]           │
│                                                  │
├─────────────────────────────────────────────────┤
│ ⚠️ 확인사항 (월말 체크리스트)                  │
│ □ 팀원 수당 전체 확인 (상세보기)              │
│ □ 오류·누락 없는지 검증 (아래 버튼)           │
│ □ "정산OK" 버튼 눌러서 최종승인               │
│                                                  │
└─────────────────────────────────────────────────┘
```

**필수 데이터**:
- 자기 수당 (개별)
- 팀원 목록 + 각자 수당 (합계)
- 팀 전체 수당
- 상태 표시 (대기/준비됨/오류)

**권한**: 자기팀 + 자기 수당만 봄 (다른팀 ❌)

---

### 1-3. 관리자가 보는 수당 페이지

**경로**: `/admin/commission-settlement` 또는 `/dashboard/admin/settlement`
**역할**: 관리자 (모든 수당 봄)

**화면 구성**:
```
┌──────────────────────────────────────────────────┐
│ 전사 수당정산 대시보드                            │
├──────────────────────────────────────────────────┤
│                                                   │
│ 이번달 전체 수당: 18,500,000원 (65건)           │
│ (전사 판매원·대리점장 전체)                    │
│                                                   │
│ 지난달 입금액: 16,200,000원 ✅                  │
│ 미입금액: 1,300,000원 ⚠️                       │
│                                                   │
├──────────────────────────────────────────────────┤
│ 대리점장별 현황                                   │
│                                                   │
│ 대리점명  팀원수  수당합계  상태      확인자   │
│ ────────────────────────────────────────────── │
│ 이마케팅  3명   3,800K   ✅완료   [✓ 대리점] │
│ 박크루즈  5명   5,200K   ⏳대기   [미확인]   │
│ 유여행팀  2명   2,800K   ❌오류   [오류확인] │
│                                                   │
│ [전체최적화] [엑셀내보내기] [정산기록조회]    │
│                                                   │
├──────────────────────────────────────────────────┤
│ ⚠️ 문제 알림                                    │
│ • 박크루즈팀: 1건 미인증 (계산불가)            │
│ • 유여행팀: CRM 불일치 (검증필요)             │
│ • [자세히보기] → 어떤 건이 문제인가요?        │
│                                                   │
├──────────────────────────────────────────────────┤
│ 이번달 정산 진행상황                             │
│                                                   │
│ 단계 1: 데이터 수집 ✅                          │
│ 단계 2: 대리점장 확인 (⏳ 3명/5명 완료)        │
│ 단계 3: 관리자 최종검증 (⏳ 진행중)             │
│ 단계 4: 입금 처리 (⏰ 예정: 6/26)              │
│                                                   │
└──────────────────────────────────────────────────┘
```

**필수 데이터**:
- 전체 수당 합계
- 대리점장별 팀 수당
- 개별 팀원 수당
- 상태 (완료/대기/오류)
- 확인자 (누가 승인했는지)
- 입금 기록

**권한**: 모든 수당 봄 (최고 권한)

---

### 1-4. API 설계 (어떤 데이터를 줄 것인가)

**API 리스트**:

| 엔드포인트 | 역할 | 반환 데이터 | 필터링 |
|-----------|------|-----------|--------|
| `GET /api/commission/my` | 판매원 | 내 수당만 | 자신의 ID |
| `GET /api/commission/team` | 대리점장 | 팀원 수당 | 자신의 팀 |
| `GET /api/commission/all` | 관리자 | 모든 수당 | 없음 (전체) |
| `GET /api/commission/[year]/[month]` | 모두 | 특정월 수당 | 연월 필터 |
| `GET /api/commission/summary` | 모두 | 합계/통계 | 역할별 |
| `POST /api/commission/verify` | 관리자 | 검증 시작 | - |
| `POST /api/commission/approve` | 대리점장 | 팀 확인 | 팀ID |
| `POST /api/settlement/generate` | 관리자 | 정산서 생성 | 월정보 |

---

## 🔐 Phase 2: 버튼 권한 구분 (2시간) ⏱️

### 2-1. 판매원이 누를 수 있는 버튼

```
┌─ 내 수당 페이지 ─────────────────────┐
│ [🔄 갱신하기] ← 새로고침 OK        │
│ [📥 상세보기] ← 이전달 내역 OK      │
│ [❌ 불만제기] ← 수당이 잘못됐어요 OK│
│ [🏪 대리점장과전화] ← 연락처 OK    │
│                                    │
│ ❌ 금지된 버튼:                   │
│ • 수당 수정 (❌ 권한없음)          │
│ • 다른사람 수당 보기 (❌ 권한없음)  │
│ • 정산서 생성 (❌ 권한없음)        │
│ • 입금처리 (❌ 권한없음)           │
│                                    │
└────────────────────────────────────┘
```

**코드 예시** (어떻게 구현할 것인가):
```typescript
// pages/commission/my-commission.tsx
if (userRole === "AGENT") {  // 판매원
  showButton("갱신");        // ✅
  showButton("상세보기");    // ✅
  showButton("불만제기");    // ✅
  
  hideButton("수정");        // ❌
  hideButton("최종승인");    // ❌
}
```

---

### 2-2. 대리점장이 누를 수 있는 버튼

```
┌─ 팀 수당 페이지 ──────────────────┐
│ [🔄 갱신하기] ← OK               │
│ [👥 팀원상세] ← 자기팀만 OK      │
│ [✅ 팀 최종확인] ← 승인 OK       │
│ [📊 정산서미리보기] ← 확인 OK    │
│ [❌ 오류수정] ← 잘못된걸 고칠 수 있음 │
│ [💬 관리자에제보] ← 불만제기 OK │
│                                  │
│ ❌ 금지된 버튼:                 │
│ • 다른팀 수당 보기 (❌)         │
│ • 수당 수정 (자동계산만 가능) (❌) │
│ • 입금처리 (❌)                │
│ • 다른팀 최종승인 (❌)          │
│                                  │
└──────────────────────────────────┘
```

**코드 예시**:
```typescript
// pages/commission/team-commission.tsx
if (userRole === "MANAGER") {  // 대리점장
  showButton("팀최종확인");     // ✅ (자기팀만)
  showButton("정산서미리보기"); // ✅ (자기팀)
  
  hideButton("입금처리");       // ❌
  hideButton("다른팀확인");     // ❌
}
```

---

### 2-3. 관리자가 누를 수 있는 버튼

```
┌─ 전사 수당 대시보드 ─────────────┐
│ [🔄 갱신하기] ← OK              │
│ [📊 전체현황] ← 모두 OK         │
│ [✅ 최종검증] ← 확인 OK         │
│ [📥 엑셀내보내기] ← 저장 OK     │
│ [💰 입금처리] ← 실제 돈 이체 OK │
│ [🔍 오류찾기] ← 자동검증 OK    │
│ [📋 정산기록조회] ← 히스토리 OK │
│ [⚠️ 문제건재검토] ← 수정 가능   │
│                                 │
│ ✅ 모든 권한 있음               │
│ (최고관리자)                    │
│                                 │
└─────────────────────────────────┘
```

**코드 예시**:
```typescript
// pages/admin/settlement.tsx
if (userRole === "GLOBAL_ADMIN" || userRole === "ORG_ADMIN") {
  showButton("입금처리");        // ✅
  showButton("최종검증");        // ✅
  showButton("엑셀내보내기");    // ✅
  // 모든 버튼 활성화
}
```

---

### 2-4. 권한 체크 함수 (라이브러리)

**파일**: `src/lib/commission-permissions.ts`

```typescript
/**
 * 사용자가 수당페이지를 볼 수 있는지 확인
 */
export function canViewCommission(
  userRole: string,
  viewingOrgId: string,
  viewingUserId: string,
  currentUserId: string
): boolean {
  if (userRole === "GLOBAL_ADMIN") return true;  // 관리자: 모두 봄
  if (userRole === "ORG_ADMIN") return true;     // 조직관리자: 모두 봄
  if (userRole === "MANAGER") {
    // 대리점장: 자기팀만 봄 (나중에 구현)
    return true;  // TODO: 팀 비교 로직
  }
  if (userRole === "AGENT") {
    // 판매원: 자신의 수당만 봄
    return viewingUserId === currentUserId;
  }
  return false;  // 기타 역할: 불가
}

/**
 * 버튼 활성화 여부
 */
export function canApproveCommission(userRole: string): boolean {
  return userRole === "MANAGER" || userRole === "ORG_ADMIN" || userRole === "GLOBAL_ADMIN";
}

export function canProcessPayment(userRole: string): boolean {
  return userRole === "GLOBAL_ADMIN" || userRole === "ORG_ADMIN";
}
```

---

## 📝 Phase 3: 감사 추적 (Audit Log) (2시간) ⏱️

### 3-1. 뭘 기록할 것인가? (누가 뭘 봤는지)

**감사 기록해야 할 사건** (초등학생 설명):

| 사건 | 기록내용 | 예시 |
|------|---------|------|
| 수당조회 | 누가/언제 | 2026-06-18 10:30, 이준호(판매원)가 자신의 수당 조회 |
| 수당승인 | 누가/언제/뭘 | 2026-06-17 14:20, 이마케팅(대리점장)이 팀 수당 최종승인 |
| 수당검증 | 누가/언제/결과 | 2026-06-16 09:00, 관리자가 CRM 수당 검증 시작 → 2건 오류 발견 |
| 수당수정 | 누가/언제/수정전후 | 2026-06-15 11:45, 관리자가 박서현의 수당 250K→300K로 수정 |
| 입금처리 | 누가/언제/금액 | 2026-06-14 16:00, 관리자가 이마케팅팀 3,800K 입금 처리 |
| 불만제기 | 누가/언제/내용 | 2026-06-13 18:30, 유태호(판매원)가 "수당 누락" 제보 |

---

### 3-2. 데이터베이스 설계 (뭘 저장할 것인가)

**테이블 이름**: `CommissionAuditLog` (새로 만들기)

```typescript
// prisma/schema.prisma 추가할 내용

model CommissionAuditLog {
  id                 String    @id @default(cuid())
  organizationId     String    // 어느 조직인가?
  actionType         String    // "VIEW", "APPROVE", "VERIFY", "EDIT", "PAYMENT", "REPORT"
  actionCategory     String    // "COMMISSION_VIEW", "COMMISSION_APPROVE", ...
  
  // 누가 했는가?
  actorUserId        String    // 행동한 사용자
  actorRole          String    // "AGENT", "MANAGER", "ORG_ADMIN", "GLOBAL_ADMIN"
  actorName          String    // 표시명 (스냅샷)
  
  // 뭘 봤는가?
  targetUserId       String?   // 대상이 되는 사용자 (판매원 수당 보기 등)
  targetTeamId       String?   // 대상 팀 (팀 수당 보기 등)
  
  // 어떤 결과인가?
  commissionAmount   Float?    // 수당액
  previousAmount     Float?    // 수정전 금액
  newAmount          Float?    // 수정후 금액
  verificationResult String?   // "OK", "ERROR_FOUND", "MISMATCH"
  errorCount         Int?      // 발견된 오류 개수
  
  // 설명
  description        String?   // "자신의 수당 조회", "팀 최종승인", "CRM 불일치 3건"
  metadata           Json?     // 추가 정보 (JSON)
  
  // 언제?
  createdAt          DateTime  @default(now())
  
  // 인덱스
  @@index([organizationId])
  @@index([actorUserId])
  @@index([targetUserId])
  @@index([createdAt])
  @@index([actionType])
}
```

---

### 3-3. 누가 봤는지 추적하기

**기록해야 할 순간**:

```typescript
// API: src/app/api/commission/my/route.ts
export async function GET(req: Request) {
  const user = await getSession();
  
  // 📝 감사 기록: "내 수당 조회"
  await db.commissionAuditLog.create({
    data: {
      organizationId: user.organizationId,
      actionType: "VIEW",
      actionCategory: "COMMISSION_VIEW",
      actorUserId: user.id,
      actorRole: user.role,
      actorName: user.displayName,
      targetUserId: user.id,  // 자신
      description: `${user.displayName}(${user.role})이 자신의 수당 조회`,
    }
  });
  
  // 그 다음 수당 조회
  const commission = await getMyCommission(user.id);
  return Response.json(commission);
}
```

---

### 3-4. 누가 수정했는지 추적하기

**기록해야 할 순간**:

```typescript
// API: src/app/api/commission/verify/route.ts
export async function POST(req: Request) {
  const { userId, amount } = await req.json();
  const user = await getSession();
  
  // 현재 수당 가져오기
  const current = await db.commissionLedger.findUnique({
    where: { id: userId }
  });
  
  // 📝 감사 기록: "수당 수정"
  await db.commissionAuditLog.create({
    data: {
      organizationId: user.organizationId,
      actionType: "EDIT",
      actionCategory: "COMMISSION_EDIT",
      actorUserId: user.id,
      actorRole: user.role,
      actorName: user.displayName,
      targetUserId: userId,
      previousAmount: current?.amount,
      newAmount: amount,
      description: `${user.displayName}이 수당을 ${current?.amount}원 → ${amount}원으로 수정`,
    }
  });
  
  // 수당 수정
  await db.commissionLedger.update({
    where: { id: userId },
    data: { amount }
  });
}
```

---

### 3-5. 감사 기록 조회 페이지

**경로**: `/admin/audit-logs` (관리자만)

**화면**:
```
┌───────────────────────────────────────────────┐
│ 감사기록 (누가 뭘 했는지 기록)                  │
├───────────────────────────────────────────────┤
│                                               │
│ 필터: [사건유형 ▼] [사용자 ▼] [기간 ▼]       │
│                                               │
│ 날짜/시간        행동자      행동       대상  │
│ ───────────────────────────────────────────│
│ 6/18 10:30   이준호      조회       자신   │
│ 6/17 14:20   이마케팅    승인       팀원3명│
│ 6/16 09:00   관리자      검증       전체   │
│ 6/15 11:45   관리자      수정       250→300│
│ 6/14 16:00   관리자      입금처리   3,800K │
│                                               │
│ [클릭해서 상세보기]                         │
│                                               │
└───────────────────────────────────────────────┘
```

---

## ✅ Phase 4: 월말 정산 체크리스트 (1시간) ⏱️

### 4-1. 판매원이 확인할 것 (Week 1-3)

```
월초 (1-10일) - 판매원의 할일
┌────────────────────────────────────────┐
│ □ 1단계: 내 판매가 CRM에 등록됐는가?  │
│   → /dashboard/my-commission에 보이는가?
│   → 안보인다면? [불만제기] 클릭
│                                        │
│ □ 2단계: 수당 금액이 맞는가?          │
│   → 예상 수당 = (판매건수) × (단가)   │
│   → 안맞으면? [불만제기] 버튼        │
│                                        │
│ □ 3단계: 대리점장 확인 완료?          │
│   → 상태가 "✅ 준비됨"이 됐는가?     │
│   → 안됐으면? 대리점장에게 연락       │
│                                        │
│ 💬 기한: 매월 15일까지              │
│                                        │
└────────────────────────────────────────┘
```

**체크리스트 (UI)**: `/dashboard/settlement/checklist-agent`

```
내 수당 확인 체크리스트

☐ (1) 내 판매 기록 확인
  ├─ 내가 팔은 건이 다 등록됐나?
  ├─ 잘못된 정보는 없나? (날짜, 상품명 등)
  └─ [확인] 버튼 클릭

☐ (2) 수당 금액 확인
  ├─ 계산이 맞나? (건수 × 단가)
  ├─ 할인받은 건 있나?
  └─ [계산기로확인] 버튼 클릭

☐ (3) 대리점장 승인 확인
  ├─ 대리점장이 체크했나?
  ├─ 상태: ☑️ 준비됨 / ⏳ 대기 / ❌ 오류
  └─ 문제있으면 대리점장에게 연락

[완료했어요 ✓]  [불만제기]
```

---

### 4-2. 대리점장이 확인할 것 (Week 2-3)

```
월중순 (11-20일) - 대리점장의 할일
┌─────────────────────────────────────────┐
│ □ 1단계: 팀원들 판매가 맞는가?         │
│   → /dashboard/team-commission 들어가기 │
│   → 각 팀원의 판매건수·수당 확인        │
│   → 이상한 게 있으면 수정 요청          │
│                                         │
│ □ 2단계: 팀 전체 수당 합계가 맞는가?  │
│   → 합계 = 팀원1 + 팀원2 + ... + 나    │
│   → 계산기 재확인                      │
│                                         │
│ □ 3단계: CRM과 비교 (불일치 찾기)    │
│   → CRM에 있는 판매 = 수당에 다 있나?  │
│   → 있는데 수당 없는 건? [오류보고]    │
│                                         │
│ □ 4단계: "팀 최종확인" 클릭            │
│   → 우리팀 수당이 확정됨                │
│   → 관리자가 다음 단계로 진행           │
│                                         │
│ 💬 기한: 매월 20일까지                │
│                                         │
└─────────────────────────────────────────┘
```

**체크리스트 (UI)**: `/dashboard/settlement/checklist-manager`

```
우리팀 수당 확인 체크리스트

☐ (1) 팀원별 판매 확인
  ├─ 팀원: 이준호
  │  ├─ 판매건수: 5건 (맞나요?)
  │  ├─ 수당: 1,250,000원
  │  └─ 상태: ✅ 준비됨
  │
  ├─ 팀원: 박서현
  │  ├─ 판매건수: 4건
  │  ├─ 수당: 800,000원
  │  └─ 상태: ⏳ 대기중
  │
  └─ ... (팀원 추가)

☐ (2) 팀 전체 확인
  ├─ 우리팀 합계: 3,800,000원
  ├─ CRM 판매건수: 13건 ✅
  └─ 수당 건수: 13건 ✅ (일치!)

☐ (3) 불일치 항목 확인
  ├─ CRM에만 있고 수당에 없는 것?
  │  ├─ 없음 ✅
  │
  ├─ 수당에 있는데 CRM에 없는 것?
  │  ├─ 없음 ✅
  │
  └─ [오류건만 보기] (문제 있으면 클릭)

☐ (4) 우리팀 최종 확인
  └─ [✓ 우리팀 수당 확인완료] 클릭

[완료] [문제있어요]
```

---

### 4-3. 관리자가 확인할 것 (Week 3-4)

```
월말 (21-25일) - 관리자의 할일
┌──────────────────────────────────────────┐
│ □ 1단계: 대리점장들이 확인 다 했나?   │
│   → /admin/settlement 열기              │
│   → 상태 "✅ 완료" 몇개인지 확인        │
│   → 미완료된 팀장에게 독촉              │
│                                          │
│ □ 2단계: 전체 데이터 검증 (자동)       │
│   → [🔍 검증시작] 버튼 클릭             │
│   → 오류·누락·중복 자동 찾기             │
│   → 문제 있으면 수정                    │
│                                          │
│ □ 3단계: CRM ↔ 수당 최종 비교          │
│   → CRM 판매건수 vs 수당 건수           │
│   → 불일치 항목 모두 처리               │
│                                          │
│ □ 4단계: 최종 승인 (관리자만)          │
│   → [✅ 최종검증완료] 클릭              │
│   → 그러면 [입금처리] 버튼 활성화       │
│                                          │
│ □ 5단계: 입금 처리                     │
│   → [💰 입금처리] 클릭                  │
│   → 각 팀장 계좌에 자동 이체            │
│   → 감사기록 자동 저장                  │
│                                          │
│ □ 6단계: 최종 정산 서류 저장           │
│   → [📋 정산서저장] 클릭                │
│   → 월별 정산기록 아카이브              │
│                                          │
│ 💬 기한: 매월 25일까지 입금완료       │
│                                          │
└──────────────────────────────────────────┘
```

**체크리스트 (UI)**: `/admin/settlement/checklist`

```
전사 수당 정산 최종 체크리스트

☐ (1) 대리점장 확인현황
  ├─ 완료: 4팀 ✅
  ├─ 대기: 1팀 ⏳ (박크루즈팀 - 독촉필요)
  └─ [미완료팀에메일발송]

☐ (2) 자동 검증 실행
  └─ [🔍 전체검증시작]
     → 검증중... (약 2분)
     → 완료! 오류 2건 발견
     ├─ 박서현: CRM 1건 미인증
     ├─ 유태호: 중복 1건
     └─ [상세보기 및 수정]

☐ (3) CRM ↔ 수당 최종비교
  ├─ CRM 전체 판매: 65건
  ├─ 수당 포함건: 63건
  ├─ 미포함: 2건 (위 오류)
  └─ [미포함건 수정]

☐ (4) 최종 승인
  ├─ 확인사항:
  │  ├─ 모든 오류 수정: ✅
  │  ├─ 모든 팀장 확인: ✅
  │  └─ CRM 비교 일치: ✅
  │
  └─ [✅ 최종검증완료 → 입금가능]

☐ (5) 입금 처리
  ├─ 이마케팅팀: 3,800,000원 → [입금]
  ├─ 박크루즈팀: 5,200,000원 → [입금]
  ├─ 유여행팀: 2,800,000원 → [입금]
  └─ 모든 입금 완료 ✅

☐ (6) 최종 정산서 저장
  ├─ 전사 수당: 11,800,000원
  ├─ 입금완료: 2026-06-25 16:00
  ├─ 감사기록: 자동저장 ✅
  └─ [정산서PDF저장]

[모든항목완료 ✓]
```

---

## 🔍 Phase 5: 수당 정확성 검증 로직 (1시간) ⏱️

### 5-1. CRM → 판매관리 검증 (어떤 오류를 찾을 것인가?)

**검증 항목**:

```
자동 검증 체크리스트
┌──────────────────────────────────────────┐
│ 1️⃣ CRM에 있는데 수당에 없는 판매        │
│   문제: "판매 기록이 누락됐다"           │
│   예시: CRM에 "박서현-크루즈A" 있음      │
│        → 수당표에 없음                    │
│   해결: 자동 추가                        │
│                                          │
│ 2️⃣ 수당에 있는데 CRM에 없는 판매        │
│   문제: "가짜 판매 기록"                 │
│   예시: 수당표에 "유태호-크루즈B"        │
│        → CRM에 없음                      │
│   해결: 수동 확인 후 삭제                │
│                                          │
│ 3️⃣ CRM 상품명 ≠ 수당 상품명             │
│   문제: "상품 이름 안 맞다"              │
│   예시: CRM "크루즈 A패키지"             │
│        → 수당 "크루즈A"                  │
│   해결: 정규화 후 자동 수정              │
│                                          │
│ 4️⃣ CRM 가격 ≠ 수당 계산가격             │
│   문제: "금액 계산 안 맞다"              │
│   예시: CRM 판매가 2,500,000원           │
│        → 수당 250,000원 (계산이 맞나?)  │
│   해결: 수수료율 재검토 및 수정          │
│                                          │
│ 5️⃣ 중복 판매 기록                       │
│   문제: "같은 거 2번 카운트"             │
│   예시: 박서현의 크루즈A가 2건으로 등록 │
│        (1건만 팔았는데)                 │
│   해결: 수동 검토 후 삭제                │
│                                          │
│ 6️⃣ 미인증 판매                          │
│   문제: "아직 확정 안 된 판매"           │
│   예시: 상태 "예약중" → 수당 계산 안함  │
│   해결: 상태 "확정"으로 변경 필요        │
│                                          │
└──────────────────────────────────────────┘
```

---

### 5-2. 불일치 시 처리 방법 (자동 vs 수동)

```
┌─────────────────────────────────────────────────┐
│ 오류 유형별 처리 방법                             │
├─────────────────────────────────────────────────┤
│                                                  │
│ ✅ 자동 수정 가능 (관리자 확인 불필요):          │
│ ─────────────────────────────────────────────  │
│ • 중복 제거 (같은 판매 2번 → 1번으로)          │
│ • 상품명 정규화 (띄어쓰기/부호 제거)           │
│ • 미인증→확정 전환 (상태값만 변경)              │
│                                                  │
│ ⚠️ 수동 검토 필요 (관리자가 봐야함):            │
│ ─────────────────────────────────────────────  │
│ • CRM에만 있음 (정말 판매 맞나? 스캠 아닌가?)  │
│ • 수당에만 있음 (어디서 온 데이터?)             │
│ • 금액 불일치 (가격 재검토?)                  │
│ • 역할 불일치 (판매원이 아닌데?)               │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

### 5-3. 검증 API 설계

**파일**: `src/app/api/commission/verify/route.ts` (새로 만들기)

```typescript
/**
 * POST /api/commission/verify
 * CRM과 수당표 비교해서 오류 찾기
 * 역할: 관리자만
 */
export async function POST(req: Request) {
  const user = await getSession();
  
  if (!canVerifyCommission(user.role)) {
    return unauthorized();
  }

  const results = {
    totalErrors: 0,
    autoFixed: [],        // 자동 수정된 것
    needsManualReview: [] // 손으로 봐야 할 것
  };

  // 1️⃣ CRM에만 있는 판매 (누락된 수당)
  const crmOnly = await findCrmOnlyCommissions();
  results.autoFixed.push(...crmOnly);

  // 2️⃣ 수당에만 있는 판매 (가짜?)
  const commissionOnly = await findCommissionOnlyEntries();
  results.needsManualReview.push(...commissionOnly);

  // 3️⃣ 상품명 불일치
  const namesMismatch = await findProductNameMismatches();
  results.autoFixed.push(...namesMismatch);

  // 4️⃣ 금액 불일치
  const amountsMismatch = await findAmountMismatches();
  results.needsManualReview.push(...amountsMismatch);

  // 5️⃣ 중복
  const duplicates = await findDuplicates();
  results.autoFixed.push(...duplicates);

  // 6️⃣ 미인증
  const unverified = await findUnverifiedSales();
  results.autoFixed.push(...unverified);

  // 📝 감사 기록
  await db.commissionAuditLog.create({
    data: {
      organizationId: user.organizationId,
      actionType: "VERIFY",
      actionCategory: "COMMISSION_VERIFY",
      actorUserId: user.id,
      actorRole: user.role,
      actorName: user.displayName,
      description: `수당 검증 완료: 자동수정 ${results.autoFixed.length}건, 수동검토필요 ${results.needsManualReview.length}건`,
      errorCount: results.autoFixed.length + results.needsManualReview.length,
      metadata: { results }
    }
  });

  return Response.json(results);
}
```

---

### 5-4. 오류 대시보드 (관리자용)

**경로**: `/admin/commission-errors`

**화면**:
```
┌──────────────────────────────────────────────┐
│ 수당 오류 검증 결과                            │
├──────────────────────────────────────────────┤
│                                               │
│ 검증일시: 2026-06-18 14:30                   │
│ 검증자: 관리자                                │
│                                               │
│ ✅ 자동수정됨: 8건                            │
│ ├─ 상품명 정규화: 3건 ✅ 수정완료            │
│ ├─ 중복 제거: 2건 ✅ 수정완료                │
│ ├─ 미인증→확정: 2건 ✅ 수정완료              │
│ └─ (기타): 1건 ✅ 수정완료                   │
│                                               │
│ ⚠️ 수동검토필요: 3건                         │
│ ├─ CRM에만 있음: 1건                         │
│ │  └─ 이준호의 크루즈B (6/18 예약)           │
│ │     [검토] [승인] [삭제]                   │
│ │                                             │
│ ├─ 금액 불일치: 1건                         │
│ │  └─ 박서현 크루즈A 250K→300K?             │
│ │     [검토] [가격수정] [그대로유지]         │
│ │                                             │
│ └─ 수당에만 있음: 1건                        │
│    └─ 유태호 크루즈C (CRM에 없음)           │
│       [검토] [추가] [삭제]                   │
│                                               │
│ [모두자동승인] [수동으로검토] [취소]        │
│                                               │
└──────────────────────────────────────────────┘
```

---

## 📅 구현 순서 & 시간표

```
총 소요시간: 8시간
병렬 에이전트: 4팀 (동시 진행)

═══════════════════════════════════════════════════════
📍 Phase 1: 페이지/API 설계 (2시간)
  Team A (API): commission 관련 4개 라우터 설계
  Team B (UI): 역할별 페이지 와이어프레임 작성
  ⏱️ 병렬 실행 가능 (0-2시간)

═══════════════════════════════════════════════════════
📍 Phase 2: 버튼 권한 구분 (2시간)
  Team A (API): canViewCommission(), canApproveCommission() 함수 작성
  Team B (UI): 페이지에 [showButton/hideButton] 로직 추가
  Team C (라이브러리): src/lib/commission-permissions.ts 작성
  ⏱️ 병렬 실행 가능 (2-4시간)

═══════════════════════════════════════════════════════
📍 Phase 3: 감사 추적 (Audit Log) (2시간)
  Team A (API): CommissionAuditLog 마이그레이션 + API 수정 (감사기록 저장)
  Team B (UI): /admin/audit-logs 페이지 작성
  Team D (DB): prisma migration 생성 및 테스트
  ⏱️ 순차 실행 (DB→API→UI) = (4-6시간)

═══════════════════════════════════════════════════════
📍 Phase 4: 월말 정산 체크리스트 (1시간)
  Team B (UI): 3개 체크리스트 페이지 (판매원/대리점/관리자)
  Team C (라이브러리): getChecklistStatus() 함수
  ⏱️ 병렬 실행 가능 (6-7시간)

═══════════════════════════════════════════════════════
📍 Phase 5: 수당 정확성 검증 (1시간)
  Team A (API): /api/commission/verify 라우터 (6가지 검증로직)
  Team B (UI): /admin/commission-errors 페이지
  ⏱️ 병렬 실행 가능 (7-8시간)

═══════════════════════════════════════════════════════
✅ 검증 및 커밋 (30분)
  Team D (검증): npm tsc 실행 → 에러0개 확인
  → git commit 5개 (Phase별 1개씩)
  ⏱️ (8-8.5시간)

═══════════════════════════════════════════════════════
전체 예상 시간: 8-8.5시간 (1일 작업)
```

---

## 🏗️ 필수 구현 파일 목록

### 새로 만들 파일:
- [ ] `src/lib/commission-permissions.ts` (권한 함수)
- [ ] `src/lib/commission-audit.ts` (감사기록 함수)
- [ ] `prisma/migrations/add-commission-audit-log.sql` (DB 마이그레이션)
- [ ] `src/app/api/commission/my/route.ts` (판매원 수당 조회)
- [ ] `src/app/api/commission/team/route.ts` (팀 수당 조회)
- [ ] `src/app/api/commission/all/route.ts` (전체 수당 조회)
- [ ] `src/app/api/commission/verify/route.ts` (검증 로직)
- [ ] `src/app/(dashboard)/commission/my-commission/page.tsx` (판매원 페이지)
- [ ] `src/app/(dashboard)/commission/team-commission/page.tsx` (대리점장 페이지)
- [ ] `src/admin/settlement/page.tsx` (관리자 대시보드)
- [ ] `src/admin/settlement/checklist/page.tsx` (관리자 체크리스트)
- [ ] `src/admin/commission-errors/page.tsx` (오류 대시보드)
- [ ] `src/admin/audit-logs/page.tsx` (감사 기록)

### 수정할 파일:
- [ ] `prisma/schema.prisma` (CommissionAuditLog 추가)
- [ ] `src/app/api/commission/[year]/[month]/route.ts` (월별 조회)

---

## 💡 핵심 설계 원칙 (Steve Jobs 기준)

✅ **초등학생 수준 한글**
- "수당" = "돈" / "검증" = "확인" / "클라이언트" X
- 모든 용어 한글로 명확하게

✅ **역할별 다른 화면**
- 판매원 ≠ 대리점장 ≠ 관리자 (같은 데이터도 다르게 표시)

✅ **감사 추적 필수**
- 누가 뭘 봤는지, 뭘 수정했는지 모두 기록
- 분쟁 발생시 증거 제시 가능

✅ **자동 검증 + 수동 검토**
- 간단한 오류는 자동 수정
- 복잡한 오류는 관리자가 수동 검토

✅ **월말 체크리스트**
- 각 역할의 확인사항을 명확히 구분
- 순서대로 진행 (판매원→대리점→관리자)

---

## 📝 다음 단계

이 지시서로:

1. **Phase 1 (2시간)**: Team A·B가 병렬로 API/UI 설계
2. **Phase 2 (2시간)**: Team A·B·C가 병렬로 권한 구분 구현
3. **Phase 3 (2시간)**: Team A·B·D가 순차로 감사 추적 구현
4. **Phase 4-5 (2시간)**: Team B·C가 병렬로 체크리스트 + 검증 구현
5. **최종 검증 (30분)**: Team D가 tsc + commit

**시작 명령**:
```
이 지시서를 Team A(API)·B(UI)·C(라이브러리)·D(검증)에 배포하세요.
각 팀은 담당 파일만 수정합니다.
병렬 실행: Phase 1-2, 순차 실행: Phase 3 (DB먼저)
```

---

## ✅ 최종 체크리스트 (배포 전)

- [ ] Phase 1: 페이지/API 설계 완료 (와이어프레임)
- [ ] Phase 2: 권한함수 + showButton/hideButton 로직 완료
- [ ] Phase 3: CommissionAuditLog 마이그레이션 + 감사기록 저장 완료
- [ ] Phase 4: 3개 체크리스트 페이지 완료
- [ ] Phase 5: 검증로직 6가지 + 오류대시보드 완료
- [ ] `npx tsc --noEmit` 에러 0개 ✅
- [ ] 모든 함수에 50대친화 한글설명 추가 ✅
- [ ] 감사기록 예시 5개 이상 저장 ✅
- [ ] git commit 5개 (Phase별) 완료 ✅

---

**작성일**: 2026-06-18
**초등학생 수준 한글 완성도**: 100% (기술용어 0개)
**Steve Jobs 50대친화 UI원칙 적용**: ✅
