# M3 병렬 마일스톤 실행 전략 (2026-06-22)

## 📋 거장단 5명 병렬 토론 분석

### 토론 주제 및 최종 결정

---

## 1️⃣ API 설계: `/restore` vs `/restore-download`

### 문제 정의
**Contact 복구 시나리오**:
- Case A: Soft-delete된 Contact 복구 → DB 복원 (내부)
- Case B: 손상된 이미지 파일 복구 → 다운로드 제공 (외부)

### 거장단 의견 분석

| 역할 | 의견 | 근거 |
|------|------|------|
| **Agent-Passport** (기술) | `/restore` 단일화 | 내부 복원만 필수. 다운로드는 별도 메서드로 분리 |
| **Agent-Security** (보안) | 권한 검증 강화 필수 | 누가 복구하는가? (Manager/Owner만?) + 감사로그 필수 |
| **Agent-Perf** (성능) | 스트리밍 미리 계획 | 대용량 파일은 메모리 로드X, 즉시 스트리밍 |
| **Agent-QA** (품질) | 테스트 범위 명확화 | 각 엔드포인트별 3가지 테스트 (성공/권한/오류) |
| **Agent-Infra** (인프라) | DB 트랜잭션 중심 | Soft-delete 복구 = DB 원자성. 파일은 이후 처리 |

### ✅ 최종 결정

**API 설계 선택**: **Option A (권장)**

```typescript
// ✅ Option A: 이벤트 기반 + 스트리밍
POST   /api/backup/contacts/[id]/restore         // DB 복구 (내부)
  └─ 응답: { success: true, contactId, restoredAt }

GET    /api/backup/contacts/[id]/download        // 파일 다운로드 (외부)
  └─ 응답: Stream (application/octet-stream)
  └─ 감사: DownloadLog 기록

// 내부 흐름 (restore):
// 1. 권한 검증 (Manager+)
// 2. Soft-delete 해제 (deletedAt = null)
// 3. ContactBackupRestoreLog 기록
// 4. Event emit: "contact.restored" (비동기)
// 5. Webhook 트리거 (선택)

// 권장 이유:
// - 단일 책임: 복구 = DB 상태 변경만
// - 성능: 파일 I/O 없음 (< 100ms)
// - 감사: 누가/언제 복구했는가 명확
// - 확장성: 이미지/파일은 별도 엔드포인트
```

### 구현 체크리스트

- [ ] POST `/api/backup/contacts/[id]/restore` 구현
  - 권한: `OWNER` 이상 + `organizationId` 일치
  - 감사: `ContactBackupRestoreLog` 기록 (userId, ipAddress, timestamp)
  - 응답시간: < 500ms (10000 Contact 기준)
  - 에러: 404 (없음), 403 (권한), 400 (이미 복구됨)

- [ ] GET `/api/backup/contacts/[id]/download` 구현
  - 스트림 방식 (메모리 로드X)
  - 감사: `ContactDownloadLog` 기록
  - Content-Type: `text/csv` 또는 `application/json`
  - 응답시간: < 3초 (1000 rows)

- [ ] 테스트 (각 3가지)
  - 성공 케이스: 정상 복구 + 파일 다운로드
  - 권한 오류: 다른 조직 사용자 접근
  - 비즈니스 로직: 이미 복구됨 (멱등성)

---

## 2️⃣ 권한 검증: Trip 폴더만? vs Trip+Contact 이중?

### 문제 정의
**여권 백업 권한 격리**:

```
Current (M2-2 단계):
├─ organizationId: Trip 폴더별 격리 (Google Drive)
├─ API: ?organizationId=XXX 쿼리 강제
└─ Cron: 모든 Trip 순회

Question: Contact도 체크해야 하나? (이중 검증)
```

### 거장단 의견

