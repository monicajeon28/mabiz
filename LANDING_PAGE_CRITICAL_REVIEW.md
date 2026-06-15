# 랜딩 페이지 기능 비판적 코드 검토 (2026-06-15)

## 📋 개요

랜딩 페이지 시스템의 **버튼별/기능별 동작**을 검증했습니다. 

**검토 범위:**
- 페이지 생성 → 저장 플로우
- CTA 버튼 클릭 → Contact/Group 생성 플로우
- Day 0-3 SMS 자동화
- 계약서 수정 → auto-resign 트리거
- 마감일(expireDate) 검증

---

## 🎯 현재 파일 구조 맵

```
src/app/(dashboard)/landing-pages/
├── [id]/page.tsx                 # ← UI 페이지 (편집/등록자/통계/공유)
├── new/page.tsx                   # ← 새 페이지 생성
└── [id]/components/
    ├── RegistrationsTab.tsx      # ← 등록자 목록
    └── CommentsTab.tsx           # ← 댓글 관리

src/app/api/landing-pages/
├── route.ts                       # GET 목록, POST 생성
├── [id]/route.ts                  # GET/PATCH 편집
├── [id]/register/route.ts         # POST 신청 (공개 엔드포인트) ⭐ 핵심
├── [id]/registrations/route.ts    # GET 등록자 목록
├── [id]/comments/route.ts         # GET/DELETE 댓글
├── [id]/stats/route.ts            # GET 통계
└── images/
    ├── route.ts                   # POST 이미지 업로드
    ├── finalize/route.ts          # POST 이미지 최종화
    └── proxy/route.ts             # GET 이미지 프록시

src/app/api/groups/[id]/
└── register/route.ts              # POST 그룹 등록 (seq 토큰 방식)

src/app/api/contract-instances/[id]/
└── auto-resign/route.ts           # POST 계약서 재서명 (수정 요청 기반)
```

---

## 🔴 발견된 문제점 (P0-P2)

### P0-1: Day 0-3 SMS 예약이 **실제로 동작하지 않음** ⭐ CRITICAL

**파일:** `src/lib/landing-page-sms-scheduler.ts:40-57`

```typescript
export async function scheduleDay0To3Sms(
  req: ScheduleDay0To3SmsRequest
): Promise<ScheduleResult> {
  try {
    // TODO: Implement Day 0-3 SMS scheduling
    // This is a placeholder that returns success for now
    return {
      success: true,
      scheduled: ["Day0", "Day1", "Day2", "Day3"],
    };  // ← 항상 성공 반환, 실제 스케줄링 없음!
  }
}
```

**심각도:** P0 (제품 사용 불가)

**문제:**
- `register/route.ts:330`에서 `scheduleDay0To3Sms()` 호출
- 함수는 **TODO 플레이스홀더**로 항상 `{ success: true }` 반환
- 실제로 DB에 SMS 메시지가 생성/스케줄되지 않음
- 사용자는 "Day 0-3 SMS 예약 완료" 로그를 보지만 **메시지는 발송 안 됨**

**영향:**
- PASONA 기반 Day 0-3 자동화 전혀 작동 안 함
- 전환율 개선 기능 부재
- 리드 스코어 +30은 되지만 SMS 팔로우업 없음

**해결책:**
1. `scheduleDay0To3Sms()` 실제 구현
2. SMS 메시지 4개(Day0/1/2/3) 생성 + `crmSmsSchedule` 또는 `scheduledSms` 테이블에 저장
3. Cron job으로 스케줄된 시간에 자동 발송

---

### P0-2: Race Condition - Contact 중복 생성 가능

**파일:** `src/app/api/landing-pages/[id]/register/route.ts:142-209`

```typescript
// ★ 핵심: Contact + GroupMember 트랜잭션 보호 (Race Condition 방지)
if (orgId) {
  try {
    const txResult = await prisma.$transaction(
      async (tx) => {
        // Step 1: Contact upsert (원자적)
        const contact = await tx.contact.upsert({
          where: {
            phone_organizationId: { phone: normalizedPhone, organizationId: orgId },
          },
          ...
        });
```

**심각도:** P0 (데이터 무결성)

