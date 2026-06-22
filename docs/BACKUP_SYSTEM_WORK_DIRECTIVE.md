# 백업 시스템 전체 개선 작업지시서 (2026-06-22)

## 📋 거장단 토론 결과 요약

5명 도메인 에이전트 병렬 검토 후 토론 완료. 
**총 P0 15건 → 3단계 Phase로 재구성**

---

## 🎯 Phase별 작업 계획

### Phase 1: Soft-Delete 표준화 + 토큰 갱신 (1-2주)
**병렬 Team 3개 동시 실행**

#### Team 1: Contact 토큰 갱신 + 복구 API
**담당**: Agent-Contact  
**파일 격리**: 
- `src/lib/contact-backup-google-drive.ts` (토큰 갱신)
- `src/app/api/backup/contacts/[id]/restore/route.ts` (복구 API 신규)
- `src/app/api/cron/contact-token-refresh/route.ts` (Cron 신규)
- `prisma/schema.prisma` (ContactBackupRestoreLog 모델 신규)

**마일스톤**:
1. Google OAuth `refresh_token` 자동 갱신 로직 (30분)
   - 환경변수: `GOOGLE_OAUTH_REFRESH_TOKEN_CONTACT`
   - 토큰 만료 시 자동 갱신 (AccessToken TTL 55분 기준)
   - 실패 시 Slack 알림

2. 복구 API 구현 (1시간)
   - `POST /api/backup/contacts/[id]/restore` 
   - 권한: OWNER 이상
   - ContactBackupRestoreLog 기록 (누가/언제/성공여부)
   - 10000명 대용량 테스트

3. Cron 타임아웃 설정 (15분)
   - AbortSignal 55초 타임아웃
   - Promise.all 병렬 처리 (현재 순차)
   - 실패 시 재시도 로직

4. PII 암호화 (1시간)
   - 전화 + 이메일 AES-256 암호화
   - `src/lib/encryption-utils.ts` 일반화 (Passport 함수 재사용)

**테스트**: Contact 100명 × 1000번 백업/복구 사이클

---

#### Team 2: Passport 파일 버퍼 + 권한 격리
**담당**: Agent-Passport  
**파일 격리**:
- `src/app/api/cron/backup-passport/route.ts` (파일 소스 확정)
- `src/lib/passport-google-drive-backup.ts` (organizationId 격리)
- `prisma/schema.prisma` (PassportBackupLog 인덱스 추가)

**마일스톤**:
1. 실제 파일 버퍼 소스 확정 (1시간)
   - GmPassportSubmissionGuest 이미지 저장 경로 명확화
   - WebP + 원본 모두 백업 (이미 구현된 이미지 최적화 재사용)
   - OCR 결과 JSON도 Google Drive에 백업

2. organizationId 권한 격리 (1.5시간)
   - 현재: 모든 조직 파일 1개 폴더 저장 → 변경: 조직별 폴더 격리
   - Google Drive 폴더 구조: `/마비즈CRM-여권백업-{organizationId}/`
   - Cron 시 organizationId 필터링 필수

3. 복구 API (1.5시간)
   - `GET /api/passport/backup/logs` (조회)
   - `POST /api/passport/backup/[backupId]/restore` (복원)
   - Trip 단위 Bulk restore 지원

**테스트**: 5개 조직 × 각 10명 여권 백업/복구

---

#### Team 3: 마케팅 Soft-Delete 설계 + Campaign 감사
**담당**: Agent-Marketing  
**파일 격리**:
- `prisma/schema.prisma` (Campaign/LandingPage/EmailLog에 deletedAt 추가)
- `src/app/api/campaigns/[id]/route.ts` (DELETE → PATCH soft-delete)
- `src/app/api/landing-pages/[id]/route.ts` (동일 패턴)
- `src/lib/backup-service.ts` (soft-delete 표준 함수 신규)

**마일스톤**:
1. Soft-Delete 스키마 확장 (1시간)
   ```prisma
   model CrmMarketingCampaign {
     // 기존 필드...
     deletedAt    DateTime?
     deletedBy    String?    @relation("CampaignDeletedBy")
   }
   
   model CrmLandingPage {
     // 기존 필드...
     deletedAt    DateTime?
     deletedBy    String?
   }
   ```

