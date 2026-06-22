# 백업 시스템 전체 개선 작업지시서 V2 (2026-06-22)
## 거장단 토론 후 조정 버전

---

## 📋 거장단 의사결정 3가지

### 의사결정 1️⃣: Passport 파일 버퍼 전략
**선택: Option A (ImageAsset FK 재사용)**
- GmPassportSubmissionGuest에 `imageAssetId` FK 필드 추가
- 기존 ImageAsset 시스템 재활용 (2-3시간)
- Phase 1B에서 스키마 적용

### 의사결정 2️⃣: Phase 1 일정 재구성
**변경: 3단계 분할 (기존 1단계 → 3단계)**
- **Phase 1A** (2026-06-22~28): Contact + Marketing 병렬 (2.5일)
- **Phase 1B** (2026-06-28~29): Passport 스키마 (0.5일)
- **Phase 1C** (2026-07-01~08-11): Passport 전체 구현 (5-6주)

### 의사결정 3️⃣: Soft-Delete 표준 필드
**확정: Contact 패턴 일괄 적용**
- 필드 3개: `deletedAt`, `deletedBy`, `deletedByName`
- 적용 테이블 5개: Campaign, LandingPage, ImageAsset, Funnel, Contact

---

## 🎯 Phase 1A: Contact + Marketing 병렬 (2026-06-22 ~ 2026-06-28)

### Team 1: Contact 토큰 갱신 + 복구 API

**마일스톤 1: Google OAuth 토큰 갱신** (30분)
- 파일: `src/lib/contact-backup-google-drive.ts`, `src/app/api/cron/contact-token-refresh/route.ts`
- 환경변수: `GOOGLE_OAUTH_REFRESH_TOKEN_CONTACT`
- TTL 55분 기준 자동 갱신
- 실패 시 Slack 알림

**마일스톤 2: 복구 API 구현** ⏱️ **1.5시간** (수정)
- 파일: `src/app/api/backup/contacts/[id]/restore/route.ts` (신규)
- API: `POST /api/backup/contacts/[id]/restore`
- 권한: OWNER 이상
- ContactBackupRestoreLog 기록 + 트랜잭션 (DB 안전성)
- **테스트**: 로컬 10명 × 50회 (기존: 100명 × 1000회 → 조정)

**마일스톤 3: Cron 타임아웃** (15분)
- AbortSignal 55초 타임아웃
- Promise.all 병렬 처리
- 재시도 3회 (조기종료 로직)

**마일스톤 4: PII 암호화** ⏱️ **1.5시간** (수정)
- 파일: `src/lib/encryption-utils.ts` (설계, 실제 구현은 Phase 2)
- 대상: phone, email, address
- AES-256 + IV 기반
- **마이그레이션은 Phase 2에서** (Contact 평문 데이터 변환)

**파일 소유권:**
- ✅ `src/lib/contact-backup-google-drive.ts`
- ✅ `src/app/api/backup/contacts/[id]/restore/route.ts` (신규)
- ✅ `src/app/api/cron/contact-token-refresh/route.ts` (신규)
- ⚠️ `src/lib/encryption-utils.ts` (Team 1 설계, Phase 2에서 Team 4가 구현)

**예상 소요시간: 5시간** (병렬)

---

### Team 3: Marketing Soft-Delete 표준화

**마일스톤 1: Soft-Delete 스키마 확장** ⏱️ **1.5시간** (수정)
- 파일: `prisma/schema.prisma`
- 추가 테이블:
  ```prisma
  model CrmMarketingCampaign {
    deletedAt      DateTime?
    deletedBy      String?
    deletedByName  String?
    @@index([organizationId, deletedAt])
  }
  
  model CrmLandingPage {
    deletedAt      DateTime?
    deletedBy      String?
    deletedByName  String?
    @@index([organizationId, deletedAt])
  }
  ```