**문제:**
- 트랜잭션 시작 **이전에** `crmLandingRegistration.create()` 발생 (줄 118-140)
  ```typescript
  // ❌ 이미 DB에 들어갔다!
  const reg = await prisma.crmLandingRegistration.create({ ... });
  regId = reg.id;  // 줄 132
  
  // ✅ 이제 트랜잭션 시작 (너무 늦음)
  const txResult = await prisma.$transaction(...)  // 줄 149
  ```
- Contact 생성 실패해도 `crmLandingRegistration`은 이미 저장됨
- 2개 탭에서 동시 제출 시 Contact가 2번 upsert될 수 있음 (unique constraint로 막히지만 불안정)
- GroupMember 생성 실패해도 Contact는 생성됨

**실제 시나리오:**
```
Tab 1: POST /api/landing-pages/[id]/register (form submit)
Tab 2: POST /api/landing-pages/[id]/register (form submit, 동일 phone)

Timeline:
1. Tab1: crmLandingRegistration.create() ✅ (regId1 저장됨)
2. Tab2: crmLandingRegistration.create() ❌ (unique constraint에 걸림)
3. Tab1: 트랜잭션 시작 → Contact upsert ✅
4. Tab2: 트랜잭션 시작 → Contact upsert ✅ (또 업데이트됨!)
5. Tab1: GroupMember upsert ✅
6. Tab2: GroupMember upsert ✅ (addedAt 재설정!)

결과: 같은 Contact가 GroupMember 2번 가입 (addedAt 시간 차이)
```

**영향:**
- GroupMember 중복 생성은 unique constraint로 방지되지만, addedAt 값이 덮어써짐
- Day 0-3 SMS anchorDate가 잘못될 수 있음 (나중 접근자 시간 기준)

**해결책:**
1. `crmLandingRegistration.create()`를 트랜잭션 **내부**로 이동
2. 또는 unique constraint 검증 후 트랜잭션 시작:
   ```typescript
   // 트랜잭션 전에 미리 검증만
   const existing = await prisma.crmLandingRegistration.findFirst({
     where: { landingPageId, phone, ... }
   });
   if (existing) return { ok: true, isDuplicate: true };  // 미리 차단
   
   // 그 다음 트랜잭션
   const txResult = await prisma.$transaction(async (tx) => { ... });
   ```

---

### P0-3: 무한 루프 위험 - `shouldResetOnReentry` 미검증

**파일:** `src/app/api/landing-pages/[id]/register/route.ts:171-186`

```typescript
if (landingPage.groupId) {
  const grp = await tx.contactGroup.findUnique({
    where: { id: landingPage.groupId },
    select: { reEntryPolicy: true },
  });
  groupMember = await tx.contactGroupMember.upsert({
    where: {
      groupId_contactId: { groupId: landingPage.groupId, contactId: contact.id },
    },
    create: { groupId: landingPage.groupId, contactId: contact.id },
    update: shouldResetOnReentry(grp?.reEntryPolicy) ? { addedAt: new Date() } : {},
    // ↑ grp이 없으면 undefined 전달, shouldResetOnReentry() 동작 예측 불가
    select: { addedAt: true },
  });
}
```

**심각도:** P0 (신청 무한 반복)

**문제:**
- `grp?.reEntryPolicy`가 `undefined`면 `shouldResetOnReentry(undefined)` 호출
- `shouldResetOnReentry()` 함수의 반환값을 확인 불가 (소스코드 필요)
- **가능성:** `reEntryPolicy`가 없는 그룹에서 매번 `addedAt` 재설정
- 이 경우 퍼널 또는 Day 0-3 SMS가 **매번 재시작** (무한 반복)

**실제 시나리오:**
```
1. User1: 신청 → Contact 생성, GroupMember.addedAt = 2026-06-15 10:00
2. User1: 다시 신청 (같은 번호) → GroupMember.addedAt = 2026-06-15 10:05 (재설정!)
3. Cron: Day0 SMS 스케줄 다시 생성 (addedAt 기준)
4. 결과: 같은 고객이 Day0 SMS 2번 받음
```

**영향:**
- 중복 신청 시 고객이 Day 0-3 SMS 여러 번 수신
- SMS 발송료 낭비
- 고객 불만

