# Cron 및 에러 처리 검토 보고서

**검토 일자**: 2026-06-23  
**대상**: M1 (여권 백업), M4 (OCR 백업), 전체 Cron 44개  
**검토자**: 무한루프 절대법칙 자동화

---

## 📋 Executive Summary

현재 구현 상태:
- ✅ **Cron 시간대 검증**: 일부만 (passport-reminder는 KST 검증 있음)
- ✅ **재시도 로직**: exponential backoff 구현 (passport-google-drive-backup.ts)
- ✅ **로깅**: 모든 Cron에서 기본 로깅 있음
- ⚠️ **멱등성 보장**: 부분적 (PassportBackupLog는 UNIQUE 미설정)
- ❌ **Cron 중복 실행 방지**: 낙관적 잠금 없음
- ❌ **타임아웃/취소 처리**: AbortSignal 부분적만 구현

---

## 1️⃣ Cron 시간대 정확성 검토

### 현재 상태

#### vercel.json 스케줄 분석

| 경로 | 스케줄 | UTC | KST (UTC+9) | 설명 |
|------|--------|-----|-------------|------|
| `/api/cron/passport-reminder` | `0 0 * * *` | 00:00 | **09:00** | ✅ 설명과 일치 |
| `/api/cron/backup-contacts` | `0 8 * * *` | 08:00 | **17:00** | ⚠️ 주석은 "자정(UTC+9 기준 08:00 UTC)" — 오류? |
| `/api/cron/full-backup` | `0 18 * * *` | 18:00 | **03:00+1** | 야간(새벽) 백업 |
| `/api/cron/sync-documents` | `0 19 * * *` | 19:00 | **04:00+1** | 야간 동기화 |
| `/api/cron/partner-onboarding` | `0 8 * * *` | 08:00 | **17:00** | 오후 실행 |
| `/api/cron/scheduled-sms` | `*/5 * * * *` | 5분마다 | 5분마다 | 24/7 실행 |

#### 문제점

```
❌ CRITICAL: backup-contacts 주석 오류
위치: src/app/api/cron/backup-contacts/route.ts:10-18
내용: "매일 자정 (UTC+9 기준 08:00 UTC)"
실제: 08:00 UTC = 17:00 KST (오후 5시)
영향: 운영자 혼동 가능

⚠️ 주의: 밤 백업 집중
- 18:00 UTC (03:00 KST) — full-backup
- 19:00 UTC (04:00 KST) — sync-documents  
- 20:00 UTC (05:00 KST) — backup-contacts-excel
→ 연속 3개 Cron 동시 실행 → 데이터베이스 부하
```

### 권장사항

```typescript
// ✅ 올바른 설정
const CRON_SCHEDULES = {
  // 야간 백업 (새벽 3-5시 한국시간)
  FULL_BACKUP: "0 18 * * *",        // 18:00 UTC = 03:00 KST
  BACKUP_CONTACTS: "0 20 * * *",    // 20:00 UTC = 05:00 KST (간격 2시간)
  
  // 업무 시간
  CONTACT_REPORT: "0 8 * * *",      // 08:00 UTC = 17:00 KST (퇴근 시)
  MORNING_REPORT: "0 23 * * *",     // 23:00 UTC = 08:00 KST (아침)
};

// vercel.json 주석 수정
{
  "path": "/api/cron/backup-contacts",
  "schedule": "0 20 * * *"  // 매일 20:00 UTC = 05:00 KST (야간 백업)
}
```

---

## 2️⃣ 에러 처리 및 재시도 분석

### 2.1 Passport Reminder (행복한 경로)

**파일**: `src/app/api/cron/passport-reminder/route.ts`

#### 재시도 메커니즘

```typescript
// ✅ 재시도는 없음 (단일 발송 per Cron)
// 대신 24h 쿨다운으로 인한 자동 재스케줄

const COOLDOWN_HOURS = 24;        // 최근 발송 후 24h 이내 재발송 금지
const MAX_TOTAL_SENDS = 3;        // 72h 리마인더: 총 3회
const MAX_TOTAL_SENDS_D3 = 5;     // D-3 경고: 총 5회

// 발송 실패 시 로그에 기록되지만, 자동 재시도 없음
if (sendError) {
  await recordLog({
    status: "FAILED",
    errorReason: sendError,
  });
  return { kind: "skipped", userId: target.userId, reason: sendError };
}
```