**마일스톤 2: API 변경** ⏱️ **2시간** (수정)
- 파일: `src/app/api/campaigns/[id]/route.ts`, `src/app/api/landing-pages/[id]/route.ts`
- 조회 쿼리 8-10개: WHERE 절에 `deletedAt IS NULL` 추가
- DELETE 메서드: soft-delete 구현 (Contact 패턴 따름)
- 권한: `?includeDeleted=true` → GLOBAL_ADMIN만

**마일스톤 3: 복구 PATCH API** ⏱️ **1.5시간** (수정)
- API: `PATCH /api/campaigns/[id]/restore`, `PATCH /api/landing-pages/[id]/restore`
- 권한: OWNER 이상
- LandingPage 복구 시 FK 이미지도 자동 복구 (Cascade)

**파일 소유권:**
- ✅ `src/app/api/campaigns/[id]/route.ts`
- ✅ `src/app/api/landing-pages/[id]/route.ts`
- ⚠️ `prisma/schema.prisma` (Team 1 후 수정)

**예상 소요시간: 5시간** (병렬)

**테스트:**
- Campaign 50개 생성/삭제/복구
- LandingPage 50개 + 이미지 연쇄 복구

---

### 병렬 실행 규칙 (Phase 1A)

**동시 실행:**
```
Week 1 (2026-06-22~28)
├─ Team 1 (Contact) ──┐
│  5시간 (독립 작업)  ├─→ 병렬 진행 (파일 충돌 없음)
├─ Team 3 (Marketing)─┘
│  5시간 (독립 작업)
└─ 예상 완료: 2026-06-25 (2.5일)
```

**Prisma 스키마 순차:**
1. Team 1이 ContactBackupRestoreLog 추가
2. Team 3이 기다린 후 Campaign/LandingPage 필드 추가
3. `npx prisma generate` (각자)

**빌드 검증:**
- ✅ 각자 로컬: `npx tsc --noEmit`
- ❌ `npm run build` 금지
- ✅ Phase 1A 완료 후 통합: `npm run build` (dev 서버 종료 후)

---

## 🎯 Phase 1B: Passport 스키마 (2026-06-28 ~ 2026-06-29)

### Team 2: Passport ImageAsset FK + 거장단 의사결정 반영

**단일 마일스톤: Passport 스키마 확장** (0.5일)
- 파일: `prisma/schema.prisma`
- 거장단 선택: **Option A (ImageAsset FK)**

```prisma
model GmPassportSubmissionGuest {
  // 기존 필드들...
  
  // Option A: ImageAsset FK 추가 (거장단 선택)
  imageAssetId    String?         // 원본 이미지
  imageAsset      ImageAsset?     @relation(
    "PassportImageAsset",
    fields: [imageAssetId],
    references: [id],
    onDelete: SetNull
  )
  
  // Google Drive 백업 필드
  googleDriveFileId       String?   // WebP 파일 ID
  googleDriveFileIdOcr    String?   // OCR JSON ID
  lastBackupAt            DateTime?
  backupStatus            String    @default("pending")
  
  @@index([imageAssetId])
  @@index([backupStatus, lastBackupAt])
}

// ImageAsset에 역참조
model ImageAsset {
  // 기존 필드들...
  
  passportGuests GmPassportSubmissionGuest[] @relation("PassportImageAsset")
  
  @@index([organizationId, category])
}
```

**파일 소유권:**
- ✅ `prisma/schema.prisma` (Phase 1A 후 수정)

**예상 소요시간: 0.5시간** (순차)

**다음 단계: Phase 1C 로드맵 준비**
- Team 2가 5-6주 Passport 구현 계획 재수립
- Contact ImageAsset 재사용 패턴 벤치마킹

---

## 🎯 Phase 1C: Passport 전체 구현 (2026-07-01 ~ 2026-08-11)

**상세 계획: 별도 문서 준비**
- 파일: `/docs/BACKUP_SYSTEM_PASSPORT_PHASE1C_PLAN.md` (5-6주 로드맵)
- 팀: Team 2 (독립적)
- 의존성: Phase 1B 스키마 완료 후 시작