2. API 변경 (1.5시간)
   - DELETE → PATCH { status: "ARCHIVED" } 또는 { deletedAt: now() }
   - 조회 시 기본 WHERE deletedAt IS NULL
   - `?includeDeleted=true` 옵션으로 휴지통 조회 (관리자만)

3. 복구 PATCH API (1시간)
   - `PATCH /api/campaigns/[id]/restore`
   - `PATCH /api/landing-pages/[id]/restore`
   - 권한: OWNER 이상

**테스트**: Campaign 50개 생성/삭제/복구 반복

---

### Phase 2: PII 암호화 + 이미지 MIME 검증 (2-3주)
**Team 2개 병렬 (Contact/Marketing 암호화 팀 + 이미지 팀)**

#### Team 4: Contact + Marketing PII 통합 암호화
**담당**: Agent-Contact + Agent-Marketing  
**파일 격리**:
- `src/lib/encryption-utils.ts` (통합 암호화 라이브러리)
  - `encryptPII(data, salt)`
  - `decryptPII(encrypted)`
  - 테스트 케이스 50개
- `src/app/api/backup/contacts/route.ts` (Contact 암호화 적용)
- `src/app/api/messages/route.ts` (EmailLog 암호화 + 마스킹)
- `src/app/api/cron/pii-encryption-audit/route.ts` (Cron 신규 - 평문 감시)

**마일스톤**:
1. 통합 암호화 라이브러리 (2시간)
   - Passport에서 검증된 AES-256 패턴 일반화
   - Contact: phone, email, address
   - Marketing: email, phone (SmsLog, EmailLog)
   - 모든 필드에 salt + IV 기반 암호화

2. Contact PII 마이그레이션 (2시간)
   - 기존 평문 → 암호화 변환 Cron
   - `scripts/migrate-contact-pii.mjs` 작성
   - 검증: 복호화 후 원본과 일치 확인

3. EmailLog 본문 저장 + 마스킹 (2시간)
   - EmailLog에 contentPlain 필드 추가 (평문 30자 마스킹 + 암호화)
   - `maskedContent`: "Hi there, I'm sending you..." (실제는 암호화)
   - EmailSentLog도 동일 패턴

4. PII 감시 Cron (1.5시간)
   - 일일 1회: 평문 PII 감지
   - GLOBAL_ADMIN에게 Slack 알림
   - 6개월 이상 미암호화 데이터 자동 암호화

**테스트**: 
- Contact 10000명 암호화/복호화 성능 (<2초)
- EmailLog 100000건 마스킹 검증

---

#### Team 5: 이미지 MIME 검증 + Soft-Delete
**담당**: Agent-Image  
**파일 격리**:
- `src/app/api/image-library/[id]/download/route.ts` (MIME 검증)
- `prisma/schema.prisma` (ImageAsset에 deletedAt 추가)
- `src/app/api/image-library/[id]/restore/route.ts` (복구 API 신규)
- `src/lib/image-audit.ts` (감사 로그 라이브러리 신규)

**마일스톤**:
1. MIME 검증 (30분)
   ```typescript
   const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
   if (asset.mimeType && !allowedMimes.includes(asset.mimeType)) {
     return NextResponse.json({ error: '지원하지 않는 파일형식' }, { status: 400 });
   }
   ```

2. Soft-Delete 추가 (1시간)
   - ImageAsset에 deletedAt, deletedBy 필드
   - DELETE → soft-delete (하드 삭제 금지)
   - 기본 조회에서 deletedAt IS NULL 필터

3. 감사 로그 테이블 (1.5시간)
   ```prisma
   model ImageAuditLog {
     id            String   @id @default(cuid())
     organizationId String
     imageAssetId  String
     userId        String
     action        String   // UPLOAD | DOWNLOAD | DELETE | RESTORE
     ipAddress     String?
     timestamp     DateTime @default(now())
     
     @@index([organizationId, timestamp])
   }
   ```

4. 다운로드 로그 추가 (45분)
   - 모든 다운로드/복구 기록 (누가/언제/파일)
   - 월별 사용량 통계 API