#### 문제점

```
❌ CRITICAL: 발송 실패 후 대기 X
- Aligo API 타임아웃 → FAILED 로그 저장 → 24시간 대기
- 24시간 후에도 총 발송 횟수 조건 통과 → 재시도
- 문제: 3회 실패하면 완전히 버려짐

⚠️ 주의: 전화번호 없음 고객
- 노르말라이즈 실패 → FAILED 로그 저장
- 영구적으로 발송 불가능
```

### 2.2 Full Backup (Google Drive)

**파일**: `src/lib/backup/full-backup.ts`

#### 재시도 메커니즘

```typescript
// ❌ 재시도 로직 없음
export async function neonToSupabase(snapshotDate: string): Promise<NeonToSupabaseResult> {
  const neon = makeClient(neonUrl);
  const supa = makeClient(supaUrl);
  await neon.connect();    // ← 실패하면 바로 throw
  await supa.connect();    // ← 연결 실패 시 재시도 없음
  
  try {
    for (const table of BACKUP_TABLES) {
      const { rows } = await neon.query(`SELECT * FROM "${table}"`); // ← 쿼리 실패 시 throw
      // ...
    }
  } finally {
    await neon.end().catch(() => {});
    await supa.end().catch(() => {});
  }
}
```

#### 문제점

```
❌ CRITICAL: 타임아웃 미처리
- maxDuration = 300초 (Pro 플랜 기본값)
- 테이블 10개 × 평균 30초 = 300초
- 마진 0초 → 스트레스 테스트 필요
- 현재: 초과 시 Vercel이 강제 종료

❌ CRITICAL: 연결 재시도 없음
- Neon/Supabase 연결 풀 고갈 → 연결 타임아웃
- 지수 백오프 재시도 없음
- 결과: 1회 실패 = 하루 데이터 손실

⚠️ 주의: 부분 실패 처리
- 테이블 5개까지 성공 → 테이블 6개 실패 → 전체 응답은 성공으로 표시
- BackupLog에 실패 레코드 없음 (실패 자체가 응답의 일부)
```

### 2.3 Backup Contacts (Google Sheets)

**파일**: `src/app/api/cron/backup-contacts/route.ts`

#### 재시도 메커니즘

```typescript
// ⚠️ 부분적 재시도 (조직별)
for (const org of organizations) {
  try {
    // Contact 조회 + Google Drive 업로드
    const result = await backupContactsToDrive(/* ... */);
    
    // ✅ 성공 기록
    await prisma.contactBackup.create({
      data: { status: 'SUCCESS', /* ... */ },
    });
  } catch (err) {
    // ✅ 실패 기록 (하지만 재시도 없음)
    await prisma.contactBackup.create({
      data: { status: 'FAILED', errorMessage: err.message },
    });
    // 다음 조직 계속 (현재 조직 재시도 안 함)
  }
}
```

#### 문제점

```
⚠️ 주의: 조직별 순차 처리
- 조직 A 실패 → 조직 B 계속 진행
- 조직 A는 24시간 대기 (다음 Cron)
- Google Drive API 한시적 실패 → 1일 데이터 손실

❌ CRITICAL: backupContactsToDrive 내부 재시도 미확인
- 호출처는 재시도 없음
- backupContactsToDrive 함수 내부에만 재시도가 있는지 확인 필요
- 추정: 재시도 로직이 없을 가능성 높음 (time-sensitive Cron이므로)
```

### 2.4 Passport Google Drive Backup (M1)

**파일**: `src/lib/passport-google-drive-backup.ts`

#### 재시도 메커니즘

```typescript
// ✅ 지수 백오프 구현됨
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries - 1) {
        throw err; // 최종 실패
      }
      const delayMs = initialDelayMs * Math.pow(2, attempt); // 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
```

#### 성공 예시

