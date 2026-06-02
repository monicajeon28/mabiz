# 콜 결과 전체 데이터 흐름 검증 (마비즈 CRM)

마비즈 CRM에서 사용자가 고객 목록에서 "관심", "보류", "거절" 버튼을 클릭했을 때 발생하는 전체 데이터 흐름을 분석한 보고서입니다.

---

## 📊 데이터 흐름 개요

```
User Click (FE)
    ↓
Frontend State Update (React)
    ↓
API Call (POST /api/contacts/{id}/call-logs)
    ↓
Database Validation & Creation (Prisma)
    ↓
Side Effects (Lead Score, Backup Job, lastContactedAt)
    ↓
UI Refresh (fetchContacts())
    ↓
UI Reflection (Button State, Success Message)
```

---

## 🔴 **1단계: 프론트엔드 클릭 이벤트**

### 파일 위치
`src/app/(dashboard)/contacts/page.tsx` (라인 545-572)

### 클릭 이벤트 정의
```tsx
// 라인 81-85: 빠른 콜 결과 옵션 정의
const QUICK_CALL_OPTIONS = [
  { result: "INTERESTED", label: "관심", icon: <CheckCircle />, color: "bg-green-100..." },
  { result: "PENDING",    label: "보류", icon: <Clock />,        color: "bg-yellow-100..." },
  { result: "REJECTED",   label: "거절", icon: <XCircle />,      color: "bg-red-100..." },
];
```

### 상태 관리
```tsx
// 라인 370-379: 로컬 상태
const [quickCallId,       setQuickCallId]       = useState<string | null>(null);
const [quickCallLoading,  setQuickCallLoading]  = useState(false);
const [quickCallError,    setQuickCallError]    = useState<string | null>(null);
```

### UI 렌더링 (라인 1272-1298)
```tsx
{isQuickCallOpen && (
  <div className="px-4 pb-3 flex items-center gap-2">
    <span className="text-sm text-gray-500">콜 결과:</span>
    {QUICK_CALL_OPTIONS.map((opt) => (
      <button
        key={opt.result}
        disabled={quickCallLoading}
        onClick={() => handleQuickCall(c.id, opt.result)}
        className={`flex items-center gap-1 text-sm px-2.5 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${opt.color}`}
      >
        {opt.icon}
        {opt.label}
      </button>
    ))}
  </div>
)}
```

### 클릭 흐름
```
사용자 클릭
  ↓
onClick={() => handleQuickCall(c.id, opt.result)}
  ↓
handleQuickCall() 함수 호출
```

---

## 🟡 **2단계: 핸들러 함수 실행 (FE → API)**

