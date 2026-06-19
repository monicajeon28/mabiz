# Passport Phase 3: Google Drive 백업 설정 가이드

## 개요
여권 파일(.webp)을 Google Drive에 자동 백업하는 시스템입니다.

- **WebP 변환**: 최적화된 이미지 포맷 (JPEG 대비 80% 크기 절감)
- **자동 백업**: Cron 작업으로 매일 자동 실행
- **폴더 구조**: `마비즈CRM-여권백업/2026-06/passport_*.webp`
- **보안**: Google OAuth 2.0, 암호화된 토큰

---

## 1. 설정 단계

### 1.1 Google Cloud 프로젝트 준비
```
1. Google Cloud Console: https://console.cloud.google.com
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. Google Drive API 활성화
   - API 라이브러리 → "Google Drive API" 검색
   - 활성화 클릭
4. OAuth 2.0 클라이언트 ID 생성
   - 사용자 인증 정보 → OAuth 동의 화면 구성
   - 승인된 리디렉션 URI:
     * 로컬: http://localhost:3000/api/auth/google/callback
     * 프로덕션: https://yourdomain.com/api/auth/google/callback
```

### 1.2 환경변수 설정
`.env.local` 또는 Vercel 대시보드에 다음 추가:

```env
# Google OAuth (기존)
GOOGLE_OAUTH_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Google Drive 백업 (신규)
GOOGLE_OAUTH_ACCESS_TOKEN=ya29.xxxx (여권 백업용 OAuth 토큰)

# Cron 보안
CRON_SECRET=your_random_cron_secret_key
```

### 1.3 Access Token 획득
```bash
# 1. Google OAuth 인증 페이지 접속
https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3000/api/auth/google/callback&response_type=code&scope=https://www.googleapis.com/auth/drive.file

# 2. 인증 후 code 획득
# 3. Access Token 교환
curl -X POST https://oauth2.googleapis.com/token \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=AUTH_CODE" \
  -d "redirect_uri=http://localhost:3000/api/auth/google/callback" \
  -d "grant_type=authorization_code"

# 4. 응답에서 access_token 복사
# 5. .env.local에 설정
```

### 1.4 Cron 설정 (Vercel)
```
1. Vercel 대시보드 → 프로젝트 → Settings → Cron Jobs
2. 새 Cron Job 추가:
   - Path: /api/cron/backup-passport
   - Cron Expression: 0 1 * * * (매일 01:00 UTC = 한국 10:00 AM)
   - HTTP Method: POST
   - Authorization Header: Bearer YOUR_CRON_SECRET
```

---

## 2. 폴더 구조

Google Drive에 다음 구조가 자동 생성됩니다:

```
📁 마비즈CRM-여권백업
  ├─ 📁 2026-06
  │  ├─ passport_20260619_kim_m12345678.webp
  │  ├─ passport_20260619_lee_m87654321.webp
  │  └─ ...
  ├─ 📁 2026-07
  │  └─ ...
  └─ ...
```

### 파일명 규칙
```
passport_{YYYYMMDD}_{NAME}_{PASSPORT_NUMBER}.webp

예시:
passport_20260619_kim_m12345678.webp
passport_20260619_lee_m87654321.webp
```

---

## 3. API 엔드포인트

### 3.1 Cron 작업 (자동 실행)
```
POST /api/cron/backup-passport

Header:
  Authorization: Bearer YOUR_CRON_SECRET

Response (성공):
{
  "ok": true,
  "message": "Passport backup completed: 10 successful, 2 failed, 1 deleted",
  "successCount": 10,
  "failureCount": 2,
  "deletedCount": 1,
  "processingTimeMs": 5234
}

Response (실패):
{
  "ok": false,
  "error": "Unauthorized"
}
```

### 3.2 수동 트리거 (개발용)
```bash
# 수동으로 Cron 작업 실행
curl -X POST http://localhost:3000/api/cron/backup-passport \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## 4. 데이터베이스 스키마

### 4.1 GmPassportSubmissionGuest (기존 모델 확장)
```sql
-- 신규 필드
ALTER TABLE "PassportSubmissionGuest" ADD COLUMN "googleDriveFileId" TEXT;
ALTER TABLE "PassportSubmissionGuest" ADD COLUMN "lastBackupAt" TIMESTAMP;
ALTER TABLE "PassportSubmissionGuest" ADD COLUMN "backupStatus" TEXT DEFAULT 'pending';
  -- 값: pending / success / failed

-- 신규 인덱스
CREATE INDEX "PassportSubmissionGuest_backupStatus_idx" ON "PassportSubmissionGuest"("backupStatus");
```

### 4.2 PassportBackupLog (새 모델)
```sql
CREATE TABLE "PassportBackupLog" (
  "id" SERIAL PRIMARY KEY,
  "guestId" INTEGER NOT NULL,          -- GmPassportSubmissionGuest.id
  "googleDriveFileId" TEXT,             -- Google Drive 파일 ID
  "backupTime" TIMESTAMP DEFAULT NOW(), -- 백업 시간
  "status" TEXT NOT NULL,               -- success / failed
  "errorMessage" TEXT,                  -- 실패 시 에러 메시지
  "retryCount" INTEGER DEFAULT 0,       -- 재시도 횟수
  "createdAt" TIMESTAMP DEFAULT NOW()   -- 로그 생성 시간
);

