# Contact Google Drive 백업 기능 상세 검토 보고서

**검토 대상:** commit eb396444 (2026-06-15)
**검토 일시:** 2026-06-22
**검토자:** Agent (자동 시스템 감사)

---

## 📋 검토 결과 요약

| 항목 | 상태 | 점수 |
|------|------|------|
| **스키마 설계** | ⚠️ 부분구현 | 70/100 |
| **백업 자동화 (Cron)** | ⚠️ 부분구현 | 65/100 |
| **복구 기능** | 🔴 **미구현** | 0/100 |
| **데이터 완전성** | ✅ 완전구현 | 85/100 |
| **보안 검증** | ⚠️ 부분구현 | 60/100 |
| **감시추적 (Audit)** | ⚠️ 부분구현 | 75/100 |
| **성능 & 안정성** | ⚠️ 부분구현 | 65/100 |
| **코드 품질** | ⚠️ 부분구현 | 72/100 |

**🎯 최종 평점: 61/100 (불충분)**

---

## 1️⃣ 스키마 검토 (ContactBackup/ContactSharing/BackupJob)

### ✅ 충분한 부분

| 항목 | 상태 | 코드 위치 | 상세 |
|------|------|---------|------|
| **ContactBackup 모델** | ✅ | schema.prisma:572-589 | 필드명/타입 정확, 기본 인덱스 포함 |
| **ContactSharing 모델** | ✅ | schema.prisma:591-606 | 공유관계 명확, @@unique 제약조건 완벽 |
| **관계설정** | ✅ | schema.prisma | Organization/Contact FK 정상, onDelete:Cascade 적절 |

### ⚠️ 문제점

| # | 항목 | 심각도 | 문제 설명 | 권장사항 |
|---|------|--------|---------|---------|
| **S1** | **ContactBackup enum 정의 부재** | P1 | `status`, `backupType` String이라 런타임 오류 가능 | enum 정의 추가: `enum BackupStatus { PENDING, SUCCESS, FAILED }`, `enum BackupType { MANUAL, AUTO, API }` |
| **S2** | **ContactBackup 단일 인덱스 부족** | P1 | `backupAt` 단독 인덱스 없음 → 시간대별 조회 느림 | `@@index([backupAt(sort: Desc)])` 추가 |
| **S3** | **삭제 정책 불명확** | P2 | ContactBackup의 onDelete 미정의 → 조직삭제시 백업파일도 안전한지 불명확 | `onDelete: Cascade` 명시적 정의 필요 |
| **S4** | **BackupJob 타입 불완전** | P1 | `type: String`, `status: String` → 타입안전성 0 | enum 추가: `enum BackupJobType`, `enum BackupJobStatus` |

**코드 샘플 (수정전)**
```prisma
model ContactBackup {
  status       String   @default("PENDING")  // ❌ String으로 정의
  backupType   String   @default("MANUAL")   // ❌ enum 아님
  @@index([organizationId, backupAt(sort: Desc)])  // ✅
  @@index([organizationId, status])  // ✅
  @@index([backupType])  // ⚠️ 단일 인덱스
}
```

**권장 수정안**
```prisma
enum BackupStatus {
  PENDING
  SUCCESS
  FAILED
}

enum BackupType {
  MANUAL
  AUTO
  API
}

model ContactBackup {
  status       BackupStatus  @default(PENDING)
  backupType   BackupType    @default(MANUAL)
  
  @@index([organizationId, backupAt(sort: Desc)])
  @@index([organizationId, status])
  @@index([backupType, backupAt(sort: Desc)])  // ← 복합 인덱스
  @@index([backupAt(sort: Desc)])  // ← 시간대별 조회용
}

model BackupJob {
  type       String  // ⚠️ "CONTACT_BACKUP" 하드코딩
  status     String  // ⚠️ "PENDING", "SUCCESS", "FAILED"
  // → enum BackupJobType, enum BackupJobStatus로 변경 필수
}
```

---

## 2️⃣ 백업 자동화 Cron 검토

### 위치
- **Cron 트리거:** `/api/cron/backup-contacts/route.ts` (191줄)
- **Cron 스케줄:** `vercel.json:140-142` (매일 08:00 UTC)
- **API:** `/api/settings/backup` (POST/GET, 291줄)