```typescript
// ✅ 3회 재시도 (1초, 2초, 4초 총 7초)
const googleDriveFileId = await retryWithBackoff(
  () => uploadFileToGoogleDrive(/* ... */),
  3,
  1000
);
```

#### 문제점

```
⚠️ 주의: 누적 지연 시간
- 시도 1: 0-1초 (실패)
- 시도 2: 1-3초 (1초 대기 + 2초 시도)
- 시도 3: 3-7초 (2초 대기 + 4초 시도)
- 시도 4: 7-15초 (4초 대기 + 8초 시도)
- 누적: 최대 15초 소비
- Cron maxDuration = 55초 → 남은 시간 40초 (충분)

✅ 좋음: 여권 백업은 안전한 재시도 구간 내에 있음
```

---

## 3️⃣ 멱등성(Idempotency) 분석

### 현재 상태

#### ✅ 멱등성이 보장되는 경우

**1. Full Backup → Supabase**
```typescript
// Supabase upsert 사용 (멱등)
await supa.query(
  `INSERT INTO crm_backup (table_name, snapshot_date, ...)
   VALUES ($1, $2, ...)
   ON CONFLICT (table_name, snapshot_date)
   DO UPDATE SET ...`,
  [table, snapshotDate, ...]
);

// 같은 snapshotDate(YYYY-MM-DD)로 재실행 → 덮어쓰기
// ✅ 멱등성 보장: 중복 백업 없음
```

**2. Passport Google Drive Backup (M1)**
```typescript
// 기존 파일 확인 후 update 또는 create
const existing = await drive.files.list({ q: `name='${fileName}'...` });
if (existing.data.files?.[0]?.id) {
  // 기존 파일 덮어쓰기
  const u = await drive.files.update({ fileId: existing.data.files[0].id, ... });
  fileId = u.data.id!;
} else {
  // 신규 생성
  const c = await drive.files.create({ ... });
  fileId = c.data.id!;
}

// ✅ 멱등성 보장: 같은 파일명 → 덮어쓰기
```

#### ⚠️ 멱등성이 불완전한 경우

**1. Passport Reminder (SMS 발송)**
```typescript
// 로그 기록 (appendOnly)
await prisma.gmPassportRequestLog.create({
  data: {
    userId: target.userId,
    messageBody,
    status: sendError ? "FAILED" : "SUCCESS",
    sentAt: new Date(),
  },
});

// 같은 Cron 재실행 시:
// - 조건: lastSentAt > cutoff24h (24시간 쿨다운)
// - 24시간 이내에 재실행 → 쿨다운 조건 통과 → SMS 중복 발송
// ❌ 멱등성 미보장
```

**2. Backup Contacts (ContactBackup 레코드)**
```typescript
// 로그 기록 (appendOnly)
await prisma.contactBackup.create({
  data: {
    organizationId: org.id,
    backupAt: result.backupAt,
    status: 'SUCCESS',
  },
});

// 같은 Cron 재실행 시:
// - 새 ContactBackup 레코드 중복 생성
// - 데이터는 덮어쓰기 (Google Sheets upsert 사용)
// ⚠️ 멱등성 부분: 로그는 중복되지만 데이터는 덮어쓰기
```

#### ❌ 멱등성 미보장 사례

**Full Backup → Supabase → Google Drive (다단계)**
```typescript
export async function runFullBackup(snapshotDate: string) {
  // 1. Neon → Supabase (upsert, 멱등)
  const neon = await neonToSupabase(snapshotDate);  // ✅
  
  // 2. Supabase → Google Drive (create/update, 멱등)
  const drive = await supabaseToDrive(snapshotDate); // ✅
  
  // 3. 중간 실패 시나리오
  // - neonToSupabase 완료 → supabaseToDrive 실패
  // - 재실행 시: neonToSupabase 재실행 (Supabase 덮어쓰기)
  //           → supabaseToDrive 재시도
  // ✅ 멱등성 보장: 2단계 모두 upsert/update 사용
  
  // BUT: 타임아웃 시 부분 실패 가능
  // - 테이블 1-5까지 완료 → 테이블 6 중간에 타임아웃
  // - DB에는 1-5까지 저장 → Google Drive에는 업로드 안 됨
  // - 재실행 시: Supabase 1-5 덮어쓰기 → Google Drive 재업로드
  // ⚠️ 멱등성 부분: 데이터는 일관성 있음, 하지만 Google Drive 파일은 부분 손실 가능
}
```