-- 인덱스
CREATE INDEX "PassportBackupLog_status_idx" ON "PassportBackupLog"("status");
CREATE INDEX "PassportBackupLog_guestId_idx" ON "PassportBackupLog"("guestId");
CREATE INDEX "PassportBackupLog_createdAt_idx" ON "PassportBackupLog"("createdAt");
```

---

## 5. 에러 처리

### 5.1 재시도 로직
- **최대 재시도**: 3회
- **지수 백오프**: 1초 → 2초 → 4초
- **타임아웃**: 30초

### 5.2 실패 처리
- DB에 `backupStatus = 'failed'` 저장
- `PassportBackupLog`에 에러 메시지 기록
- Cron 다음 실행 시 자동 재시도

### 5.3 권한 오류
```
Error: "GOOGLE_OAUTH_ACCESS_TOKEN not set"
→ 환경변수 설정 확인

Error: "Google Drive 폴더 생성 실패"
→ Google OAuth 토큰 만료 또는 권한 부족
→ 새 토큰으로 교체 필요
```

---

## 6. 성능 목표

| 항목 | 목표 | 실제 |
|------|------|------|
| 파일 크기 절감 | 80% | (sharp WebP 변환) |
| 업로드 성공률 | >95% | (3회 재시도) |
| Cron 실행 시간 | <10초 | (100개 게스트 기준) |
| 1년 파일 삭제율 | 100% | (매일 Cron) |

---

## 7. 모니터링

### 7.1 로그 확인
```
Vercel Functions → Logs 탭
[Cron] Backup Passport - 시작
[Cron] Backup Passport - 성공: kim (fileId: 1a2b3c4d5e6f7g8h)
[Cron] Backup Passport - 완료: 10 성공, 2 실패, 1 삭제
```

### 7.2 DB 쿼리
```sql
-- 최근 백업 상태
SELECT status, COUNT(*) as count FROM "PassportBackupLog"
WHERE createdAt > NOW() - INTERVAL '24 hours'
GROUP BY status;

-- 백업 실패 상세
SELECT guestId, errorMessage FROM "PassportBackupLog"
WHERE status = 'failed' AND createdAt > NOW() - INTERVAL '1 day'
ORDER BY createdAt DESC;

-- 미백업 게스트
SELECT id, name FROM "PassportSubmissionGuest"
WHERE backupStatus = 'pending' AND submittedAt IS NOT NULL
ORDER BY submittedAt DESC;
```

---

## 8. 보안 고려사항

### 8.1 토큰 보관
- Access Token은 환경변수로 관리
- GitHub에 커밋 금지
- 정기적으로 갱신 (매 90일)

### 8.2 파일 권한
- Google Drive 폴더 공개 범위: 조직만
- 백업 파일 직접 접근 불가
- Admin 대시보드에서만 다운로드 가능

### 8.3 Cron 보안
- `CRON_SECRET` Authorization 헤더 필수
- Vercel Cron Job에서만 호출 허용
- IP 화이트리스트 (선택사항)

---

## 9. 구현 체크리스트

- [ ] Google Cloud 프로젝트 설정
- [ ] OAuth 2.0 인증 정보 생성
- [ ] Access Token 획득 및 환경변수 설정
- [ ] Prisma 마이그레이션 실행 (`npx prisma migrate deploy`)
- [ ] `src/lib/passport-google-drive-backup.ts` 라이브러리 확인
- [ ] `src/app/api/cron/backup-passport/route.ts` API 확인
- [ ] Vercel Cron Job 설정
- [ ] 수동 테스트: `curl -X POST http://localhost:3000/api/cron/backup-passport -H "Authorization: Bearer YOUR_SECRET"`
- [ ] 실제 파일 업로드 테스트 (고객 여권 제출)
- [ ] Google Drive 폴더 구조 확인
- [ ] PassportBackupLog 데이터 확인
- [ ] 에러 로그 모니터링

---

## 10. 자주 묻는 질문

### Q1: 기존 파일도 백업되나요?
A: 아니요. Cron 작업은 24시간 내에 `submittedAt` 값을 가진 게스트만 백업합니다.
기존 파일 대량 백업이 필요하면 별도 스크립트 실행이 필요합니다.

### Q2: 백업 파일이 손상되면?
A: 3회 자동 재시도 로직이 작동합니다. 계속 실패하면 `PassportBackupLog`의 `errorMessage`를 확인하세요.

### Q3: Google Drive 용량이 초과되면?
A: 1년 이상된 파일은 자동 삭제됩니다. 추가 용량이 필요하면 Google Drive 계획 업그레이드가 필요합니다.

### Q4: Access Token이 만료되면?
A: Cron 작업 실패 로그에 "Google Drive 폴더 생성 실패" 메시지가 표시됩니다.
새 토큰으로 갱신하고 환경변수를 업데이트하세요.

---

**마지막 업데이트**: 2026-06-19
**버전**: Passport Phase 3 v1.0
