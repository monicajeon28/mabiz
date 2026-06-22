# M3 병렬 마일스톤 팀 배치 및 실행 지시서 (2026-06-22)

## 🎯 팀 배치 (7개 팀)

### Phase 1A: Contact 토큰 갱신 (Team 1) [2026-06-22~06-25]
**담당**: Agent-Contact-Backup  
**파일 격리**: 
- `src/app/api/backup/contacts/` ✅ 독립
- `src/app/api/cron/contact-token-refresh/` ✅ 신규
- `src/lib/contact-backup-google-drive.ts` ✅ 토큰 갱신 로직

**마일스톤 (4시간)**:
1. ✅ Google OAuth 토큰 자동 갱신 (30분)
   - 환경변수: `GOOGLE_OAUTH_REFRESH_TOKEN_CONTACT`
   - TTL 55분 기준 자동 갱신
   - 실패 시 Slack 알림

2. ✅ 복구 API 구현 (1시간)
   - `POST /api/backup/contacts/[id]/restore` (DB 복구만)
   - 권한: OWNER+, organizationId 검증
   - 응답: < 500ms (10000 rows)

3. ✅ Cron 타임아웃 (15분)
   - AbortSignal 55초 설정
   - Promise.all 병렬 처리
   - 재시도 3회 로직

4. ✅ PII 암호화 설계 (30분)
   - `src/lib/encryption-utils.ts` (일반화 설계)
   - Phone + Email AES-256 (Passport 패턴 재사용)

**테스트**: `npm run test:backup-contact`
- 성공: 10000명 복구 < 1초
- 권한: 다른 조직 403 반환
- 오류: 이미 복구됨 409 반환

**커밋**:
```bash
git commit -m "feat(backup-contact): Google OAuth 토큰 자동 갱신 + 복구 API

- refresh_token 자동 갱신 (TTL 55분)
- POST /api/backup/contacts/[id]/restore (DB 복구)
- Promise.all 병렬 처리
- ContactBackupRestoreLog 감사로그
- 대용량 테스트 (10000명)

Co-Authored-By: Agent-Contact-Backup <noreply@anthropic.com>"
```

---

### Phase 1B: Passport 파일 버퍼 (Team 2) [2026-06-25~06-27]
**담당**: Agent-Passport-Backup  
**의존성**: Team 1 완료 후 시작  
**파일 격리**:
- `src/app/api/cron/backup-passport/` ✅ 파일 소스 확정
- `src/lib/passport-google-drive-backup.ts` ✅ organizationId 격리
- `src/app/api/passport/backup/` ✅ 복구 API

**마일스톤 (4시간)**:
1. ✅ 실제 파일 버퍼 확정 (1시간)
   - GmPassportSubmissionGuest 이미지 경로
   - WebP + 원본 모두 백업
   - OCR 결과 JSON 동시 백업

2. ✅ 조직별 폴더 격리 (1.5시간)
   - Google Drive: `/마비즈CRM-여권백업-{organizationId}/`
   - Cron: organizationId 필터링 강화
   - 다른 조직 접근 차단

3. ✅ 복구 API (1.5시간)
   - `GET /api/passport/backup/logs` (조회)
   - `POST /api/passport/backup/[backupId]/restore` (복원)
   - Trip 단위 Bulk restore 지원

**테스트**: `npm run test:backup-passport`
- 성공: 1000 여권 백업 < 60초
- 권한: 조직별 폴더 격리 확인
- 오류: Google Drive quota 초과 처리

**커밋** (Team 1 완료 후):
```bash
git commit -m "feat(backup-passport): 실제 여권 파일 백업 + organizationId 격리

- Cron 실제 이미지 버퍼 적용
- 조직별 Google Drive 폴더 격리
- OCR JSON 동시 백업
- POST /api/backup/passport/[tripId]/restore
- PassportBackupRestoreLog 감사로그

Co-Authored-By: Agent-Passport-Backup <noreply@anthropic.com>"
```

---

### Phase 1C: Campaign Soft-Delete (Team 3) [2026-06-27~06-28]
**담당**: Agent-Marketing-Backup  
**의존성**: Team 2 완료 후 시작  
**파일 격리**:
- `src/app/api/campaigns/[id]/` ✅ soft-delete 패턴
- `src/app/api/landing-pages/[id]/` ✅ 동일 패턴
- `prisma/schema.prisma` ⚠️ 순차 (Team 1→2→3)

**마일스톤 (3.5시간)**:
1. ✅ Soft-Delete 스키마 (1시간)
   - Campaign.deletedAt + deletedBy
   - LandingPage.deletedAt + deletedBy
   - EmailLog.deletedAt (향후)

2. ✅ API 변경 (1.5시간)
   - DELETE → soft-delete PATCH로 변경
   - 조회 시 기본 WHERE deletedAt IS NULL
   - 휴지통 조회: ?includeDeleted=true (관리자만)

3. ✅ 복구 API (1시간)
   - `PATCH /api/campaigns/[id]/restore`
   - `PATCH /api/landing-pages/[id]/restore`
   - 권한: OWNER+

**테스트**: `npm run test:backup-marketing`
- 성공: 50개 Campaign 생성/삭제/복구
- 권한: 다른 조직 접근 불가
- 오류: 없는 Campaign 404 반환