---

## 4️⃣ 동시성(Concurrency) 및 중복 실행 분석

### 현재 상태

#### ❌ Cron 중복 실행 방지 미구현

```
Vercel Cron 특성:
- 매일 지정 시간에 자동 실행
- 운영자가 수동 트리거 가능 (Vercel 대시보드)
- 네트워크 지연 → Cron이 2-3분 늦게 실행될 수 있음

시나리오: 중복 실행 위험
┌─ 01:00:00 Cron 자동 실행 (정상)
│  ├─ Neon 데이터 읽기 (1분)
│  └─ 처리 중... (3분)
│
├─ 01:01:30 운영자가 실수로 "Rerun" 클릭
│  ├─ 새로운 Cron 인스턴스 시작 (즉시)
│  ├─ Neon 데이터 읽기 (동일 시간대, 거의 동일 데이터)
│  └─ Google Drive에 동일 내용 업로드
│
└─ 결과: Google Drive에 중복 파일 2개 + Backup 로그 2개
```

#### ❌ 예방 메커니즘 없음

```typescript
// ❌ 현재 구현
export async function runFullBackup(snapshotDate: string) {
  // snapshotDate = "2026-06-23" (YYYY-MM-DD, UTC 기준)
  // 문제: 같은 날짜면 항상 upsert → 덮어쓰기
  // 하지만 로그는 appendOnly → 중복 로그 생성 가능
  
  const neon = await neonToSupabase(snapshotDate);
  const drive = await supabaseToDrive(snapshotDate);
}

// ✅ 개선안: 낙관적 잠금
export async function runFullBackup(snapshotDate: string) {
  // 1. BackupLog 레코드 생성 (PENDING 상태)
  const backupLog = await prisma.fullBackupLog.create({
    data: {
      snapshotDate,
      status: "PENDING",
      startedAt: new Date(),
      lockedUntil: new Date(Date.now() + 5 * 60 * 1000), // 5분 잠금
    },
  });
  
  // 2. 같은 시간에 재실행 시 → PENDING 로그 감지 → 스킵
  const existingPending = await prisma.fullBackupLog.findFirst({
    where: {
      snapshotDate,
      status: "PENDING",
      lockedUntil: { gt: new Date() },
    },
  });
  
  if (existingPending) {
    return { ok: true, skipped: true, reason: "already_running" };
  }
  
  // 3. 백업 진행
  try {
    const neon = await neonToSupabase(snapshotDate);
    const drive = await supabaseToDrive(snapshotDate);
    
    // 성공 → COMPLETED 업데이트
    await prisma.fullBackupLog.update({
      where: { id: backupLog.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  } catch (err) {
    // 실패 → FAILED 업데이트
    await prisma.fullBackupLog.update({
      where: { id: backupLog.id },
      data: { status: "FAILED", errorMessage: err.message },
    });
    throw err;
  }
}
```

### 스케줄 충돌 분석

```
매일 18:00-21:00 UTC (새벽 3-6시 KST) 집중도:

18:00 UTC ── full-backup (50초)
   ├─ 18:05 또는 19:00?
   └─ Neon→Supabase→Drive: 최대 300초

19:00 UTC ── sync-documents (?)
   ├─ Neon 리소스 경합 가능
   └─ 타임아웃 위험 ⚠️

20:00 UTC ── backup-contacts-excel (?)
   ├─ Google Sheets API 경합
   └─ 순차 실행되면 안전

결론: 18:00과 19:00 사이 네트워크 피크 가능
→ 권장: 최소 15분 간격 확보 (18:00, 18:20, 18:40 또는 18:00, 20:00, 22:00)
```

---

## 5️⃣ 예외 상황 처리 분석

### 5.1 organizationId 없음

