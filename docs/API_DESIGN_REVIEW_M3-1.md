# M3-1 API 설계 검토: Contact 백업 복구 엔드포인트 (2026-06-22)

## 📋 검토 대상

**예상 API 엔드포인트 설계**
- `GET /api/backup/contacts/[id]/restore/[fileId]` — 복구할 Contact 백업 파일 조회
- `POST /api/backup/contacts/[id]/restore/confirm` — 복구 확인 및 실행

**검토 기준**: REST 원칙, 권한 검증, 응답 형식, 에러 처리, 성능 최적화

---

## ✅ 권장 API 설계 (최종)

### 1️⃣ GET /api/backup/contacts/[id]/restore/[fileId] → ⚠️ 문제 발견

**현재 설계**:
```typescript
GET /api/backup/contacts/[id]/restore/[fileId]
↳ Contact ID로 조회하되, 특정 fileId의 백업만 반환
```

**문제점**:
1. **REST 계층 구조 위반** — fileId가 Contact과 독립적 리소스 (fileId는 ContactBackupFile의 PK)
2. **경로 깊이 과다** — `/restore/[fileId]`는 복구(Action) + 리소스 혼용
3. **멱등성 위반** — GET이 부수 효과(미리보기 렌더링)를 일으킬 수 있음
4. **캐싱 불가능** — 파라미터 증가로 인한 캐시 히트율 저하

**✅ 권장 설계 (변경)**:
```typescript
# 옵션 A: 백업 파일 리소스 중심 (추천) ⭐
GET /api/backup/contact-files/[fileId]
↳ 백업 파일 상세 조회 (미리보기용)
↳ 응답: { id, contactId, fileName, backupAt, size, status, preview: {...} }

POST /api/backup/contact-files/[fileId]/restore
↳ 복구 트리거 (멱등성 있음)
↳ 응답: { success, restoredContactId, restoredAt, fields }

# 옵션 B: Contact 중심 (Contact 목록에서 바로 복구)
POST /api/contacts/[id]/restore-from-backup
↳ 요청: { fileId?, date? } — 최신 백업 또는 특정 날짜 선택
↳ 응답: { success, restoredAt, changedFields, previousValues }
```

**선택 기준**:
- **옵션 A**: 백업 파일 관리 페이지에서 여러 파일 조회/복구
- **옵션 B**: Contact 상세 페이지에서 "이전 버전으로 복구" 기능

**마비즈 CRM 권장**: **옵션 B** (Contact 워크플로우와 일관성)

---

### 2️⃣ POST /api/backup/contacts/[id]/restore/confirm → ⚠️ 리팩토링 필요

**현재 설계**:
```typescript
POST /api/backup/contacts/[id]/restore/confirm
↳ 사전 GET [fileId] → 미리보기 → POST confirm 2단계 플로우
```

**문제점**:
1. **2단계 플로우 복잡성** — 스테이트풀 미리보기 (세션/상태 관리 필요)
2. **원자성 위협** — GET과 confirm 사이 데이터 변경 가능
3. **에러 처리 복잡** — 미리보기 실패 vs 실제 복구 실패 구분 필요
4. **confirm 파라미터 불명확** — 요청 본문에 무엇을 전달할지 불명확

**✅ 권장 설계 (단일 엔드포인트)**:
```typescript
POST /api/contacts/[id]/restore-from-backup
Content-Type: application/json

{
  "backupFileId": "file_abc123",  // 특정 백업 파일 선택
  "fields": ["phone", "email"],   // 선택적: 특정 필드만 복구 (생략시 전체)
  "confirmPreview": {             // 미리보기 확인 데이터
    "previousData": { ... },
    "newData": { ... }
  }
}

응답:
{
  "ok": true,
  "contactId": "contact_xyz",
  "restoredAt": "2026-06-22T14:30:00Z",
  "restoredFields": ["phone", "email"],
  "restoreLogId": "log_123"  // ContactBackupRestoreLog ID
}
```