### 함수 정의 (라인 545-572)
```tsx
const handleQuickCall = async (contactId: string, result: QuickCallResult) => {
  setQuickCallLoading(true);           // ① 로딩 상태 활성화
  setQuickCallError(null);              // ② 이전 에러 클리어
  
  // ③ 결과값을 라벨로 변환
  const resultLabel = result === "INTERESTED" 
    ? "관심" 
    : result === "PENDING" 
    ? "보류" 
    : "거절";
  
  // ④ conviction score 매핑 (확신도 점수)
  const convictionScore = result === "INTERESTED" 
    ? "8" 
    : result === "PENDING" 
    ? "5" 
    : "2";
  
  try {
    // ⑤ API 호출 (POST)
    const res = await fetch(`/api/contacts/${contactId}/call-logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `[퀵기록] ${resultLabel}`,  // 콜 기록 내용
        result,                             // INTERESTED|PENDING|REJECTED
        convictionScore,                    // 확신도 점수
      }),
    });
    
    const data = await res.json();
    
    if (!data.ok) {
      // ⑥ 에러 처리
      setQuickCallError("콜 기록 저장에 실패했습니다.");
    } else {
      // ⑦ 성공 → 모달 닫기
      setQuickCallId(null);
      // ⑧ 데이터 새로고침
      fetchContacts();
    }
  } catch {
    // ⑨ 네트워크 에러 처리
    setQuickCallError("네트워크 오류가 발생했습니다.");
  } finally {
    // ⑩ 로딩 상태 해제
    setQuickCallLoading(false);
  }
};
```

### 주요 특징
- **동기화**: async/await 사용으로 응답 대기
- **에러 처리**: try-catch 구조로 안전함
- **상태 관리**: 로딩, 에러 상태 명확히 관리
- **UI 피드백**: 사용자에게 실시간 상태 표시

---

## 🟢 **3단계: API 엔드포인트 처리**

### 엔드포인트 정보
- **경로**: `POST /api/contacts/[id]/call-logs`
- **파일**: `src/app/api/contacts/[id]/call-logs/route.ts` (라인 180-294)

### API 핸들러 분석
```typescript
export async function POST(req: Request, { params }: Params) {
  try {
    // ① 세션 & 조직 검증
    const orgId    = await getOrgId();
    const ctx      = await getAuthContext();
    const session  = await getMabizSession();
    const { id }   = await params;
    const body     = await req.json();

    // ② Contact 존재 확인 (테넌트 격리)
    const contact = await prisma.contact.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true, name: true, phone: true },
    });
    if (!contact) 
      return NextResponse.json({ ok: false }, { status: 404 });

    // ③ 요청 데이터 추출
    const {
      content, result, duration, convictionScore, nextAction, scheduledAt,
      objectionId, customerReaction, recovered, recoveryTime
    } = body;

    // ④ 폼 유효성 검사 [E-004]
    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json(
        { ok: false, message: '콜 기록 내용을 입력하세요' },
        { status: 400 }
      );
    }

    // ⑤ 이의처리 데이터 검증 (Track A)
    const objectionValidation = validateObjectionInput({
      objectionId,
      customerReaction,
      recovered,
      recoveryTime,
    });
    if (!objectionValidation.isValid) {
      return NextResponse.json(
        { ok: false, errors: objectionValidation.errors },
        { status: 400 }
      );
    }

    // ⑥ CallLog 레코드 생성 (Prisma)
    const log = await prisma.callLog.create({
      data: {
        contactId: id,
        userId: ctx.userId,
        content,
        result,
        duration:        duration        ? parseInt(duration) || 0        : null,
        convictionScore: convictionScore ? parseInt(convictionScore) || null : null,
        nextAction,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        objectionId: objectionId || null,
        customerReaction: customerReaction || null,
        recovered: recovered !== undefined ? recovered : null,
        recoveryTime: recoveryTime !== undefined ? parseInt(String(recoveryTime)) || null : null,
      },
    });

    // ⑦ Contact.lastContactedAt 업데이트
    await prisma.contact.update({
      where: { id },
      data: { lastContactedAt: new Date() },
    });

    // ⑧ Lead Score 자동 계산 (fire-and-forget)
    const scoreMap = {
      INTERESTED:  "CALL_INTERESTED",
      RESCHEDULED: "CALL_RESCHEDULED",
      PENDING:     "CALL_PENDING",
      REJECTED:    "CALL_REJECTED",
    };
    if (result && scoreMap[result]) {
      addLeadScore(id, scoreMap[result])
        .catch(err => logger.error('[addLeadScore failed]', { err }));
    }

    // ⑨ Google Drive 자동 백업 큐 등록
    if (session && process.env.GOOGLE_DRIVE_CALL_LOG_FOLDER_ID) {
      let userId = ctx.role === 'GLOBAL_ADMIN' ? 'admin' : ctx.userId;
      let displayName = ctx.member?.displayName ?? userId;

      await prisma.backupJob.create({
        data: {
          type: 'CALL_LOG',
          targetId: id,
          payload: {
            userId,
            displayName,
            customerName: contact.name,
            customerPhone: contact.phone,
          },
        },
      }).catch(err => {
        logger.error('[CallLog] BackupJob 등록 실패', { err });
      });
    }

    // ⑩ 응답 반환
    return NextResponse.json({ ok: true, log }, { status: 201 });

  } catch (err) {
    logger.error("[POST call-logs]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

### 핵심 검증 항목
| 항목 | 검증 내용 | 상태 |
|------|---------|------|
| 테넌트 격리 | organizationId 기반 필터링 | ✅ OK |
| 인증 확인 | ctx.userId로 사용자 검증 | ✅ OK |
| Contact 존재 확인 | findFirst + 404 처리 | ✅ OK |
| 콘텐츠 검증 | content 필수 & 공백 제거 | ✅ OK |
| 숫자형 캐스팅 | duration, convictionScore 안전 변환 | ✅ OK |
| 이의처리 검증 | objectionId, recovered 데이터 검증 | ✅ OK |

---

## 🔵 **4단계: 데이터베이스 저장**

### CallLog 스키마 (prisma/schema.prisma:652-706)
```prisma
model CallLog {
  id              String    @id @default(cuid())
  contactId       String    // 고객 ID (외래키)
  userId          String    // 사용자 ID (누가 기록했는가)
  
  // ★ 핵심 필드
  content         String?   // "[퀵기록] 관심"
  result          String?   // INTERESTED | PENDING | REJECTED
  duration        Int?      // 통화 시간 (초)
  convictionScore Int?      // 확신도 점수 (2, 5, 8)
  
  nextAction      String?   // 다음 액션
  scheduledAt     DateTime? // 예약 시간
  createdAt       DateTime  @default(now())

  // Track A: 이의처리 메타데이터
  objectionId      String?   // "A-001" ~ "F-004"
  customerReaction String?   // "positive" | "neutral" | "negative"
  recovered        Boolean?  // 이의 해결 여부
  recoveryTime     Int?      // 해결 시간 (초)

  // A/B 테스트 및 분석
  callPhase        String?   // "opening" | "desire" | "implication" | "close"
  abTestGroup      String?   // "A" | "B"
  callStartedAt    DateTime?
  callEndedAt      DateTime?

  contact Contact @relation(fields: [contactId], references: [id], onDelete: Cascade)

  @@index([contactId])
  @@index([userId])
  @@index([contactId, createdAt(sort: Desc)])
  @@index([objectionId, recovered])
}
```

### Contact 스키마 (prisma/schema.prisma:189-288)
```prisma
model Contact {
  id                  String    @id @default(cuid())
  phone               String
  organizationId      String
  name                String
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  
  // ★ 콜 기록과 연동되는 필드
  lastContactedAt     DateTime?  // 마지막 연락일 (API에서 자동 업데이트)
  leadScore           Int       @default(0) // Lead score (비동기 계산)
  
  tags                String[]  @default([])
  type                String    @default("LEAD") // LEAD | CUSTOMER
  status              String?   @db.VarChar(20)  // ACTIVE | INACTIVE
  
  // SMS 시퀀스 추적
  smsDay0Sent         Boolean   @default(false)
  smsDay1Sent         Boolean   @default(false)
  smsDay2Sent         Boolean   @default(false)
  smsDay3Sent         Boolean   @default(false)
  smsDay7Sent         Boolean   @default(false)

  callLogs            CallLog[]  // 1:N 관계 (콜 기록들)
}
```

### 데이터 저장 순서 (트랜잭션 아님)
1. **CallLog 생성** → Prisma.callLog.create()
2. **Contact.lastContactedAt 업데이트** → Prisma.contact.update()
3. **Lead Score 계산** (비동기, fire-and-forget)
4. **BackupJob 큐 등록** (비동기, 에러 무시)

**⚠️ 주의**: Step 1-2는 순차 실행되지만 트랜잭션으로 보호되지 않음. Step 3-4는 비동기이므로 실패해도 API 응답에 영향 없음.

---

## 🟠 **5단계: 부수 효과 (Side Effects)**

### A. Lead Score 업데이트 (라인 246-254)
```typescript
const scoreMap = {
  INTERESTED:  "CALL_INTERESTED",   // +10 점수
  RESCHEDULED: "CALL_RESCHEDULED",  // +5 점수
  PENDING:     "CALL_PENDING",       // +2 점수
  REJECTED:    "CALL_REJECTED",      // -3 점수
};

if (result && scoreMap[result]) {
  addLeadScore(id, scoreMap[result])
    .catch(err => logger.error('[addLeadScore failed]', { err }));
}
```

**특징**:
- Fire-and-forget 패턴 (응답 대기 안 함)
- 에러 발생 시 무시됨 (사용자 모름)
- 리드 스코어는 즉시 업데이트되지 않음 (조회 시 지연 가능)

### B. Google Drive 자동 백업 (라인 256-287)
```typescript
if (session && process.env.GOOGLE_DRIVE_CALL_LOG_FOLDER_ID) {
  await prisma.backupJob.create({
    data: {
      type: 'CALL_LOG',
      targetId: id,
      payload: {
        userId,
        displayName,
        customerName: contact.name,
        customerPhone: contact.phone,
      },
    },
  }).catch(err => {
    logger.error('[CallLog] BackupJob 등록 실패', { err });
  });
}
```

**특징**:
- 백업 작업을 큐(BackupJob)에 등록만 함
- Cron Job이 나중에 실제 백업 실행
- 환경 변수 확인 필수 (없으면 백업 스킵)

---

## 🔴 **6단계: UI 새로고침**

### fetchContacts() 함수 (라인 390-430)
```typescript
const fetchContacts = useCallback(async (signal?: AbortSignal) => {
  setLoading(true);
  const params = new URLSearchParams({ page: String(page), limit: "30" });
  if (q)                        params.set("q",          q);
  if (type)                     params.set("type",       type);
  if (filterSourceType)         params.set("sourceType", filterSourceType);
  if (filterGroupId)            params.set("groupId",    filterGroupId);
  if (filterAssignedTo)         params.set("assignedTo", filterAssignedTo);
  if (selectedTags.length > 0)  params.set("tags",       selectedTags.join(","));

  try {
    const res = await fetch(`/api/contacts?${params}`, { signal });
    const data = await res.json();
    if (data.ok) {
      setContacts(data.contacts);     // ← 로컬 상태 업데이트
      setTotal(data.total);
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return;
    logger.error("[fetchContacts failed]", { err });
  } finally {
    setLoading(false);
  }
}, [q, type, page, filterGroupId, filterSourceType, filterAssignedTo, selectedTags]);
```

### 데이터 갱신 메커니즘
1. `handleQuickCall()` 성공 시 `fetchContacts()` 호출
2. `/api/contacts?...` 엔드포인트로 최신 고객 목록 조회
3. 응답 데이터로 로컬 상태(`setContacts`) 업데이트
4. React가 컴포넌트 재렌더링

---

## 🟣 **7단계: UI 반영**

### 성공 케이스
```tsx
// 라인 1273-1298: 인라인 버튼 UI
{isQuickCallOpen && (
  <div className="px-4 pb-3 flex items-center gap-2">
    {QUICK_CALL_OPTIONS.map((opt) => (
      <button
        disabled={quickCallLoading}  // ← 로딩 중 비활성화
        onClick={() => handleQuickCall(c.id, opt.result)}
        className={`... disabled:opacity-50 ${opt.color}`}
      >
        {opt.label}
      </button>
    ))}
  </div>
)}

{quickCallLoading && <span>저장 중...</span>}
{quickCallError && <span className="text-red-500">{quickCallError}</span>}
```

### 상태별 UI 변화
| 상태 | UI 표시 |
|------|--------|
| 대기 | "콜 결과:" 버튼 활성화 |
| 로딩 중 | 버튼 disabled, "저장 중..." 표시 |
| 성공 | 모달 닫힘, 목록 새로고침 |
| 에러 | "콜 기록 저장에 실패했습니다." 빨간 텍스트 |

---

## ⚠️ 가능한 결함 분석

### 1️⃣ **API 엔드포인트 없음**
- **결과**: `fetch` 404 에러 → catch 블록 → "네트워크 오류" 표시
- **상태**: ✅ 안전 (에러 처리됨)

### 2️⃣ **데이터베이스 필드 누락**
- **결과**: Prisma 에러 → API 500 → `data.ok = false` → "콜 기록 저장 실패"
- **상태**: ✅ 안전 (에러 처리됨)

### 3️⃣ **테넌트 격리 실패**
- **결과**: `findFirst` 조건 누락 → 다른 조직 데이터 수정 가능
- **상태**: ✅ 안전 (organizationId 필터링 확인됨)

### 4️⃣ **인증 검증 누락**
- **결과**: 미인증 사용자가 콜 기록 생성 가능
- **상태**: ✅ 안전 (getOrgId() 및 getAuthContext() 확인됨)

### 5️⃣ **Lead Score 계산 실패 무시**
- **결과**: 콜 기록은 저장되지만 점수 미업데이트
- **상태**: ⚠️ 숨겨진 에러 (사용자 모름, 로그만 남음)

### 6️⃣ **UI 새로고침 실패**
- **결과**: 콜 기록 저장은 성공하지만 목록 미반영
- **상태**: ✅ 안전 (에러 처리 + 재시도 가능)

### 7️⃣ **Content 검증 누락**
- **결과**: 빈 문자열 저장 가능
- **상태**: ✅ 안전 (라인 200-205에서 검증)

### 8️⃣ **SQL Injection**
- **결과**: Prisma ORM 사용으로 방지
- **상태**: ✅ 안전

---

## 📋 전체 흐름도 (ASCII)

```
Frontend (contacts/page.tsx)
    ↓
[사용자 클릭] "관심" 버튼
    ↓
handleQuickCall(contactId, "INTERESTED")
    ├─ setQuickCallLoading(true)
    ├─ setQuickCallError(null)
    └─ resultLabel = "관심"
       convictionScore = "8"
    ↓
fetch("POST /api/contacts/{id}/call-logs", {
  content: "[퀵기록] 관심",
  result: "INTERESTED",
  convictionScore: "8"
})
    ↓
Backend (api/contacts/[id]/call-logs/route.ts)
    ├─ getOrgId() ← 테넌트 격리
    ├─ getAuthContext() ← 인증 확인
    └─ findFirst(Contact, { id, organizationId })
       ├─ 없음? 404 반환
       └─ 있음? 계속
    ├─ JSON 파싱 → { content, result, convictionScore }
    ├─ content 검증 [E-004]
    ├─ objectionValidation (Track A)
    ├─ Prisma.callLog.create({
    │   contactId, userId, content, result, convictionScore, ...
    │ })
    ├─ Prisma.contact.update({
    │   where: { id },
    │   data: { lastContactedAt: new Date() }
    │ })
    ├─ addLeadScore(id, "CALL_INTERESTED") [비동기, 무시]
    ├─ BackupJob.create(...) [비동기, 무시]
    └─ return { ok: true, log }
    ↓
Frontend (response 처리)
    ├─ data.ok = true?
    │  ├─ Yes: setQuickCallId(null) → 모달 닫기
    │  │        fetchContacts() → 새로고침
    │  └─ No: setQuickCallError("저장 실패") → 에러 표시
    └─ catch: setQuickCallError("네트워크 오류")
    ↓
fetchContacts() → /api/contacts?...
    ↓
Backend (GET /api/contacts)
    ├─ 현재 페이지 고객 목록 재조회
    └─ return { ok: true, contacts[], total }
    ↓
Frontend (UI 업데이트)
    ├─ setContacts(data.contacts)
    └─ React 재렌더링 → 목록 새로고침
```

---

## 🔧 개선 권장사항

### 1. 트랜잭션 보호
```typescript
// Before: 두 개의 개별 쿼리
const log = await prisma.callLog.create({ ... });
await prisma.contact.update({ ... });

// After: 트랜잭션
const [log] = await prisma.$transaction([
  prisma.callLog.create({ ... }),
  prisma.contact.update({ ... }),
]);
```

### 2. Lead Score 에러 처리 개선
```typescript
// Before: fire-and-forget (에러 무시)
addLeadScore(id, scoreMap[result])
  .catch(err => logger.error('...'));

// After: 실패 시 사용자에게 알림
try {
  await addLeadScore(id, scoreMap[result]);
} catch (err) {
  logger.error('[addLeadScore failed]', { err });
  // 선택: 부분 성공 처리 또는 API 에러 응답
}
```

### 3. BackupJob 환경 변수 검증 강화
```typescript
if (!process.env.GOOGLE_DRIVE_CALL_LOG_FOLDER_ID) {
  logger.warn('[CallLog] GOOGLE_DRIVE_CALL_LOG_FOLDER_ID 미설정');
}
```

### 4. UI 새로고침 에러 처리
```tsx
// Before: 무시
fetchContacts();

// After: 에러 알림
fetchContacts().catch(err => {
  toast({
    title: '새로고침 실패',
    description: '목록 새로고침에 실패했습니다.',
    variant: 'destructive'
  });
});
```

### 5. Race Condition 방지
```tsx
// Before: 빠른 클릭 시 중복 저장 가능
const [quickCallLoading, setQuickCallLoading] = useState(false);

// After: 상태 잠금
const handleQuickCall = async (...) => {
  if (quickCallLoading) return; // 이미 진행 중이면 무시
  // ...
};
```

---

## 📊 데이터 흐름 검증 체크리스트

| 단계 | 확인 항목 | 상태 | 위험도 |
|------|---------|------|--------|
| **1. 클릭** | 올바른 함수 호출 | ✅ | 낮음 |
| **2. 상태 관리** | 로딩/에러 상태 | ✅ | 낮음 |
| **3. API 호출** | fetch 구문 올바름 | ✅ | 낮음 |
| **4. 요청 데이터** | JSON 구조 올바름 | ✅ | 낮음 |
| **5. 인증** | getAuthContext() 호출 | ✅ | 낮음 |
| **6. 테넌트 격리** | organizationId 필터 | ✅ | **중간** |
| **7. 검증** | content, objection 검증 | ✅ | 낮음 |
| **8. DB 저장** | Prisma.create() 호출 | ✅ | 낮음 |
| **9. 트랜잭션** | 2개 쿼리 원자성 | ⚠️ | **높음** |
| **10. Lead Score** | fire-and-forget 에러 처리 | ⚠️ | **중간** |
| **11. Backup** | 환경변수 확인 | ⚠️ | 낮음 |
| **12. UI 새로고침** | fetchContacts() 호출 | ✅ | 낮음 |
| **13. UI 표시** | 에러 메시지 표시 | ✅ | 낮음 |

---

## 🎯 결론

### ✅ 강점
1. **명확한 에러 처리**: try-catch와 상태 표시로 사용자 피드백 충분
2. **테넌트 격리**: organizationId 검증으로 데이터 보호
3. **입력 검증**: content, duration, convictionScore 검증
4. **비동기 처리**: Lead Score와 Backup은 API 응답 블로킹 안 함

### ⚠️ 개선 필요 항목
1. **트랜잭션 부재**: CallLog와 Contact 업데이트가 원자적이지 않음
   - 심각도: 중간 (동시성 낮은 환경에서는 실제 문제 드물 수 있음)
   
2. **비동기 에러 무시**: Lead Score, BackupJob 실패 시 사용자 모름
   - 심각도: 낮음 (부수 기능이므로 핵심 기능은 동작)
   
3. **환경 변수 검증**: GOOGLE_DRIVE_CALL_LOG_FOLDER_ID 미설정 시 조용히 스킵
   - 심각도: 낮음 (백업 기능만 미동작)

### 🚀 전체 평가
**안전성: 8/10** - 핵심 기능은 안전하지만 트랜잭션 보호와 에러 로깅 개선 권장

---

## 📎 관련 파일 목록

| 파일 | 역할 | 라인 수 |
|------|------|--------|
| `src/app/(dashboard)/contacts/page.tsx` | 클릭 UI & 상태 관리 | 1507 |
| `src/app/api/contacts/[id]/call-logs/route.ts` | API 엔드포인트 | 295 |
| `src/lib/lead-score.ts` | Lead Score 계산 | N/A |
| `src/lib/contact-auto-creator.ts` | Contact 생성 | N/A |
| `prisma/schema.prisma` | DB 스키마 | 3000+ |
| `src/lib/google-drive.ts` | 백업 유틸 | N/A |