**마일스톤 (대략):**
1. 실제 여권 파일 버퍼 Cron 수정 (ImageAsset 재사용)
2. organizationId/Trip 권한 격리
3. 복구 API (GET + POST restore)
4. OCR 데이터 Google Drive 동시 백업
5. 대용량 테스트 (5개 조직 × 각 100명)

---

## 📊 Phase 1A-C 총 일정

| Phase | 기간 | 팀 | 작업 | 예상 | 상태 |
|-------|------|-----|------|------|------|
| **1A** | 06-22~28 | Team 1+3 | Contact+Marketing Soft-Delete | 2.5일 | 병렬 |
| **1B** | 06-28~29 | Team 2 | Passport 스키마 | 0.5일 | 순차 |
| **1C** | 07-01~08-11 | Team 2 | Passport 전체 | 5-6주 | 독립 |
| **합계** | 06-22~08-11 | - | - | **6주** | - |

**병렬 최적화: 45% 단축** (기존 순차 11주 → 병렬 6주)

---

## ✅ Soft-Delete 표준 필드 (전체 도메인)

**Phase 1A에서 추가 (5개 테이블):**

| 테이블 | 추가 필드 | 적용 여부 | 책임 팀 |
|--------|----------|---------|--------|
| Contact | deletedAt, deletedBy, deletedByName | ✅ 기존 | - |
| CrmMarketingCampaign | deletedAt, deletedBy, deletedByName | ✅ Phase 1A | Team 3 |
| CrmLandingPage | deletedAt, deletedBy, deletedByName | ✅ Phase 1A | Team 3 |
| ImageAsset | deletedAt, deletedBy, deletedByName | ⏳ Phase 2 | Team 5 |
| Funnel | deletedAt, deletedBy, deletedByName | ⏳ Phase 2 | TBD |

**쿼리 표준:**
```typescript
// 모든 도메인 동일 패턴
WHERE organizationId = $orgId AND deletedAt IS NULL  // 기본
WHERE organizationId = $orgId AND deletedAt IS NOT NULL // 휴지통
```

**Restore 시 이미지 처리:**
- LandingPage soft-delete/restore 시 FK 이미지도 자동 처리 (Cascade)
- ImageAsset 자체 soft-delete는 Phase 2

---

## 🔧 병렬 실행 규칙 (Phase 1A-C)

### 파일 소유권 (절대 규칙)

**Phase 1A (Team 1 + Team 3):**
```
Team 1 (Contact) 전담:
  - src/lib/contact-backup-google-drive.ts
  - src/app/api/backup/contacts/[id]/restore/route.ts
  - src/app/api/cron/contact-token-refresh/route.ts

Team 3 (Marketing) 전담:
  - src/app/api/campaigns/[id]/route.ts
  - src/app/api/landing-pages/[id]/route.ts

공유 (순차):
  - prisma/schema.prisma (Team 1 → Team 3 순서)
  - src/lib/encryption-utils.ts (설계만, 구현은 Phase 2)
```

**Phase 1B (Team 2):**
```
Team 2 전담:
  - prisma/schema.prisma ImageAsset FK 추가 (Phase 1A 후)
```

**Phase 1C (Team 2):**
```
Team 2 독립 작업 (Passport 도메인)
  - src/app/api/cron/backup-passport/route.ts
  - src/lib/passport-google-drive-backup.ts
  - 기타 Passport 관련 파일
```

### 빌드 검증 규칙

```powershell
# Phase 1A (병렬 실행 중)
npx tsc --noEmit              # ✅ 각 팀 로컬에서 실행

# Phase 1A 완료 후 (2026-06-25)
npm run build                 # ✅ dev 서버 종료 후 전체 빌드

# Phase 1C (Passport 독립)
npx tsc --noEmit              # ✅ Team 2 로컬에서만
```

---

## 📝 커밋 전략

### Phase 1A 커밋 순서