**이점**:
1. **원자성** — 1회 요청으로 확인 + 실행
2. **멱등성** — 동일 요청 재발송 시 same backup file로 중복 방지 가능
3. **선택적 필드 복구** — 특정 필드만 복구 가능 (전체 덮어쓰기 방지)
4. **미리보기 분리** — 별도 "미리보기" 엔드포인트로 UI에서 선택

**추가 엔드포인트 (미리보기)**:
```typescript
# 미리보기 (읽기 전용, 부수 효과 없음)
POST /api/contacts/[id]/preview-backup
Content-Type: application/json

{
  "backupFileId": "file_abc123"
}

응답:
{
  "ok": true,
  "contactId": "contact_xyz",
  "currentData": { phone: "010-****-****", email: "user@***.com", ... },
  "backupData": { phone: "010-1234-5678", email: "user@example.com", ... },
  "changedFields": ["phone", "email"],
  "backupAt": "2026-06-21T10:00:00Z"
}
```

---

## 🔐 권한 검증 위치 (정책 수립)

### 현황 분석
마비즈 CRM 기존 패턴 (`src/app/api/contacts/[id]/route.ts`):
```typescript
// ✅ API route 진입 직후 권한 검사 (early return)
export async function GET(_req: Request, { params }: Params) {
  const ctx = await getAuthContext();
  
  // 1단계: 기본 역할 검사 (FREE_SALES 차단)
  if (ctx.role === 'FREE_SALES') {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  
  // 2단계: 리소스 기반 권한 (WHERE 조건)
  const where = buildContactWhere(ctx, { id });
  const contact = await prisma.contact.findFirst({ where, ... });
  if (!contact) return NextResponse.json({ ok: false }, { status: 404 });
  
  // 실제 로직
}
```

### ✅ 권장 정책 (Contact 복구)

```typescript
// 파일: src/app/api/contacts/[id]/restore-from-backup/route.ts

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    const { id: contactId } = await params;

    // ─── 권한 검증 (API route 레이어) ───────────────────
    
    // 1️⃣ 기본 역할 검사 (빠른 실패)
    if (ctx.role === 'FREE_SALES') {
      return forbidden('판매원은 백업 복구 권한이 없습니다');
    }

    // 2️⃣ Contact 소유권 검사 (건드릴 수 없는 Contact 차단)
    const contact = await prisma.contact.findFirst({
      where: buildContactWhere(ctx, { id: contactId }),
      select: { id: true, organizationId: true }
    });
    
    if (!contact) {
      return notFound('고객을 찾을 수 없습니다');
    }

    // 3️⃣ 백업 파일 소유권 검사 (다른 조직 파일 접근 방지)
    const body = await req.json();
    const { backupFileId, fields, confirmPreview } = body;
    
    const backupFile = await prisma.contactBackupFile.findFirst({
      where: {
        id: backupFileId,
        organizationId: contact.organizationId,  // ← 조직 격리
        contactId: contactId,                     // ← Contact 격리
        deletedAt: null                           // ← soft-delete 제외
      }
    });
    
    if (!backupFile) {
      return notFound('백업 파일을 찾을 수 없습니다');
    }

    // ─── 비즈니스 로직 (lib 레이어) ───────────────────
    
    // 복구 실행 (트랜잭션)
    const restored = await restoreContactFromBackupFile(
      contact.id,
      backupFile.id,
      ctx.userId,
      { fields, validatePreview: confirmPreview }
    );

    // 감사 로그 기록
    await prisma.contactBackupRestoreLog.create({
      data: {
        organizationId: contact.organizationId,
        contactId: contact.id,
        backupId: backupFile.id,
        restoredBy: ctx.userId,
        restoredByName: ctx.userName,
        status: 'SUCCESS',
        restoredFields: JSON.stringify(restored.changedFields)
      }
    });

    return ok({
      contactId: contact.id,
      restoredAt: new Date(),
      restoredFields: restored.changedFields,
      restoreLogId: logId
    });

  } catch (err) {
    // 401/403 구분 (handleApiError 이용)
    return handleApiError(err, 'POST /contacts/[id]/restore-from-backup');
  }
}
```