| 역할 | 주장 | 상세 |
|------|------|------|
| **Agent-Security** | **Trip만** (단순) | 1) Trip 생성 시 이미 organizationId 검증 됨 2) Contact 이중검증 = 과도 3) DB 조인 = 성능 저하 |
| **Agent-Perf** | **이중 추천** (안전) | 1) Passport 파일은 민감정보 2) Trip.organizationId ≠ Contact.organizationId 버그 가능 3) 10만 건 조인 = < 100ms (인덱스O) |
| **Agent-Passport** | **중간** | 1) Trip별 권한 충분 2) Contact 체크는 향후 강화 가능 3) 현재: Trip 우선 |
| **Agent-QA** | **명확한 정책** | 테스트: (Trip=A, Contact=B) 혼성 케이스 필수 |
| **Agent-Infra** | **DB 인덱스 필수** | @@index([organizationId, tripId]) 추가 |

### ✅ 최종 결정

**권한 검증 선택**: **Option B+ (강화된 Trip 검증)**

```typescript
// ✅ 권장 구조
Query: GET /api/passport/backup/logs
  └─ 필터: organizationId (필수, 쿼리)
  
DB 검증 (3층):
  ├─ Layer 1: 사용자의 organizationId (세션 또는 JWT)
  ├─ Layer 2: Trip.organizationId = Layer 1 (SQL WHERE)
  └─ Layer 3: Contact.organizationId = Layer 1 (향후, 선택)

// Phase 1 (현재): Trip 체크만
GmTrip
  .findMany({
    where: {
      organizationId: userOrgId,  // ← 강제
      deletedAt: null
    }
  })

// Phase 2 (M4+): Contact 이중 체크
const trip = await GmTrip.findUnique({
  where: { id: tripId },
  select: { organizationId: true }
});
if (trip?.organizationId !== userOrgId) return 403;

const contacts = await GmPassportSubmission.findMany({
  where: {
    guestId: { // Contact 간접 검증
      in: gmTrip.guests.map(g => g.id)
    }
  }
});
```

### 인덱스 전략

```prisma
// schema.prisma 추가 (Phase 1)
model GmTrip {
  @@index([organizationId, deletedAt])  // 현재
  @@index([organizationId, createdAt])  // 추가 (정렬용)
}

model GmPassportSubmissionGuest {
  @@index([organizationId, tripId])  // 향후 (Contact 이중검증용)
}
```

### 구현 체크리스트

- [ ] Trip 권한 검증 강화
  - 모든 조회: WHERE organizationId = ?
  - Cron: Batch 처리 (organizationId별 루프)
  - 응답: 다른 조직 데이터 0건

- [ ] Contact 명시적 관계
  - Passport.guestId → Contact (향후)
  - 테스트: 크로스 조직 혼성 데이터 생성

- [ ] 감사로그
  - 누가 어느 Trip 복구했는가
  - 실패한 권한 검증 시도 기록

---

## 3️⃣ 메모리 최적화: 스트리밍 vs 전체 로드?

### 문제 정의
**대용량 Contact 복구 시나리오**:
- Contact: 10,000명
- 각 Contact: { name, phone, email, address, ... } (JSON ~500B)
- 전체 크기: ~5MB

**CPU/메모리 트레이드오프**:

| 방식 | 메모리 | CPU | 응답 |
|------|--------|------|------|
| **전체 로드** | 5MB | 낮음 (복사1회) | 빠름 (< 100ms) |
| **스트리밍** | < 1MB | 높음 (chunk 처리) | 느림 (100-500ms) |

### 거장단 의견

| 역할 | 입장 | 근거 |
|------|------|------|
| **Agent-Perf** | **스트리밍 필수** | 1) Vercel Function 메모리 한계 512MB 2) 미래 10만 건 = 50MB 3) 스트리밍 = 안정성 |
| **Agent-Infra** | **전체+청크** | DB 커서 사용 → 메모리 최소 + 처리량 최대 |
| **Agent-Passport** | **실용적** | 1) 현재: 10K Contact 전체로드O 2) 5MB = 문제X 3) 표준화는 향후 |
| **Agent-QA** | **테스트 명확** | 1MB/5MB/50MB 3가지 모두 테스트 |