**테스트**: 이미지 1000개 업로드/다운로드/복구 사이클

---

### Phase 3: 계약서 감사로그 + 모니터링 (2-3주)
**Team 2개 병렬 (계약서 감사 + 전체 모니터링)**

#### Team 6: 계약서 감사로그 완성
**담당**: Agent-Contract  
**파일 격리**:
- `src/app/api/contract-instances/[id]/route.ts` (PATCH 감사로그 추가)
- `src/app/api/contract-instances/[id]/modification-requests/route.ts` (POST 감사로그)
- `src/app/api/cron/contract-backup-verify/route.ts` (Cron 신규)

**마일스톤**:
1. PATCH 감사로그 추가 (1시간)
   - 상태 변경 시마다 ContractAuditLog 기록
   - 필드: action(status_DRAFT_to_SENT 등), userId, ipAddress, timestamp

2. Drive 실패 처리 (1.5시간)
   - SIGNED/COMPLETED 전환 시 Drive 저장 실패 → 전체 롤백 (DB도)
   - 재시도 3회 + Slack 알림
   - 부분 복구 우선 (DB만 커밋, Drive는 나중)

3. Modification 감사로그 (1시간)
   - POST /modification-requests 시 항상 기록
   - 요청/수락/대안제시 모두 로그

4. Drive 백업 검증 Cron (1시간)
   - 매일 02:00: Contract 백업 파일 SHA256 검증
   - 손상 시 수동 개입 알림

**테스트**: 계약서 100건 상태 변경 감시로그 확인

---

#### Team 7: 전사 모니터링 + 백업 대시보드
**담당**: 모든 에이전트 협력  
**파일 격리**:
- `src/app/api/cron/backup-system-health/route.ts` (통합 모니터링)
- `src/app/(dashboard)/admin/backup-status.tsx` (대시보드 UI 신규)
- `src/lib/backup-metrics.ts` (지표 수집 라이브러리)

**마일스톤**:
1. 백업 지표 수집 (2시간)
   - Contact 백업: 성공률 / 토큰 갱신 실패 / 평균 응답시간
   - Passport 백업: 파일 크기 / 조직별 사용량 / OCR 정확도
   - 이미지 백업: 월별 업로드/다운로드 / 스토리지 사용량
   - 마케팅: Campaign 삭제/복구 추적 / PII 암호화율
   - 계약서: 서명율 / Drive 백업 성공률

2. 대시보드 UI (2시간)
   - 5개 도메인별 탭
   - 각 탭: 지난 30일 추이 그래프 + 현재 상태 카드
   - 문제 감지 시 🔴 표시 (백업 실패 / PII 미암호화 등)

3. 자동 경고 Cron (1.5시간)
   - PII 암호화율 < 95% → Slack 알림
   - 백업 성공률 < 99% → 가중 경고
   - Drive 용량 > 90% → 저장소 확장 권고

---

## 📊 Phase별 일정 및 병렬 구조

```
Week 1 (2026-06-22 ~ 2026-06-28)
├─ Phase 1: Soft-Delete + 토큰 갱신 (Team 1-3 병렬)
│  ├─ Team 1 (Contact): 토큰 + 복구 API (2-3시간/병렬)
│  ├─ Team 2 (Passport): 파일 버퍼 + 권한 격리 (3-4시간/병렬)
│  └─ Team 3 (Marketing): Soft-Delete 설계 (3-4시간/병렬)
│  
│  **병렬 방식**: 각 팀이 독립 파일만 수정
│  **공유 파일**: 
│    - prisma/schema.prisma (순차: Team 1 → Team 2 → Team 3)
│    - src/lib/encryption-utils.ts (Design by Team 1, Team 2 경청)
│
│  **테스트**: 각 팀 로컬 테스트 (npx tsc --noEmit만, npm build X)
│  **커밋**: 각자 독립 커밋 후 선형화
│
└─ 예상 완료: 2026-06-25

Week 2-3 (2026-06-29 ~ 2026-07-12)
├─ Phase 2: PII 암호화 + MIME 검증 (Team 4-5 병렬)
│  ├─ Team 4 (Contact+Marketing): 통합 암호화 (5-6시간/병렬)
│  └─ Team 5 (Image): MIME + Soft-Delete (3-4시간/병렬)
│
│  **의존성**: Phase 1 완료 후 시작
│  **테스트**: 대용량 성능 테스트 (10000명 이상)
│
└─ 예상 완료: 2026-07-10

Week 4-5 (2026-07-13 ~ 2026-07-27)
├─ Phase 3: 계약서 감사 + 모니터링 (Team 6-7 병렬)
│  ├─ Team 6 (Contract): 감사로그 완성 (3-4시간/병렬)
│  └─ Team 7 (Monitoring): 통합 대시보드 (4-5시간/병렬)
│
│  **병렬 조건**: Contact/Passport/Image 백업 모두 완료 후
│  **최종 검증**: 모든 백업/복구 엔드-투-엔드 테스트
│
└─ 예상 완료: 2026-07-23

**총 예상 기간**: 5주 (2026-06-22 ~ 2026-07-23)
```