**권한 검증 체크리스트**:
- ✅ 기본 역할 검사 (FREE_SALES 차단) — API route
- ✅ Contact 소유권 검사 (buildContactWhere) — API route
- ✅ 백업 파일 조직 격리 (organizationId) — API route
- ✅ 백업 파일 deletedAt 필터 — API route
- ⚠️ 필드별 권한 (민감 필드 차단) — lib 레이어 (선택사항)

**민감 필드 권한 규칙** (선택사항):
```typescript
// 복구 불가 필드 (조직 관리자만)
const SENSITIVE_FIELDS = ['organizationId', 'createdAt', 'createdBy', 'status'];
const ADMIN_ONLY_FIELDS = ['paymentStatus', 'riskScore'];

if (fields?.some(f => ADMIN_ONLY_FIELDS.includes(f)) && 
    ctx.role !== 'ADMIN') {
  return forbidden(`이 필드는 관리자만 복구할 수 있습니다: ${fields.join(',')}`);
}
```

---

## 📋 응답 형식 (JSON Schema)

### ✅ 성공 응답 (200 OK)

```typescript
{
  "ok": true,
  "contactId": "contact_abc123xyz",
  "restoredAt": "2026-06-22T14:35:42.123Z",  // ISO 8601
  "restoredFields": ["phone", "email"],      // 실제 복구된 필드 목록
  "restoreLogId": "log_def456uvw",           // 감사 추적용
  "restoreLog": {                            // 선택사항: 상세 정보
    "id": "log_def456uvw",
    "organizationId": "org_xyz",
    "contactId": "contact_abc123xyz",
    "backupFileId": "file_abc123",
    "restoredBy": "user_123",
    "restoredByName": "김철수",
    "status": "SUCCESS",
    "restoredFields": ["phone", "email"]
  }
}
```

**마비즈 CRM 표준**:
- `ok: true` 필수
- `contactId`, `restoredAt`, `restoredFields` 필수
- `restoreLogId` 필수 (감사 추적)
- `restoreLog` 선택사항 (클라이언트 필요시)

---

### ⚠️ 에러 응답 (4xx/5xx)

#### 1. 403 Forbidden (권한 없음)

```json
{
  "ok": false,
  "error": "FORBIDDEN",
  "message": "이 작업을 수행할 권한이 없습니다",
  "details": {
    "reason": "FREE_SALES"  // 차단 사유
  }
}
```

**시나리오**:
- 판매원(FREE_SALES)이 복구 시도
- 다른 조직 Contact 복구 시도
- 관리자 전용 필드 복구 시도

#### 2. 404 Not Found (리소스 없음)

```json
{
  "ok": false,
  "error": "NOT_FOUND",
  "message": "고객을 찾을 수 없습니다"
}
```

또는 (백업 파일 없음):
```json
{
  "ok": false,
  "error": "NOT_FOUND",
  "message": "백업 파일을 찾을 수 없습니다",
  "details": {
    "backupFileId": "file_abc123"
  }
}
```

#### 3. 400 Bad Request (검증 실패)

```json
{
  "ok": false,
  "error": "INVALID_INPUT",
  "message": "요청이 유효하지 않습니다",
  "errors": {
    "backupFileId": "필수 필드입니다",
    "fields": "배열이어야 합니다"
  }
}
```

**검증 규칙**:
- `backupFileId`: 필수, UUID 형식
- `fields`: 선택, 배열, 각 항목 문자열 + 알려진 필드만
- `confirmPreview`: 선택, 객체

#### 4. 409 Conflict (데이터 변경 감지)

```json
{
  "ok": false,
  "error": "CONFLICT",
  "message": "백업 이후 데이터가 변경되었습니다. 다시 미리보기를 확인해주세요",
  "details": {
    "currentData": { ... },
    "backupData": { ... },
    "changedFields": ["phone"]
  }
}
```

**시나리오**:
- GET 미리보기 후 다른 사용자가 Contact 수정
- confirmPreview.previousData와 현재 Contact 불일치