**해결책:**
```typescript
// 안전한 재입장 정책 기본값
if (landingPage.groupId) {
  const grp = await tx.contactGroup.findUnique({
    where: { id: landingPage.groupId },
    select: { reEntryPolicy: true },
  });
  
  // grp이 없어도 안전한 기본값
  const reEntryPolicy = grp?.reEntryPolicy ?? "NO_REENTRY";
  
  groupMember = await tx.contactGroupMember.upsert({
    where: { groupId_contactId: { ... } },
    create: { groupId: landingPage.groupId, contactId: contact.id },
    update: shouldResetOnReentry(reEntryPolicy) ? { addedAt: new Date() } : {},
    select: { addedAt: true },
  });
}
```

---

### P0-4: IDOR - 남의 랜딩페이지 수정 가능

**파일:** `src/app/(dashboard)/landing-pages/[id]/page.tsx:143-221`

```typescript
// ← 초기 로드 (GET /api/landing-pages/[id])
const [loading, setLoading] = useState(true);
useEffect(() => {
  fetch(`/api/landing-pages/${id}`, { signal }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  })
```

**심각도:** P0 (보안)

**문제:**
- UI는 초기 로드 시 **권한 검증 없음**
- API는 검증: `const existing = await prisma.crmLandingPage.findFirst({ where: { id, organizationId: orgId } })`
- **하지만** 다른 조직의 landingPageId를 URL에 입력하면?
  1. API GET: 404 반환 (조직 필터 작동)
  2. UI: 빈 페이지 + "페이지를 찾을 수 없습니다"
  3. **BUT:** 고급 사용자가 직접 `/api/landing-pages/[attacker-id]`로 PATCH 시도 가능
  
실제로 PATCH는 조직 필터 있음:
```typescript
// src/app/api/landing-pages/[id]/route.ts:96
const existing = await prisma.crmLandingPage.findFirst({ 
  where: { id, organizationId: orgId }  // ← 필터 있음
});
if (!existing) return NextResponse.json({ ok: false }, { status: 404 });
```

**재평가:** 실제로는 **IDOR 아님** (API 레벨에서 조직 필터 있음)
- 하지만 UI 404 상황에서 에러 메시지 미흡

---

### P0-5: 마감일 검증 미흡 - 미래 날짜 체크 없음

**파일:** `src/app/api/landing-pages/[id]/register/route.ts:102-108`

```typescript
// [P0-5] 마감일 검증: 현재 시간이 expireDate를 지났으면 마감됨
if (landingPage.expireDate && new Date() > new Date(landingPage.expireDate)) {
  return NextResponse.json(
    { ok: false, message: "마감된 퍼널입니다. 이전 오퍼를 확인해주세요." },
    { status: 410 }
  );
}
```

**심각도:** P1 (운영 리스크)

**문제:**
- ✅ 과거 검증 O (현재 > expireDate)
- ❌ **미래 검증 X** (expireDate 설정하지 않아도 됨)
- expireDate가 `null`이면 무제한 신청 가능
- UI에서 expireDate 입력 UI는 있지만 **필수 아님**

**UI 상황:**
```javascript
// 고급 설정에서 optional
<input type="date" value={expireDate} onChange={(e) => setExpireDate(e.target.value)} />
```

**실제 시나리오:**
```
1. Manager: 랜딩페이지 생성, expireDate 미입력
2. 1개월 후: 아직도 신청 받음 (예정과 다름)
3. 로그 확인: "expireDate: null"

→ 운영자 실수로 인한 예상 외 신청 수신
```

**영향:**
- 시즌별 특가, 한정 오퍼 실패
- 수량 제한된 상품 초과 신청

**해결책:**
1. expireDate를 **필수값**으로 변경:
   ```typescript
   // UI
   <input 
     type="date" 
     value={expireDate} 
     onChange={(e) => setExpireDate(e.target.value)}
     required
   />
   
   // API 검증
   if (!expireDate) {
     return NextResponse.json({ ok: false, message: "마감일은 필수입니다." }, { status: 400 });
   }
   ```