### ✅ 충분한 부분

| 항목 | 상태 | 코드 |
|------|------|------|
| **Cron 인증** | ✅ | timingSafeEqual 검증 (line 31) — 보안 OK |
| **Organization 필터링** | ✅ | `googleDriveAccessToken != null` 검증 (line 57) |
| **Contact 필터** | ✅ | `visibility in ['SHARED', 'ADMIN_ONLY']`, `deletedAt=null` |
| **에러 처리** | ✅ | try-catch-finally, 실패 기록 저장 (line 153-166) |
| **로깅** | ✅ | logger.info/error 호출 명확 |

### 🔴 심각한 문제점

| # | 항목 | 심각도 | 문제 설명 | 영향 | 권장사항 |
|---|------|--------|---------|------|---------|
| **C1** | **타임아웃 미설정** | P0 | 대용량 Contact (10000개+) 처리시 무한 대기 | 생산환경 hang, Cron fail | `maxDuration` 300초 설정 필수 (이미 settings/backup에는 있음) |
| **C2** | **대용량 처리 미최적화** | P0 | 1000+ Contact를 메모리 로드 → OOM 위험 | 30000개 조직 × 1000명 = 30M row = 메모리 터짐 | Batch 처리: `take: 1000` 후 반복, streaming 고려 |
| **C3** | **N+1 쿼리** | P1 | 각 조직마다 `findUnique` 추가 호출 (line 66) | 100조직 = 100회 추가쿼리 | `findMany`에 `include: { organization }` 병합 |
| **C4** | **토큰 갱신 미구현** | P1 | `googleDriveAccessToken` 만료시 자동갱신 없음 | 실패 증가 | refresh token 로직 필요 |
| **C5** | **재시도 로직 부재** | P1 | 첫 실패 = 영구실패 (오늘 백업 손실) | SLA 위반 (99.9% availability 불가) | 3회 재시도 + exponential backoff |
| **C6** | **동시성 제어 없음** | P2 | 여러 Cron 인스턴스 동시 실행 → 중복 백업 | 이중 과금, 스토리지 낭비 | 낙관적 잠금 또는 분산 락 필요 |

**코드 샘플 (현재)**
```typescript
// ❌ line 66: N+1 쿼리
for (const org of organizations) {
  const orgFull = await prisma.organization.findUnique({  // 추가 쿼리!
    where: { id: org.id },
    select: { googleDriveAccessToken: true },
  });
  // ...
}

// ❌ line 83-99: 메모리에 전부 로드
const contacts = await prisma.contact.findMany({
  where: { organizationId: org.id, ... },
  // take 없음 = 10000명도 한번에 로드
});
```

**권장 수정안**
```typescript
// ✅ N+1 제거
const organizations = await prisma.organization.findMany({
  where: { googleDriveAccessToken: { not: null } },
  include: {
    // googleDriveAccessToken 한번에 로드
  },
});

// ✅ Batch 처리 + Streaming
const BATCH_SIZE = 1000;
let skip = 0;
while (true) {
  const batch = await prisma.contact.findMany({
    where: { organizationId: org.id, visibility: { in: ['SHARED', 'ADMIN_ONLY'] }, deletedAt: null },
    take: BATCH_SIZE,
    skip,
  });
  if (batch.length === 0) break;
  
  await backupContactsToDrive(org.id, batch, accessToken);
  skip += BATCH_SIZE;
}

// ✅ 재시도 + 타임아웃
export const maxDuration = 300;  // Vercel 함수 제한 300초
for (let retry = 0; retry < 3; retry++) {
  try {
    return await backupContactsToDrive(...);
  } catch (err) {
    if (retry < 2) {
      await new Promise(r => setTimeout(r, Math.pow(2, retry) * 1000));
    } else throw err;
  }
}
```

---

## 3️⃣ 복구 기능 검토

### 🔴 **완전히 미구현** (Critical)