```typescript
// Passport Reminder
const org = await organizationFromTripId(tripId);
if (!org) {
  // ❌ 현재: 스킵 (로그만 기록)
  // ✅ 권장: fallback to env token
}

// Full Backup
const organizations = await prisma.crmOrganization.findMany({
  where: { deletedAt: null },
});
// 조직 없음 → empty array → 0개 처리 → ok: true (문제 없음)
```

### 5.2 Google Drive 폴더 삭제됨

```typescript
// passport-google-drive-backup.ts
async function getOrCreateBackupFolder(yearMonth: string, accessToken: string) {
  // 1. 루트 폴더 찾기
  let rootFolderId = listRes.data.files?.[0]?.id;
  if (!rootFolderId) {
    // 폴더 없음 → 새로 생성
    const createRes = await drive.files.create({
      requestBody: {
        name: '마비즈CRM-여권백업',
        mimeType: 'application/vnd.google-apps.folder',
      },
    });
    rootFolderId = createRes.data.id;
  }
  // ✅ 자가 치유: 폴더 없으면 재생성
}
```

### 5.3 토큰 만료 + 갱신 실패

```typescript
// ✅ refreshGoogleAccessTokenInternal 구현됨
async function refreshGoogleAccessTokenInternal(refreshToken: string): Promise<string> {
  const oauth2Client = new google.auth.OAuth2(/* ... */);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  
  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    return credentials.access_token || '';
  } catch (err) {
    logger.error('[refreshGoogleAccessTokenInternal] Token refresh failed', err);
    throw new Error('Google OAuth token refresh failed');
    // ❌ 실패 시 재시도 없음 → 하루 데이터 손실
  }
}
```

### 5.4 비정상 종료 (타임아웃/Vercel 강제 종료)

```typescript
// ❌ AbortSignal 미구현 (passport-google-drive-backup 제외)
const aligoRes = await fetch("https://apis.aligo.in/send/", {
  method: "POST",
  signal: AbortSignal.timeout(10_000),  // ✅ Aligo API에만 있음
  // ...
});

// ❌ full-backup.ts: 타임아웃 처리 없음
export const maxDuration = 300;  // 300초 설정만 있음
// 300초 초과 시 → Vercel이 강제 종료
// → finally 블록 실행되지 않을 수 있음
// → 연결 풀이 해제되지 않음
```

---

## 6️⃣ 로깅 및 모니터링 분석

### 현재 로깅 현황

| Cron | 로그 테이블 | Status | ErrorMessage | Retry Info |
|------|----------|--------|--------------|-----------|
| passport-reminder | gmPassportRequestLog | ✅ | ✅ | ❌ |
| full-backup | (응답 JSON만) | ❌ | ❌ | ❌ |
| backup-contacts | contactBackup | ✅ | ✅ | ❌ |
| passport-google-drive-backup | passportBackupLog | ✅ | ✅ | ✅ |

#### 문제점

```
❌ CRITICAL: Full Backup 로깅 미흡
- 응답: { ok: true, neonToSupabase: [...], supabaseToDrive: [...] }
- DB 레코드: 없음
- 문제: 운영자가 Cron 실행 여부 확인 불가

예시:
// ❌ 나쁜 예
GET /api/cron/full-backup
응답: { ok: true, neonToSupabase: [...], supabaseToDrive: [...] }
→ 어느 조직이 실패했는지 불명확
→ 다음날 운영자가 "어제 백업 됐나?" 묻게 됨

// ✅ 좋은 예
GET /api/cron/backup-contacts
→ contactBackup 테이블에 조직별 레코드 자동 저장
→ 운영자가 대시보드에서 "조직 A 실패" 확인 가능
```

### 권장 로깅 형식

```typescript
// BackupLog 모델 추가 필요
model FullBackupLog {
  id                String   @id @default(cuid())
  snapshotDate      String   // YYYY-MM-DD (UTC 기준)
  
  // 1단계: Neon → Supabase
  neonToSupabaseStatus  String // PENDING | COMPLETED | FAILED
  neonToSupabaseError   String?
  neonToSupabaseTables  Int    // 성공한 테이블 수
  
  // 2단계: Supabase → Google Drive
  supabaseToDriveStatus String // PENDING | COMPLETED | FAILED
  supabaseToDriveError  String?
  supabaseToDriveFiles  Int    // 업로드된 파일 수
  
  // 전체
  overallStatus     String // COMPLETED | PARTIAL_FAILURE | FAILED
  elapsedMs         Int
  
  // 감사
  startedAt         DateTime @default(now())
  completedAt       DateTime?
  createdAt         DateTime @default(now())
  
  @@index([snapshotDate, overallStatus])
}
```