---

## 🔧 병렬 실행 규칙

### 파일 소유권 (절대 규칙)

| 파일 | 소유권 | 도메인 |
|------|--------|--------|
| `src/app/(dashboard)/contacts/` | Team 1 | Contact |
| `src/app/api/backup/contacts/` | Team 1 | Contact |
| `src/app/api/cron/contact-*` | Team 1 | Contact |
| `src/app/(dashboard)/passport/` | Team 2 | Passport |
| `src/app/api/passport/` | Team 2 | Passport |
| `src/app/(dashboard)/campaigns/` | Team 3 | Marketing |
| `src/app/api/campaigns/` | Team 3 | Marketing |
| `src/app/(dashboard)/media/` | Team 5 | Image |
| `src/app/api/image-library/` | Team 5 | Image |
| `src/app/(dashboard)/contract-*` | Team 6 | Contract |
| `src/app/api/contract-*` | Team 6 | Contract |

### 공유 파일 (순차 처리)

```
❌ 동시 수정 금지:
  - prisma/schema.prisma
  - src/lib/ (모든 파일)
  - .github/workflows/ (CI/CD)

✅ 순차 순서:
  Phase 1: Soft-Delete 스키마 → Team 1 → Team 2 → Team 3 커밋
  Phase 2: 암호화 라이브러리 → Team 4 → Team 5 검증
```

### 빌드 검증 (EBUSY 방지)

```powershell
# ✅ 각 팀이 로컬에서만 실행 (병렬 안전)
npx tsc --noEmit

# ✅ Prisma 타입 재생성
npx prisma generate

# ❌ 절대 금지 (dev 서버 실행 중)
npm run build

# ✅ 풀 빌드 필요시: dev 서버 먼저 종료 후
# Ctrl+C → npm run build → npm run dev
```

---

## 📝 커밋 전략

### Phase 1 커밋 순서 (권장)

```bash
# Team 1: Contact 토큰 갱신
git commit -m "feat(backup-contact): Google OAuth 토큰 자동 갱신 + 복구 API

- refresh_token 자동 갱신 (TTL 55분)
- POST /api/backup/contacts/[id]/restore API
- Promise.all 병렬 처리 (순차 → 병렬)
- ContactBackupRestoreLog 감사
- 대용량 테스트 (10000명)

Co-Authored-By: Agent-Contact <noreply@anthropic.com>"

# Team 2: Passport 파일 버퍼 (토큰 갱신 후)
git commit -m "feat(backup-passport): 실제 여권 파일 백업 + organizationId 격리

- Cron에 실제 이미지 버퍼 적용 (WebP + 원본)
- 조직별 Google Drive 폴더 격리
- OCR JSON 동시 백업
- 복구 API (Bulk restore 지원)

Co-Authored-By: Agent-Passport <noreply@anthropic.com>"

# Team 3: Marketing Soft-Delete (파일 버퍼 후)
git commit -m "feat(backup-marketing): Campaign/LandingPage soft-delete 표준화

- deletedAt/deletedBy 필드 추가
- DELETE → soft-delete PATCH로 변경
- 휴지통 조회 (관리자만)
- 복구 API PATCH /[id]/restore

Co-Authored-By: Agent-Marketing <noreply@anthropic.com>"
```