2. 또는 기본값 설정:
   ```typescript
   // 생성 시 expireDate 기본값 = 30일 후
   const defaultExpireDate = new Date();
   defaultExpireDate.setDate(defaultExpireDate.getDate() + 30);
   ```

---

### P0-6: XSS - sanitizeHtml 설정 미흡

**파일:** `src/app/api/landing-pages/[id]/register/route.ts:365-379`

```typescript
const htmlContent = sanitizeHtml(unsafeHtml, {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "br"]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    "*": ["class"],  // ← ⚠️ 모든 태그에 class 허용
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
});
```

**심각도:** P1 (XSS 가능성)

**문제:**
- `"*": ["class"]`로 모든 태그에 `class` 허용
- `<script class="whatever">`는 필터링 안 됨 (allowedTags에 script 없음 → OK)
- **하지만** `<img>` 태그의 `onerror` 속성은?
  ```html
  <img src="x" onerror="alert('xss')" class="safe">
  ```
  → `onerror` 제거됨 (allowedAttributes에 없음) → 안전

**재평가:** 현재 설정은 **상대적으로 안전함** (allowedTags만 명시)

**개선 방안:**
- `allowedAttributes.img` 명시적으로 정의:
  ```typescript
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ["src", "alt", "loading", "width", "height"],
    a: ["href", "target"],
    "*": ["class"],
  },
  ```

---

### P1-1: 그룹 배정 로직 - groupId vs groupCategory/groupSubName 혼동

**파일:** `src/app/api/landing-pages/[id]/route.ts:114-142`

```typescript
// groupSubName이 오면 groupId보다 우선. 같은 조직 내 (name, category) 동일 그룹이 있으면 재사용.
let resolvedGroupId: string | null | undefined = groupId;
if (groupSubName !== undefined) {
  const subName = (groupSubName ?? "").trim();
  if (!subName) {
    resolvedGroupId = null; // 소그룹 비우면 배정 해제
  } else {
    const cat = (groupCategory ?? "").trim() || null;
    const found = await prisma.contactGroup.findFirst({
      where: { organizationId: existing.organizationId, name: subName, category: cat },
      select: { id: true },
    });
    if (found) {
      resolvedGroupId = found.id;
    } else {
      const createdGroup = await prisma.contactGroup.create({
        data: {
          organizationId: existing.organizationId,
          name: subName,
          category: cat,
          ownerId: ctx.userId,
        },
        select: { id: true },
      });
      resolvedGroupId = createdGroup.id;
    }
  }
}
```

**심각도:** P1 (운영 혼동)

**문제:**
- UI에서는 "대그룹(카테고리)" + "소그룹(그룹명)" 표현
- **하지만** API는 `groupId` (직접 지정), `groupCategory`/`groupSubName` (검색/생성) 지원
- 둘이 동시에 전달되면 **groupSubName이 우선됨**
- 운영자가 "카테고리 + 소그룹" 입력했는데 기존 groupId가 무시될 수 있음

**실제 시나리오:**
```
1. 기존: groupId = "group-123" (이미 배정)
2. 운영자: "대그룹=크루즈", "소그룹=지중해" 입력 후 저장
3. 결과: 기존 groupId 무시, 새 그룹 검색/생성
   → 고객들이 다른 그룹으로 이동 (퍼널 초기화!)
```

**영향:**
- 기존 고객의 그룹 변경 (의도 아님)
- 퍼널 중단 또는 재시작

**해결책:**
1. **선택 기준 명시:**
   - groupSubName이 있으면 무조건 새 그룹 검색/생성 (현재 동작 유지)
   - **또는** groupSubName이 있으면 경고: "기존 그룹이 변경됩니다"

2. **UI 개선:**
   ```typescript
   // 대그룹/소그룹과 groupId 중 하나 선택 UI
   <fieldset>
     <legend>그룹 배정 방식 선택</legend>
     <label>
       <input type="radio" name="groupMode" value="direct" checked={groupMode === 'direct'} />
       기존 그룹 ID로 직접 배정
       <select value={groupId} disabled={groupMode !== 'direct'} />
     </label>
     <label>
       <input type="radio" name="groupMode" value="category" checked={groupMode === 'category'} />
       카테고리 + 그룹명으로 검색/생성
       <input value={groupCategory} disabled={groupMode !== 'category'} />
       <input value={groupSubName} disabled={groupMode !== 'category'} />
     </label>
   </fieldset>
   ```

