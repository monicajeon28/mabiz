# Contact 백업 시스템 환경변수 설정 (Phase 1A)

## 개요
Contact 백업 Google Drive 토큰 갱신 + 복구 API 구현을 위한 환경변수 설정 가이드

---

## 필수 환경변수

### 1. Google OAuth 설정 (기존)
```
GOOGLE_OAUTH_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_OAUTH_REDIRECT_URI=https://your-domain.com/api/auth/callback
```

### 2. Contact 백업용 마스터 Refresh Token (신규)
```
GOOGLE_OAUTH_REFRESH_TOKEN_CONTACT=1//xxxxx...
```

**설정 방법:**
- Google OAuth 인증 플로우에서 발급받은 refresh_token
- `/api/auth/google-callback` 또는 수동 인증으로 획득
- DB에 저장되는 조직별 accessToken과 별개 (마스터 토큰)

### 3. Cron 인증
```
CRON_SECRET=your-random-secret-token-min-32-chars
```

### 4. Slack 알림 (선택사항)
```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX
```

**설정 방법:**
- Slack 워크스페이스 > 설정 > 앱 및 통합
- Incoming Webhooks 앱 추가 후 URL 복사

### 5. PII 암호화용 마스터 키 (Phase 2)
```
ENCRYPTION_MASTER_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

**생성 방법:**
```bash
# Node.js에서 실행
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Vercel 배포 설정

### 1. 환경변수 등록
```bash
vercel env add GOOGLE_OAUTH_REFRESH_TOKEN_CONTACT
vercel env add CRON_SECRET
vercel env add SLACK_WEBHOOK_URL
vercel env add ENCRYPTION_MASTER_KEY
```

### 2. vercel.json에 Cron 추가
```json
{
  "crons": [
    {
      "path": "/api/cron/contact-token-refresh",
      "schedule": "0 6 * * *"
    }
  ]
}
```

**스케줄:**
- `0 6 * * *`: 매일 06:00 UTC (한국시간 15:00)
- TTL: 55분 (Vercel 최대 타임아웃 60초)

---

## DB 마이그레이션

### ContactBackupRestoreLog 테이블 생성
```bash
# 1. 스키마 적용
npx prisma migrate dev --name add_contact_backup_restore_log

# 2. 스키마 생성 (기존 DB에만 적용)
npx prisma generate
```

**스키마:**
```prisma
model ContactBackupRestoreLog {
  id             String       @id @default(cuid())
  organizationId String
  contactId      String
  backupId       String?
  restoredBy     String
  restoredByName String?
  restoredAt     DateTime     @default(now())
  status         String       @default("SUCCESS")
  errorMessage   String?
  restoredFields String?

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  contact      Contact      @relation("BackupRestoreLogs", fields: [contactId], references: [id], onDelete: Cascade)

  @@index([organizationId, restoredAt(sort: Desc)])
  @@index([contactId])
  @@index([status])
}
```

---

## API 엔드포인트

### 1. 토큰 갱신 (Cron)
```
GET /api/cron/contact-token-refresh
Headers: Authorization: Bearer {CRON_SECRET}
```

**응답:**
```json
{
  "ok": true,
  "message": "Contact 백업 토큰 갱신 완료",
  "results": {
    "success": 3,
    "failed": 0,
    "skipped": 1,
    "organizations": [
      {
        "id": "org-1",
        "name": "마비즈",
        "status": "SUCCESS"
      }
    ]
  }
}
```

### 2. Contact 복구
```
POST /api/backup/contacts/{contactId}/restore
Headers: Authorization: Bearer {USER_SESSION_TOKEN}
Body: {
  "fields": ["phone", "email"],  // 선택사항
  "backupId": "backup-id"         // 선택사항
}
```

**응답:**
```json
{
  "ok": true,
  "message": "Contact 복구 완료",
  "data": {
    "contact": {
      "id": "contact-1",
      "name": "홍길동",
      "phone": "010-1234-5678",
      "email": "user@example.com",
      "updatedAt": "2026-06-22T15:00:00Z"
    },
    "restoreLog": {
      "id": "log-1",
      "restoredAt": "2026-06-22T15:00:00Z",
      "restoredFields": "[\"deletedAt\", \"deletedBy\", \"deletedByName\"]"
    }
  }
}
```

### 3. 복구 이력 조회
```
GET /api/backup/contacts/{contactId}/restore/logs?limit=20&offset=0
Headers: Authorization: Bearer {USER_SESSION_TOKEN}
```

---

## 테스트

### 로컬 테스트
```bash
# 1. 환경변수 설정
export GOOGLE_OAUTH_CLIENT_ID="..."
export GOOGLE_OAUTH_CLIENT_SECRET="..."
export GOOGLE_OAUTH_REDIRECT_URI="http://localhost:3000/api/auth/callback"
export GOOGLE_OAUTH_REFRESH_TOKEN_CONTACT="1//..."
export CRON_SECRET="test-secret"
export SLACK_WEBHOOK_URL="https://..."

# 2. dev 서버 시작
npm run dev

# 3. 수동 Cron 테스트
curl -H "Authorization: Bearer test-secret" http://localhost:3000/api/cron/contact-token-refresh

# 4. 복구 API 테스트
curl -X POST http://localhost:3000/api/backup/contacts/{contactId}/restore \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"fields": ["phone"]}'
```

### 프로덕션 테스트
```bash
# Vercel 원격 환경에서 Cron 수동 실행
vercel env pull
curl -H "Authorization: Bearer {CRON_SECRET}" \
  https://your-domain.com/api/cron/contact-token-refresh
```

---

## 보안 체크리스트

- [ ] GOOGLE_OAUTH_REFRESH_TOKEN_CONTACT 환경변수 암호화 저장
- [ ] CRON_SECRET 최소 32자 이상 난수 사용
- [ ] Slack Webhook URL 보안 설정 (필요시 채널 제한)
- [ ] DB RLS (Row-Level Security) 활성화
  - ContactBackupRestoreLog: `organizationId` 기반 격리
  - Contact: 기존 RLS 유지
- [ ] API 권한 검증
  - POST /api/backup/contacts/[id]/restore: OWNER/ADMIN만
  - GET /api/cron/contact-token-refresh: CRON_SECRET Bearer 토큰만

---

## Phase 2 준비 (PII 암호화)

### 마이그레이션 계획
1. ENCRYPTION_MASTER_KEY 환경변수 설정
2. Contact 테이블에 암호화된 필드 추가
   - `phoneEncrypted`, `emailEncrypted` 등
3. 기존 평문 데이터 마이그레이션
4. 애플리케이션 코드 업데이트

### 암호화 표준
- 알고리즘: AES-256-GCM
- Salt: 16 bytes
- IV: 16 bytes (매번 새로 생성)
- 키 유도: PBKDF2 (SHA-256, 100,000 iterations)

---

**작성일**: 2026-06-22  
**업데이트**: Team 1 구현 완료 후 추가 업데이트  
**담당자**: Team 1 (Contact Backup)