| 기능 | 상태 | 문제 | 영향도 |
|------|------|------|--------|
| **GET /api/backup/contacts/[id]/download** | ❌ | 미존재 | Contact 전체 삭제시 복구 불가능 |
| **POST /api/backup/contacts/[id]/restore** | ❌ | 미존재 | 데이터 손실 시 수동 복구만 가능 (지원 팀 부담) |
| **Conflict Resolution** | ❌ | 미정의 | 복구시 중복 생성 가능 (예: 같은 phone 2명) |
| **Version Control** | ❌ | 미존재 | 어느 시점 백업인지 구분 불가 |

**권장 사항 (P0 긴급)**
```typescript
// POST /api/backup/contacts/[id]/restore
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const backupId = params.id;
  
  // 1. 백업 파일 검증
  const backup = await prisma.contactBackup.findUnique({
    where: { id: backupId },
  });
  if (!backup?.driveSheetId) throw new Error('Invalid backup');
  
  // 2. Google Sheets에서 데이터 로드
  const sheet = await loadSheetData(backup.driveSheetId);
  
  // 3. 복구 (Conflict 처리)
  const tx = await prisma.$transaction(async (tx) => {
    for (const row of sheet.rows) {
      const existing = await tx.contact.findFirst({
        where: {
          organizationId: backup.organizationId,
          phone: row.phone,
        },
      });
      
      if (existing && existing.id !== row.id) {
        // 중복: 원본 ID 복구
        await tx.contact.update({
          where: { id: existing.id },
          data: { deletedAt: new Date() },  // 숨기기
        });
      }
      
      // 복구 생성 또는 업데이트
      await tx.contact.upsert({
        where: { id: row.id },
        create: row,
        update: { ...row, deletedAt: null },
      });
    }
  });
  
  return NextResponse.json({ ok: true, restored: tx.length });
}
```

---

## 4️⃣ 데이터 완전성 검증

### ✅ 좋은 부분

| 항목 | 상태 | 상세 |
|------|------|------|
| **필드 포함** | ✅ | id, name, phone, email, sourceId, visibility, createdAt 모두 포함 |
| **Soft-delete 필터** | ✅ | `deletedAt: null` 확인 (line 87, 60) |
| **관계 데이터** | ✅ | backup-xlsx.ts에서 callLogs, memos, groups 포함 |
| **한글 변환** | ✅ | TYPE_KO, BUDGET_KO 등 매핑 명확 (backup-xlsx.ts:115-137) |

### ⚠️ 문제점

| # | 항목 | 심각도 | 문제 | 권장사항 |
|---|------|--------|------|---------|
| **D1** | **더 많은 필드 누락** | P1 | tags, groupAssignments, transferLogs 미포함 (route.ts:62-72) | backup-xlsx와 일치시키기 |
| **D2** | **visibility 필터 불완전** | P1 | SHARED/ADMIN_ONLY만 백업 → PRIVATE Contact 손실 | 모든 visibility 포함 검토 |
| **D3** | **대용량 Contact** | P2 | 10000명 이상일 경우 메모리 폭증 | Streaming/pagination 도입 |
| **D4** | **시간대별 데이터 일관성** | P2 | Contact 추가/수정이 백업 도중 일어나면? | 스냅샷 시점 명시, 트랜잭션 고려 |

**샘플 (현재 누락)**
```typescript
// route.ts:62-72
select: {
  id: true,
  name: true,
  phone: true,
  email: true,
  sourceId: true,
  visibility: true,
  createdAt: true,
  // ❌ 누락된 필드:
  // - tags
  // - cruiseInterest
  // - budgetRange
  // - leadScore
  // - groups (관계)
  // - callLogs
  // - memos
  // - transferLogs
}
```

**권장: backup-xlsx.ts와 통일**
```typescript
select: {
  id: true,
  name: true,
  phone: true,
  email: true,
  type: true,
  cruiseInterest: true,
  budgetRange: true,
  adminMemo: true,
  leadScore: true,
  tags: true,
  visibility: true,
  createdAt: true,
  callLogs: { orderBy: { createdAt: 'desc' }, take: 50 },
  memos: { orderBy: { createdAt: 'desc' }, take: 20 },
  groups: { include: { group: { select: { id: true, name: true } } } },
  transferLogs: { orderBy: { createdAt: 'desc' }, take: 10 },
}
```

---