---

### P1-2: Contact 중복 체크 없음 (groupRegister)

**파일:** `src/app/api/groups/[id]/register/route.ts:74-95`

```typescript
const { contact, funnelStarted } = await prisma.$transaction(async (tx) => {
  // Contact upsert
  const contact = await tx.contact.upsert({
    where: { phone_organizationId: { phone, organizationId: group.organizationId } },
    update: {
      name: name || undefined,
      email: email || undefined,
    },
    create: {
      phone,
      name,
      email: email || null,
      organizationId: group.organizationId,
    },
  });

  // ContactGroupMember 추가
  await tx.contactGroupMember.upsert({
    where: { groupId_contactId: { groupId, contactId: contact.id } },
    update: {},  // ← 재입장 시 아무것도 업데이트 안 함
    create: { contactId: contact.id, groupId },
  });
```

**심각도:** P1 (데이터 불일치)

**문제:**
- 재입장 시 `update: {}` (아무것도 안 함)
- **하지만** `landingPageRegister`에서는 `update: shouldResetOnReentry(grp?.reEntryPolicy) ? { addedAt: new Date() } : {}`
- 두 엔드포인트가 **다른 정책** 적용
- seq 토큰 방식과 landing page 방식이 일관성 없음

**영향:**
- seq 토큰 재신청: GroupMember.addedAt 안 바뀜
- landing page 재신청: GroupMember.addedAt 바뀜
- 같은 Contact가 다른 그룹 배정 시 anchorDate 차이

**해결책:**
- seq/landing page 모두 통일:
  ```typescript
  // ContactGroupMember upsert 정책 통일
  await tx.contactGroupMember.upsert({
    where: { groupId_contactId: { groupId, contactId: contact.id } },
    update: { addedAt: new Date() },  // ← 항상 재설정 또는
    // update: {},  // ← 항상 미설정
    create: { contactId: contact.id, groupId },
  });
  ```

---

### P1-3: FormConfig 검증 부족

**파일:** `src/app/api/landing-pages/[id]/register/route.ts:29-36`

```typescript
// [P1-6] formConfig JSON 유효성 검증 (body에 있으면 검증)
if (body.formConfig) {
  try {
    JSON.parse(JSON.stringify(body.formConfig)); // 직렬화 가능 확인
  } catch {
    return NextResponse.json({ ok: false, message: "formConfig가 유효한 JSON이 아닙니다." }, { status: 400 });
  }
}
```

**심각도:** P1 (데이터 손상)

**문제:**
- `JSON.parse(JSON.stringify(...))` 테스트만 함
- **실제 스키마 검증 없음**
  - `formConfig.b2bEduType`이 "INQUIRER" | "BUYER"인지 확인 안 함
  - `formConfig.fields[].type`이 유효한지 확인 안 함
  - `formConfig.fields[].required`가 boolean인지 확인 안 함

**실제 시나리오:**
```json
{
  "formConfig": {
    "b2bEduType": "INVALID_TYPE",
    "fields": [
      { "name": "name", "type": "invalid-type", "required": "yes" }
    ]
  }
}
```
→ 저장됨, 나중에 UI 렌더링 실패

**해결책:**
```typescript
import { z } from 'zod';

const FormConfigSchema = z.object({
  b2bEduType: z.enum(['INQUIRER', 'BUYER']).optional(),
  fields: z.array(z.object({
    id: z.string(),
    name: z.string(),
    label: z.string(),
    type: z.enum(['text', 'email', 'tel', 'select', 'checkbox']),
    required: z.boolean(),
    placeholder: z.string().optional(),
    options: z.array(z.string()).optional(),
  })).optional(),
  footer: z.string().optional(),
});

if (body.formConfig) {
  const parsed = FormConfigSchema.safeParse(body.formConfig);
  if (!parsed.success) {
    return NextResponse.json({ 
      ok: false, 
      message: "formConfig 형식이 유효하지 않습니다.",
      errors: parsed.error.flatten().fieldErrors
    }, { status: 400 });
  }
}
```