### Phase 2 커밋 순서

```bash
# Team 4-1: 암호화 라이브러리 (Phase 1 완료 후)
git commit -m "feat(lib): 통합 PII 암호화 라이브러리 (AES-256)

- src/lib/encryption-utils.ts 일반화
- Contact: phone, email, address
- Marketing: email, phone (SmsLog/EmailLog)
- 테스트 50개 + 성능 검증 (<2ms/항목)

Co-Authored-By: Agent-Contact <noreply@anthropic.com>"

# Team 4-2: Contact + Marketing PII 마이그레이션
git commit -m "feat(backup): Contact/Marketing PII 암호화 마이그레이션 + EmailLog 본문

- 기존 평문 Contact → AES-256 암호화
- EmailLog에 contentPlain 저장 (마스킹 + 암호화)
- 감시 Cron (PII 암호화율 모니터링)
- 대용량 성능 테스트 (10000건/항목)

Co-Authored-By: Agent-Marketing <noreply@anthropic.com>"

# Team 5: 이미지 MIME 검증 + Soft-Delete
git commit -m "fix(image): MIME 검증 + soft-delete + 감사 로그

- allowedMimes 검증 (웹셸 차단)
- ImageAsset soft-delete (deletedAt/deletedBy)
- ImageAuditLog 테이블 (UPLOAD/DOWNLOAD/DELETE/RESTORE)
- 다운로드 시 lastAccessedAt 자동 업데이트

Co-Authored-By: Agent-Image <noreply@anthropic.com>"
```

### Phase 3 커밋 순서

```bash
# Team 6: 계약서 감사로그
git commit -m "feat(contract): 감사로그 완성 + Drive 실패 처리

- PATCH 시 ContractAuditLog 기록 (상태변경/수정요청)
- Drive 저장 실패 → 전체 롤백
- 재시도 3회 + Slack 알림
- 검증 Cron (SHA256 일일 체크)

Co-Authored-By: Agent-Contract <noreply@anthropic.com>"

# Team 7: 통합 모니터링 + 대시보드
git commit -m "feat(admin): 백업 시스템 통합 모니터링 대시보드

- 5개 도메인 지표 통합 수집
- 관리자 대시보드 UI (30일 추이)
- 자동 경고 (암호화율/성공률/용량)
- 예방적 모니터링 Cron

Co-Authored-By: Agent-Monitoring <noreply@anthropic.com>"
```

### 최종 정렬 (Phase 별 완료 후)

```bash
# Phase 1 완료 후
git log --oneline | head -5
# 0a1b2c3 feat(backup-contact): Google OAuth 토큰 자동 갱신 + 복구 API
# 1b2c3d4 feat(backup-passport): 실제 여권 파일 백업 + organizationId 격리
# 2c3d4e5 feat(backup-marketing): Campaign/LandingPage soft-delete 표준화

# Phase 2 완료 후
git log --oneline | head -8
# ... (Phase 1 3개)
# 3d4e5f6 feat(lib): 통합 PII 암호화 라이브러리 (AES-256)
# 4e5f6g7 feat(backup): Contact/Marketing PII 암호화 마이그레이션 + EmailLog
# 5f6g7h8 fix(image): MIME 검증 + soft-delete + 감사 로그

# Phase 3 완료 후
git log --oneline | head -10
# ... (Phase 1-2 8개)
# 6g7h8i9 feat(contract): 감사로그 완성 + Drive 실패 처리
# 7h8i9j0 feat(admin): 백업 시스템 통합 모니터링 대시보드
```

---

## ✅ 최종 검증 체크리스트

### Contact 백업 (Team 1)
- [ ] Google OAuth 토큰 자동 갱신 (만료 감지)
- [ ] 복구 API 동작 (10000명 복구 < 5초)
- [ ] Promise.all 병렬 처리 (순차 대비 50% 성능 개선)
- [ ] PII 암호화 (전화/이메일 100% 암호화됨)
- [ ] ContactBackupRestoreLog 기록 (감사 추적 완벽)
- [ ] `npx tsc --noEmit` 0 에러