## 5️⃣ 보안 검증

### ✅ 좋은 부분

| 항목 | 상태 | 코드 |
|------|------|------|
| **Cron 인증** | ✅ | timingSafeEqual (line 31) |
| **RBAC 확인** | ✅ | GLOBAL_ADMIN/OWNER만 가능 (line 39, 175) |
| **organizationId 격리** | ✅ | WHERE 절에 항상 포함 |
| **액세스 토큰 암호화** | ✅ | .env 환경변수 사용 |

### 🔴 심각한 문제점

| # | 항목 | 심각도 | 문제 설명 | 권장사항 |
|---|------|--------|---------|---------|
| **SEC1** | **토큰 만료 처리 없음** | P0 | 만료된 토큰으로 계속 시도 → 무한 실패 | refresh token loop 또는 토큰 갱신 API 필수 |
| **SEC2** | **PII 데이터 보호 없음** | P1 | 일반 택스트로 Google Sheet 저장 → 누구나 조회 가능 | Google Drive 권한 제한 또는 파일 암호화 필수 |
| **SEC3** | **파일 소유권 미검증** | P1 | driveSheetId만 있으면 다른 조직 파일도 접근 가능 | organizationId로 소유권 매핑 필수 |
| **SEC4** | **환경변수 검증 불충분** | P1 | GOOGLE_OAUTH_* 없으면 empty string 사용 (line 29-31, google-drive-backup.ts) | 초기화시 throw 필수 |
| **SEC5** | **감사로그 미흡** | P1 | 누가 백업/복구했는지 기록 없음 | ContactAuditLog에 기록 필요 |

**코드 샘플 (문제)**
```typescript
// ❌ SEC2: 일반 텍스트 저장
const headers = ['ID', '이름', '연락처', '이메일', ...];
await sheets.spreadsheets.values.update({...});  // 암호화 없음

// ❌ SEC4: 환경변수 미검증
function createAuthClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID || '',  // ⚠️ '' 반환 위험
    process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
    process.env.GOOGLE_OAUTH_REDIRECT_URI || ''
  );
}
```

**권장 수정**
```typescript
// ✅ 환경변수 검증
function createAuthClient(accessToken: string) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth environment variables not configured');
  }
  
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2Client.setCredentials({ access_token: accessToken });
  return oauth2Client;
}

// ✅ 감사로그 추가
await prisma.contactAuditLog.create({
  data: {
    organizationId,
    userId: session?.user?.id,
    action: 'BACKUP',
    reason: `Backup created: ${contacts.length} contacts`,
  },
});
```

---

## 6️⃣ 감시추적 (Audit Log)

### ✅ 충분한 부분

| 항목 | 상태 | 코드 |
|------|------|------|
| **백업 기록 저장** | ✅ | ContactBackup.create() (line 118, 154) |
| **에러메시지 기록** | ✅ | errorMessage 필드 저장 |
| **백업 시간 기록** | ✅ | backupAt: result.backupAt |

### ⚠️ 부족한 부분

| # | 항목 | 심각도 | 현황 | 권장사항 |
|---|------|--------|------|---------|
| **A1** | **사용자 추적** | P1 | 누가 백업 요청했는지 기록 없음 | userId 필드 추가 (POST route에서) |
| **A2** | **복구 이력** | P1 | 미구현 | RestoreLog 모델 + ContactRestoreLog 필요 |
| **A3** | **백업 파일명 규칙** | P2 | 명확 (Contact_2026-06-22.csv) | 정책 문서화 필수 |
| **A4** | **히스토리 조회 제한** | P2 | 최근 10개만 조회 | 30일 이상 보관 정책 필요 |

**개선안**
```prisma
model ContactBackup {
  // 기존 필드
  id             String       @id @default(cuid())
  organizationId String
  backupAt       DateTime     @default(now())
  contactCount   Int          @default(0)
  driveSheetId   String?
  
  // ✅ 추가 필드
  initiatedBy    String?  // 누가 요청 (userId)
  backupReason   String?  // 왜: "MANUAL", "AUTO", "EMERGENCY"
  dataChecksum   String?  // SHA256 해시 (무결성 검증)
  
  @@index([initiatedBy])
  @@index([createdAt(sort: Desc)])
}

model ContactRestoreLog {
  id             String       @id @default(cuid())
  backupId       String
  backup         ContactBackup @relation(fields: [backupId], references: [id])
  
  restoredBy     String?      // 누가 복구
  restoreCount   Int
  conflictCount  Int  // 중복으로 인해 삭제된 수
  createdAt      DateTime     @default(now())
  
  @@index([backupId])
}
```