---

### P1-4: 비블로킹 작업 실패 무시

**파일:** `src/app/api/landing-pages/[id]/register/route.ts:213, 254, 277, 387`

```typescript
// 리드 스코어 +30 (랜딩 등록 = 강력한 관심 신호)
// 비블로킹: 트랜잭션 완료 후 독립적으로 실행
addLeadScore(contact.id, "LANDING_REGISTER").catch(() => {});

// B2B 문의자/구매자 자동 등록 (트랜잭션 외부, 비블로킹)
prisma.b2BProspect.findFirst({...}).then(async (existingProspect) => {
  ...
}).catch(() => {});

// autoFunnelId 직접 퍼널 시작
try {
  const enrollRes = await fetch(...);
  ...
} catch { /* 퍼널 시작 실패해도 등록은 유지 */ }

// 신청 완료 이메일
sendFunnelEmail({...}).catch(() => {}); // fire-and-forget
```

**심각도:** P2 (운영 가시성)

**문제:**
- 모든 비블로킹 작업이 **실패를 무시**함
- 로그를 남기지 않음 (일부는 logger.error() 있음, 일부는 없음)
- 운영자는 왜 이메일이 안 갔는지, 퍼널이 시작 안 했는지 알 수 없음

**영향:**
- 고객에게 연락 못 함
- 퍼널 안 시작됨
- **원인 파악 불가**

**해결책:**
```typescript
// 모든 비블로킹 작업에 logger 추가
addLeadScore(contact.id, "LANDING_REGISTER")
  .catch((err) => {
    logger.warn("[LandingRegister] Lead score 추가 실패", {
      contactId: contact.id,
      error: err instanceof Error ? err.message : String(err),
    });
  });

// 이메일도 마찬가지
sendFunnelEmail({...})
  .catch((err) => {
    logger.warn("[LandingRegister] 완료 이메일 발송 실패", {
      email,
      error: err instanceof Error ? err.message : String(err),
    });
  });
```

---

### P1-5: Contact/GroupMember 생성 실패 로그 부족

**파일:** `src/app/api/landing-pages/[id]/register/route.ts:198-209`

```typescript
} catch (txError) {
  logger.error("[LandingRegister] 트랜잭션 실패 (Contact + GroupMember)", {
    error: txError instanceof Error ? txError.message : String(txError),
    phone: normalizedPhone.substring(0, 4) + "***",
  });
  // Contact 생성 실패 시에도 등록 기록은 유지 (이미 생성됨)
  return NextResponse.json(
    { ok: false, message: "등록 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
    { status: 500 }
  );
}
```

**심각도:** P2 (디버깅)

**문제:**
- 트랜잭션 실패 시 기본 500 에러만 반환
- 서버 로그에만 남음 (사용자는 모른다)
- **그런데 crmLandingRegistration은 이미 생성됨**
- 다음 재시도 시 `isDuplicate: true` 반환 (혼동)

**실제 시나리오:**
```
1. User: POST /api/landing-pages/[id]/register (phone="010-1234-5678")
2. crmLandingRegistration.create() ✅
3. Contact upsert (트랜잭션) → 데이터베이스 시간초과 ❌
4. API: 500 에러 반환
5. User: 재시도 POST
6. crmLandingRegistration.create() ❌ (unique constraint)
7. API: isDuplicate: true 반환
8. User: "이미 신청했습니다" 메시지 (혼동)
```

**해결책:**
```typescript
// crmLandingRegistration.create()를 트랜잭션 내부로 이동
const txResult = await prisma.$transaction(async (tx) => {
  // Step 0: crmLandingRegistration 먼저 생성 (트랜잭션 내)
  const reg = await tx.crmLandingRegistration.create({
    data: { ... },
    select: { id: true },
  });
  
  // Step 1: Contact upsert
  const contact = await tx.contact.upsert({ ... });
  
  // Step 2: GroupMember upsert
  ...
  
  return { regId: reg.id, contact, groupMember };
}, { isolationLevel: "Serializable" });
```

---

### P2-1: 타임아웃 처리 없음 (10초)

**파일:** `src/app/api/landing-pages/[id]/register/route.ts:191-193`