#### 5. 500 Internal Server Error

```json
{
  "ok": false,
  "error": "INTERNAL_ERROR",
  "message": "서버 오류가 발생했습니다",
  "details": {
    "context": "POST /contacts/[id]/restore-from-backup",
    "error": "Google Drive API timeout"
  }
}
```

---

## 🚨 에러 처리 (Error Handling)

### 구현 패턴

```typescript
export async function POST(req: Request, { params }: Params) {
  try {
    // ... 검증 로직
    
    // 트랜잭션 실행
    const result = await prisma.$transaction(async (tx) => {
      // Contact 복구
      const restored = await tx.contact.update({
        where: { id: contactId },
        data: {
          phone: backupData.phone,
          email: backupData.email,
          // ...
        }
      });

      // 감사 로그 기록
      const log = await tx.contactBackupRestoreLog.create({
        data: {
          organizationId: contact.organizationId,
          contactId,
          backupId: backupFileId,
          restoredBy: ctx.userId,
          restoredByName: ctx.userName,
          status: 'SUCCESS',
          restoredFields: JSON.stringify(changedFields)
        }
      });

      return { restored, log };
    });

    return ok({ ... });

  } catch (err) {
    // 1️⃣ 알려진 에러 (Custom error 처리)
    if (err instanceof ContactNotFoundError) {
      return notFound('고객을 찾을 수 없습니다');
    }
    if (err instanceof BackupFileNotFoundError) {
      return notFound('백업 파일을 찾을 수 없습니다');
    }
    if (err instanceof ConflictError) {
      return errorResponse(
        '백업 이후 데이터가 변경되었습니다',
        409,
        { error: 'CONFLICT', details: err.details }
      );
    }
    if (err instanceof Prisma.PrismaClientValidationError) {
      return badRequest('요청 데이터가 유효하지 않습니다');
    }

    // 2️⃣ 권한 에러 (RBAC 통합)
    return handleApiError(err, 'POST /contacts/[id]/restore-from-backup');
  }
}
```

### 예외 클래스 정의

```typescript
// src/lib/errors.ts
export class ContactNotFoundError extends Error {
  constructor() {
    super('Contact not found');
    this.name = 'ContactNotFoundError';
  }
}

export class BackupFileNotFoundError extends Error {
  constructor(fileId: string) {
    super(`Backup file not found: ${fileId}`);
    this.name = 'BackupFileNotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(public details: any) {
    super('Data conflict detected');
    this.name = 'ConflictError';
  }
}
```

---

## ⚡ 성능 (Performance)

### 메모리 스트리밍 (대용량 복구)

**문제**: Contact 10000명 복구 시 메모리 과다 사용

**✅ 권장 방안**:
```typescript
// ❌ 나쁜 예시 (메모리 병목)
const allContacts = await prisma.contact.findMany({
  where: { organizationId, backupFileId }
});
await Promise.all(allContacts.map(c => restoreContact(c)));

// ✅ 좋은 예시 (스트리밍 + 배치)
const BATCH_SIZE = 100;
let skip = 0;

while (true) {
  const batch = await prisma.contact.findMany({
    where: { organizationId, backupFileId },
    skip,
    take: BATCH_SIZE
  });
  
  if (batch.length === 0) break;
  
  await Promise.all(batch.map(c => restoreContact(c)));
  skip += BATCH_SIZE;
  
  // Cron 타임아웃 처리 (55초 기준)
  if (Date.now() - startTime > 45000) {
    // 나머지는 다음 Cron 대기
    logger.info(`Batch restore paused at ${skip}`);
    break;
  }
}
```

### 데이터베이스 인덱스

**이미 정의된 인덱스** (ContactBackupRestoreLog):
```prisma
@@index([organizationId, restoredAt(sort: Desc)])
@@index([contactId])
@@index([status])
```

**추가 필요 인덱스**:
```prisma
// ContactBackupFile (기존 없음, 신규 생성 시 추가)
model ContactBackupFile {
  // ...
  @@index([organizationId, contactId])
  @@index([createdAt(sort: Desc)])
  @@index([status])  // PENDING, COMPLETED, FAILED
}
```