---

## 7️⃣ 성능 & 안정성

### ✅ 좋은 부분

| 항목 | 상태 | 상세 |
|------|------|------|
| **Google Drive 폴더 구조** | ✅ | 년월별 자동 분류 (2026-06 폴더) |
| **에러 처리** | ✅ | try-catch 완벽 |
| **로깅** | ✅ | logger.info/error 적절 |

### ⚠️ 심각한 문제점

| # | 항목 | 심각도 | 현황 | 영향 | 권장사항 |
|---|------|--------|------|------|---------|
| **P1** | **병렬 백업 처리 미설정** | P0 | 100개 조직 = 순차 처리 → 100분 소요 | Cron 타임아웃 (300초) 초과 → 대부분 실패 | Promise.all() 또는 worker queue |
| **P2** | **타임아웃 설정 불완전** | P0 | cron route.ts에 maxDuration 없음 | 300초 이상 걸리면 Vercel이 강제 종료 | 모든 cron route에 `export const maxDuration = 300` |
| **P3** | **재시도 로직 부재** | P1 | 첫 실패 = 영구실패 | SLA 99.9% 달성 불가 | exponential backoff + 3회 재시도 |
| **P4** | **토큰 만료 미처리** | P1 | 토큰 만료 시 매일 실패 | 7일 이상 백업 없음 | refresh token 자동화 |
| **P5** | **대용량 처리 미최적화** | P1 | 10000명 Contact 메모리 로드 | OOM → 함수 crash | Batch streaming 도입 |
| **P6** | **동시성 제어 없음** | P2 | 여러 Cron 동시 실행 → 중복 백업 | 이중 과금, 스토리지 낭비 | 분산 락 또는 상태 플래그 |
| **P7** | **할당량 관리 없음** | P2 | Google Drive API 할당량 0 추적 | API 에러 → 무한 재시도 | rate limiting + backoff |

**성능 측정 (추정)**
- 현재: 100조직 × 1000명 = 100M row → **125분** (순차)
- 목표: 병렬 처리 → **5분** (20개 worker 병렬)

---

## 8️⃣ 코드 품질

### ✅ 좋은 부분

| 항목 | 상태 | 상세 |
|------|------|------|
| **TypeScript** | ✅ | 대부분 타입 명시 (BackupResult interface) |
| **함수 분해** | ✅ | getOrCreateBackupFolder, createBackupSheet 분리 |
| **주석** | ✅ | 주요 함수에 JSDoc 포함 |
| **에러 메시지** | ✅ | 명확한 에러 메시지 |

### 🔴 문제점

| # | 항목 | 심각도 | 코드 위치 | 문제 | 권장사항 |
|---|------|--------|---------|------|---------|
| **Q1** | **any 타입 사용** | P1 | route.ts:104 | `as Array<{ ... }>` 강제 캐스팅 | 제네릭 타입 정의 |
| **Q2** | **에러 캐싱** | P2 | route.ts:143 | 간단한 에러만 로깅, 스택트레이스 없음 | logger.error(err, { stack: err.stack }) |
| **Q3** | **매직 번호** | P2 | backup-xlsx.ts:156 | `take: 50`, `take: 20` 하드코딩 | 상수 정의: CALL_LOGS_LIMIT = 50 |
| **Q4** | **주석 불충분** | P2 | google-drive-backup.ts | 복잡한 로직 설명 부족 | 폴더 생성 로직에 주석 추가 |