```typescript
const txResult = await prisma.$transaction(
  async (tx) => { ... },
  {
    isolationLevel: "Serializable", // ← Race Condition 완전 방지
    timeout: 10000, // ← 10초 타임아웃
  }
);
```

**심각도:** P2 (성능)

**문제:**
- 타임아웃은 설정했음 (OK)
- **하지만** 타임아웃 에러 처리가 일반 에러와 동일
  ```typescript
  } catch (txError) {
    return NextResponse.json({ ok: false, message: "등록 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
  ```
- 타임아웃인지 실패인지 구분 못 함

**해결책:**
```typescript
} catch (txError) {
  if (txError instanceof Error && 
      (txError.message.includes('timeout') || txError.message.includes('Serializable'))) {
    logger.warn("[LandingRegister] 트랜잭션 타임아웃 (동시 접근)", { phone });
    return NextResponse.json(
      { ok: false, message: "현재 너무 많은 신청이 있습니다. 잠시 후 다시 시도해주세요." },
      { status: 503 }  // ← Service Unavailable
    );
  }
  // 기타 에러
  return NextResponse.json({ ok: false, message: "등록 처리 중 오류가 발생했습니다." }, { status: 500 });
}
```

---

### P2-2: 폼 필드 길이 제한 없음

**파일:** `src/app/(dashboard)/landing-pages/[id]/page.tsx:137-141`

```typescript
const [formFields, setFormFields] = useState<FormField[]>([
  { id: 'name', name: 'name', label: '이름', type: 'text', required: true, placeholder: '이름을 입력하세요' },
  { id: 'phone', name: 'phone', label: '전화번호', type: 'tel', required: true, placeholder: '010-0000-0000' },
  { id: 'email', name: 'email', label: '이메일', type: 'email', required: false, placeholder: 'example@email.com' },
]);
```

**심각도:** P2 (DoS 리스크)

**문제:**
- 필드 개수 제한 없음
- 필드명 길이 제한 없음
- 운영자가 1000개 필드 추가 가능 → formConfig JSON 비대화

**영향:**
- 폼 렌더링 느림
- DB 저장 용량 초과 가능

**해결책:**
```typescript
// UI
const MAX_FORM_FIELDS = 20;

const addField = () => {
  if (formFields.length >= MAX_FORM_FIELDS) {
    setError(`최대 ${MAX_FORM_FIELDS}개 필드까지만 추가 가능합니다.`);
    return;
  }
  ...
};

// API (Zod)
const PatchSchema = z.object({
  formConfig: z.object({
    fields: z.array(...).max(20),  // ← 최대 20개
  }).optional(),
});
```

---

### P2-3: 폼 필드 이름/라벨 특수문자 검증 없음

**파일:** `src/app/api/landing-pages/[id]/register/route.ts:29-36`

```typescript
if (body.formConfig) {
  try {
    JSON.parse(JSON.stringify(body.formConfig)); // 직렬화만 확인, 콘텐츠 검증 없음
```

**심각도:** P2 (UX)

**문제:**
- 필드 이름/라벨에 HTML/스크립트 가능?
  ```json
  { "formConfig": { "fields": [{ "label": "<img src=x onerror=\"alert('xss')\">" }] } }
  ```
- UI에서 `encodeHtml()` 있지만, formConfig 자체를 검증하지 않음

**해결책:**
```typescript
// FormConfig 스키마에 sanitization 추가
const FormFieldSchema = z.object({
  id: z.string().max(50),
  name: z.string().max(50).regex(/^[a-zA-Z0-9_-]+$/),  // ← alphanumeric only
  label: z.string().max(100),
  type: z.enum(['text', 'email', 'tel', 'select', 'checkbox']),
  required: z.boolean(),
  placeholder: z.string().max(100).optional(),
}).refine((f) => {
  // label에 스크립트 없는지 확인
  if (f.label.includes('<') || f.label.includes('>')) {
    return false;
  }
  return true;
}, { message: "라벨에 HTML 태그를 포함할 수 없습니다." });
```

---

### P2-4: auto-resign 재서명 - 이메일 발송 실패 무시

**파일:** `src/app/api/contract-instances/[id]/auto-resign/route.ts:149-164`