### ✅ 최종 결정

**메모리 전략**: **Option A + B (하이브리드)**

```typescript
// Phase 1 (현재, 2026-06-22~06-28): 전체 로드 (간단)
// Phase 2 (향후, M4): 스트리밍 마이그레이션

// ========== Phase 1 구현 ==========
POST /api/backup/contacts/[id]/restore
  ├─ 트리거: Contact soft-delete 해제
  ├─ 응답: { success: true, restoredAt }
  └─ 추가 작업: 없음 (sync)

GET /api/backup/contacts/[id]/download
  ├─ 로드: Contact.findMany() → 전체 배열
  ├─ 변환: JSON 또는 CSV 생성
  └─ 응답: file stream (response.send())

// ========== Phase 2 구현 예상 ==========
// GET /api/backup/contacts/[id]/download
//   ├─ Cursor 기반 페이지네이션
//   ├─ Writable Stream (fs.createWriteStream)
//   └─ Readable Stream (res.pipe())

// ========== 현재 용량 추정 ==========
// Contact 크기:
//   - 기본 필드: name(30) + phone(15) + email(50) + address(100) = 195B
//   - JSON 오버헤드: ~50%
//   - 실제 JSON: ~300B/Contact
//   - 10000 Contact = 3MB (안전)
//   - 100000 Contact = 30MB (위험선)
```

### 구현 로드맵

**Phase 1 (2026-06-25 예상 완료)**
```typescript
// src/app/api/backup/contacts/[id]/download/route.ts
import { db } from '@/src/db';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  // 1. 권한 검증
  const org = await validateOrgId(req);
  
  // 2. Contact 전체 로드 (현재)
  const contacts = await db.gmContact.findMany({
    where: {
      organizationId: org.id,
      not: { deletedAt: { not: null } }
    }
  });
  
  // 3. CSV 변환
  const csv = convertToCSV(contacts);
  
  // 4. 스트림 응답
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename=contacts.csv'
    }
  });
}
```

**Phase 2 (M4, 2026-07-10 예상)**
```typescript
// Cursor 기반 페이지네이션 추가
const limit = 1000; // 배치 크기
let cursor = null;

while (true) {
  const batch = await db.gmContact.findMany({
    where: { organizationId: org.id, deletedAt: null },
    take: limit + 1,
    ...(cursor && { skip: 1, cursor: { id: cursor } })
  });
  
  if (batch.length === 0) break;
  
  for (const contact of batch.slice(0, limit)) {
    writeStream.write(convertToCSVRow(contact));
  }
  
  cursor = batch[batch.length - 1]?.id;
}
```

---

## 4️⃣ 테스트 범위: 로컬만 vs 통합테스트까지?

### 문제 정의
**M3 병렬 실행 중 테스트 전략**:

```
현재 상황:
├─ 7개 팀 병렬 실행
├─ 각 팀 독립 파일 수정
├─ 공유 파일: prisma/schema.prisma (순차)
└─ 의존성: Team 1 → Team 2 → Team 3 (Phase 1)

질문: Phase 1 완료 후 통합테스트?
  Case A: 각 팀 로컬만 (빠름)
  Case B: 통합테스트 전체 (느림, 안전)
```

### 거장단 의견

| 역할 | 입장 | 근거 |
|------|------|------|
| **Agent-QA** | **통합 필수** | 1) Phase 1A + 1B 상호작용 (soft-delete ↔ encryption) 2) Prisma 마이그레이션 버그 3) 권한 검증 오버래핑 |
| **Agent-Perf** | **로컬 충분** | 1) 로컬 tsc + unit 테스트 = 충분 2) 통합 = 시간 2배 3) Vercel 배포 때 통합 실행 |
| **Agent-Infra** | **중간** | 1) 로컬 tsc 필수 2) DB 마이그레이션 테스트만 병합 3) E2E는 선택 |
| **Agent-Passport** | **명확한 경계** | 1) 로컬: npx tsc + npm test:backup-contact 2) 통합: Phase 완료 후만 |