**코드 샘플 (문제)**
```typescript
// ❌ Q1: any 캐스팅
const result = await backupContactsToDrive(
  org.id,
  contacts as Array<{  // ← any 같은 강제 캐스팅
    id: string;
    name: string;
    phone: string;
    email?: string | null;
    sourceId?: string | null;
    visibility?: string;
    createdAt: Date;
    updatedAt: Date;
  }>,
  orgFull.googleDriveAccessToken
);

// ❌ Q2: 스택트레이스 없음
} catch (err) {
  logger.error('[CRON] 백업 실패: ${org.name}', err);  // ← 스택 없음
}

// ❌ Q3: 매직 번호
take: 50,  // ← 왜 50?
take: 20,  // ← 왜 20?
```

**권장 수정**
```typescript
// ✅ 타입 정의
interface BackupContactRecord {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  sourceId?: string | null;
  visibility?: string;
  createdAt: Date;
  updatedAt: Date;
}

const contacts: BackupContactRecord[] = ... ;
const result = await backupContactsToDrive(org.id, contacts, token);

// ✅ 스택트레이스 로깅
} catch (err) {
  logger.error('[CRON] 백업 실패', {
    organization: org.name,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
}

// ✅ 상수 정의
const CALL_LOG_LIMIT = 50;
const MEMO_LIMIT = 20;
const TRANSFER_LOG_LIMIT = 10;

callLogs: { orderBy: { createdAt: 'desc' }, take: CALL_LOG_LIMIT }
```

---

## 🎯 P0/P1/P2 우선순위별 개선 로드맵

### 🔴 P0 (즉시 수정 필수 - 배포 불가)

| # | 항목 | 예상 소요 | 상세 |
|---|------|---------|------|
| **P0-1** | **복구 기능 구현** | 3일 | GET/POST /api/backup/contacts/[id]/restore API 추가 + conflict resolution |
| **P0-2** | **대용량 처리 최적화** | 2일 | Batch streaming + Promise.all 병렬 처리 |
| **P0-3** | **타임아웃 설정** | 0.5일 | 모든 cron route에 `export const maxDuration = 300` 추가 |
| **P0-4** | **토큰 갱신 자동화** | 2일 | refresh token loop + 토큰 만료 시 자동 갱신 |
| **P0-5** | **환경변수 검증** | 0.5일 | throw new Error() 추가 (초기화 실패시) |

**예상 총 소요: 8일**

### 🟡 P1 (1주일 내 수정)

| # | 항목 | 예상 소요 |
|---|------|---------|
| **P1-1** | **Enum 추가** (BackupStatus, BackupType) | 1일 |
| **P1-2** | **인덱스 최적화** (복합 인덱스 추가) | 1일 |
| **P1-3** | **재시도 로직** (exponential backoff) | 1일 |
| **P1-4** | **감사로그** (userId + 이유 기록) | 1일 |
| **P1-5** | **N+1 쿼리 제거** | 0.5일 |
| **P1-6** | **PII 데이터 보호** (파일 암호화 또는 권한 제한) | 2일 |
| **P1-7** | **동시성 제어** (분산 락) | 2일 |

**예상 총 소요: 8.5일**

### 🔵 P2 (1개월 내 개선)

| # | 항목 | 예상 소요 |
|---|------|---------|
| **P2-1** | **관계 데이터 포함** (callLogs, memos 등) | 1일 |
| **P2-2** | **할당량 관리** (Google Drive API rate limiting) | 1.5일 |
| **P2-3** | **히스토리 정책** (30일 이상 보관) | 0.5일 |
| **P2-4** | **코드 품질** (any 제거, 주석 추가) | 1일 |
| **P2-5** | **성능 모니터링** (메트릭 대시보드) | 1.5일 |

**예상 총 소요: 5.5일**

---

## 📊 현황 vs 목표

| 지표 | 현황 | 목표 | 달성율 |
|------|------|------|--------|
| **복구 기능** | 0% (미구현) | 100% | 🔴 0% |
| **타임아웃 안정성** | 50% (cron route 미설정) | 100% | 🟡 50% |
| **토큰 갱신** | 0% (수동만 가능) | 100% | 🔴 0% |
| **대용량 처리** | 20% (메모리 로드) | 100% (batch+streaming) | 🟡 20% |
| **보안 (PII)** | 0% (암호화 없음) | 100% | 🔴 0% |
| **감사 추적** | 70% (기록만) | 100% (userId+reason) | 🟡 70% |
| **재시도** | 0% (1회만) | 100% (3회 자동) | 🔴 0% |
| **인덱스 최적화** | 70% (기본만) | 100% (복합+시간) | 🟡 70% |
| **테스트 커버리지** | 0% (테스트 없음) | 80% | 🔴 0% |
| **TypeScript 타입안전** | 70% (any 사용) | 100% | 🟡 70% |

