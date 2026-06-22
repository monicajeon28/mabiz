# Phase 1C M2-5: 여권 백업 파일 마이그레이션 작업지시서

**목표**: 기존 평면 폴더 구조(2026-06/) → Trip별 계층 구조(Org-{orgId}/Trip-{tripId}) 마이그레이션

**시작**: 2026-07-04  
**예상 시간**: 1일  
**담당**: Agent-Passport  
**의존성**: M2-1~M2-4 완료 후  

---

## 📋 마이그레이션 개요

### 현재 상태 (M1)
```
마비즈CRM-여권백업/
├── 2026-06/
│   ├── passport_20260619_kim_m12345678.webp
│   ├── guest-1-여권.webp
│   ├── guest-1-ocr.json
│   └── ... (평면 구조)
└── 2026-07/
    └── ...
```

### 목표 상태 (M2-5)
```
마비즈CRM-여권백업/
├── Org-123-abc/
│   ├── Trip-1/
│   │   ├── 여권이미지/
│   │   │   ├── guest-1.webp
│   │   │   └── guest-2.webp
│   │   └── OCR데이터/
│   │       ├── guest-1.json
│   │       └── guest-2.json
│   └── Trip-2/
│       └── ...
└── Org-456-def/
    └── Trip-3/
        └── ...
```

---

## 🛠️ 실행 단계

### Step 1: 마이그레이션 스크립트 준비

**파일**: `scripts/migrate-passport-files-to-trips.mjs`

**스크립트 기능**:
- ✅ 모든 `GmPassportSubmissionGuest` (backup status = 'success') 조회
- ✅ Trip별로 그룹화
- ✅ Trip마다 Trip 폴더 생성 (Org-{orgId}/Trip-{tripId})
- ✅ 여권이미지, OCR데이터 서브폴더 생성
- ✅ 기존 파일 이동 + 이름 변경
- ✅ 진행 상황 실시간 로깅
- ✅ 오류 처리 + 재시도 불가능한 항목 스킵

**마이그레이션 로직**:
```typescript
1. 모든 guests 조회 (backupStatus = 'success')
   ↓
2. Trip별로 그룹화
   ↓
3. 각 Trip마다:
   a. organizationId 조회 (OrganizationMember 통해)
   b. Trip 폴더 생성: Org-{orgId}/Trip-{tripId}
   c. 서브폴더 생성: 여권이미지/, OCR데이터/
   ↓
4. 각 guest 파일:
   a. 이미지 파일 이동 + 이름변경: guest-{id}.webp
   b. OCR 파일 이동 + 이름변경: guest-{id}.json
   c. DB 업데이트 (선택사항)
   ↓
5. 최종 리포트: 성공/실패/스킵 통계
```

---

### Step 2: 환경 변수 확인

마이그레이션 전 `.env.local`에 다음이 설정되어 있는지 확인:

```bash
# Google OAuth 설정
GOOGLE_OAUTH_CLIENT_ID=your-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/auth/google/callback
GOOGLE_OAUTH_ACCESS_TOKEN=ya29.xxx...  # 최신 accessToken

# Prisma
DATABASE_URL=postgresql://...
```

**AccessToken 갱신** (필요시):
```bash
# Google OAuth 페이지에서 새 액세스 토큰 발급
# https://accounts.google.com/o/oauth2/v2/auth?...

# 또는 existing refresh token 사용하여 갱신
node -e "
const { google } = require('googleapis');
const oauth2Client = new google.auth.OAuth2(...);
oauth2Client.setCredentials({ refresh_token: 'your-refresh-token' });
oauth2Client.refreshAccessToken().then(res => {
  console.log('New Access Token:', res.credentials.access_token);
});
"
```

---

### Step 3: 로컬 테스트 (드라이런)

```bash
# 1. dev 서버 실행 (선택사항 - Prisma 타입만 필요)
npm run dev &

# 2. 스크립트 실행 (로컬)
cd D:\mabiz-crm
dotenv -e .env.local node scripts/migrate-passport-files-to-trips.mjs
```