**커밋** (Team 2 완료 후):
```bash
git commit -m "feat(backup-marketing): Campaign/LandingPage soft-delete 표준화

- Campaign/LandingPage에 deletedAt/deletedBy 추가
- DELETE → soft-delete PATCH로 변경
- 휴지통 조회 (관리자 전용)
- PATCH /[id]/restore 복구 API
- 50개 반복 테스트

Co-Authored-By: Agent-Marketing-Backup <noreply@anthropic.com>"
```

---

## 🔄 병렬 실행 규칙 (절대 준수)

### ❌ 금지 사항
```
동시에 수정하지 마:
  - prisma/schema.prisma (순차: Team 1→2→3)
  - src/lib/ (공유 파일)
  - .github/workflows/ (CI/CD)
```

### ✅ 병렬 방식
```
Phase 1A (Team 1): 독립 파일만 수정
  └─ git commit (로컬) → push

Phase 1B (Team 2): Team 1 커밋 후 시작
  └─ Team 1 변경사항 pull → 독립 파일 수정

Phase 1C (Team 3): Team 2 커밋 후 시작
  └─ Team 2 변경사항 pull → 독립 파일 수정
```

### 빌드 검증 (EBUSY 방지)
```powershell
# ✅ 각 팀이 로컬에서만 실행
npx tsc --noEmit
npx prisma generate

# ❌ 절대 금지
npm run build  # dev 서버 실행 중

# ✅ 커밋 전 반드시
npm run test:backup-[domain]
```

---

## 📊 병렬 의존성 다이어그램

```
2026-06-22 (월)
  └─ Phase 1A: Team 1 (Contact)
      ├─ 토큰 갱신 (1.5시간)
      ├─ 복구 API (1.5시간)
      ├─ 테스트 (1시간)
      └─ 커밋 (30분)
      └─> 2026-06-25 (목) 예상 완료

2026-06-25 (목)
  └─ Phase 1B: Team 2 (Passport) [Team 1 완료 후 시작]
      ├─ 파일 버퍼 확정 (1시간)
      ├─ 폴더 격리 (1.5시간)
      ├─ 복구 API (1.5시간)
      ├─ 테스트 (1시간)
      └─ 커밋 (30분)
      └─> 2026-06-27 (토) 예상 완료

2026-06-27 (토)
  └─ Phase 1C: Team 3 (Marketing) [Team 2 완료 후 시작]
      ├─ Soft-Delete 스키마 (1시간)
      ├─ API 변경 (1.5시간)
      ├─ 복구 API (1시간)
      ├─ 테스트 (1시간)
      └─ 커밋 (30분)
      └─> 2026-06-28 (일) 예상 완료

2026-06-28 (일)
  └─ 통합 테스트 (30분)
      ├─ Contact + Passport + Campaign 연계 확인
      ├─ 권한 검증 (조직별 격리)
      ├─ 감사로그 (모든 작업 기록)
      └─> 2026-06-28 (일) 완료
```

---

## ✅ Phase 1 완료 체크리스트

### Team 1 (Contact)
- [ ] Google OAuth 토큰 갱신 구현
- [ ] POST /api/backup/contacts/[id]/restore 동작
- [ ] ContactBackupRestoreLog 기록
- [ ] npx tsc --noEmit (0 에러)
- [ ] npm run test:backup-contact (모두 통과)

### Team 2 (Passport)
- [ ] 실제 파일 버퍼 적용 (더미X)
- [ ] 조직별 Google Drive 폴더 격리
- [ ] POST /api/backup/passport/[tripId]/restore 동작
- [ ] PassportBackupRestoreLog 기록
- [ ] npx tsc --noEmit (0 에러)
- [ ] npm run test:backup-passport (모두 통과)

### Team 3 (Marketing)
- [ ] Campaign.deletedAt 필드 추가
- [ ] DELETE → soft-delete PATCH 변경
- [ ] PATCH /campaigns/[id]/restore 동작
- [ ] 휴지통 조회 (관리자 전용)
- [ ] npx tsc --noEmit (0 에러)
- [ ] npm run test:backup-marketing (모두 통과)

### 통합
- [ ] 모든 soft-delete 권한 검증 일관성
- [ ] 모든 감사로그 필드 통일
- [ ] Cross-org 혼성 데이터 테스트 (보안)
- [ ] 성능 SLA 달성 (DB < 1초, Cron < 60초)

---

## 🚀 M3 병렬 마일스톤 시작 명령

```bash
# 1. 각 팀 worktree 생성
git worktree add .worktrees/team-1-contact main
git worktree add .worktrees/team-2-passport main
git worktree add .worktrees/team-3-marketing main

# 2. Team 1 시작
cd .worktrees/team-1-contact
npm run test:backup-contact

# 3. Team 1 완료 후, Team 2 시작
cd .worktrees/team-2-passport
npm run test:backup-passport

# 4. Team 2 완료 후, Team 3 시작
cd .worktrees/team-3-marketing
npm run test:backup-marketing

# 5. 통합 테스트
npm run test:backup-system
```

---

**작성일**: 2026-06-22  
**상태**: ✅ 병렬 마일스톤 즉시 시작 가능  
**예상 완료**: 2026-06-28  
**다음 Phase**: Phase 2 (PII 암호화, 2026-06-29 시작)