### ✅ 최종 결정

**테스트 전략**: **Option A + B (두 단계)**

```typescript
// ========== Step 1: 각 팀 로컬 (병렬) ==========
// 각 팀이 독립적으로 실행 (Phase 1 중)

npm run test:backup-contact   // Team 1 (Contact)
npm run test:backup-passport  // Team 2 (Passport)
npm run test:backup-marketing // Team 3 (Marketing)

// 테스트 범위 (각 팀):
// ├─ Unit: API 엔드포인트 (3가지: success/403/400)
// ├─ Integration: DB 상태 변경 확인
// ├─ TypeScript: npx tsc --noEmit (0 에러)
// └─ Lint: npx eslint [team-files]

// 예상 시간: 각 팀 15분

// ========== Step 2: 통합테스트 (순차) ==========
// Phase 1 완료 후 (Team 1→2→3 순서대로)

// Phase 1A 통합 테스트 (2026-06-26)
npm run test:backup-system -- --phase=1a

// 테스트 범위:
// ├─ Contact soft-delete + 복구 (Team 1)
// ├─ Passport 토큰 + 파일 백업 (Team 2)
// ├─ Campaign soft-delete + 복구 (Team 3)
// └─ 통합: 모든 감사로그 연계 확인

// 예상 시간: 30분

// Phase 1B 통합 테스트 (2026-07-05)
npm run test:backup-system -- --phase=1b

// Phase 1C 통합 테스트 (2026-07-12)
npm run test:backup-system -- --phase=1c
```

### 테스트 체크리스트 (각 팀)

```bash
# Team 1: Contact 복구
✅ POST /api/backup/contacts/123/restore
  - 성공: 404 (없음)
  - 성공: 200 (복구됨)
  - 실패: 403 (권한 없음)
  - 실패: 409 (이미 복구됨)

✅ GET /api/backup/contacts/123/download
  - 성공: CSV 100줄
  - 성공: JSON 배열
  - 실패: 403 (권한 없음)
  - 용량: 1000 rows < 2초

✅ Cron /api/cron/contact-token-refresh
  - 성공: 100개 Token 갱신
  - 실패: Slack 알림 확인
  - 성능: < 60초

# ✅ 총 테스트: 12가지 (각 팀별)
```

---

## 5️⃣ 성능 목표: 복구 시간 < 30초?

### 문제 정의
**대용량 복구 성능 SLA**:

```
Scenario 1: Contact 복구 (DB만)
  ├─ 데이터: 10,000 Contact
  ├─ 작업: UPDATE contacts SET deletedAt = NULL WHERE id = ?
  ├─ 기준: < 1초 (DB 인덱스O)
  └─ 목표: < 500ms

Scenario 2: Passport 백업 (파일 + DB)
  ├─ 데이터: 1000 여권 이미지 (각 2MB)
  ├─ 작업: Google Drive 업로드 + DB 기록
  ├─ 기준: < 30초? < 60초?
  └─ 목표: ???

Scenario 3: Campaign 복구 (soft-delete)
  ├─ 데이터: 100 Campaign + 1000 EmailLog
  ├─ 작업: 상태 전환
  ├─ 기준: < 2초
  └─ 목표: < 1초
```

### 거장단 의견

| 역할 | 목표 | 근거 |
|------|------|------|
| **Agent-Perf** | < 3초 (DB) | 사용자 UX (웹 응답 3초 이상 = 답답) |
| **Agent-Infra** | < 30초 (파일) | Google Drive API 기준 (업로드 대역폭) |
| **Agent-Passport** | < 5초 (메타) | 파일은 Cron, 메타만 즉시 |
| **Agent-QA** | 명확한 SLA | 1) DB < 1초 2) Cron < 30초 3) API 응답 < 3초 |

### ✅ 최종 결정

**성능 SLA**: **Option B (계층적)**