**예상 출력**:
```
🚀 마이그레이션 시작: 평면 폴더 → Trip별 계층
========================================

✅ 총 NNN명의 guest 발견

📋 Trip-1: 15명 처리 시작
  ℹ️  organizationId: org-abc-123
  ✓ Trip 폴더 조회: folder-id-xyz
  ✓ 여권이미지 폴더 생성
  ✓ OCR데이터 폴더 생성
    ✓ 게스트 1 이미지 파일 이동: guest-1.webp
    ✓ 게스트 1 OCR 파일 이동: guest-1.json
    ✓ 게스트 2 이미지 파일 이동: guest-2.webp
    ...
  ✅ Trip-1 마이그레이션 완료 (15명)

📋 Trip-2: 10명 처리 시작
  ...

==================================================
📊 마이그레이션 완료:
   ✅ 성공: NNN명
   ❌ 실패: N명
   ⏭️  스킵: N명
   🎯 총: NNN명
==================================================
```

---

### Step 4: 검증 체크리스트

#### 4.1 스크립트 실행 검증

- [ ] 스크립트 정상 종료 (exit code = 0)
- [ ] 성공 게스트 수 = 예상 게스트 수 (실패 + 스킵 = 0)
- [ ] 로그에 Trip별 폴더 생성 메시지 확인

#### 4.2 Google Drive 폴더 구조 검증

**매뉴얼 확인**:

1. Google Drive 열기
2. "마비즈CRM-여권백업" 폴더 확인
3. 다음 구조 존재 확인:
   ```
   ✅ Org-org-abc-123/
      ✅ Trip-1/
         ✅ 여권이미지/ (WebP 파일 N개)
         ✅ OCR데이터/ (JSON 파일 N개)
      ✅ Trip-2/
         ...
   ✅ Org-org-def-456/
      ✅ Trip-3/
         ...
   ```

4. 파일명 확인:
   - ✅ 여권이미지: `guest-1.webp`, `guest-2.webp`, ...
   - ✅ OCR데이터: `guest-1.json`, `guest-2.json`, ...

#### 4.3 DB 검증

```bash
# Prisma Studio 열기
npx prisma studio

# GmTripGoogleDriveConfig 조회
# - tripId: 마이그레이션된 모든 trip 확인
# - googleFolderId: NULL이 아님
# - googleFolderName: Trip-{tripId} 형식
# - deletedAt: NULL
```

**SQL로 검증** (선택):
```sql
-- GmTripGoogleDriveConfig 통계
SELECT COUNT(*) as total, COUNT(CASE WHEN "googleFolderId" IS NOT NULL THEN 1 END) as with_folder
FROM "TripGoogleDriveConfig"
WHERE "deletedAt" IS NULL;

-- 예상: total = with_folder (마이그레이션 완료)
```

#### 4.4 파일 다운로드 테스트

**복구 기능 테스트** (M3 준비):

1. Google Drive에서 임의 파일 우클릭 → "다운로드"
2. 파일 정상 다운로드 확인
3. 파일 손상 없음 (WebP 이미지 뷰어로 열기)

---

### Step 5: 문제 해결

#### 문제 1: `GOOGLE_OAUTH_ACCESS_TOKEN` 토큰 만료

**증상**: "Google Drive 폴더 생성 실패" 또는 "Unauthorized"

**해결**:
```bash
# 1. .env.local의 GOOGLE_OAUTH_ACCESS_TOKEN 갱신
# 2. Google OAuth 콘솔에서 새 토큰 발급
# 3. 스크립트 재실행
```

#### 문제 2: "organizationId 조회 실패"

**증상**: Trip의 organizationId를 찾을 수 없음 → fallback: `USER_{tripId}`

**원인**: GmUser가 OrganizationMember에 등록되지 않은 개별 사용자 시스템

**해결**:
- 이는 정상 동작 (fallback 메커니즘)
- "USER_{tripId}" 폴더가 생성되면 조직 구분 불가
- 관리자가 수동으로 폴더 정리 필요 (선택사항)