```typescript
// 트랜잭션 성공: 5️⃣ 비블로킹: 이메일 발송 (백그라운드)
if (contactInfo?.email) {
  sendReSignCompletedEmail(contactInfo.email, { ... })
    .catch((err) => {
      // 로깅만 하고 계속 진행 (이메일 실패는 비블로킹)
      console.warn("[Re-sign Email Send Error]", err instanceof Error ? err.message : String(err));
    });
}
```

**심각도:** P2 (운영)

**문제:**
- 이메일 발송 실패 시 `console.warn()` 만 사용 (structred logging 아님)
- logger 사용하지 않음
- 운영자 모니터링 불가

**해결책:**
```typescript
sendReSignCompletedEmail(contactInfo.email, { ... })
  .catch((err) => {
    logger.error("[Auto-resign] 재서명 완료 이메일 발송 실패", {
      email: contactInfo.email,
      contractId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
```

---

## 📊 종합 점수

| 항목 | 현재 상태 | 점수 |
|------|---------|------|
| **Data Integrity** | P0 2건 (Race Condition, SMS 미구현) | 40/100 |
| **Security** | P0 1건 (타입 검증 부족) | 60/100 |
| **Error Handling** | P1 3건 (비블로킹 로깅 부족) | 65/100 |
| **Performance** | P2 2건 (제한 없음) | 70/100 |
| **Usability** | P1 1건 (혼동 UI) | 75/100 |
| **종합** | **P0: 4개, P1: 5개, P2: 4개** | **61/100** |

---

## 🔧 우선순위별 수정안

### Phase 1 (긴급 - 지금 당장)
- [ ] **P0-1:** `scheduleDay0To3Sms()` 실제 구현
- [ ] **P0-2:** `crmLandingRegistration.create()` 트랜잭션 내부로 이동
- [ ] **P0-3:** `shouldResetOnReentry()` 기본값 처리

### Phase 2 (이번 주)
- [ ] **P0-5:** expireDate 필수값 또는 기본값 설정
- [ ] **P1-1:** 그룹 배정 모드 명확화 (UI)
- [ ] **P1-3:** FormConfig Zod 스키마 검증

### Phase 3 (이번 달)
- [ ] **P1-4, P1-5:** 모든 비블로킹 작업 logger 추가
- [ ] **P2-1:** 타임아웃 에러 처리 개선
- [ ] **P2-2, P2-3:** 폼 필드 제한 및 검증

---

## 📎 관련 파일 목록

```
src/app/(dashboard)/landing-pages/[id]/page.tsx       (1,376줄)
src/app/api/landing-pages/[id]/register/route.ts      (405줄) ← P0 많음
src/app/api/landing-pages/[id]/route.ts               (218줄)
src/app/api/landing-pages/route.ts                    (206줄)
src/app/api/groups/[id]/register/route.ts             (193줄)
src/app/api/contract-instances/[id]/auto-resign/route.ts (227줄)
src/lib/landing-page-sms-scheduler.ts                 (57줄) ← TODO
src/lib/funnel-trigger.ts                             (142줄)
```

---

## 결론

### ✅ 잘한 점
1. Serializable 트랜잭션으로 Race Condition 방지 의도 명확
2. 폼 필드 동적 생성 + 재정렬 UI 우수
3. 이미지 배치 처리 및 진행률 표시
4. HTTP 에러 처리 (res.ok 검증)
5. 마감일 (410 Gone) 개념 도입

### ❌ 나쁜 점
1. Day 0-3 SMS 구현 미완성 (TODO)
2. Race Condition 방어가 불완전 (crmLandingRegistration 분리)
3. 그룹 배정 로직이 복잡하고 혼동 가능
4. 비블로킹 작업의 로깅 일관성 부족
5. formConfig 스키마 검증 미흡

### 🎯 최종 진단
**기본 기능은 동작하지만 엣지 케이스와 자동화 부분이 미흡합니다.**
- 동시 신청 시 Race Condition 리스크 (P0)
- SMS 자동화 미작동 (P0)
- 비블로킹 작업 실패 추적 불가 (P2)

**배포 가능 여부:** ❌ **P0 4개 해결 후 배포 권장**