```bash
# Team 1: Contact 토큰 갱신 + 복구 API
git commit -m "feat(backup-contact): 토큰 자동 갱신 + 복구 API + Cron 타임아웃

- Google OAuth refresh_token 자동 갱신 (TTL 55분)
- POST /api/backup/contacts/[id]/restore API
- Promise.all 병렬 처리 (순차 → 50% 성능 개선)
- ContactBackupRestoreLog 감사 기록
- 트랜잭션 보호 (DB 일관성)
- PII 암호화 구조 설계 (Phase 2에서 구현)

Co-Authored-By: Team-Contact <noreply@anthropic.com>"

# Team 3: Marketing Soft-Delete (동시 진행)
git commit -m "feat(backup-marketing): Soft-Delete 표준화 + 복구 API

- Campaign/LandingPage deletedAt/deletedBy/deletedByName 추가
- 조회 쿼리 8-10개 soft-delete 필터링 적용
- DELETE → soft-delete PATCH 변경
- PATCH /[id]/restore 복구 API
- ?includeDeleted=true (관리자만 접근)
- LandingPage 이미지 자동 복구 (Cascade)

Co-Authored-By: Team-Marketing <noreply@anthropic.com>"
```

### Phase 1B 커밋

```bash
# Team 2: Passport 스키마 (Phase 1A 후)
git commit -m "schema: Passport ImageAsset FK + Google Drive 필드

- GmPassportSubmissionGuest.imageAssetId (FK to ImageAsset)
- GoogleDriveFileId/GoogleDriveFileIdOcr 백업 필드
- BackupStatus enum tracking
- 인덱스 최적화 (backupStatus, lastBackupAt)

Co-Authored-By: Team-Passport <noreply@anthropic.com>"
```

### Phase 1C 커밋 (추후)
- 별도 로드맵 문서에서 정의

---

## ✅ Phase 1A 최종 검증 체크리스트

### Contact 백업 (Team 1)
- [ ] Google OAuth 토큰 갱신 로직 (55분 TTL)
- [ ] 복구 API (트랜잭션 보호)
- [ ] Promise.all 병렬 처리 (성능 50% 개선)
- [ ] ContactBackupRestoreLog 감사 기록
- [ ] 권한 검증 (OWNER 이상만)
- [ ] 로컬 테스트 10명 × 50회 (기존: 100명 × 1000회 → 축소)
- [ ] `npx tsc --noEmit` 0 에러

### Marketing Soft-Delete (Team 3)
- [ ] Campaign deletedAt/deletedBy/deletedByName 추가
- [ ] LandingPage 동일 필드 추가
- [ ] DELETE → soft-delete 구현
- [ ] PATCH /[id]/restore 복구 API
- [ ] 조회 쿼리 8-10개 필터링 확인
- [ ] LandingPage 이미지 Cascade 복구 검증
- [ ] Campaign 50개 + LandingPage 50개 테스트
- [ ] `npx tsc --noEmit` 0 에러

### 병렬 실행 검증
- [ ] Prisma 스키마 충돌 0개 (순차 처리)
- [ ] 각 팀 독립 파일만 수정
- [ ] Phase 1A 완료 후 `npm run build` 성공
- [ ] 통합 테스트 (Contact + Marketing 동시 동작)

---

## 🎯 다음 단계

**2026-06-22 (지금):**
- ✅ 작업지시서 V2 배포
- ⏭️ Team 1 + Team 3 병렬 시작

**2026-06-25 (예상):**
- ✅ Phase 1A 완료
- ✅ 통합 빌드 성공
- ⏭️ Phase 1B 시작 (Passport 스키마)

**2026-06-29 (예상):**
- ✅ Phase 1B 완료
- ⏭️ Phase 1C 로드맵 배포 + Team 2 시작

**2026-07-01 ~ 2026-08-11:**
- Phase 1C 진행 (5-6주)
- 동시에 Phase 2 준비

---

**작성일**: 2026-06-22  
**버전**: V2 (거장단 토론 반영)  
**상태**: 🎬 준비 완료, Phase 1A 배포 대기