#### 문제 3: "파일 이동 실패"

**증상**: 특정 파일이 이동되지 않음

**원인**:
- Google Drive API Rate Limit 초과
- 파일 권한 부족 (공유 파일)
- 파일이 이미 삭제됨

**해결**:
- 스크립트 재실행 (자동 재시도 없음, 수동 재시작 필요)
- 실패한 파일 ID 로그에서 확인 후 수동 이동

#### 문제 4: 스크립트 중단

**증상**: 실행 중 프로세스 종료

**원인**: Prisma 연결 해제, 메모리 부족, 네트워크 오류

**해결**:
```bash
# 1. DB 연결 확인
echo $DATABASE_URL  # 또는 .env.local 확인

# 2. 메모리 모니터링
# - Google Drive API 병렬 요청 제한 없음 (한 번에 1개씩 처리)
# - 메모리 사용량 정상 (< 200MB)

# 3. 스크립트 재실행
dotenv -e .env.local node scripts/migrate-passport-files-to-trips.mjs
```

---

## 📊 기대 효과

| 지표 | M1 | M2 |
|------|-------|-------|
| **폴더 구조** | 평면 (2026-06/) | 계층 (Org/Trip) |
| **권한 격리** | 조직 레벨 없음 | Trip 레벨 격리 |
| **검색 성능** | O(n) 평면 검색 | O(log n) 계층 검색 |
| **확장성** | 년월별 자동 분류 | 조직/Trip별 완전 격리 |
| **백업 복구** | 전체 다운로드만 가능 | Trip별 선택 다운로드 |

---

## 🔄 롤백 계획 (긴급)

마이그레이션 실패 시 롤백 가능 (Google Drive 원본 파일 유지되므로):

```bash
# 1. 스크립트 중단 (Ctrl+C)
# 2. GmTripGoogleDriveConfig 일부만 생성됨 (문제 없음)
# 3. Google Drive 폴더 삭제 (매뉴얼)
# 4. 스크립트 재실행
```

---

## ✅ 최종 커밋

마이그레이션 완료 후:

```bash
# 1. 스크립트 파일 확인
git status

# 2. 커밋
git add scripts/migrate-passport-files-to-trips.mjs
git commit -m "feat(backup-passport-m2-5): 파일 마이그레이션 (평면→Trip 계층)

- scripts/migrate-passport-files-to-trips.mjs 추가
- 평면 구조 파일 → Org-{orgId}/Trip-{tripId}/파일타입 이동
- organizationId 자동 조회 (OrganizationMember 통해)
- Google Drive 폴더 계층 자동 생성
- 마이그레이션 상태: 성공 NNN명 / 실패 N명 / 스킵 N명
- M3 Restore API 준비 완료

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"

# 3. 푸시 (선택사항 - 사용자 결정)
# git push origin main
```

---

## 📈 다음 단계

**M2-5 완료 후**:

1. **M3: Restore API 권한 격리** (1-2일)
   - Trip 폴더에서 파일 다운로드 API
   - organizationId + Trip 권한 검증

2. **M4: OCR 백업 통합** (1일)
   - Vision API 결과를 Trip 폴더에 자동 저장
   - Ebbinghaus 망각곡선 기반 OCR 재실행 스케줄

3. **M5: 부하 테스트** (1-2일)
   - 1,000명 동시 Cron 실행
   - 메모리/API Rate Limit 검증
   - 성능 최적화

---

## 🔐 보안 체크리스트

- [ ] GOOGLE_OAUTH_ACCESS_TOKEN 환경변수만 사용 (하드코딩 금지)
- [ ] 스크립트 완료 후 TOKEN 변경 (보안 고려)
- [ ] Google Drive 폴더 권한: 관리자만 접근
- [ ] 스크립트 실행 후 `.env.local` 파일 접근 제한

---

**버전**: Phase 1C M2-5 Work Directive V1  
**작성**: 무한루프 절대법칙 거장단  
**최종 검토**: M2-5 완료 후 재검토  