### 응답 시간 목표

| 작업 | 목표 | 고려사항 |
|------|------|---------|
| GET 미리보기 | < 500ms | 단일 Contact 조회 |
| POST 복구 (개별) | < 1s | DB 트랜잭션 + 감사 로그 |
| POST 복구 (배치 100개) | < 5s | 병렬 처리 + 타임아웃 |

---

## 🔍 설계 체크리스트

### REST 원칙
- ✅ 리소스 중심 (`/contacts/[id]/restore-from-backup`)
- ✅ HTTP 메서드 올바르게 사용 (GET=읽기, POST=쓰기)
- ✅ 상태 코드 의미있음 (200, 400, 403, 404, 409, 500)
- ✅ 멱등성 고려 (동일 fileId 재발송 안전)

### 권한 검증
- ✅ API route 진입 직후 기본 역할 검사
- ✅ buildContactWhere로 Contact 소유권 검사
- ✅ organizationId로 백업 파일 격리
- ✅ 민감 필드별 권한 검사 (선택사항)
- ✅ 감사 로그 (누가/언제/성공 여부)

### 응답 형식
- ✅ 성공: `{ ok: true, contactId, restoredAt, restoredFields }`
- ✅ 실패: `{ ok: false, error, message, details }`
- ✅ 에러 코드 명확 (403, 404, 400, 409, 500)
- ✅ 감사 추적용 restoreLogId 포함

### 에러 처리
- ✅ 403 Forbidden (권한 없음)
- ✅ 404 Not Found (Contact/파일 없음)
- ✅ 400 Bad Request (검증 실패)
- ✅ 409 Conflict (데이터 변경 감지)
- ✅ 500 Internal Server Error (서버 오류)

### 성능
- ✅ 개별 복구 < 1s
- ✅ 배치 복구 100개 < 5s
- ✅ DB 인덱스 정의
- ✅ 메모리 스트리밍 (대용량)
- ✅ Cron 타임아웃 처리 (55초)

---

## 📝 구현 순서 (Phase 1)

### 1단계: 데이터 모델 (Prisma)
```bash
# 필요한 모델 (이미 정의됨)
- ContactBackupRestoreLog (감사 로그)
- ContactBackupFile (백업 파일) ← 신규 필요

# 마이그레이션
npx prisma migrate dev --name add_contact_backup_file_model
```

### 2단계: API 엔드포인트
```bash
src/app/api/contacts/[id]/
├── restore-from-backup/
│   └── route.ts (POST 구현)
└── preview-backup/
    └── route.ts (POST 미리보기)
```

### 3단계: 라이브러리 함수
```bash
src/lib/
├── restore-contact-service.ts (복구 로직)
├── backup-file-validator.ts (검증)
└── restore-audit.ts (감사 로그)
```

### 4단계: 테스트
```bash
- 개별 복구 테스트
- 배치 복구 테스트
- 권한 테스트 (403)
- 데이터 변경 감지 테스트 (409)
```

---

## 🎯 최종 권장안

| 항목 | 권장안 | 이유 |
|------|--------|------|
| **엔드포인트** | `POST /api/contacts/[id]/restore-from-backup` | Contact 워크플로우 중심, REST 원칙 준수 |
| **미리보기** | 별도 `POST /api/contacts/[id]/preview-backup` | GET 부수 효과 제거, 명확한 의도 |
| **권한 검증** | API route (조직/Contact) + lib (필드) | 계층 분리 + 보안 다중 방어 |
| **응답 형식** | `{ ok, contactId, restoredAt, restoredFields }` | 마비즈 표준 준수 |
| **에러 처리** | Custom exception + handleApiError | 일관된 에러 응답 |
| **성능** | 배치 100개 < 5s + DB 인덱스 | Cron 55초 제약 준수 |

---

**검토 완료**: 2026-06-22  
**승인 필요**: Team 1 (Contact 에이전트)  
**구현 예상**: Phase 1 (2026-06-25)