```typescript
// ========== SLA 목표 ==========

// Layer 1: DB 복구 (즉시, < 1초)
POST /api/backup/contacts/[id]/restore
  └─ SLA: < 1초 (10000 rows)
  └─ 측정: DB UPDATE 시간만 (파일 I/O 제외)

// Layer 2: 메타데이터 동기화 (< 3초)
POST /api/backup/passport/[tripId]/restore
  ├─ 동기: PassportBackupRestoreLog 기록
  ├─ 비동기: Google Drive 파일 백업 (이후)
  └─ SLA: < 3초

// Layer 3: 파일 백업 Cron (< 60초)
GET /api/cron/backup-passport
  ├─ 병렬: 50개 Contact 동시
  ├─ 구간: 매일 22:00-23:00
  └─ SLA: < 60초 (Vercel Function TTL)

// ========== 성능 측정 ==========
// 각 엔드포인트별 응답 시간 기록:

const perfMetrics = {
  'restore-contact': < 1000,    // ms
  'restore-passport': < 3000,
  'restore-campaign': < 500,
  'cron-backup': < 60000,
  'cron-token-refresh': < 55000
};

// Monitoring: 초과 시 Slack 알림
if (responseTime > SLA) {
  sendSlackAlert(`⚠️ Performance degradation: ${endpoint}`);
}
```

### 구현 가이드

**Phase 1 성능 최적화**

```typescript
// ✅ 1. 인덱스 추가 (필수)
// schema.prisma
@@index([organizationId, deletedAt])
@@index([organizationId, createdAt])

// ✅ 2. 배치 처리 (Cron)
const contacts = await db.gmContact.findMany({
  where: { organizationId },
  select: { id: true }
});

// 배치로 처리 (50개씩)
const batches = chunk(contacts, 50);
for (const batch of batches) {
  await Promise.all(
    batch.map(c => backupContact(c.id))
  );
}

// ✅ 3. 타임아웃 설정
const controller = new AbortController();
setTimeout(() => controller.abort(), 55000); // 55초

// ✅ 4. 성능 로깅
const start = Date.now();
const result = await restore();
const duration = Date.now() - start;

console.log(`[PERF] restore: ${duration}ms (SLA: ${SLA}ms)`);
```

---

## 🎯 최종 합의 사항 (M3 Parallel Milestone)

### 5가지 핵심 결정

| # | 주제 | 결정 | 근거 |
|---|------|------|------|
| **1** | API 설계 | `/restore` 단일 + `/download` 별도 | 책임 분리 + 성능 |
| **2** | 권한 검증 | Trip organizationId 강화 (Contact는 향후) | 단순성 + 인덱스 최적화 |
| **3** | 메모리 | Phase 1은 전체 로드, Phase 2는 스트리밍 | 현재 5MB 안전, 미래 50MB 대비 |
| **4** | 테스트 | 로컬 병렬 + Phase 후 통합 | 속도와 안정성 균형 |
| **5** | 성능 | DB < 1초, Cron < 60초, API < 3초 | UX + Vercel 함수 제약 |

---

## 📊 M3 Phase 1 실행 계획

### 팀 배치 및 의존성

```
Phase 1 (2026-06-22 ~ 2026-06-28, 1주)
├─ Team 1 (Contact): 토큰 갱신 + 복구 API
│  ├─ 구현: src/app/api/backup/contacts/
│  ├─ Cron: src/app/api/cron/contact-token-refresh
│  └─ 테스트: npm run test:backup-contact
│
├─ Team 2 (Passport): 파일 버퍼 + 권한 격리 (Team 1 후)
│  ├─ 구현: src/app/api/cron/backup-passport
│  ├─ 권한: organizationId 검증 강화
│  └─ 테스트: npm run test:backup-passport
│
└─ Team 3 (Marketing): Soft-Delete 표준화 (Team 2 후)
   ├─ 구현: src/app/api/campaigns/
   ├─ 스키마: Campaign.deletedAt 추가
   └─ 테스트: npm run test:backup-marketing

의존성:
  prisma/schema.prisma (순차: Team 1 → Team 2 → Team 3)
  src/lib/encryption-utils.ts (공유, Team 1 설계)
```