### Passport 백업 (Team 2)
- [ ] 실제 이미지 버퍼 Cron에 적용 (더미 아님)
- [ ] 조직별 폴더 격리 (마비즈CRM-여권백업-{orgId})
- [ ] OCR JSON 동시 백업 (파일 + 메타데이터)
- [ ] 복구 API 동작 (Bulk restore)
- [ ] organizationId 권한 검증 (다른 조직 조회 불가)
- [ ] `npx tsc --noEmit` 0 에러

### 이미지 백업 (Team 5)
- [ ] MIME 검증 (image/* 외 차단)
- [ ] Soft-delete (DELETE → 논리 삭제)
- [ ] 복구 API 동작
- [ ] ImageAuditLog 기록 (모든 다운로드/삭제)
- [ ] 1000개 이미지 업로드/다운로드 성공
- [ ] `npx tsc --noEmit` 0 에러

### 마케팅 백업 (Team 3, 4)
- [ ] Campaign soft-delete (PATCH /[id], DELETE → 에러)
- [ ] LandingPage soft-delete (동일 패턴)
- [ ] PII 암호화 (email/phone 100%)
- [ ] EmailLog 본문 저장 + 마스킹 (30자 노출)
- [ ] CSV 내보내기 API (기간 필터링)
- [ ] ExportLog 감사 (누가/언제/몇 건)
- [ ] `npx tsc --noEmit` 0 에러

### 계약서 백업 (Team 6)
- [ ] PATCH 시 감사로그 (상태변경 이력)
- [ ] Drive 실패 시 롤백 (DB + Drive 일관성)
- [ ] 재시도 로직 (3회)
- [ ] Slack 알림 (실패 시)
- [ ] 복구 API 동작
- [ ] 100개 계약서 상태변경 감사 완벽
- [ ] `npx tsc --noEmit` 0 에러

### 전체 모니터링 (Team 7)
- [ ] 백업 시스템 대시보드 UI (5개 탭)
- [ ] 지표 수집 (Contact/Passport/Image/Marketing/Contract)
- [ ] 30일 추이 그래프 (선형 그래프)
- [ ] 문제 감지 표시 (🔴 아이콘)
- [ ] 자동 경고 Cron (96시간마다)
- [ ] `npx tsc --noEmit` 0 에러

---

## 🎯 배포 전 최종 검증

```bash
# 1단계: 전체 타입 검증
npx tsc --noEmit

# 2단계: Prisma 스키마 검증
npx prisma generate

# 3단계: 로컬 테스트 (각 팀)
npm run test:backup-contact
npm run test:backup-passport
npm run test:backup-image
npm run test:backup-marketing
npm run test:backup-contract

# 4단계: 전체 통합 테스트
npm run test:backup-system

# 5단계: 성능 벤치마크
npm run benchmark:backup

# 6단계: 보안 검증
npm run audit:secrets

# 7단계: 배포
npm run build
npm run deploy:prod
```

---

## 📞 문의 및 예외 처리

### Phase 중 병렬 파일 충돌 발생 시
1. 충돌한 팀들 즉시 보고
2. `npx git diff` 으로 변경사항 비교
3. 다음 순서:
   - prisma/schema.prisma 충돌 → 스키마 리더(모니카)가 수동 병합
   - src/lib/ 충돌 → 라이브러리 담당 에이전트가 수동 병합
   - 도메인 파일 충돌 → 각 팀이 수동 병합 (이미 격리되어야 함)

### Cron 타임아웃 발생 시
- AbortSignal 타임아웃: 55초로 설정 (Vercel Function 기본 60초)
- 실패 시: 재시도 로직 (3회)
- 반복 실패: Slack 알림 + 수동 개입

### Google Drive API quota 초과 시
- 일시 중지 후 24시간 대기
- 백업 대기열 저장 (가장 오래된 항목부터 복구)

---

**작성일**: 2026-06-22  
**최종 검토**: 5명 에이전트 토론 완료  
**예상 완료**: 2026-07-23  
**배포**: 각 Phase 완료 후 순차 배포 (또는 Phase 3 완료 후 일괄)