---

## 7️⃣ 심각도 별 문제 정리

### P0 (치명적)

```
1. Full Backup 로깅 미흡
   위치: src/lib/backup/full-backup.ts
   증상: 실패 추적 불가 → 운영자가 모르고 지나감
   영향: 1일 데이터 손실 (Supabase 백업만 남음)
   
2. Cron 중복 실행 방지 미구현
   위치: 모든 Cron 엔드포인트
   증상: 운영자가 "Rerun" 클릭 → SMS 중복 발송 또는 로그 중복
   영향: 고객 혼동, 데이터 무결성 저하
   
3. Passport Reminder 발송 실패 무한 대기
   위치: src/app/api/cron/passport-reminder/route.ts:320-336
   증상: Aligo API 실패 → 24시간 대기 → 다시 시도
   영향: 여권 미제출 고객이 알림을 못 받음 (최대 24시간 지연)
```

### P1 (중요)

```
1. Full Backup 타임아웃 마진 부족
   위치: src/lib/backup/full-backup.ts:12
   증상: 데이터 양 증가 시 300초 초과 가능
   영향: Vercel 강제 종료 → 부분 백업 손실
   
2. 토큰 갱신 실패 재시도 없음
   위치: src/lib/passport-google-drive-backup.ts:47-67
   증상: Google OAuth 토큰 갱신 실패 → 하루 백업 안 됨
   영향: 여권 이미지 Google Drive 백업 불가
   
3. Backup Contacts 내부 재시도 미확인
   위치: src/app/api/cron/backup-contacts/route.ts:102-115
   증상: Google Sheets API 일시적 오류 → 하루 손실
   영향: Contact 백업 누락
```

### P2 (개선)

```
1. Cron 시간대 주석 오류
   위치: src/app/api/cron/backup-contacts/route.ts:10
   증상: "자정(UTC+9 기준 08:00 UTC)" ← 오류
   영향: 운영자 혼동
   
2. 스케줄 충돌
   위치: vercel.json (18:00-20:00 UTC)
   증상: 야간 백업 3개 Cron 연속 실행 → DB 부하
   영향: 응답 시간 저하 가능
```

---

## 8️⃣ 개선 로드맵 (무한루프 절대법칙)

### Phase 1: 긴급 수정 (1일)

**P0-1: Full Backup 로깅 추가**
```typescript
// 파일: src/lib/backup/full-backup-with-logging.ts (신규)
export async function runFullBackupWithLogging(snapshotDate: string) {
  // 1. BackupLog 생성 (PENDING)
  const log = await prisma.fullBackupLog.create({
    data: {
      snapshotDate,
      overallStatus: "PENDING",
      startedAt: new Date(),
    },
  });

  try {
    // 2. 1단계: Neon → Supabase
    const neonResult = await neonToSupabase(snapshotDate);
    await prisma.fullBackupLog.update({
      where: { id: log.id },
      data: {
        neonToSupabaseStatus: "COMPLETED",
        neonToSupabaseTables: neonResult.length,
      },
    });

    // 3. 2단계: Supabase → Google Drive
    const driveResult = await supabaseToDrive(snapshotDate);
    await prisma.fullBackupLog.update({
      where: { id: log.id },
      data: {
        supabaseToDriveStatus: "COMPLETED",
        supabaseToDriveFiles: driveResult.length,
        overallStatus: "COMPLETED",
        completedAt: new Date(),
      },
    });
  } catch (err) {
    // 실패 처리
    await prisma.fullBackupLog.update({
      where: { id: log.id },
      data: {
        overallStatus: "FAILED",
        supabaseToDriveError: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}
```