### 커밋 체크리스트

```bash
# Phase 1A: Contact 토큰 갱신 (Team 1)
git commit -m "feat(backup-contact): Google OAuth 토큰 자동 갱신 + 복구 API

- refresh_token 자동 갱신 (TTL 55분)
- POST /api/backup/contacts/[id]/restore (DB 복구)
- GET /api/backup/contacts/[id]/download (CSV/JSON)
- Promise.all 병렬 처리 (Cron)
- ContactBackupRestoreLog 감사로그
- 대용량 테스트 (10000명)
- npx tsc --noEmit (0 에러)

Co-Authored-By: Agent-Contact <noreply@anthropic.com>"

# Phase 1B: Passport 파일 버퍼 (Team 2, Team 1 완료 후)
git commit -m "feat(backup-passport): 실제 여권 파일 백업 + organizationId 격리

- Cron 실제 이미지 버퍼 적용
- 조직별 Google Drive 폴더 격리
- OCR JSON 동시 백업
- POST /api/backup/passport/[tripId]/restore
- PassportBackupRestoreLog 감사로그
- 대용량 테스트 (1000여권)

Co-Authored-By: Agent-Passport <noreply@anthropic.com>"

# Phase 1C: Campaign Soft-Delete (Team 3, Team 2 완료 후)
git commit -m "feat(backup-marketing): Campaign/LandingPage soft-delete 표준화

- Campaign.deletedAt 필드 추가
- LandingPage.deletedAt 필드 추가
- DELETE → PATCH soft-delete 변경
- PATCH /[id]/restore 복구 API
- 휴지통 조회 (관리자 전용)
- 50개 Campaign 반복 테스트

Co-Authored-By: Agent-Marketing <noreply@anthropic.com>"
```

---

## ⚠️ 잠재 위험요소 및 대응책

### Risk 1: Prisma 스키마 충돌
**발생 시기**: Team 2, 3이 동시에 schema.prisma 수정
**대응책**:
- 순차 원칙 준수 (Team 1 → Team 2 → Team 3)
- 각 팀 커밋 후 `npx prisma generate` 실행
- 충돌 시 스키마 리더(모니카)가 수동 병합

### Risk 2: Google Drive API Quota
**발생 시기**: Passport Cron 대량 업로드
**대응책**:
- 배치 50개 제한 (동시 실행 제한)
- 실패 시 재시도 3회
- Quota 초과 시 24시간 대기

### Risk 3: DB 마이그레이션 실패
**발생 시기**: deletedAt 필드 추가 후 기존 데이터
**대응책**:
- 마이그레이션: `ALTER TABLE campaigns ADD COLUMN deletedAt DATETIME DEFAULT NULL`
- 검증: 기존 데이터 deletedAt = NULL (논리 삭제 안 됨)
- 롤백 계획: git revert --no-commit

### Risk 4: 권한 검증 오버래핑
**발생 시기**: Team 1-3 모두 organizationId 검증
**대응책**:
- 명확한 문서 (이 파일)
- Code Review: 권한 검증 코드 표준화
- 테스트: Cross-org 혼성 데이터 5가지 케이스

---

## ✅ 병렬 마일스톤 시작 조건

- [ ] 거장단 5명 토론 완료 (완료)
- [ ] 5가지 결정 사항 문서화 (완료)
- [ ] 각 팀 담당자 할당 확인
- [ ] 로컬 개발 환경 준비 (git worktree)
- [ ] test 스크립트 준비
- [ ] Slack 채널 생성 (#m3-backup-contact, #m3-backup-passport, ...)

---

**작성일**: 2026-06-22  
**상태**: ✅ 병렬 마일스톤 시작 가능  
**예상 완료**: 2026-06-28 (Phase 1A-C)  
**다음 Phase**: 2026-06-29 시작 (Phase 2: PII 암호화 + MIME 검증)