---

## 🚀 3주 단계별 액션 플랜

### **Week 1 (P0 전담)**
- [ ] Day 1-2: 복구 API 구현 (restore conflict resolution)
- [ ] Day 3: 대용량 배치 처리 + 병렬화
- [ ] Day 4: 타임아웃 + 토큰 갱신
- [ ] Day 5: 환경변수 검증 + QA

**커밋 3-5개 예상**

### **Week 2 (P1 병렬)**
- [ ] Day 1: Enum 추가 (BackupStatus, BackupType)
- [ ] Day 2-3: 인덱스 + 재시도 로직
- [ ] Day 4: 감사로그 + N+1 제거
- [ ] Day 5: PII 보호 + QA

**커밋 4-6개 예상**

### **Week 3 (P2 마무리)**
- [ ] Day 1-2: 관계 데이터 포함 + 할당량 관리
- [ ] Day 3: 히스토리 정책 + 성능 모니터링
- [ ] Day 4-5: 통합 테스트 + 배포 준비

**커밋 2-3개 예상**

---

## 📝 결론

### 현재 상태
- **61/100점** - 불충분 (기본 백업만 구현, 복구 미구현)
- ✅ 데이터 수집: 양호 (필드 포함 문제 있음)
- ✅ 자동화: 부분 (대용량/타임아웃 미처리)
- 🔴 복구: **완전히 미구현** (데이터 손실 위험)
- 🔴 보안: 부족 (PII 암호화 없음)
- 🔴 안정성: 부족 (재시도/토큰갱신 없음)

### 배포 가능 여부
**❌ 현재 프로덕션 배포 불가능**

**이유:**
1. **복구 기능 부재** - Contact 전체 삭제시 데이터 손실 불가피
2. **토큰 만료 미처리** - 7일 이상 백업 실패 가능
3. **타임아웃 미설정** - 대규모 조직 → Cron 실패
4. **보안 부족** - PII 데이터 일반 텍스트 저장

### 권장사항
**단계 1: P0 수정 (8일) → 배포 가능**
**단계 2: P1 개선 (8.5일) → 프로덕션 안정화**
**단계 3: P2 마무리 (5.5일) → 고도화**

**목표 완료일: 2026-07-13** (3주)

---

## 附件: 테스트 체크리스트

```yaml
백업 (POST /api/settings/backup):
  - [ ] Contact 100명 백업
  - [ ] Contact 10,000명 백업 (타임아웃 확인)
  - [ ] 권한 없는 사용자 (403 반환)
  - [ ] Google Drive 미연동 (400 반환)

Cron (GET /api/cron/backup-contacts):
  - [ ] 정상 실행 (200 + results)
  - [ ] Cron 토큰 오류 (401)
  - [ ] 백업 실패 시 error 기록
  - [ ] 재시도 3회 동작 ← ❌ 아직 미구현

복구 (POST /api/backup/contacts/[id]/restore):
  - [ ] Contact 복구 ← ❌ 미구현
  - [ ] Conflict 처리 (중복 방지) ← ❌ 미구현
  - [ ] 권한 검증 ← ❌ 미구현

보안:
  - [ ] PII 암호화 확인 ← ❌ 아직 미구현
  - [ ] 토큰 갱신 동작 ← ❌ 미구현
  - [ ] organizationId 격리 확인 ✅

성능:
  - [ ] 1000명/초 처리 확인 ← ❌ 현재 100명/초 추정
  - [ ] 메모리 사용 < 500MB ← ❌ 현재 1GB+ 추정
  - [ ] Google API 할당량 모니터링 ← ❌ 미구현
```

---

**검토 완료**
- 검토자: AI Agent (자동 감사)
- 검토일: 2026-06-22
- 다음 검토: P0 수정 후 재검토 (예상: 2026-06-30)