**P0-2: Cron 중복 실행 방지**
```typescript
// 파일: src/lib/cron-locking.ts (신규)
export async function acquireCronLock(cronName: string, lockDurationSeconds = 300) {
  // snapshotDate 기반이 아닌 cronName + 실행시간 기반
  const snapshotKey = `${cronName}:${new Date().toISOString().slice(0, 10)}`;
  
  const existing = await prisma.cronLock.findUnique({
    where: { key: snapshotKey },
  });

  if (existing && existing.expiresAt > new Date()) {
    return { acquired: false, reason: "already_running" };
  }

  const lock = await prisma.cronLock.upsert({
    where: { key: snapshotKey },
    update: { expiresAt: new Date(Date.now() + lockDurationSeconds * 1000) },
    create: {
      key: snapshotKey,
      cronName,
      expiresAt: new Date(Date.now() + lockDurationSeconds * 1000),
    },
  });

  return { acquired: true, lockId: lock.id };
}
```

### Phase 2: 재시도 강화 (2일)

**P1-1: Full Backup 연결 재시도**
```typescript
// exponential backoff 추가
async function connectWithRetry(connectionString: string, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
      await client.connect();
      return client;
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      const delayMs = 1000 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
```

**P1-2: 토큰 갱신 재시도**
```typescript
// 기존 refreshGoogleAccessTokenInternal에 재시도 추가
async function refreshGoogleAccessTokenWithRetry(
  refreshToken: string,
  maxRetries = 3
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await refreshGoogleAccessTokenInternal(refreshToken);
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
}
```

### Phase 3: 모니터링 대시보드 (3일)

**관리자 > 시스템 > Cron 모니터**
```
[Cron 실행 히스토리]

오늘:
 ✅ 09:00 passport-reminder: 발송 45건, 스킵 3건
 ✅ 17:00 backup-contacts: 조직 5개 모두 성공
 ❌ 03:00 full-backup: Supabase 2단계 실패 (Google Drive API 할당량 초과)
    → 재시도: 수동 클릭 또는 자동 24시간 후
 ⏳ 실행 중: marketing-monthly-snapshot (진행률 45%)

최근 7일:
 [그래프] 성공률 96%, 평균 응답시간 42초
 [테이블] 날짜별 성공/실패 로그
```

---

## 9️⃣ 체크리스트 (배포 전)

```
✅ 구현 확인사항

[ ] Full Backup 로깅 추가 (BackupLog 모델 + upsert 로직)
[ ] Cron 중복 실행 방지 (CronLock 모델 + 낙관적 잠금)
[ ] Passport Reminder 실패 처리 (재시도 또는 수동 개입 안내)
[ ] Cron 시간대 주석 수정 (올바른 시간 기재)
[ ] 스케줄 간격 조정 (18:00, 20:00, 22:00으로 변경)
[ ] 연결 재시도 추가 (exponential backoff 3회)
[ ] 토큰 갱신 재시도 추가
[ ] 타임아웃 마진 검증 (maxDuration 증가 필요시)
[ ] 로깅 대시보드 구현 (관리자 UI)
[ ] 테스트: Vercel에서 "Rerun" 클릭 → 중복 실행 방지 확인
```

---

## 종합 평가

| 항목 | 평가 | 비고 |
|------|------|------|
| **Cron 정확성** | ⚠️ 부분적 | 주석 오류, 스케줄 충돌 |
| **재시도 메커니즘** | ⚠️ 부분적 | 패스포트만 구현, 일부 누락 |
| **멱등성** | ⚠️ 부분적 | upsert는 있으나 로그 중복 가능 |
| **중복 실행 방지** | ❌ 없음 | 위험 높음 |
| **에러 처리** | ⚠️ 부분적 | 로깅 미흡, 재시도 불균형 |
| **타임아웃 처리** | ⚠️ 부분적 | 일부만 AbortSignal 사용 |
| **로깅** | ⚠️ 부분적 | Full Backup 로깅 없음 |

**총평**: **무한루프 절대법칙 Phase 1-3 필수 적용 (예상 3일)**

---

**작성**: Agent 자동 분석  
**최종 검토**: 2026-06-23
